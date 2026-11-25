package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.common.validation.VietnamPhones;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.SaveTenant;
import com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.Created;
import com.thangit.boardinghouse.repository.AdminTenantRepository;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

/** Direct drafts share the existing contract, onboarding, room guard and deposit ledger. */
@Service
public class DirectContractService {
    private AccountProvisioningService provisioning;private ContractDeliveryService delivery;
    @org.springframework.beans.factory.annotation.Autowired
    public void contractWorkflow(AccountProvisioningService provisioning,ContractDeliveryService delivery){this.provisioning=provisioning;this.delivery=delivery;}
    public record NewTenant(@NotBlank @Size(max=150) String fullName,
            @NotBlank @Pattern(regexp=VietnamPhones.REGEX) String phone,
            @Email @Size(max=255) String email, LocalDate dateOfBirth,
            @Pattern(regexp="^$|[0-9]{9}|[0-9]{12}") String identityNumber,
            @Size(max=500) String permanentAddress,
            @Size(max=150) String emergencyContactName,
            @Pattern(regexp=VietnamPhones.OPTIONAL_REGEX) String emergencyContactPhone) {}
    public record Request(@NotNull @Positive Long roomId, @Positive Long tenantProfileId,
            @Valid NewTenant newTenant, @NotNull @Valid CreateContract terms,
            @NotNull LocalDate expectedCheckinDate, @Size(max=2000) String note, boolean submit) {}
    private final JdbcClient db;
    private final RoomLifecycleGuard rooms;
    private final ContractOnboardingService onboarding;
    private final AdminTenantRepository tenants;
    public DirectContractService(JdbcClient db,RoomLifecycleGuard rooms,ContractOnboardingService onboarding,AdminTenantRepository tenants) {
        this.db=db; this.rooms=rooms; this.onboarding=onboarding; this.tenants=tenants;
    }
    private AuthException invalid(String code,String message) {return new AuthException(HttpStatus.CONFLICT,code,message);}
    private void access(AuthenticatedUser p,long property) {
        rooms.access(p,property);
        if(p.activeRole()==RoleCode.MANAGER)rooms.capability(p,property,PropertyAuthorization.Capability.CONTRACT_APPROVE);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> options(AuthenticatedUser p,Long property,String keyword) {
        if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"CONTRACT_ACCESS_DENIED","Không có quyền lập hợp đồng.");
        var properties=db.sql("SELECT p.id,p.name,p.address,u.full_name owner_name FROM properties p JOIN users u ON u.id=p.owner_id WHERE p.status='ACTIVE' AND "+scope(p,"p")+" ORDER BY p.name").param("user",p.id()).query().listOfRows();
        if(property==null)return Map.of("properties",properties,"rooms",List.of(),"tenants",List.of(),"services",List.of());
        access(p,property);
        var roomRows=db.sql("SELECT id,code,building_name,floor_name,area,monthly_rent,capacity,status FROM rooms WHERE property_id=:p ORDER BY code").param("p",property).query().listOfRows();
        var tenantRows=db.sql("SELECT tp.id,tp.tenant_code,tp.full_name,tp.phone,tp.email,(tp.user_id IS NOT NULL) has_account FROM tenant_profiles tp WHERE (tp.management_property_id=:p OR EXISTS(SELECT 1 FROM tenant_residences tr WHERE tr.tenant_profile_id=tp.id AND tr.property_id=:p)) AND (LOWER(tp.full_name) LIKE :q OR tp.phone LIKE :q OR LOWER(COALESCE(tp.email,'')) LIKE :q OR LOWER(tp.tenant_code) LIKE :q) ORDER BY tp.full_name LIMIT 30").param("p",property).param("q","%"+(keyword==null?"":keyword.trim().toLowerCase())+"%").query().listOfRows();
        // Policies are suggestions only. The agreement stores its own immutable rates.
        var services=new PropertyServiceCatalogService(db).items(property).stream().filter(x->"ACTIVE".equals(x.get("status"))).toList();
        return Map.of("properties",properties,"rooms",roomRows,"tenants",tenantRows,"services",services);
    }
    private String scope(AuthenticatedUser p,String a){return p.activeRole()==RoleCode.OWNER?a+".owner_id=:user":"EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id="+a+".id AND pm.manager_id=:user)";}
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Created create(AuthenticatedUser p,String key,Request r) {
        if(key==null||key.isBlank()||key.length()>100)throw invalid("IDEMPOTENCY_KEY_REQUIRED","Cần mã yêu cầu hợp lệ.");
        if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"CONTRACT_ACCESS_DENIED","Không có quyền lập hợp đồng.");
        // Room first, as in booking/check-in; then serialize this actor's idempotency keys.
        var room=rooms.lockRoom(r.roomId());long property=((Number)room.get("property_id")).longValue();access(p,property);
        db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",p.id()).query(Long.class).single();
        String hash=fingerprint(r);
        var replay=db.sql("SELECT request_hash,contract_id FROM contract_creation_requests WHERE actor_id=:actor AND request_key=:key FOR UPDATE").param("actor",p.id()).param("key",key).query(DirectContractService::row).optional();
        if(replay.isPresent()) {
            if(!hash.equals(replay.get().get("request_hash")))throw invalid("IDEMPOTENCY_CONFLICT","Mã yêu cầu đã dùng với nội dung khác.");
            return created(((Number)replay.get().get("contract_id")).longValue());
        }
        if((r.tenantProfileId()==null)==(r.newTenant()==null))throw invalid("TENANT_SELECTION_REQUIRED","Chọn hồ sơ có sẵn hoặc thêm một người thuê mới.");
        var terms=r.terms();
        if(terms.reservationTransferAmount()!=null&&terms.reservationTransferAmount().signum()!=0)throw invalid("DIRECT_RESERVATION_INVALID","Hợp đồng trực tiếp không có tiền giữ chỗ để chuyển.");
        if(r.expectedCheckinDate().isBefore(terms.startDate())||!r.expectedCheckinDate().isBefore(terms.endDate()))throw invalid("CHECKIN_DATE_INVALID","Ngày dự kiến nhận phòng phải nằm trong thời hạn thuê.");
        Long legacy=rooms.directContract(r.roomId(),terms.startDate(),terms.endDate(),null,r.tenantProfileId());
        long profile=r.tenantProfileId()==null?newProfile(r.newTenant(),property,p.id()):r.tenantProfileId();
        if(!tenants.canAccessTenant(p.id(),p.activeRole(),profile)||!db.sql("SELECT EXISTS(SELECT 1 FROM tenant_profiles tp WHERE tp.id=:id AND (tp.management_property_id=:p OR EXISTS(SELECT 1 FROM tenant_residences tr WHERE tr.tenant_profile_id=tp.id AND tr.property_id=:p)))").param("id",profile).param("p",property).query(Boolean.class).single())throw new AuthException(HttpStatus.FORBIDDEN,"TENANT_SCOPE_DENIED","Hồ sơ không thuộc nhà trọ đã chọn.");
        var person=db.sql("SELECT user_id FROM tenant_profiles WHERE id=:id FOR UPDATE").param("id",profile).query().singleRow();
        var params=new HashMap<String,Object>();
        params.put("room",r.roomId());params.put("profile",profile);params.put("code","HD-"+UUID.randomUUID());
        params.put("start",terms.startDate());params.put("end",terms.endDate());params.put("deposit",terms.depositAmount());
        params.put("rent",terms.monthlyRent()==null?room.get("monthly_rent"):terms.monthlyRent());
        params.put("due",terms.paymentDueDay());params.put("notice",terms.noticePeriodDays());params.put("initial",terms.initialPaymentRequired());
        params.put("user",person.get("user_id"));params.put("checkin",r.expectedCheckinDate());params.put("note",r.note());
        long id=insert("INSERT INTO contracts(room_id,tenant_id,tenant_profile_id,code,start_date,end_date,original_end_date,deposit_amount,status,agreed_monthly_rent,payment_due_day,notice_period_days,initial_payment_required,creation_source,expected_checkin_date,note) VALUES(:room,:user,:profile,:code,:start,:end,:end,:deposit,'DRAFT',:rent,:due,:notice,:initial,'DIRECT',:checkin,:note)",params);
        // Reuse snapshot/assets/utility/service initialization from the booking path.
        db.sql("UPDATE contracts SET legacy_residence_id=:legacy WHERE id=:id").param("legacy",legacy).param("id",id).update();
        onboarding.initialize(id,terms,p.id());
        db.sql("INSERT INTO contract_creation_requests(actor_id,request_key,request_hash,contract_id) VALUES(:a,:k,:h,:id)").param("a",p.id()).param("k",key).param("h",hash).param("id",id).update();
        new SecurityAudit(db).record(p.id(),"DIRECT_CONTRACT_DRAFT_CREATED","CONTRACT",id,"SUCCESS","Direct draft; no booking, occupancy or payment created");
        if(r.submit())submit(p,id);
        return created(id);
    }
    private long newProfile(NewTenant n,long property,long actor) {
        db.sql("SELECT id FROM roles WHERE code='TENANT' FOR UPDATE").query(Long.class).single();
        var phones=VietnamPhones.aliases(n.phone());
        if(phones.stream().anyMatch(phone->tenants.profilePhoneExists(phone,null))||(n.email()!=null&&!n.email().isBlank()&&tenants.profileEmailExists(n.email().trim(),null))||(n.identityNumber()!=null&&!n.identityNumber().isBlank()&&tenants.profileIdentityExists(n.identityNumber().trim(),null)))throw invalid("TENANT_ALREADY_EXISTS","Thông tin đã có hồ sơ; tìm và chọn hồ sơ hiện có hoặc liên hệ chủ nhà.");
        if(n.dateOfBirth()!=null&&n.dateOfBirth().isAfter(com.thangit.boardinghouse.service.BusinessTime.today()))throw invalid("TENANT_BIRTH_DATE_INVALID","Ngày sinh không hợp lệ.");
        long id=tenants.createProfile(new SaveTenant(n.fullName(),n.dateOfBirth(),null,phones.getFirst(),n.email(),n.permanentAddress(),null,null,null,n.emergencyContactName(),n.emergencyContactPhone(),n.identityNumber()==null?null:"CCCD",n.identityNumber(),null,null,null,property,null,null,null,"REPRESENTATIVE"),actor);
        tenants.createResidence(id,property,null,null,null,"REPRESENTATIVE",actor);
        return id;
    }
    @Transactional(readOnly=true)
    public Map<String,Object> draft(AuthenticatedUser p,long id) {
        return editable(p,id,false);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> agreement(AuthenticatedUser p,long id){return editable(p,id,true);}
    private Map<String,Object> editable(AuthenticatedUser p,long id,boolean pending) {
        var c=db.sql("SELECT c.*,r.property_id FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE c.id=:id").param("id",id).query(DirectContractService::row).optional().orElseThrow(()->invalid("CONTRACT_NOT_FOUND","Không tìm thấy hợp đồng."));
        access(p,((Number)c.get("property_id")).longValue());
        if(!"DIRECT".equals(c.get("creation_source"))||!(pending?"PENDING_CONFIRMATION":"DRAFT").equals(c.get("status")))throw invalid("CONTRACT_NOT_DRAFT","Chỉ sửa hợp đồng trực tiếp đang ở đúng giai đoạn nháp/chờ xác nhận.");
        var rates=db.sql("SELECT * FROM contract_utility_rates WHERE contract_id=:id ORDER BY code").param("id",id).query((rs,n)->new AgreedRate(rs.getString("code"),rs.getString("name"),rs.getString("calculation_method"),rs.getBigDecimal("unit_price"),rs.getString("unit"))).list();
        var services=db.sql("SELECT * FROM contract_services WHERE contract_id=:id ORDER BY id").param("id",id).query((rs,n)->rs.getInt("snapshot_version")==0?new AgreedService(rs.getString("code"),rs.getString("name"),rs.getString("calculation_method"),rs.getBigDecimal("unit_price")):new AgreedService(rs.getString("code"),rs.getString("name"),rs.getString("calculation_method"),rs.getBigDecimal("unit_price"),rs.getObject("catalog_service_id")==null?null:rs.getLong("catalog_service_id"),rs.getString("description"),rs.getString("unit"),rs.getBigDecimal("quantity"),rs.getString("billing_cycle"),rs.getObject("effective_date",LocalDate.class),rs.getObject("end_date",LocalDate.class),rs.getString("status"),rs.getString("note"),rs.getBoolean("prorate"))).list();
        var terms=db.sql("SELECT * FROM contract_terms WHERE contract_id=:id ORDER BY id").param("id",id).query((rs,n)->new AgreedTerm(rs.getString("title"),rs.getString("content"))).list();
        var agreement=new CreateContract(RoomLifecycleGuard.date(c.get("start_date")),RoomLifecycleGuard.date(c.get("end_date")),(BigDecimal)c.get("deposit_amount"),((Number)c.get("payment_due_day")).intValue(),((Number)c.get("notice_period_days")).intValue(),BigDecimal.ZERO,(BigDecimal)c.get("agreed_monthly_rent"),rates,services,terms,Boolean.TRUE.equals(c.get("initial_payment_required")));
        var person=db.sql("SELECT id,tenant_code,full_name,phone,email,(user_id IS NOT NULL) has_account FROM tenant_profiles WHERE id=:id").param("id",c.get("tenant_profile_id")).query().singleRow();
        String hash=db.sql("SELECT content_hash FROM contract_versions WHERE contract_id=:id AND version=:v").param("id",id).param("v",c.get("onboarding_version")).query(String.class).single();
        return Map.of("status",c.get("status"),"contentHash",hash,"serviceEstimate",new PropertyServiceCatalogService(db).estimate(id),"propertyId",c.get("property_id"),"tenant",person,"version",c.get("onboarding_version"),"request",new Request(((Number)c.get("room_id")).longValue(),((Number)c.get("tenant_profile_id")).longValue(),null,agreement,RoomLifecycleGuard.date(c.get("expected_checkin_date")),(String)c.get("note"),false));
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Created updateDraft(AuthenticatedUser p,long id,long version,Request r) {
        rooms.lockContract(id);var current=draft(p,id);
        if(((Number)current.get("version")).longValue()!=version)throw invalid("CONTRACT_VERSION_CONFLICT","Bản nháp đã thay đổi; tải lại trước khi sửa.");
        var original=(Request)current.get("request");
        if(!Objects.equals(original.roomId(),r.roomId())||!Objects.equals(original.tenantProfileId(),r.tenantProfileId())||r.newTenant()!=null)throw invalid("DRAFT_PARTIES_IMMUTABLE","Giữ nguyên phòng và người thuê của bản nháp; lập nháp mới nếu cần thay đổi.");
        if(!r.terms().startDate().isBefore(r.terms().endDate())||r.expectedCheckinDate().isBefore(r.terms().startDate())||!r.expectedCheckinDate().isBefore(r.terms().endDate()))throw invalid("CONTRACT_DATE_INVALID","Ngày thuê/nhận phòng không hợp lệ.");
        if(r.terms().reservationTransferAmount()!=null&&r.terms().reservationTransferAmount().signum()!=0)throw invalid("DIRECT_RESERVATION_INVALID","Không có booking để chuyển tiền.");
        rooms.contractDates(r.roomId(),r.terms().startDate(),r.terms().endDate(),id,null);
        var t=r.terms();db.sql("UPDATE contracts SET start_date=:start,end_date=:end,original_end_date=:end,agreed_monthly_rent=COALESCE(:rent,agreed_monthly_rent),deposit_amount=:deposit,payment_due_day=:due,notice_period_days=:notice,initial_payment_required=:initial,expected_checkin_date=:checkin,note=:note WHERE id=:id")
                .param("start",t.startDate()).param("end",t.endDate()).param("rent",t.monthlyRent()).param("deposit",t.depositAmount()).param("due",t.paymentDueDay()).param("notice",t.noticePeriodDays()).param("initial",t.initialPaymentRequired()).param("checkin",r.expectedCheckinDate()).param("note",r.note()).param("id",id).update();
        for(String table:List.of("contract_utility_rates","contract_terms"))db.sql("DELETE FROM "+table+" WHERE contract_id=:id").param("id",id).update();
        onboarding.initialize(id,t,p.id());
        new SecurityAudit(db).record(p.id(),"DIRECT_CONTRACT_DRAFT_UPDATED","CONTRACT",id,"SUCCESS","Draft revision");
        if(r.submit())submit(p,id);
        return created(id);
    }
    @Transactional(isolation=Isolation.READ_COMMITTED)
    public Created submit(AuthenticatedUser p,long id) {
        rooms.lockContract(id);
        var c=db.sql("SELECT c.*,r.property_id FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE c.id=:id FOR UPDATE").param("id",id).query(DirectContractService::row).optional().orElseThrow(()->invalid("CONTRACT_NOT_FOUND","Không tìm thấy hợp đồng."));
        access(p,((Number)c.get("property_id")).longValue());
        if(!"DIRECT".equals(c.get("creation_source")))throw invalid("CONTRACT_SOURCE_INVALID","Dùng quy trình booking cho hợp đồng này.");
        if("PENDING_CONFIRMATION".equals(c.get("status")))return created(id);
        if(!"DRAFT".equals(c.get("status")))throw invalid("CONTRACT_NOT_DRAFT","Hợp đồng không còn là nháp.");
        long room=((Number)c.get("room_id")).longValue();
        Long legacy=rooms.directContract(room,RoomLifecycleGuard.date(c.get("start_date")),RoomLifecycleGuard.date(c.get("end_date")),id,((Number)c.get("tenant_profile_id")).longValue());
        Object originalLegacy=c.get("legacy_residence_id");
        if(originalLegacy==null?legacy!=null:legacy==null||((Number)originalLegacy).longValue()!=legacy.longValue())throw invalid("LEGACY_RESIDENCE_CONFLICT","Nguồn cư trú đã thay đổi; cần đối soát lại bản nháp.");
        if(provisioning!=null)provisioning.ensureContractTenant(p,((Number)c.get("tenant_profile_id")).longValue(),((Number)c.get("property_id")).longValue());
        var user=db.sql("SELECT u.id FROM tenant_profiles tp JOIN users u ON u.id=tp.user_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE tp.id=:id AND u.status='ACTIVE' AND r.code='TENANT' FOR UPDATE").param("id",c.get("tenant_profile_id")).query(Long.class).optional().orElseThrow(()->invalid("TENANT_ACCOUNT_REQUIRED","Cần tài khoản TENANT hợp lệ để gửi xác nhận; bản nháp đã được giữ."));
        db.sql("UPDATE contracts SET tenant_id=:user,status='PENDING_CONFIRMATION' WHERE id=:id").param("user",user).param("id",id).update();
        if(legacy!=null)db.sql("UPDATE tenant_residences SET contract_id=:contract WHERE id=:id AND contract_id IS NULL").param("contract",id).param("id",legacy).update();
        db.sql("INSERT INTO tenant_deposits(contract_id,property_id,tenant_id,required_amount) SELECT id,:p,tenant_id,deposit_amount FROM contracts WHERE id=:id").param("p",c.get("property_id")).param("id",id).update();
        onboarding.recordVersion(id,p.id(),"Gửi xác nhận hợp đồng trực tiếp");
        if(delivery!=null)delivery.submitted(id);
        new SecurityAudit(db).record(p.id(),"DIRECT_CONTRACT_SUBMITTED","CONTRACT",id,"SUCCESS","Awaiting existing bilateral confirmation and handover");
        return created(id);
    }
    private Created created(long id){return db.sql("SELECT id,code,status FROM contracts WHERE id=:id FOR UPDATE").param("id",id).query((rs,n)->new Created(rs.getLong("id"),rs.getString("code"),rs.getString("status"))).single();}
    private long insert(String sql,Map<String,Object> params){var key=new GeneratedKeyHolder();db.sql(sql).params(params).update(key,"id");return key.getKey().longValue();}
    private String fingerprint(Request r){try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(r.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private static Map<String,Object> row(java.sql.ResultSet rs,int n)throws java.sql.SQLException {var out=new HashMap<String,Object>();for(int i=1;i<=rs.getMetaData().getColumnCount();i++)out.put(rs.getMetaData().getColumnLabel(i),rs.getObject(i));return out;}
}
