package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.security.SecurityAudit;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Organization metadata never implicitly grants access to a property or its residents. */
@Service
@Transactional(readOnly = true)
public class OrganizationManagementService {
    public record SaveOrganization(@NotBlank @Size(max=50) String code,
            @NotBlank @Size(max=150) String name, @Size(max=1000) String description) {}
    public record SaveArea(@NotBlank @Size(max=50) String code,
            @NotBlank @Size(max=150) String name, @Size(max=1000) String description,
            @NotNull @Pattern(regexp="ACTIVE|INACTIVE") String status,
            @NotNull @PositiveOrZero Long version, @NotBlank @Size(max=500) String reason) {}
    public record LinkProperty(@Positive long propertyId, @Positive Long areaId,
            @NotBlank @Size(max=200) String agreementReference,
            @NotNull @PastOrPresent LocalDate effectiveFrom,
            @NotBlank @Size(max=500) String reason) {}
    public record MoveArea(@Positive Long areaId, @NotNull @PositiveOrZero Long version,
            @NotBlank @Size(max=500) String reason) {}
    public record EndRelationship(@NotNull @PositiveOrZero Long version,
            @NotBlank @Size(max=500) String reason) {}

    private final JdbcClient db;
    private final SecurityAudit audit;
    public OrganizationManagementService(JdbcClient db, SecurityAudit audit) {
        this.db=db; this.audit=audit;
    }
    private void owner(AuthenticatedUser actor) {
        if (actor==null || actor.activeRole()!=RoleCode.OWNER) throw denied();
    }
    private AuthException denied() {
        return new AuthException(HttpStatus.FORBIDDEN,"ORGANIZATION_ACCESS_DENIED",
                "Bạn không có quyền quản trị công ty hoặc nhà trọ này.");
    }
    private AuthException conflict(String message) {
        return new AuthException(HttpStatus.CONFLICT,"ORGANIZATION_CONFLICT",message);
    }
    // Lock the administrator first, then the organization and property consistently on mutations.
    // This also serializes assignment changes made through PropertyAuthorization by this owner.
    private void authorize(AuthenticatedUser actor,long organization,boolean lock) {
        owner(actor);
        if(lock) db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE")
                .param("id",actor.id()).query(Long.class).single();
        if(db.sql("SELECT id FROM organizations WHERE id=:id AND administrator_id=:actor"
                +(lock?" FOR UPDATE":"")).param("id",organization).param("actor",actor.id())
                .query(Long.class).optional().isEmpty()) throw denied();
    }
    public List<Map<String,Object>> organizations(AuthenticatedUser actor) {
        owner(actor);
        return db.sql("SELECT id,code,name,description FROM organizations WHERE administrator_id=:actor ORDER BY name,id")
                .param("actor",actor.id()).query().listOfRows();
    }
    @Transactional
    public long setup(AuthenticatedUser actor) {
        owner(actor);
        db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",actor.id()).query(Long.class).single();
        var current=organizations(actor);
        if(!current.isEmpty())return ((Number)current.getFirst().get("id")).longValue();
        return create(actor,new SaveOrganization("PERSONAL-"+actor.id(),"Không gian quản lý cá nhân", "Không gian vận hành của chủ sở hữu; có thể cập nhật thông tin tổ chức trong Cài đặt."));
    }
    @Transactional
    public void update(AuthenticatedUser actor,long organization,SaveOrganization request) {
        authorize(actor,organization,true);
        if(db.sql("SELECT COUNT(*) FROM organizations WHERE administrator_id=:actor AND code=:code AND id<>:id").param("actor",actor.id()).param("code",request.code().trim()).param("id",organization).query(Long.class).single()>0)throw conflict("Mã tổ chức đã tồn tại.");
        db.sql("UPDATE organizations SET code=:code,name=:name,description=:description WHERE id=:id").param("code",request.code().trim()).param("name",request.name().trim()).param("description",request.description()).param("id",organization).update();
        audit.record(actor.id(),"ORGANIZATION_UPDATED","ORGANIZATION",organization,"SUCCESS","Owner updated organization information in Settings");
    }
    @Transactional
    public long create(AuthenticatedUser actor,SaveOrganization request) {
        owner(actor);
        db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",actor.id()).query(Long.class).single();
        if(db.sql("SELECT COUNT(*) FROM organizations WHERE administrator_id=:actor AND code=:code")
                .param("actor",actor.id()).param("code",request.code().trim()).query(Long.class).single()>0)
            throw conflict("Mã công ty đã tồn tại.");
        var key=new GeneratedKeyHolder();
        db.sql("INSERT INTO organizations(administrator_id,code,name,description) VALUES(:actor,:code,:name,:description)")
                .param("actor",actor.id()).param("code",request.code().trim()).param("name",request.name().trim())
                .param("description",request.description()).update(key,"id");
        long id=Objects.requireNonNull(key.getKey()).longValue();
        db.sql("INSERT INTO organization_members(organization_id,user_id,member_role) VALUES(:id,:actor,'ADMIN')")
                .param("id",id).param("actor",actor.id()).update();
        audit.record(actor.id(),"ORGANIZATION_CREATED","ORGANIZATION",id,"SUCCESS","Created explicitly by administrator");
        return id;
    }
    public Map<String,Object> detail(AuthenticatedUser actor,long organization) {
        authorize(actor,organization,false);
        var out=new LinkedHashMap<String,Object>();
        out.put("organization",db.sql("SELECT id,code,name,description FROM organizations WHERE id=:id")
                .param("id",organization).query().singleRow());
        out.put("areas",db.sql("SELECT id,code,name,description,status,version FROM management_areas WHERE organization_id=:id ORDER BY name,id")
                .param("id",organization).query().listOfRows());
        // Recheck property ownership even for metadata reads, if external tools changed owner_id.
        out.put("relationships",db.sql("SELECT x.id,x.property_id,p.name property_name,x.area_id,a.name area_name,x.agreement_reference,x.effective_from,x.ended_at,x.version FROM organization_property_relationships x JOIN properties p ON p.id=x.property_id LEFT JOIN management_areas a ON a.id=x.area_id WHERE x.organization_id=:id AND p.owner_id=:actor ORDER BY x.id DESC")
                .param("id",organization).param("actor",actor.id()).query().listOfRows());
        out.put("availableProperties",db.sql("SELECT p.id,p.name FROM properties p WHERE p.owner_id=:actor AND NOT EXISTS(SELECT 1 FROM organization_property_relationships x WHERE x.property_id=p.id AND x.ended_at IS NULL) ORDER BY p.name,p.id")
                .param("actor",actor.id()).query().listOfRows());
        return out;
    }
    @Transactional
    public long createArea(AuthenticatedUser actor,long organization,SaveArea request) {
        authorize(actor,organization,true);
        if(request.version()!=0) throw conflict("Khu vực mới phải có phiên bản 0.");
        uniqueAreaCode(organization,0,request.code());
        var key=new GeneratedKeyHolder();
        db.sql("INSERT INTO management_areas(organization_id,code,name,description,status) VALUES(:org,:code,:name,:description,:status)")
                .param("org",organization).param("code",request.code().trim()).param("name",request.name().trim())
                .param("description",request.description()).param("status",request.status()).update(key,"id");
        long id=Objects.requireNonNull(key.getKey()).longValue();
        audit.record(actor.id(),"AREA_CREATED","ORGANIZATION",organization,"SUCCESS","area="+id+"; "+request.reason());
        return id;
    }
    private void uniqueAreaCode(long organization,long area,String code) {
        if(db.sql("SELECT COUNT(*) FROM management_areas WHERE organization_id=:org AND code=:code AND id<>:id")
                .param("org",organization).param("code",code.trim()).param("id",area).query(Long.class).single()>0)
            throw conflict("Mã khu vực đã tồn tại trong công ty.");
    }
    @Transactional
    public void updateArea(AuthenticatedUser actor,long organization,long area,SaveArea request) {
        authorize(actor,organization,true);
        if(db.sql("SELECT COUNT(*) FROM management_areas WHERE id=:id AND organization_id=:org")
                .param("id",area).param("org",organization).query(Long.class).single()!=1) throw denied();
        if("INACTIVE".equals(request.status()) && db.sql("SELECT COUNT(*) FROM organization_property_relationships WHERE area_id=:id AND ended_at IS NULL")
                .param("id",area).query(Long.class).single()>0)
            throw conflict("Chuyển các nhà trọ ra khỏi khu vực trước khi ngừng sử dụng.");
        uniqueAreaCode(organization,area,request.code());
        if(db.sql("UPDATE management_areas SET code=:code,name=:name,description=:description,status=:status,version=version+1 WHERE id=:id AND organization_id=:org AND version=:version")
                .param("code",request.code().trim()).param("name",request.name().trim()).param("description",request.description())
                .param("status",request.status()).param("id",area).param("org",organization).param("version",request.version()).update()!=1)
            throw conflict("Khu vực đã thay đổi. Vui lòng tải lại.");
        audit.record(actor.id(),"AREA_UPDATED","ORGANIZATION",organization,"SUCCESS","area="+area+"; version="+request.version()+"; "+request.reason());
    }
    private void area(long organization,Long area) {
        if(area!=null && db.sql("SELECT COUNT(*) FROM management_areas WHERE id=:id AND organization_id=:org AND status='ACTIVE'")
                .param("id",area).param("org",organization).query(Long.class).single()!=1) throw denied();
    }
    @Transactional
    public long link(AuthenticatedUser actor,long organization,LinkProperty request) {
        authorize(actor,organization,true);
        if(db.sql("SELECT id FROM properties WHERE id=:id AND owner_id=:actor FOR UPDATE")
                .param("id",request.propertyId()).param("actor",actor.id()).query(Long.class).optional().isEmpty()) throw denied();
        area(organization,request.areaId());
        if(db.sql("SELECT COUNT(*) FROM organization_property_relationships WHERE property_id=:id AND (ended_at IS NULL OR DATE(ended_at)>=:start)")
                .param("id",request.propertyId()).param("start",request.effectiveFrom()).query(Long.class).single()>0)
            throw conflict("Nhà trọ đã có đơn vị vận hành hoặc trùng thời kỳ quản lý. Chọn ngày sau kỳ cũ.");
        var key=new GeneratedKeyHolder();
        db.sql("INSERT INTO organization_property_relationships(organization_id,property_id,area_id,agreement_reference,effective_from,created_by) VALUES(:org,:property,:area,:reference,:start,:actor)")
                .param("org",organization).param("property",request.propertyId()).param("area",request.areaId())
                .param("reference",request.agreementReference().trim()).param("start",request.effectiveFrom()).param("actor",actor.id()).update(key,"id");
        long id=Objects.requireNonNull(key.getKey()).longValue();
        audit.record(actor.id(),"ORGANIZATION_PROPERTY_LINKED","ORGANIZATION",organization,"SUCCESS","relationship="+id+"; property="+request.propertyId()+"; area="+request.areaId()+"; "+request.reason());
        return id;
    }
    private Map<String,Object> relationship(AuthenticatedUser actor,long organization,long id,long version) {
        var rows=db.sql("SELECT x.* FROM organization_property_relationships x JOIN properties p ON p.id=x.property_id WHERE x.id=:id AND x.organization_id=:org AND p.owner_id=:actor FOR UPDATE")
                .param("id",id).param("org",organization).param("actor",actor.id()).query().listOfRows();
        if(rows.isEmpty()) throw denied();
        var row=rows.getFirst();
        if(row.get("ended_at")!=null || ((Number)row.get("version")).longValue()!=version)
            throw conflict("Phân nhóm đã thay đổi hoặc kết thúc. Vui lòng tải lại.");
        return row;
    }
    @Transactional
    public void move(AuthenticatedUser actor,long organization,long id,MoveArea request) {
        authorize(actor,organization,true);
        var previous=relationship(actor,organization,id,request.version());
        area(organization,request.areaId());
        db.sql("UPDATE organization_property_relationships SET area_id=:area,version=version+1 WHERE id=:id")
                .param("area",request.areaId()).param("id",id).update();
        audit.record(actor.id(),"PROPERTY_AREA_CHANGED","ORGANIZATION",organization,"SUCCESS","relationship="+id+"; previousArea="+previous.get("area_id")+"; area="+request.areaId()+"; "+request.reason());
    }
    @Transactional
    public void end(AuthenticatedUser actor,long organization,long id,EndRelationship request) {
        authorize(actor,organization,true);
        relationship(actor,organization,id,request.version());
        db.sql("UPDATE organization_property_relationships SET ended_at=CURRENT_TIMESTAMP(6),version=version+1 WHERE id=:id")
                .param("id",id).update();
        audit.record(actor.id(),"ORGANIZATION_PROPERTY_ENDED","ORGANIZATION",organization,"SUCCESS","relationship="+id+"; "+request.reason());
    }
    public List<Map<String,Object>> history(AuthenticatedUser actor,long organization,int page) {
        authorize(actor,organization,false);
        if(page<0 || page>100000) throw new AuthException(HttpStatus.BAD_REQUEST,"INVALID_PAGE","Trang không hợp lệ.");
        return db.sql("SELECT id,actor_id,action,reason,occurred_at FROM security_audit_logs WHERE resource_type='ORGANIZATION' AND resource_id=:id ORDER BY id DESC LIMIT 50 OFFSET :offset")
                .param("id",organization).param("offset",page*50).query().listOfRows();
    }
}
