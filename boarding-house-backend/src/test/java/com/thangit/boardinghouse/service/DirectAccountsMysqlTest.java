package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.*;
import com.thangit.boardinghouse.security.*;
import com.thangit.boardinghouse.service.AccountProvisioningService.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@EnabledIfSystemProperty(named="direct.accounts.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DirectAccountsMysqlTest {
 final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
 final BCryptPasswordEncoder passwords=new BCryptPasswordEncoder(4);final AtomicInteger sequence=new AtomicInteger(100000);
 final AuthenticatedUser manager=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER),other=new AuthenticatedUser(4L,"other@test.invalid",RoleCode.OWNER);
 AccountProvisioningService service;OwnerAccountsService accounts;AdminTenantRepository tenants;InitialPasswordService initial;
 @BeforeAll void setup()throws Exception{
  f.setup("direct_accounts_test_","33");long before=count("contracts");Flyway.configure().dataSource(f.dataSource).load().migrate();assertThat(count("contracts")).isEqualTo(before);
  for(var r:Map.of(1,"OWNER",2,"MANAGER",3,"ACCOUNTANT",4,"OWNER",5,"TENANT",6,"TECHNICIAN").entrySet())f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE code=:role").param("id",r.getKey()).param("role",r.getValue()).update();
  var audit=new SecurityAudit(f.db);tenants=new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db));accounts=new OwnerAccountsService(f.db,audit,new PropertyAuthorization(f.db,audit),passwords,tenants);service=new AccountProvisioningService(f.db,audit,passwords,accounts,tenants);initial=new InitialPasswordService(f.db,passwords,audit);
 }
 String phone(){return "09%08d".formatted(sequence.incrementAndGet());}
 long count(String table){return f.db.sql("SELECT COUNT(*) FROM "+table).query(Long.class).single();}
 long property(long owner){return f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES("+owner+",'"+f.key().substring(0,20)+"','Property','Test')");}
 Create request(String role,String phone,String email,List<Long> props,Long management,Long profile,Long user,boolean identity,Set<String> permissions){return new Create("Direct created account",phone,email,Set.of(role),"ACTIVE",props,null,management,profile,user,null,permissions.isEmpty()?Map.of():Map.of(role,permissions),false,identity,"Authorized direct creation");}
 Result create(String role){return f.inTx(()->service.create(f.owner,request(role,phone(),null,List.of(),null,null,null,false,Set.of())));}
 void forbidden(Runnable action){assertThatThrownBy(action::run).isInstanceOfSatisfying(AuthException.class,e->assertThat(e.status().value()).isEqualTo(403));}
 void conflict(Runnable action){assertThatThrownBy(action::run).isInstanceOfSatisfying(AuthException.class,e->assertThat(e.status().value()).isEqualTo(409));}
 AuthenticatedUser principal(Result user,String role){return new AuthenticatedUser(user.id(),null,RoleCode.valueOf(role),f.db.sql("SELECT security_version FROM users WHERE id=:id").param("id",user.id()).query(Long.class).single(),Instant.now(),null);}
 @Test void directManagerIsCreatedAssignedAndListedWithoutInvitation(){
  long a=property(1),b=property(1),invitations=count("account_invitations");String phone=phone();var result=f.inTx(()->service.create(f.owner,request("MANAGER",phone,null,List.of(a,b),null,null,null,false,Set.of("FINANCE_READ"))));
  assertThat(result.initialPassword()).isNotBlank();assertThat(result.mustChangePassword()).isTrue();assertThat(result.loginIdentifier()).isEqualTo(phone);
  assertThat(count("account_invitations")).isEqualTo(invitations);assertThat(f.db.sql("SELECT COUNT(*) FROM property_managers WHERE manager_id=:id").param("id",result.id()).query(Long.class).single()).isEqualTo(2);
  assertThat(passwords.matches(result.initialPassword(),f.db.sql("SELECT password_hash FROM users WHERE id=:id").param("id",result.id()).query(String.class).single())).isTrue();
  assertThat(new LiveSessionVerifier(f.db).verify(principal(result,"MANAGER")).email()).isNull();
  assertThat(new AdminPropertyRepository(f.db).canAccess(result.id(),RoleCode.MANAGER,a)).isTrue();assertThat(new AdminPropertyRepository(f.db).canAccess(result.id(),RoleCode.MANAGER,property(4))).isFalse();
  assertThat(accounts.list(f.owner,a,null,"MANAGER",phone,null,0,20).get("total")).isEqualTo(1);
  assertThat(f.db.sql("SELECT reason FROM security_audit_logs WHERE resource_type='USER' AND resource_id=:id").param("id",result.id()).query(String.class).list()).noneMatch(reason->reason!=null&&reason.contains(result.initialPassword()));
 }
 @Test void temporaryPasswordsAreDistinctAndChangeInvalidatesOldSessions(){
  var a=create("MANAGER");var b=create("MANAGER");assertThat(a.initialPassword()).isNotEqualTo(b.initialPassword());var before=principal(a,"MANAGER");
  assertThat(new LiveSessionVerifier(f.db).requiresPasswordChange(before)).isTrue();
  f.run(()->initial.change(before,new InitialPasswordService.Change(a.initialPassword(),"Private-New-123","Private-New-123")));
  assertThat(new LiveSessionVerifier(f.db).requiresPasswordChange(before)).isFalse();assertThatThrownBy(()->new LiveSessionVerifier(f.db).verify(before)).isInstanceOf(AuthException.class);
  assertThat(passwords.matches(a.initialPassword(),f.db.sql("SELECT password_hash FROM users WHERE id=:id").param("id",a.id()).query(String.class).single())).isFalse();
 }
 @Test void tenantCanExistBeforeRoomContractOrResidenceAndIsSharedByScope(){
  long p=property(1);f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:p,2)").param("p",p).update();long contracts=count("contracts"),residences=count("tenant_residences");
  var r=f.inTx(()->service.create(f.owner,request("TENANT",phone(),null,List.of(),p,null,null,false,Set.of())));
  assertThat(count("contracts")).isEqualTo(contracts);assertThat(count("tenant_residences")).isEqualTo(residences);
  assertThat(tenants.canAccessTenant(1,RoleCode.OWNER,r.tenantProfileId())).isTrue();assertThat(tenants.canAccessTenant(2,RoleCode.MANAGER,r.tenantProfileId())).isTrue();assertThat(tenants.canAccessTenant(4,RoleCode.OWNER,r.tenantProfileId())).isFalse();
  assertThat(tenants.summary(1,RoleCode.OWNER,p).active()).isZero();assertThat(tenants.list(2,RoleCode.MANAGER,p,null,null,null,null,null,null,null,null,null,0,20).items()).extracting(x->x.id()).contains(r.tenantProfileId());
  @SuppressWarnings("unchecked") var summary=(Map<String,Object>)accounts.list(f.owner,p,null,"TENANT",null,null,0,20).get("summary");assertThat(((Number)summary.get("pending")).longValue()).isEqualTo(1);assertThat(((Number)summary.get("active")).longValue()).isZero();
 }
 @Test void tenantWithoutPropertyIsVisibleOnlyToItsCompany(){
  var r=create("TENANT");assertThat(tenants.canAccessTenant(1,RoleCode.OWNER,r.tenantProfileId())).isTrue();assertThat(tenants.canAccessTenant(2,RoleCode.MANAGER,r.tenantProfileId())).isFalse();
  assertThat(accounts.list(f.owner,null,null,"TENANT",r.loginIdentifier(),null,0,20).get("total")).isEqualTo(1);assertThat(accounts.list(other,null,null,"TENANT",r.loginIdentifier(),null,0,20).get("total")).isEqualTo(0);
 }
 @Test void existingTenantProfileIsLinkedOnceAfterIdentityCheck(){
  String phone=phone();long p=property(1);long profile=f.insert("INSERT INTO tenant_profiles(tenant_code,full_name,phone,created_by,management_property_id) VALUES('"+f.key().substring(0,20)+"','Existing tenant','"+phone+"',1,"+p+")");long users=count("users"),profiles=count("tenant_profiles");
  conflict(()->f.run(()->service.create(f.owner,request("TENANT",phone,null,List.of(),p,profile,null,false,Set.of()))));assertThat(count("users")).isEqualTo(users);
  var r=f.inTx(()->service.create(f.owner,request("TENANT",phone,null,List.of(),p,profile,null,true,Set.of())));assertThat(r.tenantProfileId()).isEqualTo(profile);assertThat(count("tenant_profiles")).isEqualTo(profiles);
  assertThat(f.db.sql("SELECT user_id FROM tenant_profiles WHERE id=:id").param("id",profile).query(Long.class).single()).isEqualTo(r.id());
 }
 @Test void duplicatePhoneAliasesAndEmailNeverCreateAnotherUser(){
  String phone=phone(),email="direct-"+f.key()+"@test.invalid";f.run(()->service.create(f.owner,request("MANAGER",phone,email,List.of(),null,null,null,false,Set.of())));long before=count("users");
  conflict(()->f.run(()->service.create(f.owner,request("TECHNICIAN","+84"+phone.substring(1),null,List.of(),null,null,null,false,Set.of()))));
  conflict(()->f.run(()->service.create(f.owner,request("ACCOUNTANT",phone(),email.toUpperCase(Locale.ROOT),List.of(),null,null,null,false,Set.of()))));assertThat(count("users")).isEqualTo(before);
 }
 @Test void existingCompanyUserCanReceiveAnotherRoleWithoutPasswordReset(){
  var r=create("MANAGER");String hash=f.db.sql("SELECT password_hash FROM users WHERE id=:id").param("id",r.id()).query(String.class).single();long before=count("users"),p=property(1);
  var linked=f.inTx(()->service.create(f.owner,request("ACCOUNTANT","",null,List.of(p),null,null,r.id(),false,Set.of("can_record_payment"))));
  assertThat(linked.linkedExisting()).isTrue();assertThat(linked.initialPassword()).isNull();assertThat(linked.id()).isEqualTo(r.id());assertThat(count("users")).isEqualTo(before);
  assertThat(f.db.sql("SELECT password_hash FROM users WHERE id=:id").param("id",r.id()).query(String.class).single()).isEqualTo(hash);
  assertThat(f.db.sql("SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=:id").param("id",r.id()).query(String.class).list()).contains("MANAGER","ACCOUNTANT");
 }
 @Test void managerCanCreateOnlyTenantsInAssignedProperties(){
  long p=property(1),outside=property(4);f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:p,2)").param("p",p).update();
  forbidden(()->f.run(()->service.create(manager,request("MANAGER",phone(),null,List.of(),null,null,null,false,Set.of()))));
  forbidden(()->f.run(()->service.create(manager,request("TENANT",phone(),null,List.of(),outside,null,null,false,Set.of()))));
  var r=f.inTx(()->service.create(manager,request("TENANT",phone(),null,List.of(),p,null,null,false,Set.of())));assertThat(accounts.list(f.owner,p,null,"TENANT",r.loginIdentifier(),null,0,20).get("total")).isEqualTo(1);
 }
 @Test void mixedScopeAndInvalidCapabilitiesRollbackUserAndRoleCreation(){
  long before=count("users"),owned=property(1),foreign=property(4);
  forbidden(()->f.run(()->service.create(f.owner,request("MANAGER",phone(),null,List.of(owned,foreign),null,null,null,false,Set.of()))));
  conflict(()->f.run(()->service.create(f.owner,request("MANAGER",phone(),null,List.of(owned),null,null,null,false,Set.of("UNSUPPORTED")))));assertThat(count("users")).isEqualTo(before);
 }
 @Test void companyCannotLinkEditResetOrLockForeignAccounts(){
  var foreign=f.inTx(()->service.create(other,request("MANAGER",phone(),null,List.of(),null,null,null,false,Set.of())));
  forbidden(()->f.run(()->service.create(f.owner,request("ACCOUNTANT","",null,List.of(),null,null,foreign.id(),false,Set.of()))));
  forbidden(()->f.run(()->service.edit(f.owner,foreign.id(),new Edit("Attempt",phone(),null,"Wrong owner"))));
  forbidden(()->f.run(()->service.reset(f.owner,foreign.id(),new Reason("Wrong owner"))));
  forbidden(()->f.run(()->service.status(f.owner,foreign.id(),new Status("LOCKED","Wrong owner"))));
 }
 @Test void accountantsAndTechniciansReuseProfilesAndStartWithNoSensitiveRights(){
  long p=property(1);var a=f.inTx(()->service.create(f.owner,request("ACCOUNTANT",phone(),null,List.of(p),null,null,null,false,Set.of())));var t=f.inTx(()->service.create(f.owner,request("TECHNICIAN",phone(),null,List.of(p),null,null,null,false,Set.of("MAINTENANCE_UPDATE"))));
  var repo=new AccountantPortalRepository(f.db);assertThat(repo.profileExists(a.id())).isTrue();assertThat(repo.canAccess(a.id(),p)).isTrue();assertThat(repo.permission(a.id(),"can_record_payment")).isFalse();assertThat(repo.permission(a.id(),"can_approve_refund")).isFalse();
  f.run(()->new TechnicianPortalRepository(f.db).requireWorkPermission(t.id(),p,false));forbidden(()->f.run(()->new TechnicianPortalRepository(f.db).requireWorkPermission(t.id(),p,true)));
 }
 @Test void resetAndLockInvalidateExistingSessionsWithoutDeletingAssignments(){
  long p=property(1);var r=f.inTx(()->service.create(f.owner,request("MANAGER",phone(),null,List.of(p),null,null,null,false,Set.of())));var before=principal(r,"MANAGER");
  var reset=f.inTx(()->service.reset(f.owner,r.id(),new Reason("Authorized reset")));assertThat(reset.initialPassword()).isNotEqualTo(r.initialPassword());assertThatThrownBy(()->new LiveSessionVerifier(f.db).verify(before)).isInstanceOf(AuthException.class);
  f.run(()->service.status(f.owner,r.id(),new Status("LOCKED","Authorized lock")));assertThatThrownBy(()->new LiveSessionVerifier(f.db).verify(principal(r,"MANAGER"))).isInstanceOf(AuthException.class);assertThat(new AdminPropertyRepository(f.db).canAccess(r.id(),RoleCode.MANAGER,p)).isTrue();
 }
 @Test void initialPasswordCannotBeReusedOrChangedAfterExpiry(){
  var r=create("TENANT");conflict(()->f.run(()->service.create(f.owner,request("TENANT",r.loginIdentifier(),null,List.of(),null,null,null,false,Set.of()))));
  f.db.sql("UPDATE users SET initial_password_expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE id=:id").param("id",r.id()).update();
  forbidden(()->f.run(()->initial.change(principal(r,"TENANT"),new InitialPasswordService.Change(r.initialPassword(),"Private-New-123","Private-New-123"))));
 }
 @Test void contactEditAndInactiveStatusKeepAccountAndResidenceDistinct(){
  var r=create("TENANT");long before=count("tenant_residences");String changed=phone();f.run(()->service.edit(f.owner,r.id(),new Edit("Updated name",changed,null,"Updated contact")));f.run(()->service.status(f.owner,r.id(),new Status("INACTIVE","Not activated")));
  assertThat(count("tenant_residences")).isEqualTo(before);assertThat(f.db.sql("SELECT phone FROM tenant_profiles WHERE user_id=:id").param("id",r.id()).query(String.class).single()).isEqualTo(changed);
 }
}
