package com.thangit.boardinghouse.service;

import static com.thangit.boardinghouse.service.MonthlyBillingService.*;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResidentApprovalService {
    public record Review(@com.fasterxml.jackson.annotation.JsonProperty(required=true) @Min(0) long version,boolean approved,@NotNull LocalDate effectiveDate,
        @NotBlank @Size(max=500) String reference,@NotBlank @Size(max=1000) String reason) {}
    private final JdbcClient db;private final RoomLifecycleGuard rooms;
    public ResidentApprovalService(JdbcClient db,RoomLifecycleGuard rooms){this.db=db;this.rooms=rooms;}
    private Map<String,Object> access(AuthenticatedUser p,long contract){rooms.lockContract(contract);var c=db.sql("SELECT c.*,r.property_id FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE c.id=:id FOR UPDATE").param("id",contract).query().singleRow();rooms.access(p,id(c,"property_id"));return c;}
    @Transactional public List<Map<String,Object>> list(AuthenticatedUser p,long contract){access(p,contract);return db.sql("SELECT id,request_type,full_name,occupant_profile_id,expected_move_in_date,expected_move_out_date,status,version,reason,public_feedback,review_reference FROM co_occupant_requests WHERE contract_id=:id ORDER BY id DESC").param("id",contract).query().listOfRows();}
    @Transactional public void review(AuthenticatedUser p,long request,Review r){long contract=db.sql("SELECT contract_id FROM co_occupant_requests WHERE id=:id").param("id",request).query(Long.class).single();var c=access(p,contract);var q=db.sql("SELECT * FROM co_occupant_requests WHERE id=:id FOR UPDATE").param("id",request).query().singleRow();if(id(q,"version")!=r.version()||!Set.of("SUBMITTED","UNDER_REVIEW","NEED_MORE_INFORMATION").contains(q.get("status")))throw fail("RESIDENT_VERSION_CONFLICT","Yêu cầu đã được xử lý.");
        Long profile=null;
        if(r.approved()){
            if(!Set.of("ACTIVE","EXPIRING","EXPIRED").contains(c.get("status"))||c.get("operational_ended_at")!=null||r.effectiveDate().isAfter(LocalDate.now())||r.effectiveDate().isBefore(date(c.get("start_date"))))throw fail("RESIDENT_DATE_INVALID","Chỉ ghi nhận cư trú thực tế trong hợp đồng; hồ sơ tương lai tiếp tục chờ xử lý.");
            if(db.sql("SELECT COUNT(*) FROM invoices WHERE contract_id=:id AND billing_period>=:period AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') FOR UPDATE").param("id",contract).param("period",r.effectiveDate().withDayOfMonth(1)).query(Long.class).single()>0&&db.sql("SELECT COUNT(*) FROM contract_services WHERE contract_id=:id AND calculation_method='PER_PERSON'").param("id",contract).query(Long.class).single()>0)throw fail("RESIDENCE_ALREADY_BILLED","Kỳ có phí theo người đã phát hành; cần chứng từ điều chỉnh trước thay đổi hồi tố.");
            if("ADD_CO_OCCUPANT".equals(q.get("request_type"))){
                if(q.get("identity_number")==null||q.get("identity_number").toString().isBlank())throw fail("RESIDENT_IDENTITY_REQUIRED","Identity evidence is required before approval");
                var matches=db.sql("SELECT * FROM tenant_profiles WHERE phone=:phone OR (identity_number IS NOT NULL AND identity_number=:identity) ORDER BY id FOR UPDATE").param("phone",q.get("phone")).param("identity",q.get("identity_number")).query().listOfRows();
                if(matches.size()>1)throw fail("RESIDENT_IDENTITY_CONFLICT","Có hồ sơ trùng cần đối soát trước.");
                if(matches.isEmpty()){var kh=new GeneratedKeyHolder();db.sql("INSERT INTO tenant_profiles(tenant_code,full_name,phone,email,date_of_birth,gender,identity_type,identity_number,permanent_address,created_by) VALUES(:code,:name,:phone,:email,:dob,:gender,:type,:identity,:address,:actor)").param("code","CO-"+request).param("name",q.get("full_name")).param("phone",q.get("phone")).param("email",q.get("email")).param("dob",q.get("date_of_birth")).param("gender",q.get("gender")).param("type",q.get("identity_type")).param("identity",q.get("identity_number")).param("address",q.get("permanent_address")).param("actor",p.id()).update(kh,"id");profile=kh.getKey().longValue();}
                else {var found=matches.getFirst();if(found.get("identity_number")!=null&&!Objects.equals(found.get("identity_number"),q.get("identity_number")))throw fail("RESIDENT_IDENTITY_CONFLICT","Số điện thoại đã thuộc giấy tờ khác; không ghi đè hồ sơ.");profile=id(found,"id");}
                if(db.sql("SELECT COUNT(*) FROM tenant_residences WHERE tenant_profile_id=:profile AND status='ACTIVE' FOR UPDATE").param("profile",profile).query(Long.class).single()>0)throw fail("RESIDENCE_CONFLICT","Người này đang có cư trú; cần xử lý chuyển đi trước.");
                rooms.resident(id(c,"room_id"),contract,"CO_OCCUPANT",profile);
                var room=rooms.lockRoom(id(c,"room_id"));long occupied=db.sql("SELECT COUNT(*) FROM tenant_residences WHERE room_id=:room AND status='ACTIVE' FOR UPDATE").param("room",c.get("room_id")).query(Long.class).single();long legacy=db.sql("SELECT COUNT(*) FROM contract_occupants WHERE contract_id=:id AND residence_status='ACTIVE' FOR UPDATE").param("id",contract).query(Long.class).single();if(Math.max(occupied,Math.max(id(c,"occupant_count"),legacy+1))>=id(room,"capacity"))throw fail("ROOM_CAPACITY_EXCEEDED","Đã đủ sức chứa.");
                db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,room_id,contract_id,residence_role,status,move_in_date,relationship,created_by,note) VALUES(:profile,:property,:room,:contract,'CO_OCCUPANT','ACTIVE',:date,:relationship,:actor,:note)").param("profile",profile).param("property",c.get("property_id")).param("room",c.get("room_id")).param("contract",contract).param("date",r.effectiveDate()).param("relationship",q.get("relationship")).param("actor",p.id()).param("note",(r.reference()+"; "+r.reason()).substring(0,Math.min(500,(r.reference()+"; "+r.reason()).length()))).update();db.sql("UPDATE tenant_profiles SET status='ACTIVE' WHERE id=:id").param("id",profile).update();
            }else if("MOVE_OUT".equals(q.get("request_type"))||"MOVE_OUT_CO_OCCUPANT".equals(q.get("request_type"))){
                profile=id(q,"occupant_profile_id");var tr=db.sql("SELECT * FROM tenant_residences WHERE tenant_profile_id=:profile AND contract_id=:contract AND status='ACTIVE' FOR UPDATE").param("profile",profile).param("contract",contract).query().listOfRows().stream().findFirst().orElseThrow(()->fail("RESIDENCE_CONFLICT","Cư trú đã thay đổi."));if("REPRESENTATIVE".equals(tr.get("residence_role"))||r.effectiveDate().isBefore(date(tr.get("move_in_date"))))throw fail("RESIDENT_DATE_INVALID","Không thể cho người đại diện chuyển đi qua yêu cầu này.");
                db.sql("UPDATE tenant_residences SET status='MOVED_OUT',move_out_date=:date,note=:note WHERE id=:id").param("id",tr.get("id")).param("date",r.effectiveDate()).param("note",(r.reference()+"; "+r.reason()).substring(0,Math.min(500,(r.reference()+"; "+r.reason()).length()))).update();db.sql("UPDATE tenant_profiles SET status='MOVED_OUT' WHERE id=:id AND NOT EXISTS(SELECT 1 FROM tenant_residences WHERE tenant_profile_id=:id AND status='ACTIVE')").param("id",profile).update();
            }else throw fail("RESIDENT_REQUEST_INVALID","Loại yêu cầu không được hỗ trợ.");
            db.sql("UPDATE contracts SET occupant_count=(SELECT COUNT(*) FROM tenant_residences WHERE contract_id=:id AND status='ACTIVE') WHERE id=:id").param("id",contract).update();
        }
        db.sql("UPDATE co_occupant_requests SET status=:status,occupant_profile_id=COALESCE(:profile,occupant_profile_id),public_feedback=:reason,review_reference=:ref,reviewed_by=:actor,reviewed_at=NOW(6),version=version+1 WHERE id=:id").param("id",request).param("status",r.approved()?"COMPLETED":"REJECTED").param("profile",profile).param("reason",r.reason()).param("ref",r.reference()).param("actor",p.id()).update();db.sql("INSERT INTO co_occupant_request_history(request_id,event_type,description,actor_name) VALUES(:id,:event,:description,:actor)").param("id",request).param("event",r.approved()?"COMPLETED":"REJECTED").param("description",r.effectiveDate()+"; "+r.reason()).param("actor",p.email()).update();db.sql("INSERT INTO contract_history(contract_id,event_type,description,actor_name,note) VALUES(:id,'RESIDENT_REVIEWED',:description,:actor,:note)").param("id",contract).param("description","Hồ sơ cư trú #"+request).param("actor",p.email()).param("note",(r.reference()+"; "+r.reason()).substring(0,Math.min(500,(r.reference()+"; "+r.reason()).length()))).update();
    }
}
