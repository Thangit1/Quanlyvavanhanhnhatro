package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.repository.AccountantPortalRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Versioned internal confirmations; no claim of a legally qualified electronic signature. */
@Service
public class ContractOnboardingService {
    public record Evidence(@NotBlank @Size(max=500) String reference) {}
    public record IdentityReview(@NotBlank @Size(max=500) String reference,
            @AssertTrue(message="Cần xác nhận đã đối chiếu chứng từ thực tế") boolean documentsReviewed,
            @NotBlank @Size(min=64,max=64) String dataHash) {}
    public record IdentityProfile(@NotBlank @Size(max=150) String fullName,@NotNull @PastOrPresent LocalDate dateOfBirth,
            @NotBlank @Pattern(regexp=com.thangit.boardinghouse.common.validation.VietnamPhones.REGEX) String phone,
            @NotBlank @Size(max=30) String identityType,@Size(max=50) String identityNumber,
            @NotBlank @Size(max=500) String permanentAddress,@NotBlank @Size(min=64,max=64) String dataHash) {}
    private static final Map<String,String> IDENTITY_FIELDS;
    static {var fields=new LinkedHashMap<String,String>();fields.put("full_name","Họ tên");fields.put("date_of_birth","Ngày sinh");fields.put("phone","Số điện thoại");fields.put("identity_type","Loại giấy tờ");fields.put("identity_number","Số giấy tờ tùy thân");fields.put("permanent_address","Địa chỉ thường trú");IDENTITY_FIELDS=Collections.unmodifiableMap(fields);}
    public record Confirmation(@Positive long version,@NotBlank @Size(min=64,max=64) String contentHash) {}
    public record Revision(@NotBlank @Size(max=1000) String reason) {}
    public record InitialInvoice(@Positive long invoiceId) {}
    public record Handover(@NotNull Long version,@NotNull LocalDate scheduledDate,
            @DecimalMin("0") BigDecimal electricityReading,@DecimalMin("0") BigDecimal waterReading,
            @Min(0) int keysCardsCount,@NotBlank @Size(max=500) String reference,@Valid List<AssetSnapshot> assets,
            @Size(max=1000) String roomCondition,@Size(max=2000) String handoverNote,
            @AssertTrue(message="Cần chủ động đồng ý xác nhận biên bản bên cho thuê") boolean confirmLandlord,
            @Size(min=64,max=64) String expectedContextHash) {
        public Handover(Long version,LocalDate date,BigDecimal electricity,BigDecimal water,int keys,String reference){this(version,date,electricity,water,keys,reference,null);}
        public Handover(Long version,LocalDate date,BigDecimal electricity,BigDecimal water,int keys,String reference,List<AssetSnapshot> assets){this(version,date,electricity,water,keys,reference,assets,null,null,true,null);}
    }
    public record TermsChange(@NotNull @Valid CreateContract terms,@NotBlank @Size(max=1000) String reason) {}
    public record MeterReplacement(@Positive long meterId,@NotBlank @Size(max=50) String newCode,
            @NotNull @DecimalMin("0") BigDecimal newReading,@NotBlank @Size(max=1000) String reason,
            @NotBlank @Size(max=500) String reference) {}
    private final JdbcClient jdbc;
    private final RoomLifecycleGuard rooms;
    private final AccountantPortalRepository accounting;
    private int maxKeysCards=20;
    @org.springframework.beans.factory.annotation.Value("${app.onboarding.max-keys-cards:20}")
    public void setMaxKeysCards(int value){if(value<1)throw new IllegalArgumentException("app.onboarding.max-keys-cards must be positive");maxKeysCards=value;}
    private void validateKeys(int count){if(count<0||count>maxKeysCards)throw fail("HANDOVER_KEYS_LIMIT","Tổng số chìa khóa/thẻ phải từ 0 đến "+maxKeysCards+" theo chính sách bàn giao.");}
    private AdminInvoiceService invoices;
    private AdminTenantService tenants;
    @org.springframework.beans.factory.annotation.Autowired public void setTenants(AdminTenantService tenants){this.tenants=tenants;}
    @org.springframework.beans.factory.annotation.Autowired public void setInvoices(AdminInvoiceService invoices){this.invoices=invoices;}
    public ContractOnboardingService(JdbcClient jdbc,RoomLifecycleGuard rooms,AccountantPortalRepository accounting){this.jdbc=jdbc;this.rooms=rooms;this.accounting=accounting;}

    @Transactional(readOnly=true)
    public Map<String,Object> detail(AuthenticatedUser p,long contract){var c=access(p,contract,false);
        Map<String,Object> draft=new LinkedHashMap<>();for(String key:List.of("status","start_date","end_date","deposit_amount","payment_due_day","notice_period_days"))draft.put(key,c.get(key));
        Map<String,Object> out=new LinkedHashMap<>();out.put("contractId",contract);out.put("version",c.get("onboarding_version"));out.put("monthlyRent",c.get("agreed_monthly_rent"));out.put("initialPaymentRequired",c.get("initial_payment_required"));out.put("initialInvoiceId",c.get("initial_invoice_id"));
        out.put("draft",draft);
        out.put("handoverPolicy",Map.of("maxKeysCards",maxKeysCards));
        var v=version(contract);out.put("contractVersion",v.orElse(null));
        if(p.activeRole()==RoleCode.ACCOUNTANT&&v.isPresent()){var visible=new LinkedHashMap<String,Object>(v.get());visible.remove("content");out.put("contractVersion",visible);}
        out.put("contractConfirmations",v.isEmpty()?List.of():confirmations("contract_version_id",num(v.get(),"id")));
        out.put("identityVerified",identityValid(c));out.put("contractConfirmed",contractConfirmed(c));out.put("initialPaymentSatisfied",initialPaid(c));
        addIdentity(p,c,out);
        out.put("utilityRates",rows("SELECT code,name,calculation_method,unit_price,unit FROM contract_utility_rates WHERE contract_id=:id ORDER BY code",contract));
        out.put("services",rows("SELECT * FROM contract_services WHERE contract_id=:id ORDER BY id",contract));
        out.put("serviceEstimate",new PropertyServiceCatalogService(jdbc).estimate(contract));
        out.put("terms",rows("SELECT title,content FROM contract_terms WHERE contract_id=:id ORDER BY display_order,id",contract));
        var ci=one("SELECT id,version,status,scheduled_date,electricity_reading,water_reading,keys_cards_count,handover_reference,actual_checkin_at,completed_by FROM rental_checkins WHERE contract_id=:id",contract);
        out.put("checkin",ci.orElse(null));
        if(ci.isPresent()){
            out.put("handoverContextHash",handoverContextHash(c,ci.get()));
            long id=num(ci.get(),"id");out.put("assets",rows("SELECT room_asset_id,asset_name,quantity,condition_status,note FROM rental_checkin_assets WHERE checkin_id=:id ORDER BY id",id));
            var hv=handoverVersion(id);out.put("handoverVersion",hv.orElse(null));out.put("handoverConfirmations",hv.isEmpty()?List.of():confirmations("handover_version_id",num(hv.get(),"id")));
            out.put("handoverDocument",hv.map(value->handoverDocument(c,ci.get(),value)).orElse(null));
        }
        out.put("meters",rows("SELECT id,meter_type,meter_code,current_reading,status FROM utility_meters WHERE room_id=:id ORDER BY meter_type",num(c,"room_id")));
        out.put("deposit",one("SELECT required_amount,balance_amount,reconciliation_status,GREATEST(required_amount-balance_amount,0) remaining_due FROM tenant_deposits WHERE contract_id=:id",contract).orElse(null));
        addProgress(p,c,out);
        out.put("confirmationNotice","Xác nhận nội bộ theo phiên bản nội dung; không phải chứng nhận chữ ký điện tử có giá trị pháp lý.");return out;
    }

    private List<Map<String,Object>> identityFields(Map<String,Object> profile){
        return IDENTITY_FIELDS.entrySet().stream().map(e->{var f=new LinkedHashMap<String,Object>();f.put("key",e.getKey());f.put("label",e.getValue());f.put("present",profile.get(e.getKey())!=null&&!profile.get(e.getKey()).toString().isBlank());return (Map<String,Object>)f;}).toList();
    }
    private void addIdentity(AuthenticatedUser actor,Map<String,Object> c,Map<String,Object> out){
        if(actor.activeRole()==RoleCode.ACCOUNTANT){out.put("identityProfile",null);return;}
        var data=c.get("tenant_profile_id")==null?new LinkedHashMap<String,Object>():profile(c);
        var visible=new LinkedHashMap<String,Object>();visible.put("fields",identityFields(data));
        visible.put("complete",identityFields(data).stream().allMatch(f->Boolean.TRUE.equals(f.get("present")))&&data.get("date_of_birth")!=null&&!RoomLifecycleGuard.date(data.get("date_of_birth")).isAfter(LocalDate.now()));
        visible.put("dataHash",identityHash(data));visible.put("canEdit", c.get("tenant_profile_id")!=null&&"PENDING_CONFIRMATION".equals(c.get("status"))&&capability(actor,c,"CONTRACT_APPROVE"));
        for(String key:IDENTITY_FIELDS.keySet())if(!"identity_number".equals(key))visible.put(key,data.get(key));
        String number=Objects.toString(data.get("identity_number"),"");visible.put("identity_number",number.isBlank()?null:"•".repeat(Math.max(0,number.length()-4))+number.substring(Math.max(0,number.length()-4)));
        visible.put("verification",c.get("tenant_profile_id")==null?null:jdbc.sql("SELECT v.verified_at,v.evidence_reference,u.full_name actor_name FROM tenant_identity_verifications v JOIN users u ON u.id=v.verified_by WHERE v.tenant_profile_id=:id AND v.data_hash=:hash ORDER BY v.id DESC LIMIT 1").param("id",c.get("tenant_profile_id")).param("hash",identityHash(data)).query().listOfRows().stream().findFirst().orElse(null));
        out.put("identityProfile",visible);
    }
    @Transactional
    public void updateIdentityProfile(AuthenticatedUser actor,long contract,IdentityProfile r){
        var c=access(actor,contract,true);staff(actor,c);
        if(!"PENDING_CONFIRMATION".equals(c.get("status")))throw fail("IDENTITY_PROFILE_EDIT_NOT_ALLOWED","Hợp đồng không còn chờ nhận phòng; cập nhật hồ sơ theo quy trình quản lý người thuê.");
        var current=profile(c);if(!identityHash(current).equals(r.dataHash()))throw fail("PROFILE_VERSION_CONFLICT","Hồ sơ đã thay đổi. Vui lòng tải lại trước khi lưu.");
        String identity=r.identityNumber()==null||r.identityNumber().isBlank()?Objects.toString(current.get("identity_number"),null):r.identityNumber().trim();
        if(identity==null||identity.isBlank()||identity.contains("•"))throw fail("TENANT_PROFILE_INCOMPLETE","Vui lòng nhập số giấy tờ tùy thân hợp lệ.");
        tenants.update(actor,num(c,"tenant_profile_id"),new com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.SaveTenant(
            r.fullName(),r.dateOfBirth(),text(current,"gender"),r.phone(),text(current,"email"),r.permanentAddress(),text(current,"hometown"),text(current,"occupation"),text(current,"workplace"),text(current,"emergency_contact_name"),text(current,"emergency_contact_phone"),r.identityType(),identity,current.get("identity_issued_date")==null?null:RoomLifecycleGuard.date(current.get("identity_issued_date")),text(current,"identity_issued_place"),text(current,"note"),null,null,null,null,null));
        audit(contract,actor.id(),"IDENTITY_PROFILE_UPDATED","Cập nhật hồ sơ định danh; cần đối chiếu lại nếu dữ liệu thay đổi.");
    }
    private static String text(Map<String,Object> row,String key){return row.get(key)==null?null:row.get(key).toString();}
    @Transactional
    public void verifyIdentityReviewed(AuthenticatedUser actor,long contract,IdentityReview r){
        var c=access(actor,contract,true);staff(actor,c);var data=profile(c);
        if(!r.documentsReviewed())throw fail("IDENTITY_REVIEW_REQUIRED","Cần đối chiếu chứng từ thực tế trước khi xác minh.");
        if(!identityHash(data).equals(r.dataHash()))throw fail("PROFILE_VERSION_CONFLICT","Hồ sơ đã thay đổi; cần đối chiếu lại dữ liệu mới.");
        verifyIdentity(actor,contract,new Evidence(r.reference()));
    }

    private boolean capability(AuthenticatedUser p,Map<String,Object> c,String capability){
        return p.activeRole()==RoleCode.OWNER || (p.activeRole()==RoleCode.MANAGER && jdbc.sql("SELECT COUNT(*) FROM manager_property_capabilities WHERE manager_id=:user AND property_id=:property AND capability=:capability").param("user",p.id()).param("property",c.get("property_id")).param("capability",capability).query(Long.class).single()==1);
    }
    @SuppressWarnings("unchecked")
    private void addProgress(AuthenticatedUser p,Map<String,Object> c,Map<String,Object> out){
        long contract=num(c,"id");var v=version(contract);
        boolean current=v.isPresent()&&Objects.equals(v.get().get("content_hash"),hash(content(c)));
        var cs=current?confirmations("contract_version_id",num(v.get(),"id")):List.<Map<String,Object>>of();
        boolean tenant=cs.stream().anyMatch(x->"TENANT".equals(x.get("party"))),landlord=cs.stream().anyMatch(x->"LANDLORD".equals(x.get("party")));
        var ci=one("SELECT * FROM rental_checkins WHERE contract_id=:id",contract);
        var hv=ci.isPresent()?handoverVersion(num(ci.get(),"id")):Optional.<Map<String,Object>>empty();
        boolean handover=hv.isPresent()&&handoverMatches(c,ci.get(),hv.get())&&confirmed("handover_version_id",num(hv.get(),"id"));
        boolean inventory=ci.isPresent()&&jdbc.sql("SELECT COUNT(*) FROM room_assets a WHERE a.room_id=:room AND NOT EXISTS(SELECT 1 FROM rental_checkin_assets x WHERE x.checkin_id=:ci AND x.room_asset_id=a.id AND x.quantity=a.quantity)").param("room",c.get("room_id")).param("ci",ci.get().get("id")).query(Long.class).single()==0;
        handover=handover&&(ci.isPresent()&&"COMPLETED".equals(ci.get().get("status"))||inventory);
        var deposit=one("SELECT d.*,COALESCE((SELECT SUM(amount-paid_amount+CASE WHEN status='REQUESTED' THEN retained_amount ELSE 0 END) FROM deposit_refund_requests WHERE deposit_id=d.id AND status IN ('REQUESTED','APPROVED','PARTIAL')),0) pending_refund FROM tenant_deposits d WHERE contract_id=:id",contract);
        boolean funded=deposit.isPresent()&&"VERIFIED".equals(deposit.get().get("reconciliation_status"))&&money(deposit.get().get("balance_amount")).compareTo(money(deposit.get().get("required_amount")))>=0&&money(deposit.get().get("pending_refund")).signum()==0;
        boolean identity=Boolean.TRUE.equals(out.get("identityVerified")),initial=Boolean.TRUE.equals(out.get("initialPaymentSatisfied"));
        boolean completed=ci.isPresent()&&"COMPLETED".equals(ci.get().get("status"));
        boolean pending="PENDING_CONFIRMATION".equals(c.get("status"));
        boolean approve=capability(p,c,"CONTRACT_APPROVE");
        boolean readFinance=p.activeRole()==RoleCode.TENANT||p.activeRole()==RoleCode.ACCOUNTANT||capability(p,c,"FINANCE_READ");
        boolean writeFinance=capability(p,c,"FINANCE_WRITE")&&readFinance || p.activeRole()==RoleCode.ACCOUNTANT&&accounting.permission(p.id(),"can_record_payment");
        String ownParty=p.activeRole()==RoleCode.TENANT?"TENANT":approve?"LANDLORD":null;
        boolean ownConfirmed=ownParty!=null&&cs.stream().anyMatch(x->ownParty.equals(x.get("party")));
        boolean oppositeActor=ownParty!=null&&cs.stream().anyMatch(x->!ownParty.equals(x.get("party"))&&num(x,"actor_id")==p.id());
        var progress=new LinkedHashMap<String,Object>();
        progress.put("contentCurrent",current);progress.put("ownParty",ownParty);progress.put("ownConfirmed",ownConfirmed);
        progress.put("confirmedByCurrentActor",ownParty!=null&&cs.stream().anyMatch(x->ownParty.equals(x.get("party"))&&num(x,"actor_id")==p.id()));
        progress.put("tenant",partyProgress(cs,"TENANT"));progress.put("landlord",partyProgress(cs,"LANDLORD"));
        progress.put("bothConfirmed",tenant&&landlord);progress.put("handoverConfirmed",handover);progress.put("checkinCompleted",completed);
        progress.put("canConfirm",pending&&current&&ownParty!=null&&!ownConfirmed&&!oppositeActor);
        progress.put("canRevise",pending&&approve&&!current);progress.put("canVerifyIdentity",pending&&approve&&!identity);
        progress.put("canManageHandover",pending&&approve);progress.put("canReadFinance",readFinance);progress.put("canWriteFinance",pending&&writeFinance);progress.put("canApproveDeposit",pending&&capability(p,c,"DEPOSIT_APPROVE"));
        progress.put("canCreateInitialInvoice",pending&&writeFinance&&p.activeRole()!=RoleCode.ACCOUNTANT || pending&&p.activeRole()==RoleCode.ACCOUNTANT&&accounting.permission(p.id(),"can_issue_invoice"));
        var checks=List.of(check("TENANT_CONFIRMATION","Người thuê xác nhận nội dung",tenant),check("LANDLORD_CONFIRMATION","Bên cho thuê xác nhận nội dung",landlord),check("IDENTITY","Hồ sơ định danh đã xác minh",identity),check("DEPOSIT","Đã ghi nhận đủ tiền cọc",funded),check("INITIAL_PAYMENT","Đáp ứng chính sách thanh toán đầu kỳ",initial),check("HANDOVER","Biên bản bàn giao được hai bên xác nhận",handover),check("CHECKIN","Hoàn tất nhận phòng",completed));
        progress.put("checklist",checks);progress.put("completedCount",checks.stream().filter(x->Boolean.TRUE.equals(x.get("completed"))).count());
        String stage=completed&&Set.of("ACTIVE","EXPIRING").contains(c.get("status"))?"ACTIVE":!pending?c.get("status").toString():!current?"CONTENT_REVIEW_REQUIRED":!tenant?"WAITING_TENANT":!landlord?"WAITING_LANDLORD":!identity?"WAITING_IDENTITY":!funded||!initial?"WAITING_FINANCE":!handover?"WAITING_HANDOVER":"READY_FOR_CHECKIN";
        progress.put("stage",stage);
        boolean dates=!LocalDate.now().isBefore(RoomLifecycleGuard.date(c.get("start_date")))&&LocalDate.now().isBefore(RoomLifecycleGuard.date(c.get("end_date")));
        if("READY_FOR_CHECKIN".equals(stage)&&!dates)progress.put("stage","WAITING_CHECKIN_DATE");
        progress.put("canCompleteCheckin",pending&&approve&&tenant&&landlord&&identity&&funded&&initial&&handover&&dates&&ci.isPresent()&&"READY".equals(ci.get().get("status")));
        out.put("progress",progress);
        var context=new LinkedHashMap<String,Object>();for(String key:List.of("code","tenant_name","property_name","room_code","tenant_profile_id","room_id","start_date","end_date","expected_checkin_date"))context.put(key,c.get(key));out.put("context",context);
        if(!readFinance)out.put("deposit",null);
        List<Map<String,Object>> invoices=List.of();
        if(readFinance)invoices=rows("SELECT id,code,status,total_amount,paid_amount,remaining_amount,due_date,billing_period FROM invoices WHERE contract_id=:id AND invoice_kind='RENTAL' AND billing_period=(SELECT DATE_FORMAT(start_date,'%Y-%m-01') FROM contracts WHERE id=:id) AND status NOT IN ('CANCELLED','DRAFT','PENDING_REVIEW') ORDER BY id",contract).stream().filter(i->initialRentMatches(c,i)).toList();
        out.put("initialInvoiceOptions",invoices);
        out.put("initialInvoice",readFinance&&c.get("initial_invoice_id")!=null?one("SELECT id,code,status,total_amount,paid_amount,remaining_amount,due_date FROM invoices WHERE id=:id",num(c,"initial_invoice_id")).orElse(null):null);
        out.put("initialDraftInvoice",readFinance?one("SELECT id,code,status FROM invoices WHERE contract_id=:id AND invoice_kind='RENTAL' AND billing_period=(SELECT DATE_FORMAT(start_date,'%Y-%m-01') FROM contracts WHERE id=:id) AND status='DRAFT' ORDER BY id LIMIT 1",contract).orElse(null):null);
        boolean initialRequired=Boolean.TRUE.equals(c.get("initial_payment_required"));
        @SuppressWarnings("unchecked") var identityData=(Map<String,Object>)out.get("identityProfile");
        boolean profileComplete=identityData!=null&&Boolean.TRUE.equals(identityData.get("complete"));
        Object identityTime=identityData!=null&&identityData.get("verification") instanceof Map<?,?> verified?verified.get("verified_at"):null;
        boolean handoverCurrent=hv.isPresent()&&handoverMatches(c,ci.get(),hv.get())&&("COMPLETED".equals(ci.get().get("status"))||inventory);
        out.put("handoverContentCurrent",handoverCurrent);
        var steps=List.of(
            procedure("CONTENT","Xác nhận nội dung hợp đồng của hai bên",tenant&&landlord?"COMPLETED":tenant||landlord?"WAITING_OTHER":"PENDING","Hai bên đọc và xác nhận cùng phiên bản nội dung hiện tại.",tenant&&landlord?c.get("signed_at"):null,"contract-content"),
            procedure("IDENTITY","Xác minh hồ sơ định danh",identity?"COMPLETED":profileComplete?"PENDING":"NEEDS_INFORMATION","Bổ sung đủ hồ sơ và đối chiếu chứng từ thực tế; đầy đủ thông tin chưa phải đã xác minh.",identityTime,"identity-profile"),
            procedure("DEPOSIT","Hoàn tất tiền cọc",funded?"COMPLETED":"PENDING","Sổ cọc phải được đối soát, đủ số dư và không có khoản hoàn đang chờ.",null,"deposit-ledger-"+contract),
            procedure("INITIAL_PAYMENT","Chính sách thanh toán đầu kỳ",!initialRequired?"NOT_APPLICABLE":initial?"COMPLETED":"PENDING",!initialRequired?"Không yêu cầu thanh toán trước":"Hóa đơn đầu kỳ hợp lệ phải được liên kết và thanh toán đủ bằng chứng từ.",null,"initial-finance"),
            procedure("HANDOVER_PREPARE","Lập biên bản bàn giao",handoverCurrent?"COMPLETED":"NEEDS_INFORMATION","Kiểm kê tài sản, ghi chỉ số thực tế và tham chiếu biên bản.",handoverCurrent?hv.get().get("created_at"):null,"handover-editor"),
            procedure("HANDOVER_CONFIRM","Hai bên xác nhận biên bản bàn giao",handover?"COMPLETED":handoverCurrent?"WAITING_OTHER":"PENDING","Hai bên đối chiếu thực tế và xác nhận cùng phiên bản biên bản.",null,"handover-preview"),
            procedure("CHECKIN","Hoàn tất check-in",completed?"COMPLETED":"PENDING","Đủ tất cả điều kiện, đến ngày nhận phòng và xác nhận bàn giao thực tế.",completed?ci.get().get("actual_checkin_at"):null,"complete-checkin"));
        out.put("procedureSteps",steps);
        String next=!pending?"NONE":!current?"REVISE_CONTENT":!(tenant&&landlord)?ownConfirmed?"WAIT_OTHER_CONTENT":"CONFIRM_CONTENT":!identity?!profileComplete?"UPDATE_PROFILE":"VERIFY_IDENTITY":!funded?"RECORD_DEPOSIT":!initial?"INITIAL_PAYMENT":!handoverCurrent?"PREPARE_HANDOVER":!handover?"CONFIRM_HANDOVER":!dates?"WAIT_DATE":"COMPLETE_CHECKIN";
        out.put("nextAction",next);
        if(readFinance){
            var finance=new LinkedHashMap<String,Object>();finance.put("rentEstimate",c.get("agreed_monthly_rent"));finance.put("depositRequired",deposit.map(x->x.get("required_amount")).orElse(c.get("deposit_amount")));finance.put("depositCollected",deposit.map(x->x.get("balance_amount")).orElse(null));finance.put("depositSatisfied",funded);finance.put("initialPaymentRequired",initialRequired);finance.put("initialPolicySatisfied",initial);
            finance.put("recordedInvoices",rows("SELECT id,code,status,total_amount,paid_amount,remaining_amount FROM invoices WHERE contract_id=:id AND invoice_kind='RENTAL' AND billing_period=(SELECT DATE_FORMAT(start_date,'%Y-%m-01') FROM contracts WHERE id=:id) AND status NOT IN ('CANCELLED','DRAFT','PENDING_REVIEW') ORDER BY id",contract));
            finance.put("recordedItems",rows("SELECT ii.name,ii.item_type,ii.amount FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id WHERE i.contract_id=:id AND i.invoice_kind='RENTAL' AND i.billing_period=(SELECT DATE_FORMAT(start_date,'%Y-%m-01') FROM contracts WHERE id=:id) AND i.status NOT IN ('CANCELLED','DRAFT','PENDING_REVIEW') ORDER BY ii.id",contract));out.put("financialSummary",finance);
        }else out.put("financialSummary",null);
    }
    private Map<String,Object> procedure(String key,String label,String status,String description,Object completedAt,String anchor){var step=new LinkedHashMap<String,Object>();step.put("key",key);step.put("label",label);step.put("status",status);step.put("description",description);step.put("completedAt",completedAt);step.put("anchor",anchor);return step;}
    private Map<String,Object> check(String key,String label,boolean completed){return Map.of("key",key,"label",label,"completed",completed);}
    private Map<String,Object> partyProgress(List<Map<String,Object>> rows,String party){var out=new LinkedHashMap<String,Object>();out.put("confirmed",false);for(var row:rows)if(party.equals(row.get("party"))){out.put("confirmed",true);out.put("actorId",row.get("actor_id"));out.put("actorName",row.get("actor_name"));out.put("confirmedAt",row.get("confirmed_at"));}return out;}
    private void notifyConfirmation(Map<String,Object> c,String party,long version){
        List<Long> recipients="TENANT".equals(party)?jdbc.sql("SELECT DISTINCT u.id FROM users u WHERE u.status='ACTIVE' AND (u.id=(SELECT owner_id FROM properties WHERE id=:property) OR EXISTS(SELECT 1 FROM property_managers pm JOIN manager_property_capabilities mc ON mc.manager_id=pm.manager_id AND mc.property_id=pm.property_id WHERE pm.property_id=:property AND pm.manager_id=u.id AND mc.capability='CONTRACT_APPROVE'))").param("property",c.get("property_id")).query(Long.class).list():List.of(num(c,"tenant_id"));
        for(long user:recipients)jdbc.sql("INSERT INTO notifications(user_id,title,content,type,category,property_id,room_id,reference_type,reference_id) VALUES(:user,'Xác nhận nội dung hợp đồng',:content,'CONTRACT','CONTRACT',:property,:room,'CONTRACT',:contract)").param("user",user).param("content",("TENANT".equals(party)?"Người thuê":"Bên cho thuê")+" đã xác nhận hợp đồng "+c.get("code")+", phiên bản "+version+". Kiểm tra tiến độ để hoàn tất nhận phòng.").param("property",c.get("property_id")).param("room",c.get("room_id")).param("contract",c.get("id")).update();
    }

    public void initialize(long contract,CreateContract r,long actor){
        if(r.utilityRates()!=null && r.utilityRates().stream().map(AgreedRate::code).distinct().count()!=r.utilityRates().size())throw fail("UTILITY_POLICY_INVALID","Mỗi loại điện/nước chỉ có một chính sách trong hợp đồng.");
        if(r.utilityRates()!=null)for(var rate:r.utilityRates())jdbc.sql("INSERT INTO contract_utility_rates(contract_id,code,name,calculation_method,unit_price,unit,effective_date) SELECT :id,:code,:name,:method,:price,:unit,start_date FROM contracts WHERE id=:id")
                .param("id",contract).param("code",rate.code()).param("name",rate.name()).param("method",rate.calculationMethod()).param("price",rate.unitPrice()).param("unit",rate.unit()).update();
        new PropertyServiceCatalogService(jdbc).snapshots(contract,r.services(),actor);
        if(r.terms()!=null)for(var term:r.terms())jdbc.sql("INSERT INTO contract_terms(contract_id,title,content) VALUES(:id,:title,:content)").param("id",contract).param("title",term.title()).param("content",term.content()).update();
        if(jdbc.sql("SELECT COUNT(*) FROM contract_assets WHERE contract_id=:id").param("id",contract).query(Long.class).single()==0)
            jdbc.sql("INSERT INTO contract_assets(contract_id,name,quantity,handover_condition,note) SELECT :id,a.name,a.quantity,a.condition_status,a.note FROM room_assets a JOIN contracts c ON c.room_id=a.room_id WHERE c.id=:id").param("id",contract).update();
        recordVersion(contract,actor,"Chốt nội dung khi lập hợp đồng");
    }
    @Transactional
    public void revise(AuthenticatedUser p,long contract,Revision r){var c=access(p,contract,true);staff(p,c);recordVersion(contract,p.id(),r.reason());}
    @Transactional
    public void changeTerms(AuthenticatedUser p,long contract,TermsChange r){var c=access(p,contract,true);staff(p,c);
        if(!"PENDING_CONFIRMATION".equals(c.get("status"))||c.get("initial_invoice_id")!=null)throw fail("CONTRACT_AMENDMENT_REQUIRED","Chỉ sửa nội dung trước nhận phòng và trước khi gắn hóa đơn đầu kỳ; thay đổi sau đó phải có phụ lục/quyết toán.");
        if(jdbc.sql("SELECT COUNT(*) FROM invoices WHERE contract_id=:id AND status<>'CANCELLED'").param("id",contract).query(Long.class).single()>0)throw fail("CONTRACT_AMENDMENT_REQUIRED","Đã có hóa đơn; cần xử lý chứng từ trước khi đổi điều khoản.");
        var terms=r.terms();if(money(c.get("deposit_amount")).compareTo(terms.depositAmount())!=0)throw fail("DEPOSIT_AMENDMENT_REQUIRED","Điều chỉnh cọc phải dùng nghiệp vụ phụ lục của sổ cọc.");
        Long booking=jdbc.sql("SELECT id FROM rental_bookings WHERE contract_id=:id").param("id",contract).query(Long.class).optional().orElse(null);
        rooms.contractDates(num(c,"room_id"),terms.startDate(),terms.endDate(),contract,booking);
        if(terms.monthlyRent()==null)throw fail("CONTRACT_RENT_REQUIRED","Cần giá thuê theo thỏa thuận.");
        jdbc.sql("UPDATE contracts SET start_date=:start,end_date=:end,agreed_monthly_rent=:rent,payment_due_day=:due,notice_period_days=:notice,initial_payment_required=:initial WHERE id=:id")
                .param("start",terms.startDate()).param("end",terms.endDate()).param("rent",terms.monthlyRent()).param("due",terms.paymentDueDay()).param("notice",terms.noticePeriodDays()).param("initial",terms.initialPaymentRequired()).param("id",contract).update();
        for(String table:List.of("contract_utility_rates","contract_terms"))jdbc.sql("DELETE FROM "+table+" WHERE contract_id=:id").param("id",contract).update();
        initialize(contract,terms,p.id());audit(contract,p.id(),"DRAFT_TERMS_REVISED",r.reason());
    }
    public void recordVersion(long contract,long actor,String reason){rooms.lockContract(contract);var c=raw(contract);String content=content(c);String hash=hash(content);var prior=version(contract);
        if(prior.isPresent()&&hash.equals(prior.get().get("content_hash")))return;
        if(prior.isPresent())jdbc.sql("UPDATE contracts SET onboarding_version=onboarding_version+1,signed_at=NULL WHERE id=:id").param("id",contract).update();
        c=raw(contract);content=content(c);hash=hash(content);
        jdbc.sql("INSERT INTO contract_versions(contract_id,version,content,content_hash,reason,created_by) VALUES(:id,:version,:content,:hash,:reason,:actor)").param("id",contract).param("version",c.get("onboarding_version")).param("content",content).param("hash",hash).param("reason",reason).param("actor",actor).update();
        audit(contract,actor,"CONTENT_VERSION_CREATED",reason);
    }
    @Transactional
    public void verifyIdentity(AuthenticatedUser p,long contract,Evidence r){var c=access(p,contract,true);staff(p,c);var profile=one("SELECT * FROM tenant_profiles WHERE id=:id FOR UPDATE",num(c,"tenant_profile_id")).orElseThrow(()->fail("TENANT_PROFILE_REQUIRED","Missing tenant profile"));
        if(identityValid(c))return;
        var missing=identityFields(profile).stream().filter(field->!Boolean.TRUE.equals(field.get("present"))).map(field->field.get("label").toString()).toList();
        if(!missing.isEmpty())throw fail("TENANT_PROFILE_INCOMPLETE","Thiếu thông tin hồ sơ: "+String.join(", ",missing)+". Cập nhật hồ sơ trước khi xác minh.");
        if(RoomLifecycleGuard.date(profile.get("date_of_birth")).isAfter(LocalDate.now()))throw fail("TENANT_PROFILE_INCOMPLETE","Ngày sinh không hợp lệ.");
        jdbc.sql("INSERT INTO tenant_identity_verifications(tenant_profile_id,data_hash,evidence_reference,verified_by) VALUES(:id,:hash,:evidence,:actor)").param("id",c.get("tenant_profile_id")).param("hash",identityHash(profile)).param("evidence",r.reference()).param("actor",p.id()).update();audit(contract,p.id(),"IDENTITY_VERIFIED",r.reference());
    }
    @Transactional
    public void confirmContract(AuthenticatedUser p,long contract,Confirmation r){var c=access(p,contract,true);
        if(!"PENDING_CONFIRMATION".equals(c.get("status"))&&!Set.of("ACTIVE","EXPIRING").contains(c.get("status")))throw fail("CONTRACT_NOT_CONFIRMABLE","Hợp đồng không còn chờ xác nhận nội dung.");
        validateTerms(c);var v=version(contract).orElseThrow(()->fail("CONTRACT_SNAPSHOT_REQUIRED","Chưa chốt nội dung hợp đồng."));
        if(num(v,"version")!=r.version()||!Objects.equals(v.get("content_hash"),r.contentHash())||!r.contentHash().equals(hash(content(c))))throw fail("CONTRACT_VERSION_CONFLICT","Nội dung đã thay đổi; phải đọc và xác nhận phiên bản mới.");
        String party=party(p,c);boolean inserted=confirm("contract_version_id",num(v,"id"),party,p.id(),r.contentHash());
        if(confirmed("contract_version_id",num(v,"id")))jdbc.sql("UPDATE contracts SET signed_at=COALESCE(signed_at,NOW()) WHERE id=:id").param("id",contract).update();
        if(inserted){audit(contract,p.id(),"CONTRACT_CONFIRMED",party+"; phiên bản "+r.version());notifyConfirmation(c,party,r.version());}
    }
    @Transactional
    public void linkInvoice(AuthenticatedUser p,long contract,InitialInvoice r){var c=access(p,contract,true);
        if(p.activeRole()==RoleCode.TENANT||p.activeRole()==RoleCode.TECHNICIAN)throw denied();
        if(p.activeRole()==RoleCode.ACCOUNTANT&&!accounting.permission(p.id(),"can_record_payment"))throw denied();
        if(p.activeRole()==RoleCode.MANAGER){rooms.capability(p,num(c,"property_id"),com.thangit.boardinghouse.security.PropertyAuthorization.Capability.FINANCE_READ);rooms.capability(p,num(c,"property_id"),com.thangit.boardinghouse.security.PropertyAuthorization.Capability.FINANCE_WRITE);}
        var invoice=one("SELECT * FROM invoices WHERE id=:id FOR UPDATE",r.invoiceId()).orElseThrow(()->fail("INVOICE_NOT_FOUND","Không tìm thấy hóa đơn đầu kỳ."));
        if(num(invoice,"contract_id")!=contract||!"RENTAL".equals(invoice.get("invoice_kind"))||!RoomLifecycleGuard.date(invoice.get("billing_period")).equals(RoomLifecycleGuard.date(c.get("start_date")).withDayOfMonth(1))||Set.of("DRAFT","CANCELLED","PENDING_REVIEW").contains(invoice.get("status")))throw fail("INITIAL_INVOICE_INVALID","Phải chọn hóa đơn thuê đã phát hành đúng hợp đồng và tháng bắt đầu.");
        if(c.get("initial_invoice_id")!=null&&num(c,"initial_invoice_id")!=r.invoiceId())throw fail("INITIAL_INVOICE_ALREADY_LINKED","Nghĩa vụ đầu kỳ đã gắn hóa đơn; không thay âm thầm.");
        if(!initialRentMatches(c,invoice))throw fail("INITIAL_INVOICE_RENT_MISMATCH","Hóa đơn phải có đúng khoản thuê theo giá và chính sách phân bổ đã chốt.");
        if(c.get("initial_invoice_id")!=null)return;
        jdbc.sql("UPDATE contracts SET initial_invoice_id=:invoice WHERE id=:id").param("invoice",r.invoiceId()).param("id",contract).update();audit(contract,p.id(),"INITIAL_INVOICE_LINKED","Hóa đơn #"+r.invoiceId());
    }

    private boolean initialRentMatches(Map<String,Object> c,Map<String,Object> invoice){long contract=num(c,"id");return c.get("agreed_monthly_rent")!=null && jdbc.sql("SELECT COUNT(*) FROM invoice_items WHERE invoice_id=:id AND item_type='ROOM_RENT' AND source_type='CONTRACT' AND source_id=:contract AND ((unit_price=:rent AND quantity=1 AND amount=:rent) OR (:daily=TRUE AND unit='ngày' AND unit_price=ROUND(:rent/DAY(LAST_DAY(:period)),8) AND quantity=:days AND amount=ROUND(:rent*:days/DAY(LAST_DAY(:period)),2)))").param("id",invoice.get("id")).param("contract",contract).param("rent",c.get("agreed_monthly_rent")).param("daily","ACTUAL_DAYS".equals(c.get("rent_proration"))).param("period",invoice.get("billing_period")).param("days",java.time.temporal.ChronoUnit.DAYS.between(RoomLifecycleGuard.date(c.get("start_date")),RoomLifecycleGuard.date(c.get("end_date")).isBefore(RoomLifecycleGuard.date(invoice.get("billing_period")).plusMonths(1))?RoomLifecycleGuard.date(c.get("end_date")):RoomLifecycleGuard.date(invoice.get("billing_period")).plusMonths(1))).query(Long.class).single()==1;}

    @Transactional
    public Map<String,Object> createInitialDraft(AuthenticatedUser p,long contract){var c=access(p,contract,true);
        if(p.activeRole()==RoleCode.TENANT||p.activeRole()==RoleCode.TECHNICIAN)throw denied();
        if(p.activeRole()==RoleCode.MANAGER){rooms.capability(p,num(c,"property_id"),com.thangit.boardinghouse.security.PropertyAuthorization.Capability.FINANCE_READ);rooms.capability(p,num(c,"property_id"),com.thangit.boardinghouse.security.PropertyAuthorization.Capability.FINANCE_WRITE);}
        if(p.activeRole()==RoleCode.ACCOUNTANT&&!accounting.permission(p.id(),"can_issue_invoice"))throw denied();
        if(!"PENDING_CONFIRMATION".equals(c.get("status"))||!Boolean.TRUE.equals(c.get("initial_payment_required")))throw fail("INITIAL_INVOICE_NOT_REQUIRED","Chỉ lập hóa đơn đầu kỳ cho hợp đồng chờ nhận phòng có yêu cầu thanh toán đầu kỳ.");
        validateTerms(c);var period=RoomLifecycleGuard.date(c.get("start_date")).withDayOfMonth(1);
        var prior=jdbc.sql("SELECT id,code,status FROM invoices WHERE contract_id=:id AND billing_period=:period AND invoice_kind='RENTAL' AND status<>'CANCELLED' FOR UPDATE").param("id",contract).param("period",period).query().listOfRows();
        if(!prior.isEmpty())return prior.getFirst();
        var agreedDue=period.withDayOfMonth(((Number)c.get("payment_due_day")).intValue());
        var result=invoices.create(p,new com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.SaveInvoice(num(c,"room_id"),contract,period.toString().substring(0,7),period,period.plusMonths(1).minusDays(1),LocalDate.now(),agreedDue.isBefore(LocalDate.now())?LocalDate.now():agreedDue,List.of(),BigDecimal.ZERO,false,"Hóa đơn đầu kỳ từ tiến độ nhận phòng","SAVE_DRAFT",null));
        audit(contract,p.id(),"INITIAL_INVOICE_DRAFT_CREATED","Hóa đơn nháp #"+result.id());
        return Map.of("id",result.id(),"code",result.invoiceCode(),"status","DRAFT");
    }

    public void validatePrepare(long contract,List<AssetSnapshot> assets){var c=raw(contract);if(assets==null||assets.isEmpty())return;
        var inventory=rows("SELECT id,quantity FROM room_assets WHERE room_id=:id ORDER BY id",num(c,"room_id"));Set<Long> seen=new HashSet<>();
        for(var asset:assets){if(asset.roomAssetId()==null||!seen.add(asset.roomAssetId()))throw fail("HANDOVER_ASSET_INVALID","Tài sản bàn giao phải có liên kết phòng, không được lặp.");var actual=inventory.stream().filter(a->num(a,"id")==asset.roomAssetId()).findFirst().orElseThrow(()->fail("HANDOVER_ASSET_INVALID","Tài sản không thuộc phòng."));if(num(actual,"quantity")!=asset.quantity())throw fail("HANDOVER_ASSET_INVALID","Số lượng phải khớp danh mục; ghi rõ tình trạng MISSING nếu thiếu thực tế.");}
        if(seen.size()!=inventory.size())throw fail("HANDOVER_ASSETS_INCOMPLETE","Chưa kiểm kê đầy đủ tài sản của phòng.");
    }
    @Transactional
    public void saveHandover(AuthenticatedUser p,long contract,Handover r){var c=access(p,contract,true);staff(p,c);rooms.checkin(contract,r.scheduledDate());
        validateKeys(r.keysCardsCount());if(!r.confirmLandlord())throw fail("HANDOVER_LANDLORD_CONSENT_REQUIRED","Cần chủ động đồng ý lưu và xác nhận biên bản bên cho thuê.");
        var ci=checkin(contract);if(!"READY".equals(ci.get("status"))||num(ci,"version")!=r.version())throw fail("CHECKIN_VERSION_CONFLICT","Biên bản đã thay đổi hoặc đã bàn giao.");
        if(r.expectedContextHash()!=null&&!r.expectedContextHash().equals(handoverContextHash(c,ci)))throw fail("HANDOVER_CONTEXT_CONFLICT","Công tơ, tài sản hoặc thông tin bàn giao đã thay đổi. Tải lại, kiểm tra các thay đổi rồi xác nhận lại.");
        if(r.assets()!=null)validatePrepare(contract,r.assets());
        if(unchangedHandover(c,ci,r)){checkAssets(c,num(ci,"id"));validateMeter(c,"ELECTRICITY",r.electricityReading());validateMeter(c,"WATER",r.waterReading());return;}
        if(r.assets()!=null){validatePrepare(contract,r.assets());jdbc.sql("DELETE FROM rental_checkin_assets WHERE checkin_id=:id").param("id",ci.get("id")).update();
            if(r.assets().isEmpty())jdbc.sql("INSERT INTO rental_checkin_assets(checkin_id,room_asset_id,asset_name,quantity,condition_status,note) SELECT :ci,id,name,quantity,condition_status,note FROM room_assets WHERE room_id=:room").param("ci",ci.get("id")).param("room",c.get("room_id")).update();
            else for(var a:r.assets())jdbc.sql("INSERT INTO rental_checkin_assets(checkin_id,room_asset_id,asset_name,quantity,condition_status,note) VALUES(:ci,:asset,:name,:quantity,:condition,:note)").param("ci",ci.get("id")).param("asset",a.roomAssetId()).param("name",a.assetName()).param("quantity",a.quantity()).param("condition",a.conditionStatus()).param("note",a.note()).update();
        }
        checkAssets(c,num(ci,"id"));validateMeter(c,"ELECTRICITY",r.electricityReading());validateMeter(c,"WATER",r.waterReading());
        jdbc.sql("UPDATE rental_checkins SET scheduled_date=:date,electricity_reading=:electricity,water_reading=:water,keys_cards_count=:keys,handover_reference=:reference,version=version+1 WHERE id=:id")
                .param("date",r.scheduledDate()).param("electricity",r.electricityReading()).param("water",r.waterReading()).param("keys",r.keysCardsCount()).param("reference",r.reference()).param("id",ci.get("id")).update();
        ci=checkin(contract);var documents=new HandoverDocuments(jdbc);String content=documents.encode(documents.snapshot(c,ci,r.roomCondition(),r.handoverNote()));String hash=hash(content);GeneratedKeyHolder kh=new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO handover_versions(checkin_id,version,content,content_hash,created_by) VALUES(:id,:version,:content,:hash,:actor)").param("id",ci.get("id")).param("version",ci.get("version")).param("content",content).param("hash",hash).param("actor",p.id()).update(kh,"id");
        confirm("handover_version_id",kh.getKey().longValue(),"LANDLORD",p.id(),hash);audit(contract,p.id(),"HANDOVER_PREPARED",r.reference());notifyHandover(c,"LANDLORD",num(ci,"version"));
    }
    @Transactional
    public void confirmHandover(AuthenticatedUser p,long contract,Confirmation r){var c=access(p,contract,true);var ci=checkin(contract);var hv=handoverVersion(num(ci,"id")).orElseThrow(()->fail("HANDOVER_REQUIRED","Cần chốt biên bản bàn giao trước."));
        rooms.lockRoom(num(c,"room_id"));
        if(!"READY".equals(ci.get("status"))||num(hv,"version")!=r.version()||!Objects.equals(hv.get("content_hash"),r.contentHash())||!handoverMatches(c,ci,hv))throw fail("HANDOVER_VERSION_CONFLICT","Thông tin bàn giao đã thay đổi; cần kiểm tra và chốt phiên bản mới.");
        checkAssets(c,num(ci,"id"));validateKeys(((Number)ci.get("keys_cards_count")).intValue());validateMeter(c,"ELECTRICITY",(BigDecimal)ci.get("electricity_reading"));validateMeter(c,"WATER",(BigDecimal)ci.get("water_reading"));
        String side=party(p,c);if(confirm("handover_version_id",num(hv,"id"),side,p.id(),r.contentHash())){audit(contract,p.id(),"HANDOVER_CONFIRMED",side+"; phiên bản "+r.version());notifyHandover(c,side,r.version());}
    }
    @Transactional
    public void refreshInventory(AuthenticatedUser actor,long contract){
        var c=access(actor,contract,true);staff(actor,c);var ci=checkin(contract);
        if(!"PENDING_CONFIRMATION".equals(c.get("status"))||!"READY".equals(ci.get("status")))throw fail("HANDOVER_NOT_EDITABLE","Chỉ nạp lại kiểm kê trước khi nhận phòng.");
        var current=rows("SELECT id room_asset_id,name asset_name,quantity,condition_status,note FROM room_assets WHERE room_id=:id ORDER BY id",num(c,"room_id"));
        var stored=rows("SELECT room_asset_id,asset_name,quantity,condition_status,note FROM rental_checkin_assets WHERE checkin_id=:id ORDER BY room_asset_id",num(ci,"id"));
        if(assetContent(current).equals(assetContent(stored)))return;
        jdbc.sql("DELETE FROM rental_checkin_assets WHERE checkin_id=:id").param("id",ci.get("id")).update();
        jdbc.sql("INSERT INTO rental_checkin_assets(checkin_id,room_asset_id,asset_name,quantity,condition_status,note) SELECT :ci,id,name,quantity,condition_status,note FROM room_assets WHERE room_id=:room").param("ci",ci.get("id")).param("room",c.get("room_id")).update();
        jdbc.sql("UPDATE rental_checkins SET version=version+1 WHERE id=:id").param("id",ci.get("id")).update();
        audit(contract,actor.id(),"HANDOVER_INVENTORY_REFRESHED","Nạp lại danh mục phòng; cần kiểm kê và chốt lại biên bản nếu nội dung thay đổi.");
    }
    private boolean unchangedHandover(Map<String,Object> c,Map<String,Object> ci,Handover r){
        var prior=handoverVersion(num(ci,"id"));
        if(prior.isPresent()&&num(prior.get(),"version")!=num(ci,"version"))return false;
        if(prior.isPresent()&&!new HandoverDocuments(jdbc).structured(prior.get().get("content").toString()))return false;
        if(prior.isPresent()){var docs=new HandoverDocuments(jdbc);var saved=docs.decode(prior.get().get("content").toString());if(!Objects.equals(docs.extra(saved,"roomCondition"),r.roomCondition())||!Objects.equals(docs.extra(saved,"note"),r.handoverNote()))return false;}
        if(prior.isEmpty()||!Objects.equals(prior.get().get("content_hash"),hash(handoverContent(c,ci)))||!Objects.equals(RoomLifecycleGuard.date(ci.get("scheduled_date")),r.scheduledDate())||!sameMoney(ci.get("electricity_reading"),r.electricityReading())||!sameMoney(ci.get("water_reading"),r.waterReading())||num(ci,"keys_cards_count")!=r.keysCardsCount()||!Objects.equals(ci.get("handover_reference"),r.reference()))return false;
        var stored=rows("SELECT room_asset_id,asset_name,quantity,condition_status,note FROM rental_checkin_assets WHERE checkin_id=:id",num(ci,"id"));
        if(r.assets()==null)return true;
        List<Map<String,Object>> requested=new ArrayList<>();
        if(r.assets().isEmpty())requested=rows("SELECT id room_asset_id,name asset_name,quantity,condition_status,note FROM room_assets WHERE room_id=:id",num(c,"room_id"));
        else for(var asset:r.assets()){var row=new LinkedHashMap<String,Object>();row.put("room_asset_id",asset.roomAssetId());row.put("asset_name",asset.assetName());row.put("quantity",asset.quantity());row.put("condition_status",asset.conditionStatus());row.put("note",asset.note());requested.add(row);}
        return assetContent(stored).equals(assetContent(requested));
    }
    private String assetContent(List<Map<String,Object>> assets){var sorted=new ArrayList<>(assets);sorted.sort(Comparator.comparing(row->Objects.toString(row.get("room_asset_id"),"")));var text=new StringBuilder();appendRows(text,"assets",sorted);return text.toString();}
    public void requireReady(long contract,CompleteCheckin r){var c=raw(contract);validateTerms(c);
        validateKeys(r.keysCardsCount());
        one("SELECT id FROM tenant_profiles WHERE id=:id FOR UPDATE",num(c,"tenant_profile_id"));
        if(!identityValid(c))throw fail("TENANT_IDENTITY_NOT_VERIFIED","Hồ sơ chưa được xác minh hoặc đã thay đổi sau xác minh.");
        if(!contractConfirmed(c))throw fail("CONTRACT_NOT_CONFIRMED","Hai bên chưa xác nhận cùng phiên bản hợp đồng hiện tại.");
        if(!initialPaid(c))throw fail("INITIAL_PAYMENT_REQUIRED","Khoản thuê/phí đầu kỳ bắt buộc chưa được thanh toán đủ qua hóa đơn.");
        var ci=checkin(contract);var hv=handoverVersion(num(ci,"id")).orElseThrow(()->fail("HANDOVER_REQUIRED","Chưa có biên bản bàn giao được chốt."));
        checkAssets(c,num(ci,"id"));
        if(!confirmed("handover_version_id",num(hv,"id"))||!handoverMatches(c,ci,hv))throw fail("HANDOVER_NOT_CONFIRMED","Hai bên chưa xác nhận cùng biên bản hoặc tài sản/chỉ số đã thay đổi.");
        if(!sameMoney(ci.get("electricity_reading"),r.electricityReading())||!sameMoney(ci.get("water_reading"),r.waterReading())||num(ci,"keys_cards_count")!=r.keysCardsCount()||num(ci,"version")!=(r.version()==null?0:r.version()))throw fail("HANDOVER_VERSION_CONFLICT","Chỉ số, khóa/thẻ hoặc version không khớp biên bản đã xác nhận.");
        checkAssets(c,num(ci,"id"));validateMeter(c,"ELECTRICITY",r.electricityReading());validateMeter(c,"WATER",r.waterReading());
        if(num(c,"capacity")<1)throw fail("ROOM_CAPACITY_EXCEEDED","Phòng không có sức chứa hợp lệ.");
    }
    public void activated(long contract,long checkin,long actor){var c=raw(contract);var ci=checkin(contract);
        for(String type:List.of("ELECTRICITY","WATER"))if("METER".equals(rate(contract,type).get("calculation_method"))){var meter=meter(num(c,"room_id"),type);jdbc.sql("INSERT INTO contract_meter_baselines(contract_id,meter_type,checkin_id,meter_id,meter_code,reading,recorded_by) VALUES(:contract,:type,:ci,:meter,:code,:reading,:actor)")
                .param("contract",contract).param("type",type).param("ci",checkin).param("meter",meter.get("id")).param("code",meter.get("meter_code")).param("reading",ci.get("ELECTRICITY".equals(type)?"electricity_reading":"water_reading")).param("actor",actor).update();}
        jdbc.sql("INSERT INTO notifications(user_id,title,content,type,category) VALUES(:tenant,'Đã hoàn tất nhận phòng',:content,'CONTRACT','CONTRACT')").param("tenant",c.get("tenant_id")).param("content","Hợp đồng "+c.get("code")+" đã ACTIVE; biên bản #"+checkin).update();
    }
    @Transactional
    public void replaceMeter(AuthenticatedUser p,long contract,MeterReplacement r){var c=access(p,contract,true);staff(p,c);
        if(!"PENDING_CONFIRMATION".equals(c.get("status")))throw fail("PERIOD_METER_REPLACEMENT_REQUIRED","Sau nhận phòng, ghi thay đồng hồ theo kỳ trong Điện nước để lưu chỉ số tháo/lắp.");
        var m=one("SELECT * FROM utility_meters WHERE id=:id FOR UPDATE",r.meterId()).orElseThrow(()->fail("METER_NOT_FOUND","Không tìm thấy đồng hồ."));if(num(m,"room_id")!=num(c,"room_id"))throw denied();
        jdbc.sql("INSERT INTO utility_meter_events(meter_id,old_code,new_code,old_reading,new_reading,reason,evidence_reference,actor_id) VALUES(:id,:old,:new,:oldReading,:newReading,:reason,:reference,:actor)")
                .param("id",r.meterId()).param("old",m.get("meter_code")).param("new",r.newCode()).param("oldReading",m.get("current_reading")).param("newReading",r.newReading()).param("reason",r.reason()).param("reference",r.reference()).param("actor",p.id()).update();
        jdbc.sql("UPDATE utility_meters SET meter_code=:code,current_reading=:reading,reading_date=CURRENT_DATE WHERE id=:id").param("code",r.newCode()).param("reading",r.newReading()).param("id",r.meterId()).update();audit(contract,p.id(),"METER_REPLACEMENT_RECORDED",r.reference());
    }

    private Map<String,Object> access(AuthenticatedUser p,long id,boolean lock){if(p==null)throw denied();if(lock)rooms.lockContract(id);var c=raw(id);
        boolean allowed=switch(p.activeRole()){case OWNER,MANAGER->{rooms.access(p,num(c,"property_id"));yield true;}case TENANT->num(c,"tenant_id")==p.id();case ACCOUNTANT->accounting.profileExists(p.id())&&accounting.canAccess(p.id(),num(c,"property_id"));default->false;};if(!allowed)throw denied();return c;}
    private void staff(AuthenticatedUser p,Map<String,Object> c){rooms.access(p,num(c,"property_id"));if(p.activeRole()==RoleCode.MANAGER)rooms.capability(p,num(c,"property_id"),com.thangit.boardinghouse.security.PropertyAuthorization.Capability.CONTRACT_APPROVE);}
    private String party(AuthenticatedUser p,Map<String,Object> c){if(p.activeRole()==RoleCode.TENANT&&num(c,"tenant_id")==p.id())return "TENANT";staff(p,c);return "LANDLORD";}
    private Map<String,Object> raw(long id){return one("SELECT c.*,r.property_id,r.capacity,r.code room_code,p.name property_name,p.address,u.id landlord_user_id,u.full_name landlord_name,tp.full_name tenant_name,tp.phone tenant_phone FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id JOIN users u ON u.id=p.owner_id LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id WHERE c.id=:id",id).orElseThrow(()->fail("CONTRACT_NOT_FOUND","Không tìm thấy hợp đồng."));}
    private Map<String,Object> profile(Map<String,Object> c){if(c.get("tenant_profile_id")==null)throw fail("TENANT_PROFILE_REQUIRED","Hợp đồng thiếu hồ sơ đại diện; cần liên kết hồ sơ theo quy trình quản lý người thuê.");return one("SELECT * FROM tenant_profiles WHERE id=:id"+(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()&&!org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly()?" FOR UPDATE":""),num(c,"tenant_profile_id")).orElseThrow(()->fail("TENANT_PROFILE_REQUIRED","Hợp đồng thiếu hồ sơ đại diện."));}
    private boolean identityValid(Map<String,Object> c){if(c.get("tenant_profile_id")==null)return false;var p=profile(c);String hash=identityHash(p);return jdbc.sql("SELECT COUNT(*) FROM tenant_identity_verifications WHERE tenant_profile_id=:id AND data_hash=:hash").param("id",c.get("tenant_profile_id")).param("hash",hash).query(Long.class).single()>0;}
    private String identityHash(Map<String,Object> p){StringBuilder b=new StringBuilder();for(String k:List.of("full_name","date_of_birth","phone","identity_type","identity_number","permanent_address"))field(b,k,p.get(k));return hash(b.toString());}
    private void validateTerms(Map<String,Object> c){if(c.get("agreed_monthly_rent")==null)throw fail("CONTRACT_RENT_RECONCILIATION_REQUIRED","Thiếu giá thuê theo thỏa thuận; không lấy giá niêm yết hiện tại để đoán hợp đồng cũ.");for(String type:List.of("ELECTRICITY","WATER"))rate(num(c,"id"),type);}
    private boolean contractConfirmed(Map<String,Object> c){var v=version(num(c,"id"));return v.isPresent()&&Objects.equals(v.get().get("content_hash"),hash(content(c)))&&confirmed("contract_version_id",num(v.get(),"id"));}
    private boolean initialPaid(Map<String,Object> c){if(!Boolean.TRUE.equals(c.get("initial_payment_required")))return true;if(c.get("initial_invoice_id")==null)return false;return one("SELECT status,remaining_amount FROM invoices WHERE id=:id",num(c,"initial_invoice_id")).map(i->!Set.of("DRAFT","CANCELLED","PENDING_REVIEW").contains(i.get("status"))&&money(i.get("remaining_amount")).signum()==0).orElse(false);}
    private Optional<Map<String,Object>> version(long id){return one("SELECT * FROM contract_versions WHERE contract_id=:id ORDER BY version DESC LIMIT 1",id);}
    private Optional<Map<String,Object>> handoverVersion(long id){return one("SELECT * FROM handover_versions WHERE checkin_id=:id ORDER BY version DESC LIMIT 1",id);}
    private Map<String,Object> checkin(long contract){return one("SELECT * FROM rental_checkins WHERE contract_id=:id FOR UPDATE",contract).orElseThrow(()->fail("CHECKIN_REQUIRED","Chưa tạo hồ sơ nhận phòng."));}
    private List<Map<String,Object>> confirmations(String column,long id){return rows("SELECT rc.party,rc.actor_id,u.full_name actor_name,rc.confirmed_at,rc.content_hash FROM rental_confirmations rc JOIN users u ON u.id=rc.actor_id WHERE rc."+column+"=:id ORDER BY rc.id",id);}
    private boolean confirmed(String column,long id){return confirmations(column,id).stream().map(r->r.get("party")).distinct().count()==2;}
    private boolean confirm(String column,long id,String party,long actor,String hash){
        if(confirmations(column,id).stream().anyMatch(c->!party.equals(c.get("party"))&&num(c,"actor_id")==actor))throw fail("CONFIRMATION_PARTIES_NOT_DISTINCT","Hai bên phải có người xác nhận riêng.");
        return jdbc.sql("INSERT IGNORE INTO rental_confirmations("+column+",party,actor_id,content_hash) VALUES(:id,:party,:actor,:hash)").param("id",id).param("party",party).param("actor",actor).param("hash",hash).update()==1;}
    private String content(Map<String,Object> c){StringBuilder b=new StringBuilder("NỘI DUNG HỢP ĐỒNG — XÁC NHẬN NỘI BỘ\n");for(String k:List.of("id","code","room_id","room_code","property_name","address","landlord_name","tenant_profile_id","tenant_name","tenant_phone","start_date","end_date","agreed_monthly_rent","deposit_amount","payment_cycle","payment_due_day","notice_period_days","initial_payment_required","management_fee","fixed_service_fee","discount_amount"))field(b,k,c.get(k));
        if("DIRECT".equals(c.get("creation_source"))){field(b,"expected_checkin_date",c.get("expected_checkin_date"));field(b,"note",c.get("note"));}
        appendRows(b,"Đơn giá điện nước",rows("SELECT code,name,calculation_method,unit_price,unit,effective_date FROM contract_utility_rates WHERE contract_id=:id ORDER BY code",num(c,"id")));
        appendRows(b,"Dịch vụ",rows("SELECT code,name,calculation_method,unit_price,effective_date FROM contract_services WHERE contract_id=:id ORDER BY id",num(c,"id")));
        appendRows(b,"Điều khoản",rows("SELECT title,content FROM contract_terms WHERE contract_id=:id ORDER BY display_order,id",num(c,"id")));var extended=rows("SELECT code,catalog_service_id,description,unit,quantity,billing_cycle,end_date,status,note,prorate FROM contract_services WHERE contract_id=:id AND snapshot_version>0 ORDER BY id",num(c,"id"));if(!extended.isEmpty())appendRows(b,"Service snapshot v1",extended);return b.toString();}
    private String legacyHandoverContent(Map<String,Object> c,Map<String,Object> ci){StringBuilder b=new StringBuilder("BIÊN BẢN BÀN GIAO — XÁC NHẬN NỘI BỘ\n");field(b,"contract_id",c.get("id"));field(b,"tenant_id",c.get("tenant_id"));for(String k:List.of("id","scheduled_date","electricity_reading","water_reading","keys_cards_count","handover_reference"))field(b,k,ci.get(k));appendRows(b,"Tài sản",rows("SELECT room_asset_id,asset_name,quantity,condition_status,note FROM rental_checkin_assets WHERE checkin_id=:id ORDER BY id",num(ci,"id")));appendRows(b,"Đồng hồ",rows("SELECT id,meter_type,meter_code FROM utility_meters WHERE room_id=:id ORDER BY meter_type",num(c,"room_id")));return b.toString();}
    private String handoverContent(Map<String,Object> c,Map<String,Object> ci){
        var prior=handoverVersion(num(ci,"id"));var docs=new HandoverDocuments(jdbc);
        if(prior.isPresent()&&docs.structured(prior.get().get("content").toString())){var saved=docs.decode(prior.get().get("content").toString());return docs.encode(docs.snapshot(c,ci,docs.extra(saved,"roomCondition"),docs.extra(saved,"note")));}
        return legacyHandoverContent(c,ci);
    }
    private String handoverContextHash(Map<String,Object> c,Map<String,Object> ci){var documents=new HandoverDocuments(jdbc);return hash(documents.encode(documents.snapshot(c,ci,null,null)));}
    private void notifyHandover(Map<String,Object> c,String side,long version){
        var recipients="LANDLORD".equals(side)?List.of(num(c,"tenant_id")):jdbc.sql("SELECT DISTINCT u.id FROM users u WHERE u.status='ACTIVE' AND (u.id=(SELECT owner_id FROM properties WHERE id=:property) OR EXISTS(SELECT 1 FROM property_managers pm JOIN manager_property_capabilities cap ON cap.property_id=pm.property_id AND cap.manager_id=pm.manager_id WHERE pm.property_id=:property AND pm.manager_id=u.id AND cap.capability='CONTRACT_APPROVE'))").param("property",c.get("property_id")).query(Long.class).list();
        for(long recipient:recipients)jdbc.sql("INSERT INTO notifications(user_id,title,content,type,category,property_id,room_id,reference_type,reference_id) VALUES(:user,'Xác nhận biên bản bàn giao',:content,'CONTRACT','CONTRACT',:property,:room,'CONTRACT',:id)").param("user",recipient).param("content",("LANDLORD".equals(side)?"Bên cho thuê":"Người thuê")+" đã xác nhận biên bản bàn giao hợp đồng "+c.get("code")+", phiên bản "+version+". Mở biên bản để kiểm tra tiến độ.").param("property",c.get("property_id")).param("room",c.get("room_id")).param("id",c.get("id")).update();
    }
    private List<Map<String,String>> handoverIssues(Map<String,Object> c,Map<String,Object> ci){
        var issues=new ArrayList<Map<String,String>>();if("COMPLETED".equals(ci.get("status")))return issues;
        if(num(ci,"keys_cards_count")<0||num(ci,"keys_cards_count")>maxKeysCards)issues.add(Map.of("key","keysCardsCount","label","Số chìa khóa/thẻ vượt chính sách hiện tại; cần kiểm tra và lập lại biên bản."));
        if(jdbc.sql("SELECT COUNT(*) FROM room_assets a WHERE a.room_id=:room AND NOT EXISTS(SELECT 1 FROM rental_checkin_assets x WHERE x.checkin_id=:ci AND x.room_asset_id=a.id AND x.quantity=a.quantity)").param("room",c.get("room_id")).param("ci",ci.get("id")).query(Long.class).single()>0)issues.add(Map.of("key","catalog","label","Danh mục tài sản thay đổi hoặc chưa kiểm kê đủ; nạp lại danh mục và kiểm tra từng tài sản."));
        for(var utility:rows("SELECT code,name FROM contract_utility_rates WHERE contract_id=:id AND calculation_method='METER'",num(c,"id"))){String type=utility.get("code").toString();
            var active=jdbc.sql("SELECT * FROM utility_meters WHERE room_id=:room AND meter_type=:type AND status='ACTIVE'").param("room",c.get("room_id")).param("type",type).query().listOfRows();
            if(active.size()!=1){issues.add(Map.of("key","meters","label","Thiếu công tơ "+("ELECTRICITY".equals(type)?"điện":"nước")+" đang hoạt động thuộc phòng."));continue;}
            Object reading=ci.get("ELECTRICITY".equals(type)?"electricity_reading":"water_reading");
            var event=lastMeterEvent(num(active.getFirst(),"id"));
            if(event.isPresent()&&!Objects.equals(event.get().get("new_code"),active.getFirst().get("meter_code")))issues.add(Map.of("key","meters","label","Mã công tơ không khớp sự kiện lắp/thay gần nhất; cần đối chiếu lịch sử."));
            BigDecimal floor=meterFloor(active.getFirst(),event);
            if(reading==null||money(reading).compareTo(floor)<0)issues.add(Map.of("key","readings","label","Chỉ số "+("ELECTRICITY".equals(type)?"điện":"nước")+" thiếu hoặc thấp hơn chỉ số công tơ/lịch sử lắp gần nhất; đối chiếu số thực tế và lịch sử thay/reset."));
        }return issues;
    }
    private boolean handoverMatches(Map<String,Object> c,Map<String,Object> ci,Map<String,Object> v){
        String stored=v.get("content").toString();if(!Objects.equals(v.get("content_hash"),hash(stored)))return false;
        if("COMPLETED".equals(ci.get("status")))return true;
        if(num(v,"version")!=num(ci,"version"))return false;
        if(!new HandoverDocuments(jdbc).structured(stored)&&legacyMeterEventsChanged(c,v))return false;
        return handoverIssues(c,ci).isEmpty()&&Objects.equals(v.get("content_hash"),hash(handoverContent(c,ci)));
    }
    private boolean legacyMeterEventsChanged(Map<String,Object> c,Map<String,Object> v){return jdbc.sql("SELECT COUNT(*) FROM utility_meter_events e JOIN utility_meters m ON m.id=e.meter_id WHERE m.room_id=:room AND e.occurred_at>:created").param("room",c.get("room_id")).param("created",v.get("created_at")).query(Long.class).single()>0;}
    private Map<String,Object> handoverDocument(Map<String,Object> c,Map<String,Object> ci,Map<String,Object> v){
        var docs=new HandoverDocuments(jdbc);String content=v.get("content").toString();var snapshot=docs.decode(content);
        var latest=handoverVersion(num(ci,"id"));boolean isLatest=latest.isPresent()&&num(latest.get(),"id")==num(v,"id");
        boolean current=isLatest&&handoverMatches(c,ci,v);var confirmations=confirmations("handover_version_id",num(v,"id"));
        var changes=new ArrayList<Map<String,String>>();if(isLatest&&!"COMPLETED".equals(ci.get("status"))){
            var live=docs.structured(content)?docs.snapshot(c,ci,docs.extra(snapshot,"roomCondition"),docs.extra(snapshot,"note")):docs.decode(legacyHandoverContent(c,ci));changes.addAll(docs.changes(snapshot,live));changes.addAll(handoverIssues(c,ci));
            if(!docs.structured(content)&&legacyMeterEventsChanged(c,v))changes.add(Map.of("key","meters","label","Có sự kiện lắp/thay/reset công tơ sau khi chốt phiên bản cũ; cần kiểm tra và chốt bản mới."));
            if(num(v,"version")!=num(ci,"version"))changes.add(Map.of("key","general","label","Bản kiểm kê đã được cập nhật sau khi chốt; cần kiểm tra và lập phiên bản biên bản mới."));
        }
        var result=new LinkedHashMap<String,Object>();result.put("id",v.get("id"));result.put("version",v.get("version"));result.put("contentHash",v.get("content_hash"));result.put("createdAt",v.get("created_at"));result.put("code","BBBG-"+c.get("id")+"-"+v.get("version"));result.put("snapshot",snapshot);result.put("confirmations",confirmations);result.put("current",current);result.put("latest",isLatest);result.put("changes",changes);
        result.put("status",!isLatest?"SUPERSEDED":!current?"CHANGED":confirmed("handover_version_id",num(v,"id"))?"BOTH_CONFIRMED":"WAITING_CONFIRMATION");
        result.put("integrityValid",Objects.equals(v.get("content_hash"),hash(content)));result.put("liveHash",handoverContextHash(c,ci));return result;
    }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> handoverHistory(AuthenticatedUser actor,long contract){var c=access(actor,contract,false);
        return rows("SELECT hv.id,hv.version,hv.created_at,u.full_name actor_name FROM handover_versions hv JOIN rental_checkins ci ON ci.id=hv.checkin_id JOIN users u ON u.id=hv.created_by WHERE ci.contract_id=:id ORDER BY hv.version DESC",contract);
    }
    @Transactional(readOnly=true)
    public Map<String,Object> handoverDocument(AuthenticatedUser actor,long contract,long selectedVersion){var c=access(actor,contract,false);var ci=one("SELECT * FROM rental_checkins WHERE contract_id=:id",contract).orElseThrow(()->fail("HANDOVER_REQUIRED","Chưa có biên bản bàn giao."));
        var v=jdbc.sql("SELECT * FROM handover_versions WHERE checkin_id=:id AND version=:version").param("id",ci.get("id")).param("version",selectedVersion).query().listOfRows().stream().findFirst().orElseThrow(()->fail("HANDOVER_VERSION_NOT_FOUND","Không tìm thấy phiên bản biên bản của hợp đồng này."));return handoverDocument(c,ci,v);
    }
    private void checkAssets(Map<String,Object> c,long ci){long missing=jdbc.sql("SELECT COUNT(*) FROM room_assets a WHERE a.room_id=:room AND NOT EXISTS(SELECT 1 FROM rental_checkin_assets x WHERE x.checkin_id=:ci AND x.room_asset_id=a.id AND x.quantity=a.quantity)").param("room",c.get("room_id")).param("ci",ci).query(Long.class).single();if(missing>0)throw fail("HANDOVER_ASSETS_INCOMPLETE","Danh mục phòng đã thay đổi hoặc chưa kiểm kê đủ tài sản; cần lập lại biên bản.");}
    private Map<String,Object> rate(long contract,String type){return jdbc.sql("SELECT * FROM contract_utility_rates WHERE contract_id=:id AND code=:type").param("id",contract).param("type",type).query().listOfRows().stream().findFirst().orElseThrow(()->fail("UTILITY_POLICY_REQUIRED","Cần chốt cách tính "+type+" (đồng hồ riêng hoặc phí cố định)."));}
    private Map<String,Object> meter(long room,String type){return jdbc.sql("SELECT * FROM utility_meters WHERE room_id=:room AND meter_type=:type AND status='ACTIVE' FOR UPDATE").param("room",room).param("type",type).query().listOfRows().stream().findFirst().orElseThrow(()->fail("ROOM_METER_REQUIRED","Phòng thiếu đồng hồ "+type+" đang hoạt động."));}
    private Optional<Map<String,Object>> lastMeterEvent(long id){return one("SELECT new_code,new_reading FROM utility_meter_events WHERE meter_id=:id ORDER BY id DESC LIMIT 1",id);}
    private BigDecimal meterFloor(Map<String,Object> meter,Optional<Map<String,Object>> event){return money(meter.get("current_reading")).max(event.map(e->money(e.get("new_reading"))).orElse(BigDecimal.ZERO));}
    private void validateMeter(Map<String,Object> c,String type,BigDecimal reading){var r=rate(num(c,"id"),type);if(!"METER".equals(r.get("calculation_method")))return;var m=meter(num(c,"room_id"),type);var event=lastMeterEvent(num(m,"id"));if(event.isPresent()&&!Objects.equals(event.get().get("new_code"),m.get("meter_code")))throw fail("METER_HISTORY_CONFLICT","Mã công tơ không khớp sự kiện lắp/thay gần nhất; cần đối chiếu lịch sử.");if(reading==null||reading.signum()<0)throw fail("CHECKIN_METERS_REQUIRED","Thiếu chỉ số "+("ELECTRICITY".equals(type)?"điện":"nước")+" theo chính sách hợp đồng.");if(reading.compareTo(meterFloor(m,event))<0)throw fail("METER_READING_INVALID","Chỉ số thấp hơn công tơ hoặc lịch sử lắp gần nhất; cần ghi sự kiện thay/reset có chứng từ trước.");}
    private void audit(long contract,long actor,String event,String reason){jdbc.sql("INSERT INTO contract_history(contract_id,event_type,description,actor_name,note) VALUES(:id,:event,:description,(SELECT full_name FROM users WHERE id=:actor),:note)").param("id",contract).param("event",event).param("description",reason.length()>500?reason.substring(0,500):reason).param("actor",actor).param("note",reason.length()>500?reason.substring(0,500):reason).update();}
    private Optional<Map<String,Object>> one(String sql,long id){return rows(sql,id).stream().findFirst();}
    private List<Map<String,Object>> rows(String sql,long id){return jdbc.sql(sql).param("id",id).query().listOfRows();}
    private static void appendRows(StringBuilder b,String label,List<Map<String,Object>> rows){b.append(label).append('\n');for(var row:rows)for(var e:new TreeMap<>(row).entrySet())field(b,e.getKey(),e.getValue());}
    private static void field(StringBuilder b,String k,Object value){String s=Objects.toString(value,"").replace("\\","\\\\").replace("\n","\\n").replace("\r","\\r");b.append(k).append(": ").append(s).append('\n');}
    private static String hash(String s){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private static long num(Map<String,Object> m,String k){return ((Number)m.get(k)).longValue();}
    private static BigDecimal money(Object v){return v==null?BigDecimal.ZERO:new BigDecimal(v.toString());}
    private static boolean sameMoney(Object a,BigDecimal b){return a==null?b==null:b!=null&&money(a).compareTo(b)==0;}
    private static AuthException fail(String c,String m){return new AuthException(HttpStatus.CONFLICT,c,m);}
    private static AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"ONBOARDING_ACCESS_DENIED","Không có quyền thao tác hồ sơ nhận phòng này.");}
}
