package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.repository.*;
import com.thangit.boardinghouse.security.*;
import com.thangit.boardinghouse.service.DirectContractService.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named="direct.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DirectContractMysqlTest {
    final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    DirectContractService service;
    final AuthenticatedUser manager=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
    record Case(long property,long room,long profile,long user) {}
    @BeforeAll void setup()throws Exception {
        f.setup("direct_contract_test_",null);
        f.db.sql("INSERT INTO user_roles(user_id,role_id) SELECT 2,id FROM roles WHERE code='MANAGER'").update();
        service=new DirectContractService(f.db,new RoomLifecycleGuard(f.db),f.onboarding,new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db)));
    }
    Case fixture() {
        String key=f.key().substring(0,16);
        long property=f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'"+key+"','Direct test','Test')");
        long room=f.insert("INSERT INTO rooms(property_id,code,monthly_rent,status) VALUES("+property+",'D',1000,'READY')");
        long user=f.insert("INSERT INTO users(email,password_hash,full_name,phone) VALUES('"+key+"@test.invalid','test-only','Direct tenant',NULL)");
        f.db.sql("INSERT INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE code='TENANT'").param("id",user).update();
        long profile=f.insert("INSERT INTO tenant_profiles(tenant_code,user_id,full_name,phone,date_of_birth,identity_type,identity_number,permanent_address) VALUES('"+key+"',"+user+",'Direct tenant','0900000000','2000-01-01','CCCD','"+key+"','Test address')");
        f.db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,status,move_in_date) VALUES(:t,:p,'ACTIVE',CURRENT_DATE)").param("t",profile).param("p",property).update();
        f.run(()->new PropertyAuthorization(f.db,new SecurityAudit(f.db)).assignManager(f.owner,property,new PropertyAuthorization.ManagerAssignment(2L,EnumSet.allOf(PropertyAuthorization.Capability.class),"Direct contract fixture")));
        return new Case(property,room,profile,user);
    }
    CreateContract terms(){return new CreateContract(LocalDate.now(),LocalDate.now().plusYears(1),BigDecimal.ZERO,5,30,BigDecimal.ZERO,null,List.of(new AgreedRate("ELECTRICITY","Electricity","FIXED",BigDecimal.ZERO,"month"),new AgreedRate("WATER","Water","FIXED",BigDecimal.ZERO,"month")),List.of(),List.of(),false);}
    Request request(Case a,boolean submit){return new Request(a.room,a.profile,null,terms(),LocalDate.now(),"Direct agreement",submit);}
    long create(Case a,boolean submit){return f.inTx(()->service.create(f.owner,f.key(),request(a,submit))).id();}
    long count(String table,long contract){return f.db.sql("SELECT COUNT(*) FROM "+table+" WHERE contract_id=:id").param("id",contract).query(Long.class).single();}
    @Test void ownerDraftIsSharedWithoutOccupancyOrMoney() {
        var a=fixture();long c=create(a,false);
        assertThat(new AdminContractRepository(f.db).detail(2,RoleCode.MANAGER,c)).isPresent();
        assertThat(f.db.sql("SELECT status FROM rooms WHERE id=:id").param("id",a.room).query(String.class).single()).isEqualTo("READY");
        for(String table:List.of("rental_bookings","tenant_deposits","invoices","rental_checkins"))assertThat(count(table,c)).as(table).isZero();
        assertThat(new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db)).summary(1,RoleCode.OWNER,a.property).active()).isZero();
    }
    @Test void managerCreatesAndOwnerReadsSameRecord(){var a=fixture();long c=f.inTx(()->service.create(manager,f.key(),request(a,true))).id();assertThat(new AdminContractRepository(f.db).detail(1,RoleCode.OWNER,c)).isPresent();assertThat(count("tenant_deposits",c)).isOne();}
    @Test void managerNeedsAssignmentAndContractCapability(){var a=fixture();f.db.sql("DELETE FROM manager_property_capabilities WHERE property_id=:p").param("p",a.property).update();assertThatThrownBy(()->f.run(()->service.create(manager,f.key(),request(a,false)))).isInstanceOf(AuthException.class);f.db.sql("DELETE FROM property_managers WHERE property_id=:p").param("p",a.property).update();assertThatThrownBy(()->service.options(manager,a.property,null)).isInstanceOf(AuthException.class);}
    @Test void otherOwnerAndTenantCannotCreateOrReadDraft(){var a=fixture();var other=new AuthenticatedUser(4L,"other",RoleCode.OWNER);assertThatThrownBy(()->f.run(()->service.create(other,f.key(),request(a,false)))).isInstanceOf(AuthException.class);long id=create(a,false);assertThatThrownBy(()->service.draft(f.tenant,id)).isInstanceOf(AuthException.class);assertThatThrownBy(()->f.onboarding.detail(f.tenant,id)).isInstanceOf(AuthException.class);}
    @Test void unavailableRoomAndPendingOverlapAreRejected(){var a=fixture();f.db.sql("UPDATE rooms SET status='MAINTENANCE' WHERE id=:id").param("id",a.room).update();assertThatThrownBy(()->create(a,false)).isInstanceOf(AuthException.class);f.db.sql("UPDATE rooms SET status='READY' WHERE id=:id").param("id",a.room).update();create(a,true);assertThatThrownBy(()->create(a,false)).isInstanceOf(AuthException.class);}
    @Test void draftsDoNotReserveForeverButSubmissionRechecks(){var a=fixture();long first=create(a,false),second=create(a,false);f.run(()->service.submit(f.owner,first));assertThatThrownBy(()->f.run(()->service.submit(f.owner,second))).isInstanceOf(AuthException.class);}
    @Test void existingResidentCanBeDigitizedWithoutPretendingToReceiveMoney(){var a=fixture();f.db.sql("UPDATE rooms SET status='OCCUPIED' WHERE id=:id").param("id",a.room).update();f.db.sql("UPDATE tenant_residences SET room_id=:room WHERE tenant_profile_id=:id").param("room",a.room).param("id",a.profile).update();long c=create(a,true);assertThat(f.db.sql("SELECT contract_id FROM tenant_residences WHERE tenant_profile_id=:id").param("id",a.profile).query(Long.class).single()).isEqualTo(c);f.run(()->new RoomLifecycleGuard(f.db).checkin(c,LocalDate.now()));assertThat(count("rental_bookings",c)).isZero();assertThat(f.db.sql("SELECT balance_amount FROM tenant_deposits WHERE contract_id=:id").param("id",c).query(BigDecimal.class).single()).isZero();}
    @Test void occupiedRoomDoesNotAllowDisplacingAnotherPerson(){var a=fixture();var b=fixture();f.db.sql("UPDATE rooms SET status='OCCUPIED' WHERE id=:id").param("id",a.room).update();f.db.sql("UPDATE tenant_residences SET room_id=:room WHERE tenant_profile_id=:id").param("room",a.room).param("id",b.profile).update();assertThatThrownBy(()->create(a,true)).isInstanceOf(AuthException.class);}
    @Test void invalidDatesRollBackCompletely(){var a=fixture();var bad=new CreateContract(LocalDate.now(),LocalDate.now(),BigDecimal.ZERO,5,30);assertThatThrownBy(()->f.run(()->service.create(f.owner,f.key(),new Request(a.room,a.profile,null,bad,LocalDate.now(),null,false)))).isInstanceOf(AuthException.class);}
    @Test void rentSnapshotSurvivesRoomPriceChanges(){var a=fixture();long c=create(a,false);f.db.sql("UPDATE rooms SET monthly_rent=9000 WHERE id=:id").param("id",a.room).update();assertThat(new AdminContractRepository(f.db).detail(1,RoleCode.OWNER,c).orElseThrow().monthlyRent()).isEqualByComparingTo("1000");}
    @Test void repeatedRequestCreatesOneDraftAndConflictingPayloadFails(){var a=fixture();String key=f.key();long first=f.inTx(()->service.create(f.owner,key,request(a,false))).id();assertThat(f.inTx(()->service.create(f.owner,key,request(a,false))).id()).isEqualTo(first);assertThatThrownBy(()->f.run(()->service.create(f.owner,key,request(a,true)))).isInstanceOf(AuthException.class);}
    @Test void concurrentConfirmationsSerializeOnRoom()throws Exception {
        var a=fixture();var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try {var futures=new ArrayList<Future<Boolean>>();for(var actor:List.of(f.owner,manager))futures.add(pool.submit(()->{gate.await();try{f.inTx(()->service.create(actor,f.key(),request(a,true)));return true;}catch(AuthException e){return false;}}));gate.countDown();int successes=0;for(var future:futures)if(future.get(30,TimeUnit.SECONDS))successes++;assertThat(successes).isOne();}finally{pool.shutdownNow();}
    }
    @Test void quickTenantWithoutAccountCanSaveAndEditDraftButNotSubmit(){var a=fixture();String phone="09"+String.format("%08d",a.profile);var n=new NewTenant("New arrival",phone,null,null,null,null,null,null);var r=new Request(a.room,null,n,terms(),LocalDate.now(),null,false);long c=f.inTx(()->service.create(f.owner,f.key(),r)).id();assertThat(new AdminContractRepository(f.db).detail(1,RoleCode.OWNER,c)).isPresent();assertThatThrownBy(()->f.run(()->service.submit(f.owner,c))).isInstanceOf(AuthException.class);var draft=service.draft(f.owner,c);var saved=(Request)draft.get("request");var edited=new Request(saved.roomId(),saved.tenantProfileId(),null,terms(),LocalDate.now(),"Revised note",false);f.run(()->service.updateDraft(f.owner,c,((Number)draft.get("version")).longValue(),edited));assertThatThrownBy(()->f.run(()->service.updateDraft(f.owner,c,((Number)draft.get("version")).longValue(),edited))).isInstanceOf(AuthException.class);}
    @Test void repeatedSubmitDoesNotDuplicateDepositObligationsOrReceipts(){var a=fixture();long c=create(a,false);f.run(()->service.submit(f.owner,c));f.run(()->service.submit(f.owner,c));assertThat(count("tenant_deposits",c)).isOne();assertThat(f.db.sql("SELECT COUNT(*) FROM deposit_transactions dt JOIN tenant_deposits d ON d.id=dt.deposit_id WHERE d.contract_id=:id").param("id",c).query(Long.class).single()).isZero();}
    @Test void bookingAndDirectCreationShareTheRoomLock()throws Exception {
        var a=fixture();var gate=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try {
            var direct=pool.submit(()->{gate.await();try{f.inTx(()->service.create(f.owner,f.key(),request(a,true)));return true;}catch(AuthException e){return false;}});
            var booking=pool.submit(()->{gate.await();try{f.inTx(()->f.lifecycle.createBooking(f.owner,new CreateBooking(a.profile,a.room,LocalDate.now(),LocalDate.now().plusDays(3),BigDecimal.ZERO,"DIRECT_RACE_TEST",null)));return true;}catch(AuthException e){return false;}});
            gate.countDown();assertThat((direct.get(30,TimeUnit.SECONDS)?1:0)+(booking.get(30,TimeUnit.SECONDS)?1:0)).isOne();
        }finally{pool.shutdownNow();}
    }
    @Test void crossPropertyTenantSelectionIsRejectedEvenForSameOwner(){var a=fixture();var b=fixture();var r=new Request(a.room,b.profile,null,terms(),LocalDate.now(),null,false);assertThatThrownBy(()->f.run(()->service.create(f.owner,f.key(),r))).isInstanceOf(AuthException.class);}
    @Test void phoneAliasesCannotCreateDuplicateProfiles(){var a=fixture();String phone="07"+String.format("%08d",a.profile);var n=new NewTenant("Alias arrival",phone,null,null,null,null,null,null);f.run(()->service.create(f.owner,f.key(),new Request(a.room,null,n,terms(),LocalDate.now(),null,false)));var alias=new NewTenant("Alias arrival","+84"+phone.substring(1),null,null,null,null,null,null);assertThatThrownBy(()->f.run(()->service.create(f.owner,f.key(),new Request(a.room,null,alias,terms(),LocalDate.now(),null,false)))).isInstanceOf(AuthException.class);}
    @Test void duplicateQuickProfileAndTransactionFailureDoNotLeakRows(){var a=fixture();String phone="08"+String.format("%08d",a.profile);var n=new NewTenant("Rollback arrival",phone,null,null,null,null,null,null);var bad=new Request(a.room,null,n,terms(),LocalDate.now(),null,true);long before=f.db.sql("SELECT COUNT(*) FROM tenant_profiles").query(Long.class).single();assertThatThrownBy(()->f.run(()->service.create(f.owner,f.key(),bad))).isInstanceOf(AuthException.class);assertThat(f.db.sql("SELECT COUNT(*) FROM tenant_profiles").query(Long.class).single()).isEqualTo(before);var good=new Request(a.room,null,n,terms(),LocalDate.now(),null,false);f.run(()->service.create(f.owner,f.key(),good));assertThatThrownBy(()->f.run(()->service.create(f.owner,f.key(),good))).isInstanceOf(AuthException.class);}
    @SuppressWarnings("unchecked")
    @Test void directCheckinStillRequiresEvidenceAndBothPartiesThenActivatesWithoutBooking(){
        var a=fixture();long c=create(a,true);long ci=f.inTx(()->f.lifecycle.prepareCheckin(f.owner,new PrepareCheckin(c,null,LocalDate.now(),null,null))).id();
        var completion=new CompleteCheckin(true,true,true,BigDecimal.ZERO,BigDecimal.ZERO,1,"Direct actual handover",1L);
        assertThatThrownBy(()->f.run(()->f.lifecycle.completeCheckin(f.owner,ci,completion))).isInstanceOf(AuthException.class);
        var tenant=new AuthenticatedUser(a.user,"direct@test.invalid",RoleCode.TENANT);
        f.run(()->f.onboarding.verifyIdentity(f.owner,c,new ContractOnboardingService.Evidence("Direct test identity")));
        var v=(Map<String,Object>)f.onboarding.detail(f.owner,c).get("contractVersion");var confirmation=new ContractOnboardingService.Confirmation(((Number)v.get("version")).longValue(),v.get("content_hash").toString());
        f.run(()->f.onboarding.confirmContract(f.owner,c,confirmation));f.run(()->f.onboarding.confirmContract(tenant,c,confirmation));
        f.run(()->f.onboarding.saveHandover(f.owner,c,new ContractOnboardingService.Handover(0L,LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,1,"Direct handover evidence")));
        var hv=(Map<String,Object>)f.onboarding.detail(f.owner,c).get("handoverVersion");f.run(()->f.onboarding.confirmHandover(tenant,c,new ContractOnboardingService.Confirmation(((Number)hv.get("version")).longValue(),hv.get("content_hash").toString())));
        f.run(()->f.lifecycle.completeCheckin(f.owner,ci,completion));
        assertThat(f.db.sql("SELECT status FROM rooms WHERE id=:id").param("id",a.room).query(String.class).single()).isEqualTo("OCCUPIED");
        assertThat(f.db.sql("SELECT status FROM contracts WHERE id=:id").param("id",c).query(String.class).single()).isEqualTo("ACTIVE");
        assertThat(new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db)).summary(1,RoleCode.OWNER,a.property).active()).isOne();
        assertThat(count("rental_bookings",c)).isZero();assertThat(count("invoices",c)).isZero();
        assertThatThrownBy(()->f.run(()->service.submit(f.owner,c))).isInstanceOf(AuthException.class);
    }
}
