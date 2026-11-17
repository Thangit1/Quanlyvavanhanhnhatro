package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.*;
import com.thangit.boardinghouse.security.*;
import com.thangit.boardinghouse.service.OwnerAccountsService.*;
import com.thangit.boardinghouse.service.OrganizationManagementService.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@EnabledIfSystemProperty(named="accounts.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OwnerAccountsMysqlTest {
    final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    final AuthenticatedUser other=new AuthenticatedUser(4L,"other@test.invalid",RoleCode.OWNER);
    final BCryptPasswordEncoder passwords=new BCryptPasswordEncoder(4);
    OwnerAccountsService service;PropertyAuthorization access;OrganizationManagementService organizations;
    @BeforeAll void setup()throws Exception {
        f.setup("accounts_test_","32");
        long before=f.db.sql("SELECT COUNT(*) FROM contracts").query(Long.class).single();
        Flyway.configure().dataSource(f.dataSource).load().migrate();
        assertThat(f.db.sql("SELECT COUNT(*) FROM contracts").query(Long.class).single()).isEqualTo(before);
        assertThat(f.db.sql("SELECT COUNT(*) FROM account_invitations").query(Long.class).single()).isZero();
        for(var entry:Map.of(1,"OWNER",2,"MANAGER",3,"ACCOUNTANT",4,"OWNER",5,"TENANT",6,"TECHNICIAN").entrySet())f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT :user,id FROM roles WHERE code=:role").param("user",entry.getKey()).param("role",entry.getValue()).update();
        access=new PropertyAuthorization(f.db,new SecurityAudit(f.db));
        service=new OwnerAccountsService(f.db,new SecurityAudit(f.db),access,passwords,new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db)));
        organizations=new OrganizationManagementService(f.db,new SecurityAudit(f.db));
    }
    String email(){return "invite-"+f.key()+"@test.invalid";}
    long property(long owner){return f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES("+owner+",'"+f.key().substring(0,20)+"','Test property','Test')");}
    Map<String,Object> invite(String email,String role){return f.inTx(()->service.invite(f.owner,new Invite(email,"Invited staff",role,null,"Explicit invitation")));}
    long user(String email){return f.db.sql("SELECT id FROM users WHERE email=:email").param("email",email).query(Long.class).single();}
    long accepted(String role){String email=email();var link=invite(email,role);f.run(()->service.accept(null,new Accept(link.get("token").toString(),"Safe-Password-123")));return user(email);}
    Assignment assignment(String role,List<Long> properties,Long area,Set<String> caps,boolean primary){return new Assignment(role,properties,area,caps,primary,"Explicit assignment");}
    void forbidden(Runnable run){assertThatThrownBy(run::run).isInstanceOfSatisfying(AuthException.class,e->assertThat(e.status().value()).isEqualTo(403));}
    void conflict(Runnable run){assertThatThrownBy(run::run).isInstanceOfSatisfying(AuthException.class,e->assertThat(e.status().value()).isEqualTo(409));}

    @Test void invitationCreatesNoUserUntilAcceptanceAndNeverPersistsTokenOrPassword(){
        String email=email();var link=invite(email,"MANAGER");String token=link.get("token").toString();
        assertThat(token).hasSize(43);
        assertThat(f.db.sql("SELECT COUNT(*) FROM users WHERE email=:email").param("email",email).query(Long.class).single()).isZero();
        assertThat(f.db.sql("SELECT token_hash FROM account_invitations WHERE id=:id").param("id",link.get("id")).query(String.class).single()).hasSize(64).doesNotContain(token);
        f.run(()->service.accept(null,new Accept(token,"Safe-Password-123")));
        long id=user(email);String hash=f.db.sql("SELECT password_hash FROM users WHERE id=:id").param("id",id).query(String.class).single();
        assertThat(passwords.matches("Safe-Password-123",hash)).isTrue();
        assertThat(assignments(id,"MANAGER")).isEmpty();
        conflict(()->f.run(()->service.accept(null,new Accept(token,"Safe-Password-123"))));
        assertThat(f.db.sql("SELECT COUNT(*) FROM users WHERE email=:email").param("email",email).query(Long.class).single()).isEqualTo(1);
    }
    @SuppressWarnings("unchecked") List<Map<String,Object>> assignments(long id,String role){return (List<Map<String,Object>>)service.detail(f.owner,id,role).get("assignments");}
    @Test void existingAccountRequiresAuthenticatedEmailOwnerAndKeepsPassword(){
        String email="p03-2@test.invalid";String before=f.db.sql("SELECT password_hash FROM users WHERE id=2").query(String.class).single();
        var link=invite(email,"MANAGER");String token=link.get("token").toString();
        assertThatThrownBy(()->f.run(()->service.accept(null,new Accept(token,"Changed-Password-123")))).isInstanceOfSatisfying(AuthException.class,e->assertThat(e.status().value()).isEqualTo(401));
        f.run(()->service.accept(new AuthenticatedUser(2L,email,RoleCode.MANAGER),new Accept(token,null)));
        assertThat(user(email)).isEqualTo(2);
        assertThat(f.db.sql("SELECT password_hash FROM users WHERE id=2").query(String.class).single()).isEqualTo(before);
    }
    @Test void resendRevokeAndExpiryInvalidateTokens(){
        var first=invite(email(),"TECHNICIAN");var replacement=f.inTx(()->service.resend(f.owner,((Number)first.get("id")).longValue(),new Reason("Replace link")));
        conflict(()->f.run(()->service.accept(null,new Accept(first.get("token").toString(),"Safe-Password-123"))));
        f.run(()->service.revokeInvitation(f.owner,((Number)replacement.get("id")).longValue(),new Reason("Withdraw invite")));
        conflict(()->f.run(()->service.accept(null,new Accept(replacement.get("token").toString(),"Safe-Password-123"))));
        var expired=invite(email(),"MANAGER");f.db.sql("UPDATE account_invitations SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE id=:id").param("id",expired.get("id")).update();
        conflict(()->f.run(()->service.accept(null,new Accept(expired.get("token").toString(),"Safe-Password-123"))));
        assertThat(service.invitations(f.owner)).anySatisfy(i->assertThat(i.get("status")).isEqualTo("EXPIRED"));
    }
    @Test void manyManagersManyPropertiesPrimaryAndRevocationKeepData(){
        long a=property(1),b=property(1),c=property(1),manager=accepted("MANAGER"),second=accepted("MANAGER");
        f.run(()->service.assign(f.owner,manager,assignment("MANAGER",List.of(a,b),null,Set.of("FINANCE_READ"),true)));
        f.run(()->service.assign(f.owner,second,assignment("MANAGER",List.of(b,c),null,Set.of(),true)));
        assertThat(assignments(manager,"MANAGER")).hasSize(2);assertThat(assignments(second,"MANAGER")).hasSize(2);
        assertThat(f.db.sql("SELECT manager_id FROM property_managers WHERE property_id=:p AND is_primary=TRUE").param("p",b).query(Long.class).single()).isEqualTo(second);
        var repository=new AdminPropertyRepository(f.db);
        assertThat(((Number)repository.property(b).orElseThrow().get("manager_id")).longValue()).isEqualTo(second);
        assertThat(repository.canAccess(manager,RoleCode.MANAGER,a)).isTrue();assertThat(repository.canAccess(manager,RoleCode.MANAGER,c)).isFalse();
        forbidden(()->access.require(new AuthenticatedUser(manager,"test",RoleCode.MANAGER),a,PropertyAuthorization.Capability.FINANCE_WRITE));
        long count=f.db.sql("SELECT COUNT(*) FROM properties").query(Long.class).single();
        f.run(()->service.revoke(f.owner,manager,"MANAGER",b,new Reason("Reduce scope")));
        assertThat(repository.canAccess(manager,RoleCode.MANAGER,b)).isFalse();assertThat(repository.canAccess(second,RoleCode.MANAGER,b)).isTrue();
        assertThat(f.db.sql("SELECT COUNT(*) FROM properties").query(Long.class).single()).isEqualTo(count);
        f.run(()->service.revoke(f.owner,manager,"MANAGER",a,new Reason("End assignment")));
        assertThat(service.detail(f.owner,manager,"MANAGER")).containsKey("user");
        assertThat(service.history(f.owner,0)).anySatisfy(h->assertThat(h.get("action")).isEqualTo("STAFF_ASSIGNMENT_REVOKED"));
    }
    @Test void areaAssignmentIsExplicitSnapshotAndSetupIsIdempotent(){
        long org=f.inTx(()->organizations.setup(f.owner));assertThat(f.inTx(()->organizations.setup(f.owner))).isEqualTo(org);
        long area=f.inTx(()->organizations.createArea(f.owner,org,new SaveArea(f.key(),"Area",null,"ACTIVE",0L,"Test")));
        long a=property(1),b=property(1),later=property(1),manager=accepted("MANAGER");
        for(long id:List.of(a,b))f.run(()->organizations.link(f.owner,org,new LinkProperty(id,area,"Agreement",LocalDate.now(),"Test grouping")));
        f.run(()->service.assign(f.owner,manager,assignment("MANAGER",List.of(),area,Set.of("CONTRACT_APPROVE"),false)));
        f.run(()->organizations.link(f.owner,org,new LinkProperty(later,area,"Agreement",LocalDate.now(),"Later property")));
        assertThat(assignments(manager,"MANAGER")).hasSize(2);
        assertThat(new AdminPropertyRepository(f.db).canAccess(manager,RoleCode.MANAGER,later)).isFalse();
    }
    @Test void accountantUsesExistingFlagsAndCannotChangeSharedProfiles(){
        long accountant=accepted("ACCOUNTANT"),a=property(1),outside=property(4);
        f.run(()->service.assign(f.owner,accountant,assignment("ACCOUNTANT",List.of(a),null,Set.of("can_record_payment"),false)));
        var repo=new AccountantPortalRepository(f.db);
        assertThat(repo.canAccess(accountant,a)).isTrue();assertThat(repo.canAccess(accountant,outside)).isFalse();
        assertThat(repo.permission(accountant,"can_record_payment")).isTrue();assertThat(repo.permission(accountant,"can_issue_invoice")).isFalse();assertThat(repo.permission(accountant,"can_approve_refund")).isFalse();
        f.db.sql("INSERT INTO accountant_property_assignments(accountant_id,property_id,granted_by) VALUES(:u,:p,4)").param("u",accountant).param("p",outside).update();
        forbidden(()->f.run(()->service.assign(f.owner,accountant,assignment("ACCOUNTANT",List.of(a),null,Set.of("can_approve_refund"),false))));
        assertThat(repo.permission(accountant,"can_approve_refund")).isFalse();
        f.run(()->service.revoke(f.owner,accountant,"ACCOUNTANT",a,new Reason("Remove owned scope")));
        assertThat(repo.canAccess(accountant,a)).isFalse();assertThat(repo.canAccess(accountant,outside)).isTrue();
    }
    @Test void technicianRequiresTaskAssignmentAndPermissionAndRevocationIsImmediate(){
        long user=accepted("TECHNICIAN"),p=property(1);
        f.run(()->service.assign(f.owner,user,assignment("TECHNICIAN",List.of(p),null,Set.of(),false)));
        var repo=new TechnicianPortalRepository(f.db);
        long task=f.insert("INSERT INTO maintenance_requests(code,property_id,title,description,issue_type,priority,status,assigned_to) VALUES('"+f.key()+"',"+p+",'Task','Test','OTHER','NORMAL','ASSIGNED',"+user+")");
        assertThat(repo.taskData(user,task,false)).isPresent();
        @SuppressWarnings("unchecked") var workHistory=(List<Map<String,Object>>)service.detail(f.owner,user,"TECHNICIAN").get("tasks");
        assertThat(workHistory).anySatisfy(row->assertThat(((Number)row.get("id")).longValue()).isEqualTo(task));
        forbidden(()->f.run(()->repo.requireWorkPermission(user,p,false)));
        f.run(()->service.assign(f.owner,user,assignment("TECHNICIAN",List.of(p),null,Set.of("MAINTENANCE_UPDATE"),false)));
        f.run(()->repo.requireWorkPermission(user,p,false));forbidden(()->f.run(()->repo.requireWorkPermission(user,p,true)));
        f.run(()->service.assign(f.owner,user,assignment("TECHNICIAN",List.of(p),null,Set.of("MAINTENANCE_UPDATE","MAINTENANCE_COST"),false)));
        f.run(()->repo.requireWorkPermission(user,p,true));
        f.run(()->service.revoke(f.owner,user,"TECHNICIAN",p,new Reason("End technical assignment")));
        assertThat(repo.taskData(user,task,false)).isEmpty();assertThat(f.db.sql("SELECT COUNT(*) FROM maintenance_requests WHERE id=:id").param("id",task).query(Long.class).single()).isEqualTo(1);
    }
    @Test void lockingStaffInvalidatesAlreadyIssuedSessionAndUnlockDoesNotReviveIt(){
        long user=accepted("MANAGER");var actor=new AuthenticatedUser(user,"session@test.invalid",RoleCode.MANAGER,
                f.db.sql("SELECT security_version FROM users WHERE id=:id").param("id",user).query(Long.class).single(),Instant.now(),null);
        var verifier=new LiveSessionVerifier(f.db);assertThat(verifier.verify(actor).id()).isEqualTo(user);
        f.run(()->service.status(f.owner,user,new ChangeStatus("LOCKED","Test lock")));
        assertThatThrownBy(()->verifier.verify(actor)).isInstanceOf(AuthException.class);
        f.run(()->service.status(f.owner,user,new ChangeStatus("ACTIVE","Test unlock")));
        assertThatThrownBy(()->verifier.verify(actor)).isInstanceOf(AuthException.class);
    }
    @Test void foreignOwnersAndManagersCannotAdministerAccountsOrMixedScope(){
        long user=accepted("MANAGER"),owned=property(1),foreign=property(4);
        forbidden(()->service.detail(other,user,"MANAGER"));
        forbidden(()->f.run(()->service.assign(f.owner,user,assignment("MANAGER",List.of(owned,foreign),null,Set.of(),false))));
        assertThat(assignments(user,"MANAGER")).isEmpty();
        forbidden(()->service.options(new AuthenticatedUser(2L,"test",RoleCode.MANAGER)));
        forbidden(()->f.run(()->service.status(other,user,new ChangeStatus("LOCKED","Wrong owner"))));
    }
    @Test void tenantActivationPreservesResidenceAndShowsSeparateAccountStatus(){
        long p=property(1);String email=email();long profile=f.insert("INSERT INTO tenant_profiles(tenant_code,full_name,phone,email) VALUES('"+f.key().substring(0,20)+"','New tenant','"+f.key().substring(0,18)+"','"+email+"')");
        f.db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,move_in_date,status) VALUES(:t,:p,CURRENT_DATE,'ACTIVE')").param("t",profile).param("p",p).update();
        var invitation=f.inTx(()->service.invite(f.owner,new Invite(email,"New tenant","TENANT",profile,"Tenant activation")));
        f.run(()->service.accept(null,new Accept(invitation.get("token").toString(),"Safe-Password-123")));
        long user=user(email);
        assertThat(f.db.sql("SELECT user_id FROM tenant_profiles WHERE id=:id").param("id",profile).query(Long.class).single()).isEqualTo(user);
        assertThat(f.db.sql("SELECT status FROM tenant_residences WHERE tenant_profile_id=:id").param("id",profile).query(String.class).single()).isEqualTo("ACTIVE");
        var result=service.list(f.owner,p,null,"TENANT",null,null,0,20);
        @SuppressWarnings("unchecked") var items=(List<Map<String,Object>>)result.get("items");
        assertThat(items).anySatisfy(row->{assertThat(((Number)row.get("id")).longValue()).isEqualTo(user);assertThat(row.get("status")).isEqualTo("ACTIVE");assertThat(row.get("residence_status")).isEqualTo("ACTIVE");});
        conflict(()->f.run(()->service.invite(f.owner,new Invite(email,"New tenant","TENANT",profile,"Duplicate activation"))));
    }
    @Test void invitationAcceptanceIsSingleUseUnderConcurrency()throws Exception {
        String email=email();var link=invite(email,"TECHNICIAN");String token=link.get("token").toString();var gate=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){List<Future<Boolean>> results=new ArrayList<>();for(int i=0;i<2;i++)results.add(pool.submit(()->{gate.await();try{f.run(()->service.accept(null,new Accept(token,"Safe-Password-123")));return true;}catch(AuthException e){assertThat(e.status().value()).isEqualTo(409);return false;}}));gate.countDown();int ok=0;for(var result:results)if(result.get(30,TimeUnit.SECONDS))ok++;assertThat(ok).isEqualTo(1);}
        assertThat(f.db.sql("SELECT COUNT(*) FROM users WHERE email=:email").param("email",email).query(Long.class).single()).isEqualTo(1);
    }
    @Test void refundApprovalRequiresExplicitDelegation(){
        var x=f.booking("1000");f.run(()->f.ledger.collect(f.accountant,x.deposit(),f.key(),f.cash("1000")));
        long refund=f.cancelAndRequest(x,"1000","0");
        forbidden(()->f.run(()->f.ledger.approveRefund(f.accountant,x.deposit(),refund)));
        f.run(()->service.assign(f.owner,3,assignment("ACCOUNTANT",List.of(x.property()),null,Set.of("can_record_payment","can_approve_refund"),false)));
        f.run(()->f.ledger.approveRefund(f.accountant,x.deposit(),refund));
        assertThat(f.db.sql("SELECT status FROM deposit_refund_requests WHERE id=:id").param("id",refund).query(String.class).single()).isEqualTo("APPROVED");
    }
}
