package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.common.validation.VietnamPhones;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.AdminTenantRepository;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.constraints.*;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Administrative provisioning; never calls public registration or changes a legal owner. */
@Service
@Transactional(readOnly=true)
public class AccountProvisioningService {
    public record Create(@NotBlank @Size(max=150) String fullName,
            @NotNull @Pattern(regexp=VietnamPhones.OPTIONAL_REGEX) String phone,
            @Email @Size(max=255) String email,
            @NotEmpty @Size(max=4) Set<@Pattern(regexp="MANAGER|ACCOUNTANT|TECHNICIAN|TENANT") String> roles,
            @NotNull @Pattern(regexp="ACTIVE|INACTIVE") String initialStatus,
            @NotNull @Size(max=100) List<@NotNull @Positive Long> propertyIds,
            @Positive Long areaId,@Positive Long managementPropertyId,@Positive Long tenantProfileId,
            @Positive Long existingUserId,@Past LocalDate dateOfBirth,
            @NotNull Map<@Pattern(regexp="MANAGER|ACCOUNTANT|TECHNICIAN") String,@NotNull @Size(max=10) Set<@NotBlank String>> permissions,
            Boolean primary,Boolean identityConfirmed,@NotBlank @Size(max=500) String reason) {}
    public record Edit(@NotBlank @Size(max=150) String fullName,
            @NotNull @Pattern(regexp=VietnamPhones.OPTIONAL_REGEX) String phone,
            @Email @Size(max=255) String email,@NotBlank @Size(max=500) String reason) {}
    public record Status(@NotNull @Pattern(regexp="ACTIVE|INACTIVE|LOCKED") String status,@NotBlank @Size(max=500) String reason) {}
    public record Reason(@NotBlank @Size(max=500) String reason) {}
    public record Result(long id,Set<String> roles,String loginIdentifier,String initialPassword,
            boolean linkedExisting,boolean mustChangePassword,int passwordExpiresInHours,Long tenantProfileId) {}
    private final JdbcClient db;private final SecurityAudit audit;private final PasswordEncoder passwords;
    private final OwnerAccountsService accounts;private final AdminTenantRepository tenants;
    public AccountProvisioningService(JdbcClient db,SecurityAudit audit,PasswordEncoder passwords,
            OwnerAccountsService accounts,AdminTenantRepository tenants){this.db=db;this.audit=audit;this.passwords=passwords;this.accounts=accounts;this.tenants=tenants;}
    private void administrator(AuthenticatedUser actor){if(actor==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(actor.activeRole()))throw denied();}
    private AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"ACCOUNT_PROVISIONING_DENIED","Tài khoản, vai trò hoặc phạm vi không thuộc quyền quản trị của bạn.");}
    private AuthException conflict(String message){return new AuthException(HttpStatus.CONFLICT,"ACCOUNT_PROVISIONING_CONFLICT",message);}
    private void actorLock(AuthenticatedUser actor){administrator(actor);db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",actor.id()).query(Long.class).single();}
    private String propertyScope(AuthenticatedUser actor,String alias){return actor.activeRole()==RoleCode.OWNER?alias+".owner_id=:actor":"EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id="+alias+".id AND pm.manager_id=:actor)";}
    private String profileScope(AuthenticatedUser actor){return "("+propertyScope(actor,"p")+(actor.activeRole()==RoleCode.OWNER?" OR (p.id IS NULL AND tp.created_by=:actor)":"")+")";}
    private static final String PROFILE_FROM=" FROM tenant_profiles tp LEFT JOIN tenant_residences tr ON tr.id=(SELECT t.id FROM tenant_residences t WHERE t.tenant_profile_id=tp.id ORDER BY (t.status='ACTIVE') DESC,t.id DESC LIMIT 1) LEFT JOIN properties p ON p.id=COALESCE(tr.property_id,tp.management_property_id) LEFT JOIN rooms room ON room.id=tr.room_id LEFT JOIN contracts c ON c.id=tr.contract_id ";
    private String ownedUserScope(){return "(EXISTS(SELECT 1 FROM owner_staff_members os WHERE os.owner_id=:actor AND os.user_id=u.id) OR EXISTS(SELECT 1 FROM property_managers pm JOIN properties p ON p.id=pm.property_id WHERE pm.manager_id=u.id AND p.owner_id=:actor) OR EXISTS(SELECT 1 FROM accountant_property_assignments a JOIN properties p ON p.id=a.property_id WHERE a.accountant_id=u.id AND p.owner_id=:actor) OR EXISTS(SELECT 1 FROM technician_property_assignments a JOIN properties p ON p.id=a.property_id WHERE a.technician_id=u.id AND p.owner_id=:actor AND a.revoked_at IS NULL) OR EXISTS(SELECT 1"+PROFILE_FROM+"WHERE tp.user_id=u.id AND (p.owner_id=:actor OR (p.id IS NULL AND tp.created_by=:actor))))";}
    public Map<String,Object> options(AuthenticatedUser actor){
        administrator(actor);
        var properties=db.sql("SELECT p.id,p.name FROM properties p WHERE p.status='ACTIVE' AND "+propertyScope(actor,"p")+" ORDER BY p.name,p.id").param("actor",actor.id()).query().listOfRows();
        var profiles=db.sql("SELECT tp.id,tp.full_name,tp.phone,tp.email,tp.user_id,tp.date_of_birth,p.id property_id,p.name property_name,room.code room_code,c.code contract_code,account_user.status account_status,account_user.must_change_password,account_user.email account_email,account_user.phone account_phone"+PROFILE_FROM+" LEFT JOIN users account_user ON account_user.id=tp.user_id WHERE "+profileScope(actor)+" ORDER BY tp.full_name,tp.id").param("actor",actor.id()).query().listOfRows();
        List<Map<String,Object>> existing;
        if(actor.activeRole()==RoleCode.OWNER)existing=db.sql("SELECT u.id,u.full_name,u.email,u.phone,u.status FROM users u WHERE u.id<>:actor AND "+ownedUserScope()+" AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code NOT IN ('MANAGER','ACCOUNTANT','TECHNICIAN','TENANT')) ORDER BY u.full_name,u.id").param("actor",actor.id()).query().listOfRows();
        else existing=db.sql("SELECT DISTINCT u.id,u.full_name,u.email,u.phone,u.status FROM users u JOIN tenant_profiles owned_tp ON owned_tp.user_id=u.id WHERE EXISTS(SELECT 1"+PROFILE_FROM+" WHERE tp.id=owned_tp.id AND "+profileScope(actor)+") AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code<>'TENANT') ORDER BY u.full_name,u.id").param("actor",actor.id()).query().listOfRows();
        return Map.of("properties",properties,"tenantProfiles",profiles,"existingAccounts",existing,
            "roles",actor.activeRole()==RoleCode.OWNER?List.of("MANAGER","ACCOUNTANT","TECHNICIAN","TENANT"):List.of("TENANT"),
            "areas",actor.activeRole()==RoleCode.OWNER?db.sql("SELECT a.id,a.name FROM management_areas a JOIN organizations o ON o.id=a.organization_id WHERE o.administrator_id=:actor AND a.status='ACTIVE' ORDER BY a.name").param("actor",actor.id()).query().listOfRows():List.of());
    }
    private long propertyOwner(AuthenticatedUser actor,long property){return db.sql("SELECT p.owner_id FROM properties p WHERE p.id=:id AND "+propertyScope(actor,"p")+" FOR UPDATE").param("id",property).param("actor",actor.id()).query(Long.class).optional().orElseThrow(this::denied);}
    private Map<String,Object> profile(AuthenticatedUser actor,long id){if(!tenants.canAccessTenant(actor.id(),actor.activeRole(),id))throw denied();return db.sql("SELECT * FROM tenant_profiles WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();}
    private long ownerFor(AuthenticatedUser actor,Long property,Map<String,Object> profile){
        if(profile!=null){Long scoped=db.sql("SELECT COALESCE((SELECT tr.property_id FROM tenant_residences tr WHERE tr.tenant_profile_id=:id ORDER BY (tr.status='ACTIVE') DESC,tr.id DESC LIMIT 1),management_property_id) FROM tenant_profiles WHERE id=:id").param("id",profile.get("id")).query(Long.class).optional().orElse(null);if(scoped!=null){long owner=propertyOwner(actor,scoped);if(property!=null&&propertyOwner(actor,property)!=owner)throw denied();return owner;}}
        if(property!=null)return propertyOwner(actor,property);
        if(actor.activeRole()==RoleCode.OWNER)return actor.id();
        throw denied();
    }
    private void noDuplicate(String email,String phone,Long except){
        long duplicate=db.sql("SELECT COUNT(*) FROM users WHERE (:except IS NULL OR id<>:except) AND ((:email IS NOT NULL AND LOWER(email)=LOWER(:email)) OR (:phone IS NOT NULL AND phone IN (:phones)))").param("except",except).param("email",email).param("phone",phone).param("phones",phone==null?List.of(""):VietnamPhones.aliases(phone)).query(Long.class).single();
        if(duplicate>0)throw conflict("Email hoặc số điện thoại đã có tài khoản. Chọn liên kết tài khoản đang quản lý; không tạo trùng hoặc đặt lại mật khẩu của người khác.");
    }
    private Map<String,Object> controlled(AuthenticatedUser actor,long user){
        administrator(actor);
        if(user==actor.id())throw denied();
        var row=db.sql("SELECT id,email,phone,full_name,status,must_change_password FROM users WHERE id=:id FOR UPDATE").param("id",user).query().listOfRows().stream().findFirst().orElseThrow(this::denied);
        long owner;
        if(actor.activeRole()==RoleCode.OWNER){owner=actor.id();if(db.sql("SELECT COUNT(*) FROM users u WHERE u.id=:id AND "+ownedUserScope()).param("id",user).param("actor",actor.id()).query(Long.class).single()!=1)throw denied();}
        else {if(db.sql("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=:user AND r.code<>'TENANT'").param("user",user).query(Long.class).single()>0)throw denied();var profiles=db.sql("SELECT id FROM tenant_profiles WHERE user_id=:user").param("user",user).query(Long.class).list();if(profiles.size()!=1)throw denied();var p=profile(actor,profiles.getFirst());owner=ownerFor(actor,null,p);}
        if(db.sql("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=:user AND r.code NOT IN ('MANAGER','ACCOUNTANT','TECHNICIAN','TENANT')").param("user",user).query(Long.class).single()>0)throw denied();
        if(db.sql("SELECT COUNT(*) FROM owner_staff_members WHERE user_id=:user AND owner_id<>:owner").param("user",user).param("owner",owner).query(Long.class).single()>0)throw denied();
        String foreign="SELECT property_id FROM property_managers WHERE manager_id=:user UNION SELECT property_id FROM accountant_property_assignments WHERE accountant_id=:user UNION SELECT property_id FROM technician_property_assignments WHERE technician_id=:user AND revoked_at IS NULL UNION SELECT property_id FROM maintenance_requests WHERE assigned_to=:user UNION SELECT m.property_id FROM maintenance_assignments ma JOIN maintenance_requests m ON m.id=ma.maintenance_request_id WHERE ma.user_id=:user AND ma.unassigned_at IS NULL UNION SELECT tr.property_id FROM tenant_residences tr JOIN tenant_profiles tp ON tp.id=tr.tenant_profile_id WHERE tp.user_id=:user AND tr.status='ACTIVE' UNION SELECT tp.management_property_id FROM tenant_profiles tp WHERE tp.user_id=:user AND tp.management_property_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tenant_residences tr WHERE tr.tenant_profile_id=tp.id)";
        if(db.sql("SELECT COUNT(*) FROM ("+foreign+") scope JOIN properties p ON p.id=scope.property_id WHERE p.owner_id<>:owner").param("user",user).param("owner",owner).query(Long.class).single()>0)throw denied();
        return row;
    }
    @Transactional
    public Result create(AuthenticatedUser actor,Create request){
        actorLock(actor);
        if(actor.activeRole()==RoleCode.MANAGER&&!request.roles().equals(Set.of("TENANT")))throw denied();
        if(!Set.of("MANAGER","ACCOUNTANT","TECHNICIAN","TENANT").containsAll(request.roles()))throw denied();
        Map<String,Object> tenant=request.tenantProfileId()==null?null:profile(actor,request.tenantProfileId());
        long owner=ownerFor(actor,request.managementPropertyId(),tenant);
        for(long property:request.propertyIds())if(propertyOwner(actor,property)!=owner)throw denied();
        if(actor.activeRole()==RoleCode.MANAGER&&(!request.propertyIds().isEmpty()||request.areaId()!=null||!request.permissions().isEmpty()))throw denied();
        if(request.areaId()!=null&&db.sql("SELECT COUNT(*) FROM management_areas a JOIN organizations o ON o.id=a.organization_id WHERE a.id=:area AND a.status='ACTIVE' AND o.administrator_id=:owner").param("area",request.areaId()).param("owner",owner).query(Long.class).single()!=1)throw denied();
        String phone=clean(request.phone());if(phone!=null)phone=VietnamPhones.aliases(phone).getFirst();
        String email=clean(request.email());if(email!=null)email=email.toLowerCase(Locale.ROOT);
        boolean existing=request.existingUserId()!=null;long user;String initial=null;
        if(existing){var current=controlled(actor,request.existingUserId());user=request.existingUserId();phone=(String)current.get("phone");email=(String)current.get("email");}
        else {
            if(phone==null||!VietnamPhones.isValid(phone))throw conflict("Tài khoản mới cần số điện thoại hợp lệ để đăng nhập khi không có email.");
            noDuplicate(email,phone,null);initial=randomPassword();var key=new GeneratedKeyHolder();
            db.sql("INSERT INTO users(full_name,phone,email,password_hash,status,must_change_password,initial_password_expires_at) VALUES(:name,:phone,:email,:hash,'ACTIVE',TRUE,DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 48 HOUR))")
                .param("name",request.fullName().trim()).param("phone",phone).param("email",email).param("hash",passwords.encode(initial)).update(key,"id");user=Objects.requireNonNull(key.getKey()).longValue();
        }
        for(String role:request.roles()){
            db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT :user,id FROM roles WHERE code=:role").param("user",user).param("role",role).update();
            db.sql("INSERT IGNORE INTO owner_staff_members(owner_id,user_id,role_code) VALUES(:owner,:user,:role)").param("owner",owner).param("user",user).param("role",role).update();
            if("ACCOUNTANT".equals(role))db.sql("INSERT IGNORE INTO accountant_profiles(user_id,employee_code,can_issue_invoice,can_record_payment,can_review_proof,can_create_voucher,can_create_adjustment,can_close_period,can_reopen_period) VALUES(:user,:code,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE)").param("user",user).param("code","ACC-"+user).update();
            if("TECHNICIAN".equals(role))db.sql("INSERT IGNORE INTO technician_profiles(user_id,employee_code) VALUES(:user,:code)").param("user",user).param("code","TECH-"+user).update();
        }
        Long profileId=null;
        if(request.roles().contains("TENANT")){
            var current=db.sql("SELECT * FROM tenant_profiles WHERE user_id=:user FOR UPDATE").param("user",user).query().listOfRows();
            if(tenant!=null){
                if(!Boolean.TRUE.equals(request.identityConfirmed()))throw conflict("Xác nhận đã đối chiếu danh tính và thông tin liên hệ trước khi liên kết hồ sơ.");
                boolean phoneMatch=phone!=null&&VietnamPhones.isValid(String.valueOf(tenant.get("phone")))&&VietnamPhones.aliases(phone).contains(tenant.get("phone"));
                boolean emailMatch=email!=null&&tenant.get("email")!=null&&email.equalsIgnoreCase(tenant.get("email").toString());
                if(!phoneMatch&&!emailMatch)throw conflict("Thông tin liên hệ tài khoản không khớp hồ sơ. Đối chiếu danh tính trước khi liên kết.");
                profileId=num(tenant,"id");
                if(tenant.get("user_id")!=null&&num(tenant,"user_id")!=user)throw conflict("Hồ sơ đã có tài khoản. Chọn liên kết đúng tài khoản hiện tại.");
                if(!current.isEmpty()&&num(current.getFirst(),"id")!=profileId)throw conflict("Tài khoản đã có hồ sơ khác; không tự ghép hoặc xóa lịch sử thuê.");
                if(db.sql("SELECT COUNT(*) FROM contracts WHERE tenant_profile_id=:profile AND tenant_id IS NOT NULL AND tenant_id<>:user").param("profile",profileId).param("user",user).query(Long.class).single()>0)throw conflict("Hồ sơ có hợp đồng gắn với tài khoản khác. Chọn đúng tài khoản; lịch sử thuê được giữ nguyên.");
                db.sql("UPDATE tenant_profiles SET user_id=:user WHERE id=:id").param("user",user).param("id",profileId).update();
            }else if(!current.isEmpty()){
                profileId=num(current.getFirst(),"id");var existingProfile=profile(actor,profileId);if(ownerFor(actor,request.managementPropertyId(),existingProfile)!=owner)throw denied();
            }else {
                if(db.sql("SELECT COUNT(*) FROM tenant_profiles WHERE phone IN (:phones) OR (:email IS NOT NULL AND LOWER(email)=LOWER(:email))").param("phones",phone==null?List.of(""):VietnamPhones.aliases(phone)).param("email",email).query(Long.class).single()>0)throw conflict("Đã có hồ sơ khớp thông tin liên hệ. Chọn hồ sơ sẵn có để tránh tạo trùng.");
                var key=new GeneratedKeyHolder();db.sql("INSERT INTO tenant_profiles(tenant_code,user_id,full_name,phone,email,date_of_birth,created_by,management_property_id,profile_status) VALUES(:code,:user,:name,:phone,:email,:dob,:actor,:property,'INCOMPLETE')")
                    .param("code","NT-"+UUID.randomUUID().toString().replace("-","").substring(0,20)).param("user",user).param("name",request.fullName().trim()).param("phone",phone==null?"UNSET-"+user:phone).param("email",email).param("dob",request.dateOfBirth()).param("actor",actor.id()).param("property",request.managementPropertyId()).update(key,"id");profileId=Objects.requireNonNull(key.getKey()).longValue();
            }
        } else if(tenant!=null)throw conflict("Chỉ liên kết hồ sơ khi có vai trò người thuê.");
        if(!request.propertyIds().isEmpty()||request.areaId()!=null){
            for(String role:request.roles())if(!"TENANT".equals(role))accounts.assign(actor,user,new OwnerAccountsService.Assignment(role,request.propertyIds(),request.areaId(),request.permissions().getOrDefault(role,Set.of()),Boolean.TRUE.equals(request.primary())&&"MANAGER".equals(role),request.reason()));
        } else if(request.permissions().values().stream().anyMatch(c->!c.isEmpty()))throw conflict("Chọn nhà trọ hoặc khu vực trước khi cấp quyền nghiệp vụ.");
        if(!existing&&!"ACTIVE".equals(request.initialStatus()))db.sql("UPDATE users SET status=:status WHERE id=:user").param("status",request.initialStatus()).param("user",user).update();
        audit.record(actor.id(),existing?"ACCOUNT_ROLES_LINKED":"ACCOUNT_CREATED_DIRECT","USER",user,"SUCCESS","owner="+owner+"; roles="+request.roles()+"; profile="+profileId+"; "+request.reason());
        boolean must=Boolean.TRUE.equals(db.sql("SELECT must_change_password FROM users WHERE id=:id").param("id",user).query(Boolean.class).single());
        return new Result(user,request.roles(),email==null?phone:email,initial,existing,must,existing?0:48,profileId);
    }
    @Transactional
    public Result reset(AuthenticatedUser actor,long user,Reason request){
        actorLock(actor);var current=controlled(actor,user);String initial=randomPassword();
        db.sql("UPDATE users SET password_hash=:hash,must_change_password=TRUE,initial_password_expires_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 48 HOUR),password_changed_at=UTC_TIMESTAMP(6),failed_login_attempts=0,locked_until=NULL WHERE id=:user").param("hash",passwords.encode(initial)).param("user",user).update();
        audit.record(actor.id(),"ACCOUNT_PASSWORD_RESET","USER",user,"SUCCESS",request.reason());
        Set<String> roles=new LinkedHashSet<>(db.sql("SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=:user").param("user",user).query(String.class).list());
        return new Result(user,roles,(String)(current.get("email")==null?current.get("phone"):current.get("email")),initial,false,true,48,null);
    }
    @Transactional
    public void edit(AuthenticatedUser actor,long user,Edit request){
        actorLock(actor);controlled(actor,user);String phone=clean(request.phone()),email=clean(request.email());
        if(phone!=null)phone=VietnamPhones.aliases(phone).getFirst();if(email!=null)email=email.toLowerCase(Locale.ROOT);
        if(phone==null&&email==null)throw conflict("Cần ít nhất một email hoặc số điện thoại để đăng nhập.");
        noDuplicate(email,phone,user);
        db.sql("UPDATE users SET full_name=:name,phone=:phone,email=:email WHERE id=:user").param("name",request.fullName().trim()).param("phone",phone).param("email",email).param("user",user).update();
        db.sql("UPDATE tenant_profiles SET full_name=:name,phone=COALESCE(:phone,phone),email=:email WHERE user_id=:user").param("name",request.fullName().trim()).param("phone",phone).param("email",email).param("user",user).update();
        audit.record(actor.id(),"ACCOUNT_INFORMATION_UPDATED","USER",user,"SUCCESS",request.reason());
    }
    @Transactional
    public void status(AuthenticatedUser actor,long user,Status request){actorLock(actor);controlled(actor,user);db.sql("UPDATE users SET status=:status,locked_until=NULL,failed_login_attempts=0 WHERE id=:user").param("status",request.status()).param("user",user).update();audit.record(actor.id(),"ACCOUNT_STATUS_CHANGED","USER",user,"SUCCESS","status="+request.status()+"; "+request.reason());}
    private static String clean(String text){return text==null||text.isBlank()?null:text.trim();}
    private static long num(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    private static String randomPassword(){byte[] bytes=new byte[18];new SecureRandom().nextBytes(bytes);return "Sh9!"+Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
}
