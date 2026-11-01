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
    public record Confirmation(@Positive long version,@NotBlank @Size(min=64,max=64) String contentHash) {}
    public record Revision(@NotBlank @Size(max=1000) String reason) {}
    public record InitialInvoice(@Positive long invoiceId) {}
    public record Handover(@NotNull Long version,@NotNull LocalDate scheduledDate,
            @DecimalMin("0") BigDecimal electricityReading,@DecimalMin("0") BigDecimal waterReading,
            @Min(0) int keysCardsCount,@NotBlank @Size(max=500) String reference,@Valid List<AssetSnapshot> assets) {
        public Handover(Long version,LocalDate date,BigDecimal electricity,BigDecimal water,int keys,String reference){this(version,date,electricity,water,keys,reference,null);}
    }
    public record TermsChange(@NotNull @Valid CreateContract terms,@NotBlank @Size(max=1000) String reason) {}
    public record MeterReplacement(@Positive long meterId,@NotBlank @Size(max=50) String newCode,
            @NotNull @DecimalMin("0") BigDecimal newReading,@NotBlank @Size(max=1000) String reason,
            @NotBlank @Size(max=500) String reference) {}
    private final JdbcClient jdbc;
    private final RoomLifecycleGuard rooms;
    private final AccountantPortalRepository accounting;
    public ContractOnboardingService(JdbcClient jdbc,RoomLifecycleGuard rooms,AccountantPortalRepository accounting){this.jdbc=jdbc;this.rooms=rooms;this.accounting=accounting;}

    @Transactional(readOnly=true)
    public Map<String,Object> detail(AuthenticatedUser p,long contract){var c=access(p,contract,false);
        Map<String,Object> draft=new LinkedHashMap<>();for(String key:List.of("status","start_date","end_date","deposit_amount","payment_due_day","notice_period_days"))draft.put(key,c.get(key));
        Map<String,Object> out=new LinkedHashMap<>();out.put("contractId",contract);out.put("version",c.get("onboarding_version"));out.put("monthlyRent",c.get("agreed_monthly_rent"));out.put("initialPaymentRequired",c.get("initial_payment_required"));out.put("initialInvoiceId",c.get("initial_invoice_id"));
        out.put("draft",draft);
        var v=version(contract);out.put("contractVersion",v.orElse(null));
        if(p.activeRole()==RoleCode.ACCOUNTANT&&v.isPresent()){var visible=new LinkedHashMap<String,Object>(v.get());visible.remove("content");out.put("contractVersion",visible);}
        out.put("contractConfirmations",v.isEmpty()?List.of():confirmations("contract_version_id",num(v.get(),"id")));
        out.put("identityVerified",identityValid(c));out.put("contractConfirmed",contractConfirmed(c));out.put("initialPaymentSatisfied",initialPaid(c));
        out.put("utilityRates",rows("SELECT code,name,calculation_method,unit_price,unit FROM contract_utility_rates WHERE contract_id=:id ORDER BY code",contract));
        out.put("services",rows("SELECT code,name,calculation_method,unit_price FROM contract_services WHERE contract_id=:id ORDER BY id",contract));
        out.put("terms",rows("SELECT title,content FROM contract_terms WHERE contract_id=:id ORDER BY display_order,id",contract));
        var ci=one("SELECT id,version,status,scheduled_date,electricity_reading,water_reading,keys_cards_count,handover_reference,actual_checkin_at,completed_by FROM rental_checkins WHERE contract_id=:id",contract);
        out.put("checkin",ci.orElse(null));
        if(ci.isPresent()){
            long id=num(ci.get(),"id");out.put("assets",rows("SELECT room_asset_id,asset_name,quantity,condition_status,note FROM rental_checkin_assets WHERE checkin_id=:id ORDER BY id",id));
            var hv=handoverVersion(id);out.put("handoverVersion",hv.orElse(null));out.put("handoverConfirmations",hv.isEmpty()?List.of():confirmations("handover_version_id",num(hv.get(),"id")));
        }
        out.put("meters",rows("SELECT id,meter_type,meter_code,current_reading,status FROM utility_meters WHERE room_id=:id ORDER BY meter_type",num(c,"room_id")));
        out.put("deposit",one("SELECT required_amount,balance_amount,reconciliation_status,GREATEST(required_amount-balance_amount,0) remaining_due FROM tenant_deposits WHERE contract_id=:id",contract).orElse(null));
        out.put("confirmationNotice","Xác nhận nội bộ theo phiên bản nội dung; không phải chứng nhận chữ ký điện tử có giá trị pháp lý.");return out;
    }

    public void initialize(long contract,CreateContract r,long actor){
        if(r.utilityRates()!=null && r.utilityRates().stream().map(AgreedRate::code).distinct().count()!=r.utilityRates().size())throw fail("UTILITY_POLICY_INVALID","Mỗi loại điện/nước chỉ có một chính sách trong hợp đồng.");
        if(r.utilityRates()!=null)for(var rate:r.utilityRates())jdbc.sql("INSERT INTO contract_utility_rates(contract_id,code,name,calculation_method,unit_price,unit,effective_date) SELECT :id,:code,:name,:method,:price,:unit,start_date FROM contracts WHERE id=:id")
                .param("id",contract).param("code",rate.code()).param("name",rate.name()).param("method",rate.calculationMethod()).param("price",rate.unitPrice()).param("unit",rate.unit()).update();
        if(r.services()!=null)for(var service:r.services())jdbc.sql("INSERT INTO contract_services(contract_id,code,name,calculation_method,unit_price,effective_date) SELECT :id,:code,:name,:method,:price,start_date FROM contracts WHERE id=:id")
                .param("id",contract).param("code",service.code()).param("name",service.name()).param("method",service.calculationMethod()).param("price",service.unitPrice()).update();
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
        Long booking=jdbc.sql("SELECT id FROM rental_bookings WHERE contract_id=:id").param("id",contract).query(Long.class).single();
        rooms.contractDates(num(c,"room_id"),terms.startDate(),terms.endDate(),contract,booking);
        if(terms.monthlyRent()==null)throw fail("CONTRACT_RENT_REQUIRED","Cần giá thuê theo thỏa thuận.");
        jdbc.sql("UPDATE contracts SET start_date=:start,end_date=:end,agreed_monthly_rent=:rent,payment_due_day=:due,notice_period_days=:notice,initial_payment_required=:initial WHERE id=:id")
                .param("start",terms.startDate()).param("end",terms.endDate()).param("rent",terms.monthlyRent()).param("due",terms.paymentDueDay()).param("notice",terms.noticePeriodDays()).param("initial",terms.initialPaymentRequired()).param("id",contract).update();
        for(String table:List.of("contract_utility_rates","contract_services","contract_terms"))jdbc.sql("DELETE FROM "+table+" WHERE contract_id=:id").param("id",contract).update();
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
        for(String key:List.of("full_name","date_of_birth","phone","identity_type","identity_number","permanent_address"))if(profile.get(key)==null||profile.get(key).toString().isBlank())throw fail("TENANT_PROFILE_INCOMPLETE","Thiếu thông tin hồ sơ: "+key+". Cập nhật hồ sơ trước khi xác minh.");
        if(RoomLifecycleGuard.date(profile.get("date_of_birth")).isAfter(LocalDate.now()))throw fail("TENANT_PROFILE_INCOMPLETE","Ngày sinh không hợp lệ.");
        jdbc.sql("INSERT INTO tenant_identity_verifications(tenant_profile_id,data_hash,evidence_reference,verified_by) VALUES(:id,:hash,:evidence,:actor)").param("id",c.get("tenant_profile_id")).param("hash",identityHash(profile)).param("evidence",r.reference()).param("actor",p.id()).update();audit(contract,p.id(),"IDENTITY_VERIFIED",r.reference());
    }
    @Transactional
    public void confirmContract(AuthenticatedUser p,long contract,Confirmation r){var c=access(p,contract,true);
        if(!"PENDING_CONFIRMATION".equals(c.get("status"))&&!Set.of("ACTIVE","EXPIRING").contains(c.get("status")))throw fail("CONTRACT_NOT_CONFIRMABLE","Hợp đồng không còn chờ xác nhận nội dung.");
        validateTerms(c);var v=version(contract).orElseThrow(()->fail("CONTRACT_SNAPSHOT_REQUIRED","Chưa chốt nội dung hợp đồng."));
        if(num(v,"version")!=r.version()||!Objects.equals(v.get("content_hash"),r.contentHash())||!r.contentHash().equals(hash(content(c))))throw fail("CONTRACT_VERSION_CONFLICT","Nội dung đã thay đổi; phải đọc và xác nhận phiên bản mới.");
        String party=party(p,c);confirm("contract_version_id",num(v,"id"),party,p.id(),r.contentHash());
        if(confirmed("contract_version_id",num(v,"id")))jdbc.sql("UPDATE contracts SET signed_at=COALESCE(signed_at,NOW()) WHERE id=:id").param("id",contract).update();audit(contract,p.id(),"CONTRACT_CONFIRMED",party+"; phiên bản "+r.version());
    }
    @Transactional
    public void linkInvoice(AuthenticatedUser p,long contract,InitialInvoice r){var c=access(p,contract,true);
        if(p.activeRole()==RoleCode.TENANT||p.activeRole()==RoleCode.TECHNICIAN)throw denied();
        if(p.activeRole()==RoleCode.ACCOUNTANT&&!accounting.permission(p.id(),"can_record_payment"))throw denied();
        var invoice=one("SELECT * FROM invoices WHERE id=:id FOR UPDATE",r.invoiceId()).orElseThrow(()->fail("INVOICE_NOT_FOUND","Không tìm thấy hóa đơn đầu kỳ."));
        if(num(invoice,"contract_id")!=contract||!"RENTAL".equals(invoice.get("invoice_kind"))||!RoomLifecycleGuard.date(invoice.get("billing_period")).equals(RoomLifecycleGuard.date(c.get("start_date")).withDayOfMonth(1))||Set.of("DRAFT","CANCELLED","PENDING_REVIEW").contains(invoice.get("status")))throw fail("INITIAL_INVOICE_INVALID","Phải chọn hóa đơn thuê đã phát hành đúng hợp đồng và tháng bắt đầu.");
        if(c.get("initial_invoice_id")!=null&&num(c,"initial_invoice_id")!=r.invoiceId())throw fail("INITIAL_INVOICE_ALREADY_LINKED","Nghĩa vụ đầu kỳ đã gắn hóa đơn; không thay âm thầm.");
        if(c.get("agreed_monthly_rent")==null || jdbc.sql("SELECT COUNT(*) FROM invoice_items WHERE invoice_id=:id AND item_type='ROOM_RENT' AND source_type='CONTRACT' AND source_id=:contract AND ((unit_price=:rent AND quantity=1 AND amount=:rent) OR (:daily=TRUE AND unit='ngày' AND unit_price=ROUND(:rent/DAY(LAST_DAY(:period)),8) AND quantity=:days AND amount=ROUND(:rent*:days/DAY(LAST_DAY(:period)),2)))").param("id",r.invoiceId()).param("contract",contract).param("rent",c.get("agreed_monthly_rent")).param("daily","ACTUAL_DAYS".equals(c.get("rent_proration"))).param("period",invoice.get("billing_period")).param("days",java.time.temporal.ChronoUnit.DAYS.between(RoomLifecycleGuard.date(c.get("start_date")),RoomLifecycleGuard.date(c.get("end_date")).isBefore(RoomLifecycleGuard.date(invoice.get("billing_period")).plusMonths(1))?RoomLifecycleGuard.date(c.get("end_date")):RoomLifecycleGuard.date(invoice.get("billing_period")).plusMonths(1))).query(Long.class).single()!=1)throw fail("INITIAL_INVOICE_RENT_MISMATCH","Hóa đơn phải có đúng khoản thuê theo giá và chính sách phân bổ đã chốt.");
        jdbc.sql("UPDATE contracts SET initial_invoice_id=:invoice WHERE id=:id").param("invoice",r.invoiceId()).param("id",contract).update();audit(contract,p.id(),"INITIAL_INVOICE_LINKED","Hóa đơn #"+r.invoiceId());
    }

    public void validatePrepare(long contract,List<AssetSnapshot> assets){var c=raw(contract);if(assets==null||assets.isEmpty())return;
        var inventory=rows("SELECT id,quantity FROM room_assets WHERE room_id=:id ORDER BY id",num(c,"room_id"));Set<Long> seen=new HashSet<>();
        for(var asset:assets){if(asset.roomAssetId()==null||!seen.add(asset.roomAssetId()))throw fail("HANDOVER_ASSET_INVALID","Tài sản bàn giao phải có liên kết phòng, không được lặp.");var actual=inventory.stream().filter(a->num(a,"id")==asset.roomAssetId()).findFirst().orElseThrow(()->fail("HANDOVER_ASSET_INVALID","Tài sản không thuộc phòng."));if(num(actual,"quantity")!=asset.quantity())throw fail("HANDOVER_ASSET_INVALID","Số lượng phải khớp danh mục; ghi rõ tình trạng MISSING nếu thiếu thực tế.");}
        if(seen.size()!=inventory.size())throw fail("HANDOVER_ASSETS_INCOMPLETE","Chưa kiểm kê đầy đủ tài sản của phòng.");
    }
    @Transactional
    public void saveHandover(AuthenticatedUser p,long contract,Handover r){var c=access(p,contract,true);staff(p,c);rooms.checkin(contract,r.scheduledDate());
        var ci=checkin(contract);if(!"READY".equals(ci.get("status"))||num(ci,"version")!=r.version())throw fail("CHECKIN_VERSION_CONFLICT","Biên bản đã thay đổi hoặc đã bàn giao.");
        if(r.assets()!=null){validatePrepare(contract,r.assets());jdbc.sql("DELETE FROM rental_checkin_assets WHERE checkin_id=:id").param("id",ci.get("id")).update();
            if(r.assets().isEmpty())jdbc.sql("INSERT INTO rental_checkin_assets(checkin_id,room_asset_id,asset_name,quantity,condition_status,note) SELECT :ci,id,name,quantity,condition_status,note FROM room_assets WHERE room_id=:room").param("ci",ci.get("id")).param("room",c.get("room_id")).update();
            else for(var a:r.assets())jdbc.sql("INSERT INTO rental_checkin_assets(checkin_id,room_asset_id,asset_name,quantity,condition_status,note) VALUES(:ci,:asset,:name,:quantity,:condition,:note)").param("ci",ci.get("id")).param("asset",a.roomAssetId()).param("name",a.assetName()).param("quantity",a.quantity()).param("condition",a.conditionStatus()).param("note",a.note()).update();
        }
        checkAssets(c,num(ci,"id"));validateMeter(c,"ELECTRICITY",r.electricityReading());validateMeter(c,"WATER",r.waterReading());
        jdbc.sql("UPDATE rental_checkins SET scheduled_date=:date,electricity_reading=:electricity,water_reading=:water,keys_cards_count=:keys,handover_reference=:reference,version=version+1 WHERE id=:id")
                .param("date",r.scheduledDate()).param("electricity",r.electricityReading()).param("water",r.waterReading()).param("keys",r.keysCardsCount()).param("reference",r.reference()).param("id",ci.get("id")).update();
        ci=checkin(contract);String content=handoverContent(c,ci);String hash=hash(content);GeneratedKeyHolder kh=new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO handover_versions(checkin_id,version,content,content_hash,created_by) VALUES(:id,:version,:content,:hash,:actor)").param("id",ci.get("id")).param("version",ci.get("version")).param("content",content).param("hash",hash).param("actor",p.id()).update(kh,"id");
        confirm("handover_version_id",kh.getKey().longValue(),"LANDLORD",p.id(),hash);audit(contract,p.id(),"HANDOVER_PREPARED",r.reference());
    }
    @Transactional
    public void confirmHandover(AuthenticatedUser p,long contract,Confirmation r){var c=access(p,contract,true);var ci=checkin(contract);var hv=handoverVersion(num(ci,"id")).orElseThrow(()->fail("HANDOVER_REQUIRED","Cần chốt biên bản bàn giao trước."));
        if(!"READY".equals(ci.get("status"))||num(hv,"version")!=r.version()||!Objects.equals(hv.get("content_hash"),r.contentHash())||!r.contentHash().equals(hash(handoverContent(c,ci))))throw fail("HANDOVER_VERSION_CONFLICT","Biên bản đã thay đổi; phải xem phiên bản mới.");
        confirm("handover_version_id",num(hv,"id"),party(p,c),p.id(),r.contentHash());audit(contract,p.id(),"HANDOVER_CONFIRMED",party(p,c)+"; phiên bản "+r.version());
    }
    public void requireReady(long contract,CompleteCheckin r){var c=raw(contract);validateTerms(c);
        one("SELECT id FROM tenant_profiles WHERE id=:id FOR UPDATE",num(c,"tenant_profile_id"));
        if(!identityValid(c))throw fail("TENANT_IDENTITY_NOT_VERIFIED","Hồ sơ chưa được xác minh hoặc đã thay đổi sau xác minh.");
        if(!contractConfirmed(c))throw fail("CONTRACT_NOT_CONFIRMED","Hai bên chưa xác nhận cùng phiên bản hợp đồng hiện tại.");
        if(!initialPaid(c))throw fail("INITIAL_PAYMENT_REQUIRED","Khoản thuê/phí đầu kỳ bắt buộc chưa được thanh toán đủ qua hóa đơn.");
        var ci=checkin(contract);var hv=handoverVersion(num(ci,"id")).orElseThrow(()->fail("HANDOVER_REQUIRED","Chưa có biên bản bàn giao được chốt."));
        if(!confirmed("handover_version_id",num(hv,"id"))||!Objects.equals(hv.get("content_hash"),hash(handoverContent(c,ci))))throw fail("HANDOVER_NOT_CONFIRMED","Hai bên chưa xác nhận cùng biên bản hoặc tài sản/chỉ số đã thay đổi.");
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
        if(!"PENDING_CONFIRMATION".equals(c.get("status")))throw fail("PERIOD_METER_REPLACEMENT_REQUIRED","Sau nh?n ph?ng, ghi thay ??ng h? theo k? trong ?i?n n??c ?? l?u ch? s? th?o/l?p.");
        var m=one("SELECT * FROM utility_meters WHERE id=:id FOR UPDATE",r.meterId()).orElseThrow(()->fail("METER_NOT_FOUND","Không tìm thấy đồng hồ."));if(num(m,"room_id")!=num(c,"room_id"))throw denied();
        jdbc.sql("INSERT INTO utility_meter_events(meter_id,old_code,new_code,old_reading,new_reading,reason,evidence_reference,actor_id) VALUES(:id,:old,:new,:oldReading,:newReading,:reason,:reference,:actor)")
                .param("id",r.meterId()).param("old",m.get("meter_code")).param("new",r.newCode()).param("oldReading",m.get("current_reading")).param("newReading",r.newReading()).param("reason",r.reason()).param("reference",r.reference()).param("actor",p.id()).update();
        jdbc.sql("UPDATE utility_meters SET meter_code=:code,current_reading=:reading,reading_date=CURRENT_DATE WHERE id=:id").param("code",r.newCode()).param("reading",r.newReading()).param("id",r.meterId()).update();audit(contract,p.id(),"METER_REPLACEMENT_RECORDED",r.reference());
    }

    private Map<String,Object> access(AuthenticatedUser p,long id,boolean lock){if(p==null)throw denied();if(lock)rooms.lockContract(id);var c=raw(id);
        boolean allowed=switch(p.activeRole()){case OWNER,MANAGER->{rooms.access(p,num(c,"property_id"));yield true;}case TENANT->num(c,"tenant_id")==p.id();case ACCOUNTANT->accounting.profileExists(p.id())&&accounting.canAccess(p.id(),num(c,"property_id"));default->false;};if(!allowed)throw denied();return c;}
    private void staff(AuthenticatedUser p,Map<String,Object> c){rooms.access(p,num(c,"property_id"));if(p.activeRole()==RoleCode.MANAGER)rooms.capability(p,num(c,"property_id"),com.thangit.boardinghouse.security.PropertyAuthorization.Capability.CONTRACT_APPROVE);}
    private String party(AuthenticatedUser p,Map<String,Object> c){if(p.activeRole()==RoleCode.TENANT&&num(c,"tenant_id")==p.id())return "TENANT";staff(p,c);return "LANDLORD";}
    private Map<String,Object> raw(long id){return one("SELECT c.*,r.property_id,r.capacity,r.code room_code,p.name property_name,p.address,u.full_name landlord_name,tp.full_name tenant_name,tp.phone tenant_phone FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id JOIN users u ON u.id=p.owner_id LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id WHERE c.id=:id",id).orElseThrow(()->fail("CONTRACT_NOT_FOUND","Không tìm thấy hợp đồng."));}
    private Map<String,Object> profile(Map<String,Object> c){return one("SELECT * FROM tenant_profiles WHERE id=:id"+(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()&&!org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly()?" FOR UPDATE":""),num(c,"tenant_profile_id")).orElseThrow(()->fail("TENANT_PROFILE_REQUIRED","Hợp đồng thiếu hồ sơ đại diện."));}
    private boolean identityValid(Map<String,Object> c){if(c.get("tenant_profile_id")==null)return false;var p=profile(c);String hash=identityHash(p);return jdbc.sql("SELECT COUNT(*) FROM tenant_identity_verifications WHERE tenant_profile_id=:id AND data_hash=:hash").param("id",c.get("tenant_profile_id")).param("hash",hash).query(Long.class).single()>0;}
    private String identityHash(Map<String,Object> p){StringBuilder b=new StringBuilder();for(String k:List.of("full_name","date_of_birth","phone","identity_type","identity_number","permanent_address"))field(b,k,p.get(k));return hash(b.toString());}
    private void validateTerms(Map<String,Object> c){if(c.get("agreed_monthly_rent")==null)throw fail("CONTRACT_RENT_RECONCILIATION_REQUIRED","Thiếu giá thuê theo thỏa thuận; không lấy giá niêm yết hiện tại để đoán hợp đồng cũ.");for(String type:List.of("ELECTRICITY","WATER"))rate(num(c,"id"),type);}
    private boolean contractConfirmed(Map<String,Object> c){var v=version(num(c,"id"));return v.isPresent()&&Objects.equals(v.get().get("content_hash"),hash(content(c)))&&confirmed("contract_version_id",num(v.get(),"id"));}
    private boolean initialPaid(Map<String,Object> c){if(!Boolean.TRUE.equals(c.get("initial_payment_required")))return true;if(c.get("initial_invoice_id")==null)return false;return one("SELECT status,remaining_amount FROM invoices WHERE id=:id",num(c,"initial_invoice_id")).map(i->!Set.of("DRAFT","CANCELLED","PENDING_REVIEW").contains(i.get("status"))&&money(i.get("remaining_amount")).signum()==0).orElse(false);}
    private Optional<Map<String,Object>> version(long id){return one("SELECT * FROM contract_versions WHERE contract_id=:id ORDER BY version DESC LIMIT 1",id);}
    private Optional<Map<String,Object>> handoverVersion(long id){return one("SELECT * FROM handover_versions WHERE checkin_id=:id ORDER BY version DESC LIMIT 1",id);}
    private Map<String,Object> checkin(long contract){return one("SELECT * FROM rental_checkins WHERE contract_id=:id FOR UPDATE",contract).orElseThrow(()->fail("CHECKIN_REQUIRED","Chưa tạo hồ sơ nhận phòng."));}
    private List<Map<String,Object>> confirmations(String column,long id){return rows("SELECT party,actor_id,confirmed_at,content_hash FROM rental_confirmations WHERE "+column+"=:id ORDER BY id",id);}
    private boolean confirmed(String column,long id){return confirmations(column,id).stream().map(r->r.get("party")).distinct().count()==2;}
    private void confirm(String column,long id,String party,long actor,String hash){
        if(confirmations(column,id).stream().anyMatch(c->!party.equals(c.get("party"))&&num(c,"actor_id")==actor))throw fail("CONFIRMATION_PARTIES_NOT_DISTINCT","Hai bên phải có người xác nhận riêng.");
        jdbc.sql("INSERT IGNORE INTO rental_confirmations("+column+",party,actor_id,content_hash) VALUES(:id,:party,:actor,:hash)").param("id",id).param("party",party).param("actor",actor).param("hash",hash).update();}
    private String content(Map<String,Object> c){StringBuilder b=new StringBuilder("NỘI DUNG HỢP ĐỒNG — XÁC NHẬN NỘI BỘ\n");for(String k:List.of("id","code","room_id","room_code","property_name","address","landlord_name","tenant_profile_id","tenant_name","tenant_phone","start_date","end_date","agreed_monthly_rent","deposit_amount","payment_cycle","payment_due_day","notice_period_days","initial_payment_required","management_fee","fixed_service_fee","discount_amount"))field(b,k,c.get(k));
        appendRows(b,"Đơn giá điện nước",rows("SELECT code,name,calculation_method,unit_price,unit,effective_date FROM contract_utility_rates WHERE contract_id=:id ORDER BY code",num(c,"id")));
        appendRows(b,"Dịch vụ",rows("SELECT code,name,calculation_method,unit_price,effective_date FROM contract_services WHERE contract_id=:id ORDER BY id",num(c,"id")));
        appendRows(b,"Điều khoản",rows("SELECT title,content FROM contract_terms WHERE contract_id=:id ORDER BY display_order,id",num(c,"id")));return b.toString();}
    private String handoverContent(Map<String,Object> c,Map<String,Object> ci){StringBuilder b=new StringBuilder("BIÊN BẢN BÀN GIAO — XÁC NHẬN NỘI BỘ\n");field(b,"contract_id",c.get("id"));field(b,"tenant_id",c.get("tenant_id"));for(String k:List.of("id","scheduled_date","electricity_reading","water_reading","keys_cards_count","handover_reference"))field(b,k,ci.get(k));appendRows(b,"Tài sản",rows("SELECT room_asset_id,asset_name,quantity,condition_status,note FROM rental_checkin_assets WHERE checkin_id=:id ORDER BY id",num(ci,"id")));appendRows(b,"Đồng hồ",rows("SELECT id,meter_type,meter_code FROM utility_meters WHERE room_id=:id ORDER BY meter_type",num(c,"room_id")));return b.toString();}
    private void checkAssets(Map<String,Object> c,long ci){long missing=jdbc.sql("SELECT COUNT(*) FROM room_assets a WHERE a.room_id=:room AND NOT EXISTS(SELECT 1 FROM rental_checkin_assets x WHERE x.checkin_id=:ci AND x.room_asset_id=a.id AND x.quantity=a.quantity)").param("room",c.get("room_id")).param("ci",ci).query(Long.class).single();if(missing>0)throw fail("HANDOVER_ASSETS_INCOMPLETE","Danh mục phòng đã thay đổi hoặc chưa kiểm kê đủ tài sản; cần lập lại biên bản.");}
    private Map<String,Object> rate(long contract,String type){return jdbc.sql("SELECT * FROM contract_utility_rates WHERE contract_id=:id AND code=:type").param("id",contract).param("type",type).query().listOfRows().stream().findFirst().orElseThrow(()->fail("UTILITY_POLICY_REQUIRED","Cần chốt cách tính "+type+" (đồng hồ riêng hoặc phí cố định)."));}
    private Map<String,Object> meter(long room,String type){return jdbc.sql("SELECT * FROM utility_meters WHERE room_id=:room AND meter_type=:type AND status='ACTIVE' FOR UPDATE").param("room",room).param("type",type).query().listOfRows().stream().findFirst().orElseThrow(()->fail("ROOM_METER_REQUIRED","Phòng thiếu đồng hồ "+type+" đang hoạt động."));}
    private void validateMeter(Map<String,Object> c,String type,BigDecimal reading){var r=rate(num(c,"id"),type);if(!"METER".equals(r.get("calculation_method")))return;var m=meter(num(c,"room_id"),type);if(reading==null||reading.signum()<0)throw fail("CHECKIN_METERS_REQUIRED","Thiếu chỉ số "+type+" theo chính sách hợp đồng.");if(reading.compareTo(money(m.get("current_reading")))<0)throw fail("METER_READING_INVALID","Chỉ số thấp hơn đồng hồ hiện tại; cần ghi sự kiện thay/reset đồng hồ có chứng từ trước.");}
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
