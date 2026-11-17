package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.AdminTenantRepository;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly=true)
public class OwnerAccountsService {
    public record Invite(@NotBlank @Email @Size(max=255) String email,
            @NotBlank @Size(max=150) String fullName,
            @NotNull @Pattern(regexp="MANAGER|TENANT|ACCOUNTANT|TECHNICIAN") String role,
            @Positive Long tenantProfileId, @NotBlank @Size(max=500) String reason) {}
    public record Accept(@NotBlank @Size(max=100) String token,
            @Size(min=8,max=72) @Pattern(regexp="^(?=.*[A-Za-z])(?=.*\\d).+$") String password) {}
    public record Assignment(@NotNull @Pattern(regexp="MANAGER|ACCOUNTANT|TECHNICIAN") String role,
            @NotNull @Size(max=100) List<@NotNull @Positive Long> propertyIds,
            @Positive Long areaId, @NotNull @Size(max=10) Set<@NotBlank String> capabilities,
            boolean primary, @NotBlank @Size(max=500) String reason) {}
    public record ChangeStatus(@NotNull @Pattern(regexp="ACTIVE|LOCKED") String status,
            @NotBlank @Size(max=500) String reason) {}
    public record Reason(@NotBlank @Size(max=500) String reason) {}
    public static final Set<String> ACCOUNTANT_PERMISSIONS=Set.of("can_issue_invoice","can_record_payment",
            "can_review_proof","can_create_voucher","can_create_adjustment","can_close_period","can_reopen_period","can_approve_refund");
    private final JdbcClient db;
    private final SecurityAudit audit;
    private final PropertyAuthorization access;
    private final PasswordEncoder passwords;
    private final AdminTenantRepository tenants;
    public OwnerAccountsService(JdbcClient db,SecurityAudit audit,PropertyAuthorization access,
            PasswordEncoder passwords,AdminTenantRepository tenants) {
        this.db=db;this.audit=audit;this.access=access;this.passwords=passwords;this.tenants=tenants;
    }
    private void owner(AuthenticatedUser actor) {
        if(actor==null || actor.activeRole()!=RoleCode.OWNER) throw denied();
    }
    private AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"ACCOUNT_SCOPE_DENIED","Tài khoản hoặc cơ sở không thuộc phạm vi quản trị của bạn.");}
    private AuthException conflict(String message){return new AuthException(HttpStatus.CONFLICT,"ACCOUNT_CONFLICT",message);}
    private void lockOwner(AuthenticatedUser actor){owner(actor);db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",actor.id()).query(Long.class).single();}
    private void property(AuthenticatedUser actor,long id) {
        if(db.sql("SELECT COUNT(*) FROM properties WHERE id=:id AND owner_id=:owner")
                .param("id",id).param("owner",actor.id()).query(Long.class).single()!=1)throw denied();
    }
    private String staffProperties() {
        return "SELECT pm.manager_id user_id,'MANAGER' role_code,pm.property_id FROM property_managers pm "
            +"UNION SELECT a.accountant_id,'ACCOUNTANT',a.property_id FROM accountant_property_assignments a "
            +"UNION SELECT t.technician_id,'TECHNICIAN',t.property_id FROM technician_property_assignments t WHERE t.revoked_at IS NULL "
            +"UNION SELECT m.assigned_to,'TECHNICIAN',m.property_id FROM maintenance_requests m WHERE m.assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM technician_property_assignments ta WHERE ta.technician_id=m.assigned_to AND ta.property_id=m.property_id AND ta.revoked_at IS NOT NULL) "
            +"UNION SELECT ma.user_id,'TECHNICIAN',m.property_id FROM maintenance_assignments ma JOIN maintenance_requests m ON m.id=ma.maintenance_request_id WHERE ma.unassigned_at IS NULL AND NOT EXISTS(SELECT 1 FROM technician_property_assignments ta WHERE ta.technician_id=ma.user_id AND ta.property_id=m.property_id AND ta.revoked_at IS NOT NULL)";
    }
    private List<Map<String,Object>> staff(AuthenticatedUser actor) {
        return db.sql("SELECT u.id,u.full_name,u.email,u.phone,u.status,u.created_at,u.must_change_password,r.code role_code FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code IN ('MANAGER','ACCOUNTANT','TECHNICIAN') AND (EXISTS(SELECT 1 FROM owner_staff_members os WHERE os.owner_id=:owner AND os.user_id=u.id AND os.role_code=r.code) OR EXISTS(SELECT 1 FROM ("+staffProperties()+") s JOIN properties p ON p.id=s.property_id WHERE s.user_id=u.id AND s.role_code=r.code AND p.owner_id=:owner)) ORDER BY u.full_name,u.id,r.code")
                .param("owner",actor.id()).query().listOfRows();
    }
    private List<Map<String,Object>> assignments(AuthenticatedUser actor,long user) {
        return db.sql("SELECT s.property_id,s.role_code,p.name property_name,pm.is_primary,a.id area_id,a.name area_name FROM ("+staffProperties()+") s JOIN properties p ON p.id=s.property_id LEFT JOIN property_managers pm ON pm.property_id=s.property_id AND pm.manager_id=s.user_id AND s.role_code='MANAGER' LEFT JOIN organization_property_relationships op ON op.property_id=p.id AND op.ended_at IS NULL LEFT JOIN management_areas a ON a.id=op.area_id WHERE s.user_id=:user AND p.owner_id=:owner ORDER BY p.name,s.role_code")
                .param("user",user).param("owner",actor.id()).query().listOfRows();
    }
    public Map<String,Object> list(AuthenticatedUser actor,Long propertyId,Long areaId,String role,String keyword,String status,int page,int size) {
        owner(actor);
        if(page<0||size<1||size>100)throw new AuthException(HttpStatus.BAD_REQUEST,"INVALID_PAGE","Thông tin phân trang không hợp lệ.");
        if(propertyId!=null)property(actor,propertyId);
        Set<Long> areaProperties=null;
        if(areaId!=null){areaOwner(actor,areaId);areaProperties=new HashSet<>(db.sql("SELECT property_id FROM organization_property_relationships WHERE area_id=:id AND ended_at IS NULL").param("id",areaId).query(Long.class).list());}
        var rows=new ArrayList<Map<String,Object>>();
        // One account can have several work roles. Summary counts distinct account IDs.
        for(var s:staff(actor)) {
            var row=new LinkedHashMap<>(s);var assigned=assignments(actor,num(s,"id")).stream().filter(a->a.get("role_code").equals(s.get("role_code"))).toList();
            row.put("assignments",assigned);row.put("profile_id",null);row.put("residence_status",null);rows.add(row);
        }
        var tenantRows=db.sql("SELECT u.id,tp.id profile_id,tp.full_name,COALESCE(u.email,tp.email) email,tp.phone,COALESCE(u.status,'NO_ACCOUNT') status,u.created_at,u.must_change_password,'TENANT' role_code,tp.tenant_code,tp.profile_status,CASE WHEN p.owner_id=:owner THEN tr.status ELSE NULL END residence_status,CASE WHEN p.owner_id=:owner THEN p.id ELSE NULL END property_id,CASE WHEN p.owner_id=:owner THEN p.name ELSE NULL END property_name,CASE WHEN p.owner_id=:owner THEN r.code ELSE NULL END room_code,CASE WHEN p.owner_id=:owner THEN c.code ELSE NULL END contract_code FROM tenant_profiles tp LEFT JOIN tenant_residences tr ON tr.id=(SELECT tr2.id FROM tenant_residences tr2 WHERE tr2.tenant_profile_id=tp.id ORDER BY (tr2.status='ACTIVE') DESC,tr2.id DESC LIMIT 1) LEFT JOIN properties p ON p.id=COALESCE(tr.property_id,tp.management_property_id) LEFT JOIN users u ON u.id=tp.user_id LEFT JOIN rooms r ON r.id=tr.room_id LEFT JOIN contracts c ON c.id=tr.contract_id WHERE p.owner_id=:owner OR (p.id IS NULL AND tp.created_by=:owner) OR EXISTS(SELECT 1 FROM owner_staff_members os WHERE os.owner_id=:owner AND os.user_id=tp.user_id AND os.role_code='TENANT') ORDER BY tp.full_name,tp.id")
                .param("owner",actor.id()).query().listOfRows();
        for(var t:tenantRows){var row=new LinkedHashMap<>(t);row.put("assignments",t.get("property_id")==null?List.of():List.of(Map.of("property_id",t.get("property_id"),"property_name",t.get("property_name"),"role_code","TENANT")));rows.add(row);}
        final Set<Long> areaFilter=areaProperties;
        var filtered=rows.stream().filter(r->role==null||role.isBlank()||role.equals(r.get("role_code")))
            .filter(r->status==null||status.isBlank()||status.equals(r.get("status")))
            .filter(r->keyword==null||keyword.isBlank()||(r.get("full_name")+" "+r.get("email")+" "+r.get("phone")+" "+r.get("tenant_code")).toLowerCase(Locale.ROOT).contains(keyword.trim().toLowerCase(Locale.ROOT)))
            .filter(r->matchesProperties(r,propertyId,areaFilter)).toList();
        var summary=new LinkedHashMap<String,Object>();
        summary.put("totalAccounts",filtered.stream().filter(r->r.get("id")!=null).map(r->num(r,"id")).distinct().count());
        for(String code:List.of("MANAGER","TENANT","ACCOUNTANT","TECHNICIAN"))summary.put(code,filtered.stream().filter(r->code.equals(r.get("role_code"))&&r.get("id")!=null).count());
        summary.put("locked",filtered.stream().filter(r->"LOCKED".equals(r.get("status"))).map(r->num(r,"id")).distinct().count());
        summary.put("active",filtered.stream().filter(r->r.get("id")!=null&&"ACTIVE".equals(r.get("status"))&&!Boolean.TRUE.equals(r.get("must_change_password"))).map(r->num(r,"id")).distinct().count());
        summary.put("pending",filtered.stream().filter(r->r.get("id")!=null&&("INACTIVE".equals(r.get("status"))||Boolean.TRUE.equals(r.get("must_change_password")))).map(r->num(r,"id")).distinct().count());
        summary.put("pendingInvitations",db.sql("SELECT COUNT(*) FROM account_invitations WHERE owner_id=:owner AND status='PENDING' AND expires_at>UTC_TIMESTAMP(6)").param("owner",actor.id()).query(Long.class).single());
        long offset=(long)page*size;
        return Map.of("summary",summary,"items",filtered.subList((int)Math.min(offset,filtered.size()),(int)Math.min(offset+size,filtered.size())),"total",filtered.size(),"page",page,"size",size);
    }
    @SuppressWarnings("unchecked")
    private boolean matchesProperties(Map<String,Object> row,Long property,Set<Long> area) {
        if(property==null&&area==null)return true;
        return ((List<Map<String,Object>>)row.get("assignments")).stream().anyMatch(a->(property==null||num(a,"property_id")==property)&&(area==null||area.contains(num(a,"property_id"))));
    }
    public Map<String,Object> options(AuthenticatedUser actor) {
        owner(actor);
        return Map.of("properties",db.sql("SELECT id,name FROM properties WHERE owner_id=:owner ORDER BY name,id").param("owner",actor.id()).query().listOfRows(),
            "areas",db.sql("SELECT a.id,a.name,a.organization_id FROM management_areas a JOIN organizations o ON o.id=a.organization_id WHERE o.administrator_id=:owner AND a.status='ACTIVE' ORDER BY a.name,a.id").param("owner",actor.id()).query().listOfRows(),
            "staff",staff(actor),"emailDeliveryAvailable",false,
            "managerAssignments",db.sql("SELECT pm.property_id,pm.manager_id,u.full_name,pm.is_primary,a.id area_id FROM property_managers pm JOIN properties p ON p.id=pm.property_id JOIN users u ON u.id=pm.manager_id LEFT JOIN organization_property_relationships op ON op.property_id=p.id AND op.ended_at IS NULL LEFT JOIN management_areas a ON a.id=op.area_id WHERE p.owner_id=:owner ORDER BY p.name,u.full_name").param("owner",actor.id()).query().listOfRows());
    }
    private void managed(AuthenticatedUser actor,long user,String role) {
        owner(actor);
        if(staff(actor).stream().noneMatch(s->num(s,"id")==user&&role.equals(s.get("role_code"))))throw denied();
    }
    public Map<String,Object> detail(AuthenticatedUser actor,long user,String role) {
        managed(actor,user,role);
        var out=new LinkedHashMap<String,Object>();
        out.put("user",staff(actor).stream().filter(s->num(s,"id")==user&&role.equals(s.get("role_code"))).findFirst().orElseThrow(this::denied));
        out.put("assignments",assignments(actor,user).stream().filter(a->role.equals(a.get("role_code"))).toList());
        out.put("capabilities",db.sql("SELECT mc.property_id,mc.capability FROM manager_property_capabilities mc JOIN properties p ON p.id=mc.property_id WHERE mc.manager_id=:user AND p.owner_id=:owner ORDER BY mc.property_id,mc.capability").param("user",user).param("owner",actor.id()).query().listOfRows());
        if("ACCOUNTANT".equals(role))out.put("accountant",db.sql("SELECT can_issue_invoice,can_record_payment,can_review_proof,can_create_voucher,can_create_adjustment,can_close_period,can_reopen_period,can_approve_refund FROM accountant_profiles WHERE user_id=:user").param("user",user).query().listOfRows());
        if("TECHNICIAN".equals(role))out.put("technician",db.sql("SELECT t.property_id,t.can_update,t.can_record_cost FROM technician_property_assignments t JOIN properties p ON p.id=t.property_id WHERE t.technician_id=:user AND p.owner_id=:owner AND t.revoked_at IS NULL").param("user",user).param("owner",actor.id()).query().listOfRows());
        if("TECHNICIAN".equals(role))out.put("tasks",db.sql("SELECT m.id,m.code,m.title,m.status,m.updated_at,p.name property_name FROM maintenance_requests m JOIN properties p ON p.id=m.property_id WHERE p.owner_id=:owner AND (m.assigned_to=:user OR EXISTS(SELECT 1 FROM maintenance_assignments ma WHERE ma.maintenance_request_id=m.id AND ma.user_id=:user)) ORDER BY m.updated_at DESC,m.id DESC LIMIT 50").param("owner",actor.id()).param("user",user).query().listOfRows());
        return out;
    }
    private void areaOwner(AuthenticatedUser actor,long area) {
        if(db.sql("SELECT COUNT(*) FROM management_areas a JOIN organizations o ON o.id=a.organization_id WHERE a.id=:id AND o.administrator_id=:owner AND a.status='ACTIVE'").param("id",area).param("owner",actor.id()).query(Long.class).single()!=1)throw denied();
    }
    // Profile permissions predate this center and apply to every assigned property.
    // Only an exclusive account administrator may change them; never mutate another owner's flags.
    private void exclusiveStaff(AuthenticatedUser actor,long user) {
        if(user==actor.id())throw denied();
        if(db.sql("SELECT COUNT(*) FROM owner_staff_members WHERE user_id=:user AND owner_id<>:owner").param("user",user).param("owner",actor.id()).query(Long.class).single()>0)throw denied();
        if(db.sql("SELECT COUNT(*) FROM ("+staffProperties()+") s JOIN properties p ON p.id=s.property_id WHERE s.user_id=:user AND p.owner_id<>:owner").param("user",user).param("owner",actor.id()).query(Long.class).single()>0)throw denied();
        if(db.sql("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=:user AND r.code NOT IN ('MANAGER','ACCOUNTANT','TECHNICIAN')").param("user",user).query(Long.class).single()>0)throw denied();
    }
    @Transactional
    public void assign(AuthenticatedUser actor,long user,Assignment request) {
        lockOwner(actor);managed(actor,user,request.role());
        db.sql("SELECT id FROM users WHERE id=:id AND status='ACTIVE' FOR UPDATE").param("id",user).query(Long.class).optional().orElseThrow(this::denied);
        var ids=new TreeSet<>(request.propertyIds());
        if(request.areaId()!=null){areaOwner(actor,request.areaId());ids.addAll(db.sql("SELECT property_id FROM organization_property_relationships WHERE area_id=:area AND ended_at IS NULL").param("area",request.areaId()).query(Long.class).list());}
        if(ids.isEmpty()||ids.size()>100)throw conflict("Chọn từ 1 đến 100 nhà trọ.");
        for(long id:ids)property(actor,id);
        db.sql("INSERT IGNORE INTO owner_staff_members(owner_id,user_id,role_code) VALUES(:owner,:user,:role)").param("owner",actor.id()).param("user",user).param("role",request.role()).update();
        if("MANAGER".equals(request.role())) {
            var caps=EnumSet.noneOf(PropertyAuthorization.Capability.class);
            for(String cap:request.capabilities())try{caps.add(PropertyAuthorization.Capability.valueOf(cap));}catch(IllegalArgumentException e){throw conflict("Quyền quản lý không hợp lệ.");}
            access.assignManagerBatch(actor,new PropertyAuthorization.ManagerBatchAssignment(new ArrayList<>(ids),user,caps,request.reason()));
            for(long id:ids){if(request.primary())db.sql("UPDATE property_managers SET is_primary=FALSE WHERE property_id=:id").param("id",id).update();db.sql("UPDATE property_managers SET is_primary=:primary WHERE property_id=:id AND manager_id=:user").param("primary",request.primary()).param("id",id).param("user",user).update();}
        } else if("ACCOUNTANT".equals(request.role())) {
            exclusiveStaff(actor,user);
            if(!ACCOUNTANT_PERMISSIONS.containsAll(request.capabilities()))throw conflict("Quyền kế toán không hợp lệ.");
            for(String cap:ACCOUNTANT_PERMISSIONS)db.sql("UPDATE accountant_profiles SET "+cap+"=:enabled,version=version+1 WHERE user_id=:user").param("enabled",request.capabilities().contains(cap)).param("user",user).update();
            for(long id:ids)db.sql("INSERT INTO accountant_property_assignments(accountant_id,property_id,granted_by) VALUES(:user,:id,:actor) ON DUPLICATE KEY UPDATE granted_by=VALUES(granted_by)").param("user",user).param("id",id).param("actor",actor.id()).update();
        } else {
            if(!Set.of("MAINTENANCE_UPDATE","MAINTENANCE_COST").containsAll(request.capabilities()))throw conflict("Quyền kỹ thuật không hợp lệ.");
            for(long id:ids)db.sql("INSERT INTO technician_property_assignments(technician_id,property_id,granted_by,can_update,can_record_cost) VALUES(:user,:id,:actor,:updates,:cost) ON DUPLICATE KEY UPDATE granted_by=VALUES(granted_by),granted_at=CURRENT_TIMESTAMP(6),revoked_at=NULL,can_update=VALUES(can_update),can_record_cost=VALUES(can_record_cost)").param("user",user).param("id",id).param("actor",actor.id()).param("updates",request.capabilities().contains("MAINTENANCE_UPDATE")).param("cost",request.capabilities().contains("MAINTENANCE_COST")).update();
        }
        audit.record(actor.id(),"STAFF_ASSIGNMENT_UPDATED","USER",user,"SUCCESS","role="+request.role()+"; properties="+ids+"; capabilities="+request.capabilities()+"; primary="+request.primary()+"; "+request.reason());
    }
    @Transactional
    public void revoke(AuthenticatedUser actor,long user,String role,long property,Reason reason) {
        lockOwner(actor);managed(actor,user,role);property(actor,property);
        db.sql("SELECT id FROM users WHERE id=:user FOR UPDATE").param("user",user).query(Long.class).single();
        if(!Set.of("MANAGER","ACCOUNTANT","TECHNICIAN").contains(role))throw denied();
        db.sql("INSERT IGNORE INTO owner_staff_members(owner_id,user_id,role_code) VALUES(:owner,:user,:role)").param("owner",actor.id()).param("user",user).param("role",role).update();
        switch(role){
            case "MANAGER"->access.revokeManager(actor,property,user,reason.reason());
            case "ACCOUNTANT"->db.sql("DELETE FROM accountant_property_assignments WHERE accountant_id=:user AND property_id=:property").param("user",user).param("property",property).update();
            case "TECHNICIAN"->db.sql("INSERT INTO technician_property_assignments(technician_id,property_id,granted_by,revoked_at) VALUES(:user,:property,:actor,CURRENT_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE revoked_at=CURRENT_TIMESTAMP(6)").param("user",user).param("property",property).param("actor",actor.id()).update();
            default->throw denied();
        }
        audit.record(actor.id(),"STAFF_ASSIGNMENT_REVOKED","USER",user,"SUCCESS","role="+role+"; property="+property+"; "+reason.reason());
    }
    @Transactional
    public void status(AuthenticatedUser actor,long user,ChangeStatus request) {
        lockOwner(actor);
        if(staff(actor).stream().noneMatch(s->num(s,"id")==user))throw denied();
        db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",user).query(Long.class).single();
        exclusiveStaff(actor,user);
        db.sql("UPDATE users SET status=:status,locked_until=NULL,failed_login_attempts=0 WHERE id=:id").param("status",request.status()).param("id",user).update();
        audit.record(actor.id(),"STAFF_STATUS_CHANGED","USER",user,"SUCCESS","status="+request.status()+"; "+request.reason());
    }
    public List<Map<String,Object>> invitations(AuthenticatedUser actor) {
        owner(actor);
        return db.sql("SELECT id,email,full_name,role_code,tenant_profile_id,CASE WHEN status='PENDING' AND expires_at<=UTC_TIMESTAMP(6) THEN 'EXPIRED' ELSE status END status,expires_at,created_at,accepted_at FROM account_invitations WHERE owner_id=:owner ORDER BY id DESC LIMIT 500").param("owner",actor.id()).query().listOfRows();
    }
    @Transactional
    public Map<String,Object> invite(AuthenticatedUser actor,Invite request) {
        lockOwner(actor);
        if("TENANT".equals(request.role())) {
            if(request.tenantProfileId()==null||!tenants.canAccessTenant(actor.id(),RoleCode.OWNER,request.tenantProfileId()))throw denied();
            if(tenants.profile(request.tenantProfileId()).orElseThrow(this::denied).get("user_id")!=null)throw conflict("Hồ sơ đã có tài khoản. Sử dụng tài khoản hiện tại.");
        } else if(request.tenantProfileId()!=null)throw denied();
        String email=request.email().trim().toLowerCase(Locale.ROOT);
        db.sql("UPDATE account_invitations SET status='REVOKED',revoked_at=UTC_TIMESTAMP(6) WHERE owner_id=:owner AND email=:email AND role_code=:role AND status='PENDING'").param("owner",actor.id()).param("email",email).param("role",request.role()).update();
        String token=token();var key=new GeneratedKeyHolder();
        db.sql("INSERT INTO account_invitations(owner_id,email,full_name,role_code,tenant_profile_id,token_hash,expires_at) VALUES(:owner,:email,:name,:role,:tenant,:hash,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 48 HOUR))").param("owner",actor.id()).param("email",email).param("name",request.fullName().trim()).param("role",request.role()).param("tenant",request.tenantProfileId()).param("hash",hash(token)).update(key,"id");
        long id=Objects.requireNonNull(key.getKey()).longValue();
        audit.record(actor.id(),"ACCOUNT_INVITED","INVITATION",id,"SUCCESS","role="+request.role()+"; "+request.reason());
        return Map.of("id",id,"token",token,"delivery","MANUAL_LINK","expiresInHours",48);
    }
    @Transactional
    public Map<String,Object> resend(AuthenticatedUser actor,long id,Reason request) {
        lockOwner(actor);
        var r=invitation(actor,id);
        if(!"PENDING".equals(r.get("status")))throw conflict("Chỉ gửi lại lời mời chưa được chấp nhận hoặc thu hồi.");
        return invite(actor,new Invite(r.get("email").toString(),r.get("full_name").toString(),r.get("role_code").toString(),r.get("tenant_profile_id")==null?null:num(r,"tenant_profile_id"),request.reason()));
    }
    private Map<String,Object> invitation(AuthenticatedUser actor,long id) {
        return db.sql("SELECT * FROM account_invitations WHERE id=:id AND owner_id=:owner FOR UPDATE").param("id",id).param("owner",actor.id()).query().listOfRows().stream().findFirst().orElseThrow(this::denied);
    }
    @Transactional
    public void revokeInvitation(AuthenticatedUser actor,long id,Reason reason) {
        lockOwner(actor);var r=invitation(actor,id);
        if(!"PENDING".equals(r.get("status")))throw conflict("Lời mời đã được xử lý.");
        db.sql("UPDATE account_invitations SET status='REVOKED',revoked_at=UTC_TIMESTAMP(6) WHERE id=:id").param("id",id).update();
        audit.record(actor.id(),"ACCOUNT_INVITATION_REVOKED","INVITATION",id,"SUCCESS",reason.reason());
    }
    @Transactional
    public void accept(AuthenticatedUser actor,Accept request) {
        // Token is high-entropy; only its SHA-256 hash is persisted. Never include it in audit logs.
        var rows=db.sql("SELECT * FROM account_invitations WHERE token_hash=:hash AND status='PENDING' AND expires_at>UTC_TIMESTAMP(6) FOR UPDATE").param("hash",hash(request.token())).query().listOfRows();
        if(rows.isEmpty())throw conflict("Liên kết không hợp lệ, đã sử dụng hoặc hết hạn.");
        var r=rows.getFirst();long owner=num(r,"owner_id");
        if(db.sql("SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles role ON role.id=ur.role_id WHERE u.id=:id AND u.status='ACTIVE' AND role.code='OWNER'").param("id",owner).query(Long.class).single()!=1)throw denied();
        var existing=db.sql("SELECT id,status FROM users WHERE LOWER(email)=LOWER(:email) FOR UPDATE").param("email",r.get("email")).query().listOfRows();
        long user;
        if(!existing.isEmpty()) {
            user=num(existing.getFirst(),"id");
            if(actor==null||actor.id()!=user||!"ACTIVE".equals(existing.getFirst().get("status")))throw new AuthException(HttpStatus.UNAUTHORIZED,"INVITATION_LOGIN_REQUIRED","Email đã có tài khoản. Đăng nhập đúng tài khoản để xác nhận lời mời; mật khẩu hiện tại được giữ nguyên.");
        } else {
            if(request.password()==null)throw conflict("Vui lòng đặt mật khẩu mới có ít nhất 8 ký tự, chữ và số.");
            var key=new GeneratedKeyHolder();
            db.sql("INSERT INTO users(email,password_hash,full_name,status) VALUES(:email,:password,:name,'ACTIVE')").param("email",r.get("email")).param("password",passwords.encode(request.password())).param("name",r.get("full_name")).update(key,"id");
            user=Objects.requireNonNull(key.getKey()).longValue();
        }
        String role=r.get("role_code").toString();
        db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT :user,id FROM roles WHERE code=:role").param("user",user).param("role",role).update();
        if("TENANT".equals(role)) {
            long profile=num(r,"tenant_profile_id");
            if(!tenants.canAccessTenant(owner,RoleCode.OWNER,profile))throw denied();
            if(db.sql("SELECT COUNT(*) FROM tenant_profiles WHERE user_id=:user AND id<>:id").param("user",user).param("id",profile).query(Long.class).single()>0)throw conflict("Tài khoản đã có hồ sơ người thuê khác. Cần đối chiếu hồ sơ trước khi liên kết; lịch sử hiện tại được giữ nguyên.");
            if(db.sql("UPDATE tenant_profiles SET user_id=:user,email=:email WHERE id=:id AND (user_id IS NULL OR user_id=:user)").param("user",user).param("email",r.get("email")).param("id",profile).update()!=1)throw conflict("Hồ sơ đã được liên kết với tài khoản khác.");
        } else {
            db.sql("INSERT IGNORE INTO owner_staff_members(owner_id,user_id,role_code) VALUES(:owner,:user,:role)").param("owner",owner).param("user",user).param("role",role).update();
            if("ACCOUNTANT".equals(role))db.sql("INSERT IGNORE INTO accountant_profiles(user_id,employee_code,can_issue_invoice,can_record_payment,can_review_proof,can_create_voucher,can_create_adjustment,can_close_period,can_reopen_period) VALUES(:user,:code,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE)").param("user",user).param("code","ACC-"+user).update();
            if("TECHNICIAN".equals(role))db.sql("INSERT IGNORE INTO technician_profiles(user_id,employee_code) VALUES(:user,:code)").param("user",user).param("code","TECH-"+user).update();
        }
        db.sql("UPDATE account_invitations SET status='ACCEPTED',accepted_by=:user,accepted_at=UTC_TIMESTAMP(6) WHERE id=:id").param("user",user).param("id",r.get("id")).update();
        audit.record(user,"ACCOUNT_INVITATION_ACCEPTED","INVITATION",num(r,"id"),"SUCCESS","role="+role+"; owner="+owner);
    }
    public List<Map<String,Object>> history(AuthenticatedUser actor,int page) {
        owner(actor);if(page<0||page>100000)throw conflict("Trang không hợp lệ.");
        return db.sql("SELECT id,actor_id,action,resource_type,resource_id,reason,occurred_at FROM security_audit_logs WHERE (actor_id=:actor AND (action LIKE 'STAFF_%' OR action LIKE 'ACCOUNT_%' OR action LIKE 'MANAGER_%')) OR (resource_type='INVITATION' AND EXISTS(SELECT 1 FROM account_invitations ai WHERE ai.id=security_audit_logs.resource_id AND ai.owner_id=:actor)) ORDER BY id DESC LIMIT 50 OFFSET :offset").param("actor",actor.id()).param("offset",page*50).query().listOfRows();
    }
    private static String token(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
    private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private static long num(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
}
