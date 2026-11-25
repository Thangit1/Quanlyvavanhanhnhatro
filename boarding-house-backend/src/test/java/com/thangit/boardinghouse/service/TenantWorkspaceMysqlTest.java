package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.*;
import com.thangit.boardinghouse.repository.AdminTenantRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AdminTenantServiceImpl;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Uses a fresh retained schema on the explicitly supplied isolated MySQL server. */
@EnabledIfSystemProperty(named="tenants.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TenantWorkspaceMysqlTest {
    @Test void newlyManagedProfileCanBookBeforeFirstResidence(){
        long property=property(),profile=create("0912345191",property);
        long room=f.insert("INSERT INTO rooms(property_id,code,monthly_rent,status) VALUES("+property+",'FRESH-BOOK',1000000,'READY')");
        var request=new com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.CreateBooking(profile,room,LocalDate.now(),LocalDate.now().plusDays(2),java.math.BigDecimal.ZERO,"DIRECT","New profile booking");
        assertThat(f.inTx(()->f.lifecycle.createBooking(f.owner,request)).id()).isPositive();
        assertThat(f.db.sql("SELECT COUNT(*) FROM tenant_residences WHERE tenant_profile_id=:id").param("id",profile).query(Long.class).single()).isZero();
    }
    @Test void managementScopeOfAnotherHouseDoesNotAuthorizeBooking(){
        long property=property(),foreign=property(),profile=create("0912345192",foreign);
        long room=f.insert("INSERT INTO rooms(property_id,code,monthly_rent,status) VALUES("+property+",'FOREIGN-BOOK',1000000,'READY')");
        var request=new com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.CreateBooking(profile,room,LocalDate.now(),LocalDate.now().plusDays(2),java.math.BigDecimal.ZERO,"DIRECT","Invalid scope");
        assertThatThrownBy(()->f.inTx(()->f.lifecycle.createBooking(f.owner,request))).isInstanceOf(AuthException.class);
    }
    final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    AdminTenantServiceImpl service;
    @BeforeAll void setup()throws Exception{
        f.setup("tenant_workspace_test_",null);
        service=new AdminTenantServiceImpl(new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db)),new BCryptPasswordEncoder());
    }
    SaveTenant request(String phone,Long property,Long version){return new SaveTenant("Workspace tenant",null,null,phone,null,null,null,null,null,null,null,null,null,null,null,null,property,null,null,null,null,version);}
    long create(String phone,Long property){return f.inTx(()->service.create(f.owner,request(phone,property,null))).id();}
    long property(){return f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'"+UUID.randomUUID().toString().substring(0,20)+"','Tenant workspace','Test')");}
    @Test void independentProfileDoesNotCreateResidenceAccountContractOrDeposit(){
        long users=count("users"),contracts=count("contracts"),deposits=count("tenant_deposits");
        long id=create("0912345101",null);
        var detail=service.detail(f.owner,id);
        assertThat(detail.residences()).isEmpty();assertThat(detail.contracts()).isEmpty();assertThat(detail.hasAccount()).isFalse();assertThat(detail.status()).isEqualTo("PENDING");
        assertThat(count("users")).isEqualTo(users);assertThat(count("contracts")).isEqualTo(contracts);assertThat(count("tenant_deposits")).isEqualTo(deposits);
    }
    @Test void duplicateProfileRejectedWithoutPartialRows(){
        create("0912345102",null);long profiles=count("tenant_profiles");
        assertThatThrownBy(()->create("0912345102",null)).isInstanceOf(AuthException.class);
        assertThat(count("tenant_profiles")).isEqualTo(profiles);
        assertThatThrownBy(()->create("+84912345102",null)).isInstanceOf(AuthException.class);
    }
    @Test void simultaneousCreateCommitsOnlyOneProfile()throws Exception{
        var pool=java.util.concurrent.Executors.newFixedThreadPool(2);var gate=new java.util.concurrent.CountDownLatch(1);
        try{
            var task=(java.util.concurrent.Callable<Boolean>)()->{gate.await();try{create("0912345110",null);return true;}catch(AuthException e){return false;}};
            var one=pool.submit(task);var two=pool.submit(task);gate.countDown();
            assertThat(java.util.List.of(one.get(15,java.util.concurrent.TimeUnit.SECONDS),two.get(15,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
            assertThat(f.db.sql("SELECT COUNT(*) FROM tenant_profiles WHERE phone='0912345110'").query(Long.class).single()).isEqualTo(1);
        }finally{pool.shutdownNow();}
    }
    @Test void assignedPropertyScopesIndependentProfile(){
        long p=property(),id=create("0912345103",p);
        var manager=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
        assertThatThrownBy(()->service.detail(manager,id)).isInstanceOf(AuthException.class);
        f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:p,2)").param("p",p).update();
        assertThat(service.detail(manager,id).managementPropertyId()).isEqualTo(p);
        assertThat(service.detail(manager,id).canReadFinance()).isFalse();
        assertThatThrownBy(()->f.inTx(()->service.create(manager,request("0912345104",null,null)))).isInstanceOf(AuthException.class);
    }
    @Test void staleProfileVersionCannotOverwriteNewerData(){
        long id=create("0912345105",null);long version=service.detail(f.owner,id).version();
        f.inTx(()->service.update(f.owner,id,request("0912345105",null,version)));
        assertThatThrownBy(()->f.inTx(()->service.update(f.owner,id,request("0912345105",null,version)))).isInstanceOf(AuthException.class).extracting(e->((AuthException)e).code()).isEqualTo("TENANT_VERSION_CONFLICT");
    }
    @Test void independentProfileListUsesPaginationAndAccountFilter(){
        long p=property(),id=create("0912345106",p);
        var result=service.list(f.owner,p,null,null,null,"NO_ACCOUNT","0912345106",null,null,"fullName","asc",0,10,null,null,null,null);
        assertThat(result.page().items()).hasSize(1);assertThat(result.page().items().getFirst().id()).isEqualTo(id);assertThat(result.page().items().getFirst().roomId()).isNull();assertThat(result.summary().pendingCheckin()).isEqualTo(1);
        assertThat(service.list(f.owner,p,null,null,null,null,null,null,null,null,null,0,10,null,null,LocalDate.now(),LocalDate.now()).page().items()).isEmpty();
    }
    @Test void memberAttachCannotBypassContractOrCrossPropertyRoom(){
        long p=property(),other=property(),id=create("0912345107",p);
        long room=f.insert("INSERT INTO rooms(property_id,code,monthly_rent) VALUES("+other+",'T101',1000)");
        assertThatThrownBy(()->f.run(()->service.attachResidence(f.owner,id,new AttachResidence(p,room,null,LocalDate.now(),"OCCUPANT")))).isInstanceOf(AuthException.class);
        assertThat(service.detail(f.owner,id).residences()).isEmpty();
        assertThatThrownBy(()->f.run(()->service.attachResidence(f.owner,id,new AttachResidence(other,room,null,LocalDate.now(),"OCCUPANT")))).isInstanceOf(AuthException.class);
    }
    @Test void tenantCannotReadIndependentAdministrativeProfile(){
        long id=create("0912345108",null);
        assertThatThrownBy(()->service.detail(f.tenant,id)).isInstanceOf(AuthException.class);
    }
    @Test void memberAttachChecksCapacityAndMoveOutPreservesHistory(){
        long p=property(),representative=create("0912345111",p),member=create("0912345112",p),extra=create("0912345113",p);
        long room=f.insert("INSERT INTO rooms(property_id,code,monthly_rent,capacity,status) VALUES("+p+",'M101',1000,2,'OCCUPIED')");
        long contract=f.insert("INSERT INTO contracts(room_id,tenant_id,tenant_profile_id,code,start_date,end_date,deposit_amount,status,occupant_count) VALUES("+room+",5,"+representative+",'MEMBER-"+room+"',CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 1 YEAR),0,'ACTIVE',1)");
        f.db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,room_id,contract_id,residence_role,status,move_in_date,created_by) VALUES(:t,:p,:r,:c,'REPRESENTATIVE','ACTIVE',CURRENT_DATE,1)").param("t",representative).param("p",p).param("r",room).param("c",contract).update();
        f.run(()->service.attachResidence(f.owner,member,new AttachResidence(p,room,contract,LocalDate.now(),"OCCUPANT")));
        assertThat(service.detail(f.owner,member).residences()).hasSize(1);
        assertThatThrownBy(()->f.run(()->service.attachResidence(f.owner,extra,new AttachResidence(p,room,contract,LocalDate.now(),"OCCUPANT")))).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->f.run(()->service.attachResidence(f.owner,member,new AttachResidence(p,room,contract,LocalDate.now(),"OCCUPANT")))).isInstanceOf(AuthException.class);
        f.run(()->service.moveOut(f.owner,member,new MoveOut(LocalDate.now(),"Member moved out",false)));
        assertThat(service.detail(f.owner,member).residences()).hasSize(1).allSatisfy(r->{assertThat(r.status()).isEqualTo("MOVED_OUT");assertThat(r.moveOutDate()).isEqualTo(LocalDate.now());});
        assertThat(f.db.sql("SELECT status FROM rooms WHERE id=:id").param("id",room).query(String.class).single()).isEqualTo("OCCUPIED");
        assertThat(f.db.sql("SELECT status FROM contracts WHERE id=:id").param("id",contract).query(String.class).single()).isEqualTo("ACTIVE");
    }
    @Test void contractListReportsOnlyCurrentVersionConfirmations(){
        var repo=new com.thangit.boardinghouse.repository.AdminContractRepository(f.db);
        var row=repo.list(1L,RoleCode.OWNER,null,null,"LEGACY",null,null,0,20).content().stream().filter(c->c.id()==f.legacyContract).findFirst().orElseThrow();
        assertThat(row.landlordConfirmed()).isFalse();assertThat(row.tenantConfirmed()).isFalse();
        f.run(()->f.onboarding.recordVersion(f.legacyContract,1L,"Test confirmation snapshot"));
        f.db.sql("INSERT INTO rental_confirmations(contract_version_id,party,actor_id,content_hash) SELECT id,'LANDLORD',1,content_hash FROM contract_versions WHERE contract_id=:id").param("id",f.legacyContract).update();
        row=repo.list(1L,RoleCode.OWNER,null,null,"LEGACY",null,null,0,20).content().stream().filter(c->c.id()==f.legacyContract).findFirst().orElseThrow();
        assertThat(row.landlordConfirmed()).isTrue();assertThat(row.tenantConfirmed()).isFalse();
        f.db.sql("UPDATE contracts SET onboarding_version=onboarding_version+1 WHERE id=:id").param("id",f.legacyContract).update();
        row=repo.list(1L,RoleCode.OWNER,null,null,"LEGACY",null,null,0,20).content().stream().filter(c->c.id()==f.legacyContract).findFirst().orElseThrow();
        assertThat(row.landlordConfirmed()).isFalse();
    }
    long count(String table){return f.db.sql("SELECT COUNT(*) FROM "+table).query(Long.class).single();}
    @Test void contractRoomDateFiltersAndSummaryRespectPropertyScope(){
        var repo=new com.thangit.boardinghouse.repository.AdminContractRepository(f.db);
        long room=f.db.sql("SELECT room_id FROM contracts WHERE id=:id").param("id",f.legacyContract).query(Long.class).single();
        long property=f.db.sql("SELECT property_id FROM rooms WHERE id=:id").param("id",room).query(Long.class).single();
        assertThat(repo.list(1L,RoleCode.OWNER,property,null,"LEGACY",null,null,0,20,room,LocalDate.now(),LocalDate.now().plusYears(1)).content()).hasSize(2);
        assertThat(repo.list(1L,RoleCode.OWNER,property,null,null,null,null,0,20,room+999999,null,null).content()).isEmpty();
        assertThat(repo.list(1L,RoleCode.OWNER,property,null,null,null,null,0,20,room,LocalDate.now().plusDays(1),null).content()).isEmpty();
        assertThat(repo.list(2L,RoleCode.MANAGER,property,null,null,null,null,0,20,room,null,null).content()).isEmpty();
        assertThat(repo.summary(1L,RoleCode.OWNER,property).total()).isEqualTo(2);
        assertThat(repo.summary(1L,RoleCode.OWNER,property()).total()).isZero();
    }
    @Test void invertedContractDateRangeIsRejected(){
        var contracts=new com.thangit.boardinghouse.service.impl.AdminContractServiceImpl(new com.thangit.boardinghouse.repository.AdminContractRepository(f.db),new RoomLifecycleGuard(f.db),f.onboarding);
        assertThatThrownBy(()->contracts.list(f.owner,null,null,null,null,null,0,20,null,LocalDate.now(),LocalDate.now().minusDays(1))).isInstanceOf(AuthException.class).extracting(e->((AuthException)e).code()).isEqualTo("CONTRACT_DATE_RANGE_INVALID");
    }
    @Test void bookingListUsesStoredContactCreatorAndCreationTime(){
        var booking=f.booking("0");
        var repo=new com.thangit.boardinghouse.repository.RentalLifecycleRepository(f.db,new RoomLifecycleGuard(f.db));
        var row=repo.board(1L,RoleCode.OWNER,booking.property()).bookings().getFirst();
        assertThat(row.id()).isEqualTo(booking.booking());assertThat(row.createdAt()).isNotNull();assertThat(row.createdByName()).isEqualTo("Test");
        assertThat(row.tenantPhone()).isEqualTo(f.db.sql("SELECT phone FROM tenant_profiles WHERE id=:id").param("id",booking.profile()).query(String.class).single());
        assertThat(repo.board(2L,RoleCode.MANAGER,booking.property()).bookings()).isEmpty();
    }
}
