package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.repository.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.ContractOnboardingService.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named="prompt05.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ContractOnboardingMysqlTest {
    final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    @BeforeAll void setup() throws Exception {f.setup("prompt05_test_",null);f.onboarding.setTenants(new com.thangit.boardinghouse.service.impl.AdminTenantServiceImpl(new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db)),new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()));}
    @SuppressWarnings("unchecked") Map<String,Object> identity(Case a){return (Map<String,Object>)f.onboarding.detail(f.owner,a.contract).get("identityProfile");}
    IdentityProfile identityUpdate(Case a,String address){var p=identity(a);return new IdentityProfile("Test renter",LocalDate.of(2000,1,1),"0912345678","CCCD",null,address,p.get("dataHash").toString());}
    @Test @SuppressWarnings("unchecked") void missingAddressIsFriendlyAndCanBeCompletedWithoutLosingOtherFields(){
        var a=draft();f.ready(a.contract,a.checkin);
        f.db.sql("UPDATE tenant_profiles SET permanent_address=NULL,occupation='KEEP-OCCUPATION',note='KEEP-NOTE',identity_issued_place='KEEP-PLACE' WHERE id=:id").param("id",a.booking.profile()).update();
        var p=identity(a);assertThat(p).containsEntry("complete",false).containsEntry("canEdit",true);
        assertThat((List<Map<String,Object>>)p.get("fields")).anySatisfy(field->assertThat(field).containsEntry("key","permanent_address").containsEntry("label","Địa chỉ thường trú").containsEntry("present",false));
        assertThatThrownBy(()->f.run(()->f.onboarding.verifyIdentity(f.owner,a.contract,new Evidence("proof")))).hasMessageContaining("Địa chỉ thường trú").hasMessageNotContaining("permanent_address");
        String identity=f.db.sql("SELECT identity_number FROM tenant_profiles WHERE id=:id").param("id",a.booking.profile()).query(String.class).single();
        // Use this fixture's own unique valid phone to avoid colliding with other cases.
        String phone="09"+String.format("%08d",a.booking.profile());
        var request=new IdentityProfile("Test renter",LocalDate.of(2000,1,1),phone,"CCCD",null,"Actual permanent address",p.get("dataHash").toString());
        f.run(()->f.onboarding.updateIdentityProfile(f.owner,a.contract,request));
        var stored=f.db.sql("SELECT * FROM tenant_profiles WHERE id=:id").param("id",a.booking.profile()).query().singleRow();
        assertThat(stored).containsEntry("occupation","KEEP-OCCUPATION").containsEntry("note","KEEP-NOTE").containsEntry("identity_issued_place","KEEP-PLACE").containsEntry("identity_number",identity).containsEntry("permanent_address","Actual permanent address");
        assertThat(identity(a)).containsEntry("complete",true);assertThat(f.onboarding.detail(f.owner,a.contract).get("identityVerified")).isEqualTo(false);
        f.error("PROFILE_VERSION_CONFLICT",()->f.run(()->f.onboarding.updateIdentityProfile(f.owner,a.contract,request)));
    }
    @Test void reviewedProofAndMatchingProfileAreRequiredAndIdempotent(){var a=draft();f.ready(a.contract,a.checkin);
        f.db.sql("UPDATE tenant_profiles SET permanent_address='New actual address' WHERE id=:id").param("id",a.booking.profile()).update();
        String hash=identity(a).get("dataHash").toString();
        f.error("IDENTITY_REVIEW_REQUIRED",()->f.run(()->f.onboarding.verifyIdentityReviewed(f.owner,a.contract,new IdentityReview("proof",false,hash))));
        f.error("PROFILE_VERSION_CONFLICT",()->f.run(()->f.onboarding.verifyIdentityReviewed(f.owner,a.contract,new IdentityReview("proof",true,"0".repeat(64)))));
        f.run(()->f.onboarding.verifyIdentityReviewed(f.owner,a.contract,new IdentityReview("Actual proof",true,hash)));
        long n=count("tenant_identity_verifications","tenant_profile_id="+a.booking.profile());
        f.run(()->f.onboarding.verifyIdentityReviewed(f.owner,a.contract,new IdentityReview("Actual proof",true,hash)));
        assertThat(count("tenant_identity_verifications","tenant_profile_id="+a.booking.profile())).isEqualTo(n);
        assertThat(identity(a).get("verification")).isNotNull();
        assertThat(progress(a)).containsEntry("bothConfirmed",true); // address is not contract content
        f.db.sql("UPDATE tenant_profiles SET permanent_address='Changed after verification' WHERE id=:id").param("id",a.booking.profile()).update();
        assertThat(f.onboarding.detail(f.owner,a.contract).get("identityVerified")).isEqualTo(false);
        assertThat(progress(a)).containsEntry("bothConfirmed",true).containsEntry("canCompleteCheckin",false);
        f.error("TENANT_IDENTITY_NOT_VERIFIED",()->complete(a));
    }
    @Test @SuppressWarnings("unchecked") void sevenStepsDistinguishPolicyFromActualPayment(){var a=draft();f.ready(a.contract,a.checkin);var d=f.onboarding.detail(f.owner,a.contract);
        var steps=(List<Map<String,Object>>)d.get("procedureSteps");assertThat(steps).hasSize(7);
        assertThat(steps).anySatisfy(s->assertThat(s).containsEntry("key","INITIAL_PAYMENT").containsEntry("status","NOT_APPLICABLE").containsEntry("description","Không yêu cầu thanh toán trước"));
        var finance=(Map<String,Object>)d.get("financialSummary");assertThat((List<?>)finance.get("recordedInvoices")).isEmpty();
        assertThat(d.get("nextAction")).isEqualTo("COMPLETE_CHECKIN");complete(a);
        assertThat(f.onboarding.detail(f.owner,a.contract).get("nextAction")).isEqualTo("NONE");
        assertThat(count("contracts","id="+a.contract+" AND status='ACTIVE'")).isOne();
    }
    @Test void profileEditAndVerificationRemainScoped(){var a=draft();f.ready(a.contract,a.checkin);var request=identityUpdate(a,"Edited address");
        f.error("ONBOARDING_ACCESS_DENIED",()->f.run(()->f.onboarding.updateIdentityProfile(new AuthenticatedUser(6L,"other@test.invalid",RoleCode.TENANT),a.contract,request)));
        assertThatThrownBy(()->f.run(()->f.onboarding.updateIdentityProfile(f.tenant,a.contract,request))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
        assertThatThrownBy(()->f.run(()->f.onboarding.updateIdentityProfile(new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER),a.contract,request))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
        assertThatThrownBy(()->f.run(()->f.onboarding.verifyIdentityReviewed(f.tenant,a.contract,new IdentityReview("proof",true,identity(a).get("dataHash").toString())))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
    }
    @Test void refreshInventoryRequiresNewSharedHandoverAndPreservesHistory(){var a=draft();f.ready(a.contract,a.checkin);long old=((Number)version(a,"handoverVersion").get("id")).longValue();
        f.db.sql("INSERT INTO room_assets(room_id,name,quantity,condition_status) VALUES(:room,'Actual desk',1,'GOOD')").param("room",a.booking.room()).update();
        f.run(()->f.onboarding.refreshInventory(f.owner,a.contract));
        assertThat(progress(a)).containsEntry("handoverConfirmed",false).containsEntry("canCompleteCheckin",false);
        assertThat(count("rental_checkin_assets","checkin_id="+a.checkin)).isOne();assertThat(count("handover_versions","id="+old)).isOne();
        f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(2L,LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,1,"Actual updated handover")));
        f.run(()->f.onboarding.confirmHandover(f.tenant,a.contract,request(version(a,"handoverVersion"))));
        f.run(()->f.lifecycle.completeCheckin(f.owner,a.checkin,new CompleteCheckin(true,true,true,BigDecimal.ZERO,BigDecimal.ZERO,1,"Actual handover",3L)));
        f.error("HANDOVER_NOT_EDITABLE",()->f.run(()->f.onboarding.refreshInventory(f.owner,a.contract)));
    }
    record Case(DepositLedgerMysqlTest.Fixture booking,long contract,long checkin) {}
    Case draft(){var b=f.booking("0");long c=f.contract(b,"0");long ci=f.inTx(()->f.lifecycle.prepareCheckin(f.owner,new PrepareCheckin(c,b.booking(),LocalDate.now(),null,null)).id());return new Case(b,c,ci);}
    @SuppressWarnings("unchecked") Map<String,Object> version(Case a,String key){return (Map<String,Object>)f.onboarding.detail(f.owner,a.contract).get(key);}
    Confirmation request(Map<String,Object> v){return new Confirmation(((Number)v.get("version")).longValue(),v.get("content_hash").toString());}
    CompleteCheckin completion(){return new CompleteCheckin(true,true,true,BigDecimal.ZERO,BigDecimal.ZERO,1,"Actual handover",1L);}
    @SuppressWarnings("unchecked") Map<String,Object> progress(Case a){return (Map<String,Object>)f.onboarding.detail(f.owner,a.contract).get("progress");}
    @Test @SuppressWarnings("unchecked") void managerRequiresExplicitApprovalAndCannotReadFinanceByDefault(){var a=draft();
        var manager=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
        f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT 2,id FROM roles WHERE code='MANAGER'").update();
        var permissions=new com.thangit.boardinghouse.security.PropertyAuthorization(f.db,new com.thangit.boardinghouse.security.SecurityAudit(f.db));
        f.run(()->permissions.assignManager(f.owner,a.booking.property(),new com.thangit.boardinghouse.security.PropertyAuthorization.ManagerAssignment(2L,Set.of(),"Read only")));
        var r=request(version(a,"contractVersion"));
        f.error("PROPERTY_CAPABILITY_DENIED",()->f.run(()->f.onboarding.confirmContract(manager,a.contract,r)));
        f.run(()->permissions.assignManager(f.owner,a.booking.property(),new com.thangit.boardinghouse.security.PropertyAuthorization.ManagerAssignment(2L,Set.of(com.thangit.boardinghouse.security.PropertyAuthorization.Capability.CONTRACT_APPROVE),"Approval delegated")));
        f.run(()->f.onboarding.confirmContract(manager,a.contract,r));
        var detail=f.onboarding.detail(manager,a.contract);var state=(Map<String,Object>)detail.get("progress");
        assertThat(state).containsEntry("ownConfirmed",true).containsEntry("canReadFinance",false).containsEntry("canCreateInitialInvoice",false);
        assertThat(detail.get("deposit")).isNull();
        assertThat(progress(a)).containsEntry("ownConfirmed",true).containsEntry("confirmedByCurrentActor",false);
        f.error("PROPERTY_CAPABILITY_DENIED",()->f.run(()->f.onboarding.createInitialDraft(manager,a.contract)));
    }
    @Test void simultaneousPartiesConfirmOneSharedVersion() throws Exception {var a=draft();var r=request(version(a,"contractVersion"));
        var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try{var owner=pool.submit(()->{start.await();f.run(()->f.onboarding.confirmContract(f.owner,a.contract,r));return true;});
            var tenant=pool.submit(()->{start.await();f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,r));return true;});
            start.countDown();assertThat(owner.get(20,TimeUnit.SECONDS)).isTrue();assertThat(tenant.get(20,TimeUnit.SECONDS)).isTrue();
            assertThat(progress(a).get("bothConfirmed")).isEqualTo(true);
            assertThat(count("rental_confirmations","contract_version_id="+version(a,"contractVersion").get("id"))).isEqualTo(2);
        }finally{pool.shutdownNow();}
    }
    @Test void oneActorCannotConfirmForBothParties(){var a=draft();var r=request(version(a,"contractVersion"));
        f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,r));
        f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT 5,id FROM roles WHERE code='MANAGER'").update();
        var permissions=new com.thangit.boardinghouse.security.PropertyAuthorization(f.db,new com.thangit.boardinghouse.security.SecurityAudit(f.db));
        f.run(()->permissions.assignManager(f.owner,a.booking.property(),new com.thangit.boardinghouse.security.PropertyAuthorization.ManagerAssignment(5L,Set.of(com.thangit.boardinghouse.security.PropertyAuthorization.Capability.CONTRACT_APPROVE),"Test separate parties")));
        assertThatThrownBy(()->f.run(()->f.onboarding.confirmContract(new AuthenticatedUser(5L,"tenant@test.invalid",RoleCode.MANAGER),a.contract,r))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
        assertThat(progress(a).get("bothConfirmed")).isEqualTo(false);
    }
    @Test void eitherPartyMayConfirmFirstWithoutActivatingContract(){
        for(boolean tenantFirst:List.of(true,false)){var a=draft();var r=request(version(a,"contractVersion"));
            f.run(()->f.onboarding.confirmContract(tenantFirst?f.tenant:f.owner,a.contract,r));
            assertThat(progress(a).get("bothConfirmed")).isEqualTo(false);
            assertThat(progress(a).get("stage")).isEqualTo(tenantFirst?"WAITING_LANDLORD":"WAITING_TENANT");
            f.run(()->f.onboarding.confirmContract(tenantFirst?f.owner:f.tenant,a.contract,r));
            assertThat(progress(a).get("bothConfirmed")).isEqualTo(true);
            assertThat(progress(a).get("canCompleteCheckin")).isEqualTo(false);
            assertThat(count("contracts","id="+a.contract+" AND status='PENDING_CONFIRMATION'")).isOne();
        }
    }
    @Test void repeatedConfirmationDoesNotDuplicateAuditOrNotification(){var a=draft();var r=request(version(a,"contractVersion"));
        f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,r));
        long notices=count("notifications","reference_type='CONTRACT' AND reference_id="+a.contract);
        assertThat(notices).isPositive();
        f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,r));
        assertThat(count("notifications","reference_type='CONTRACT' AND reference_id="+a.contract)).isEqualTo(notices);
        assertThat(count("contract_history","contract_id="+a.contract+" AND event_type='CONTRACT_CONFIRMED'")).isOne();
    }
    @Test void changedContentResetsDerivedProgress(){var a=draft();var r=request(version(a,"contractVersion"));
        f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,r));
        f.db.sql("UPDATE contracts SET agreed_monthly_rent=2000 WHERE id=:id").param("id",a.contract).update();
        assertThat(progress(a)).containsEntry("stage","CONTENT_REVIEW_REQUIRED").containsEntry("bothConfirmed",false).containsEntry("canConfirm",false).containsEntry("canRevise",true);
        f.error("CONTRACT_VERSION_CONFLICT",()->f.run(()->f.onboarding.confirmContract(f.owner,a.contract,r)));
    }
    @Test void unchangedIdentityAndHandoverReuseExistingEvidence(){var a=draft();f.ready(a.contract,a.checkin);
        long identities=count("tenant_identity_verifications","tenant_profile_id="+a.booking.profile());
        f.run(()->f.onboarding.verifyIdentity(f.owner,a.contract,new Evidence("Same profile")));
        assertThat(count("tenant_identity_verifications","tenant_profile_id="+a.booking.profile())).isEqualTo(identities);
        var before=version(a,"handoverVersion");
        f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(((Number)before.get("version")).longValue(),LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,1,"CI-TEST")));
        assertThat(version(a,"handoverVersion").get("id")).isEqualTo(before.get("id"));
        assertThat(progress(a)).containsEntry("handoverConfirmed",true).containsEntry("canCompleteCheckin",true);
    }
    @Test void initialDraftCreationReusesInvoiceWithoutRecordingPayment(){var a=draft();
        f.db.sql("UPDATE contracts SET initial_payment_required=TRUE WHERE id=:id").param("id",a.contract).update();
        f.onboarding.setInvoices(new com.thangit.boardinghouse.service.impl.AdminInvoiceServiceImpl(new AdminInvoiceRepository(f.db)));
        var first=f.inTx(()->f.onboarding.createInitialDraft(f.owner,a.contract));
        var second=f.inTx(()->f.onboarding.createInitialDraft(f.owner,a.contract));
        assertThat(((Number)second.get("id")).longValue()).isEqualTo(((Number)first.get("id")).longValue());
        assertThat(count("invoices","contract_id="+a.contract)).isOne();
        assertThat(count("payments","invoice_id="+first.get("id"))).isZero();
        assertThat(f.onboarding.detail(f.owner,a.contract).get("initialPaymentSatisfied")).isEqualTo(false);
        assertThatThrownBy(()->f.run(()->f.onboarding.createInitialDraft(f.tenant,a.contract))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
    }
    long count(String table,String where){return f.db.sql("SELECT COUNT(*) FROM "+table+" WHERE "+where).query(Long.class).single();}
    @SuppressWarnings("unchecked") Map<String,Object> document(Case a){return (Map<String,Object>)f.onboarding.detail(f.owner,a.contract).get("handoverDocument");}
    @Test @SuppressWarnings("unchecked") void immutableVersionsKeepTheirOwnSnapshotsAndConfirmations(){var a=draft();f.ready(a.contract,a.checkin);var first=document(a);long oldVersion=((Number)first.get("version")).longValue();
        assertThat(first).containsEntry("current",true).containsEntry("status","BOTH_CONFIRMED");assertThat((List<?>)first.get("confirmations")).hasSize(2);
        String oldContent=version(a,"handoverVersion").get("content").toString();
        f.db.sql("INSERT INTO room_assets(room_id,name,quantity,condition_status) VALUES(:room,'Bàn học thực tế',1,'GOOD')").param("room",a.booking.room()).update();
        var changed=document(a);assertThat(changed).containsEntry("current",false);assertThat((List<Map<String,String>>)changed.get("changes")).anySatisfy(change->assertThat(change.get("key")).isEqualTo("catalog"));
        f.error("HANDOVER_VERSION_CONFLICT",()->f.run(()->f.onboarding.confirmHandover(f.tenant,a.contract,new Confirmation(oldVersion,first.get("contentHash").toString()))));
        f.run(()->f.onboarding.refreshInventory(f.owner,a.contract));
        f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(2L,LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,2,"Biên bản mới",null,"Phòng sạch, đã kiểm tra","Ghi chú thực tế",true,f.onboarding.detail(f.owner,a.contract).get("handoverContextHash").toString())));
        var latest=document(a);assertThat(((Number)latest.get("version")).longValue()).isEqualTo(3);assertThat(latest).containsEntry("current",true).containsEntry("status","WAITING_CONFIRMATION");assertThat((List<?>)latest.get("confirmations")).hasSize(1);
        var old=f.onboarding.handoverDocument(f.tenant,a.contract,oldVersion);assertThat(old).containsEntry("latest",false).containsEntry("status","SUPERSEDED");assertThat((List<?>)old.get("confirmations")).hasSize(2);
        assertThat(f.db.sql("SELECT content FROM handover_versions WHERE id=:id").param("id",first.get("id")).query(String.class).single()).isEqualTo(oldContent);
        f.error("HANDOVER_VERSION_CONFLICT",()->f.run(()->f.onboarding.confirmHandover(f.tenant,a.contract,new Confirmation(oldVersion,first.get("contentHash").toString()))));
        var r=new Confirmation(3L,latest.get("contentHash").toString());f.run(()->f.onboarding.confirmHandover(f.tenant,a.contract,r));
        long notices=count("notifications","reference_type='CONTRACT' AND reference_id="+a.contract);f.run(()->f.onboarding.confirmHandover(f.tenant,a.contract,r));assertThat(count("notifications","reference_type='CONTRACT' AND reference_id="+a.contract)).isEqualTo(notices);
        assertThat(document(a)).containsEntry("status","BOTH_CONFIRMED");assertThat(f.onboarding.handoverHistory(f.owner,a.contract)).hasSize(2);
        f.run(()->f.lifecycle.completeCheckin(f.owner,a.checkin,new CompleteCheckin(true,true,true,BigDecimal.ZERO,BigDecimal.ZERO,2,"Physical handover",3L)));
        assertThatThrownBy(()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(3L,LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,2,"After completion")))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
    }
    @Test @SuppressWarnings("unchecked") void changingMeterEventEvenWithSameCodeInvalidatesConsentAndRejectsStaleReview(){var a=draft();
        f.db.sql("UPDATE contract_utility_rates SET calculation_method='METER' WHERE contract_id=:id AND code='ELECTRICITY'").param("id",a.contract).update();
        var meterService=new RoomMeterService(f.db,new RoomLifecycleGuard(f.db));long meter=((Number)f.inTx(()->meterService.install(f.owner,a.booking.room(),new RoomMeterService.Install("ELECTRICITY",f.key(),new BigDecimal("1250"),"Actual evidence","Initial physical meter"))).get("id")).longValue();
        f.db.sql("UPDATE utility_meters SET current_reading=1200 WHERE id=:id").param("id",meter).update();
        f.error("METER_READING_INVALID",()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(0L,LocalDate.now(),new BigDecimal("1200"),null,1,"Below documented installation reading"))));
        f.ready(a.contract,a.checkin,new BigDecimal("1250"),null);String review=f.onboarding.detail(f.owner,a.contract).get("handoverContextHash").toString();
        String code=f.db.sql("SELECT meter_code FROM utility_meters WHERE id=:id").param("id",meter).query(String.class).single();
        f.run(()->f.onboarding.replaceMeter(f.owner,a.contract,new MeterReplacement(meter,code,new BigDecimal("1250"),"Actual reset checked","Actual reset evidence")));
        assertThat(document(a)).containsEntry("current",false);assertThat((List<Map<String,String>>)document(a).get("changes")).anySatisfy(change->assertThat(change.get("key")).isEqualTo("meters"));
        f.error("HANDOVER_CONTEXT_CONFLICT",()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(1L,LocalDate.now(),new BigDecimal("1250"),null,1,"New record",null,null,null,true,review))));
        assertThat(count("handover_versions","checkin_id="+a.checkin)).isOne();
    }
    @Test void keyLimitAndExplicitLandlordConsentAreEnforced(){var a=draft();
        f.error("HANDOVER_KEYS_LIMIT",()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(0L,LocalDate.now(),null,null,123456,"Actual record"))));
        f.error("HANDOVER_LANDLORD_CONSENT_REQUIRED",()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(0L,LocalDate.now(),null,null,1,"Actual record",null,null,null,false,null))));
        try{f.onboarding.setMaxKeysCards(2);assertThat(f.onboarding.detail(f.owner,a.contract).get("handoverPolicy")).isEqualTo(Map.of("maxKeysCards",2));f.error("HANDOVER_KEYS_LIMIT",()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(0L,LocalDate.now(),null,null,3,"Actual record"))));}finally{f.onboarding.setMaxKeysCards(20);}
        assertThat(count("handover_versions","checkin_id="+a.checkin)).isZero();
    }
    @Test void draftVersionChangeCannotReuseOldConfirmationsEvenIfValuesWereRestored(){var a=draft();f.ready(a.contract,a.checkin);var old=document(a);
        f.db.sql("UPDATE rental_checkins SET version=version+1 WHERE id=:id").param("id",a.checkin).update();
        assertThat(document(a)).containsEntry("current",false);assertThat(progress(a)).containsEntry("canCompleteCheckin",false);
        f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(2L,LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,1,"CI-TEST")));
        var next=document(a);assertThat(((Number)next.get("version")).longValue()).isEqualTo(3);assertThat(next).containsEntry("status","WAITING_CONFIRMATION");
        assertThat((List<?>)next.get("confirmations")).hasSize(1);assertThat((List<?>)f.onboarding.handoverDocument(f.owner,a.contract,1).get("confirmations")).hasSize(2);
        f.error("HANDOVER_VERSION_CONFLICT",()->f.run(()->f.onboarding.confirmHandover(f.tenant,a.contract,new Confirmation(1L,old.get("contentHash").toString()))));
    }
    @Test @SuppressWarnings("unchecked") void snapshotUnicodeRoundTripsAndDoesNotBorrowRenamedPartyData(){var a=draft();String name="Nguyễn Thị Hòa 🏠";
        f.db.sql("UPDATE tenant_profiles SET full_name=:name WHERE id=:id").param("name",name).param("id",a.booking.profile()).update();f.ready(a.contract,a.checkin);
        var v=document(a);var snapshot=(Map<String,Object>)v.get("snapshot");assertThat((Map<String,Object>)snapshot.get("general")).containsEntry("tenantName",name);
        f.db.sql("UPDATE tenant_profiles SET full_name='Updated current name' WHERE id=:id").param("id",a.booking.profile()).update();
        var historical=f.onboarding.handoverDocument(f.tenant,a.contract,((Number)v.get("version")).longValue());var saved=(Map<String,Object>)historical.get("snapshot");assertThat((Map<String,Object>)saved.get("general")).containsEntry("tenantName",name);
        assertThat(historical).containsEntry("current",false);assertThat(version(a,"handoverVersion").get("content").toString()).contains(name);
    }
    @Test @SuppressWarnings("unchecked") void legacyTextCanBeViewedWithoutRewritingStoredBytes(){var a=draft();String content="BIÊN BẢN BÀN GIAO — XÁC NHẬN NỘI BỘ\ncontract_id: "+a.contract+"\ntenant_id: 5\nid: "+a.checkin+"\nscheduled_date: "+LocalDate.now()+"\nelectricity_reading: 1250.00\nwater_reading: 50.00\nkeys_cards_count: 2\nhandover_reference: BB-CŨ\nTài sản\nasset_name: Bàn học\ncondition_status: GOOD\nnote: Đã kiểm tra\nquantity: 1\nroom_asset_id: 99\nĐồng hồ\nid: 11\nmeter_code: E-CŨ\nmeter_type: ELECTRICITY\n";
        String hash;try{hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(content.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}
        f.db.sql("INSERT INTO handover_versions(checkin_id,version,content,content_hash,created_by) VALUES(:id,1,:content,:hash,1)").param("id",a.checkin).param("content",content).param("hash",hash).update();
        var d=f.onboarding.handoverDocument(f.tenant,a.contract,1);var s=(Map<String,Object>)d.get("snapshot");assertThat(s.get("schemaVersion")).isEqualTo(1);assertThat((List<Map<String,Object>>)s.get("assets")).anySatisfy(asset->assertThat(asset).containsEntry("asset_name","Bàn học"));
        assertThat(f.db.sql("SELECT content FROM handover_versions WHERE checkin_id=:id").param("id",a.checkin).query(String.class).single()).isEqualTo(content);
        f.db.sql("UPDATE rental_checkins SET version=1 WHERE id=:id").param("id",a.checkin).update();
        f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(1L,LocalDate.now(),null,null,2,"Actual reviewed new version")));
        assertThat(f.onboarding.handoverHistory(f.owner,a.contract)).hasSize(2);
        assertThat(f.db.sql("SELECT content FROM handover_versions WHERE checkin_id=:id AND version=1").param("id",a.checkin).query(String.class).single()).isEqualTo(content);
        assertThat(version(a,"handoverVersion").get("content").toString()).startsWith("{");
        f.error("ONBOARDING_ACCESS_DENIED",()->f.onboarding.handoverHistory(new AuthenticatedUser(6L,"other@test.invalid",RoleCode.TENANT),a.contract));f.error("ONBOARDING_ACCESS_DENIED",()->f.onboarding.handoverDocument(new AuthenticatedUser(6L,"other@test.invalid",RoleCode.TENANT),a.contract,1));
    }
    @Test @SuppressWarnings("unchecked") void legacySameCodeMeterResetIsDetectedByEventTimestamp(){var a=draft();var meters=new RoomMeterService(f.db,new RoomLifecycleGuard(f.db));String code="E-"+f.key();long meter=((Number)f.inTx(()->meters.install(f.owner,a.booking.room(),new RoomMeterService.Install("ELECTRICITY",code,BigDecimal.ZERO,"Actual proof","Initial meter"))).get("id")).longValue();
        String text="BIÊN BẢN BÀN GIAO — XÁC NHẬN NỘI BỘ\ncontract_id: "+a.contract+"\ntenant_id: 5\nid: "+a.checkin+"\nscheduled_date: "+LocalDate.now()+"\nelectricity_reading: \nwater_reading: \nkeys_cards_count: 0\nhandover_reference: \nTài sản\nĐồng hồ\nid: "+meter+"\nmeter_code: "+code+"\nmeter_type: ELECTRICITY\n";
        String hash;try{hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}
        f.db.sql("INSERT INTO handover_versions(checkin_id,version,content,content_hash,created_by) VALUES(:id,1,:text,:hash,1)").param("id",a.checkin).param("text",text).param("hash",hash).update();
        f.db.sql("UPDATE rental_checkins SET version=1 WHERE id=:id").param("id",a.checkin).update();
        assertThat(document(a)).containsEntry("current",true);
        f.run(()->f.onboarding.replaceMeter(f.owner,a.contract,new MeterReplacement(meter,code,BigDecimal.ZERO,"Actual reset","Reset proof")));
        assertThat(document(a)).containsEntry("current",false);
        assertThat((List<Map<String,String>>)document(a).get("changes")).anySatisfy(change->assertThat(change.get("label")).contains("sự kiện lắp/thay/reset"));
    }
    void complete(Case a){f.run(()->f.lifecycle.completeCheckin(f.owner,a.checkin,completion()));}
    @Test void tc01_newContractFreezesRent(){var a=draft();f.db.sql("UPDATE rooms SET monthly_rent=9000 WHERE id=:id").param("id",a.booking.room()).update();assertThat(f.onboarding.detail(f.owner,a.contract).get("monthlyRent").toString()).isEqualTo("1000.00");assertThat(new AdminInvoiceRepository(f.db).contractForRoom(a.booking.room(),a.contract).orElseThrow().get("monthly_rent").toString()).isEqualTo("1000.00");}
    @Test void tc02_draftDoesNotOccupyRoom(){var a=draft();assertThat(count("contracts","id="+a.contract+" AND status='PENDING_CONFIRMATION' AND signed_at IS NULL")).isOne();assertThat(count("tenant_residences","contract_id="+a.contract+" AND status='ACTIVE'")).isZero();}
    @Test void tc03_checkboxesCannotVerifyIdentity(){var a=draft();f.db.sql("UPDATE tenant_profiles SET permanent_address=:address WHERE id=:id").param("address",f.key()).param("id",a.booking.profile()).update();f.error("TENANT_IDENTITY_NOT_VERIFIED",()->complete(a));}
    @Test void tc04_incompleteProfileCannotBeVerified(){var a=draft();f.db.sql("UPDATE tenant_profiles SET date_of_birth=NULL WHERE id=:id").param("id",a.booking.profile()).update();f.error("TENANT_PROFILE_INCOMPLETE",()->f.run(()->f.onboarding.verifyIdentity(f.owner,a.contract,new Evidence("proof"))));}
    @Test void tc05_onePartyIsInsufficient(){var a=draft();var r=request(version(a,"contractVersion"));f.run(()->f.onboarding.confirmContract(f.owner,a.contract,r));assertThat(f.onboarding.detail(f.owner,a.contract).get("contractConfirmed")).isEqualTo(false);assertThat(count("contracts","id="+a.contract+" AND signed_at IS NULL")).isOne();}
    @Test void tc06_confirmationIsIdempotent(){var a=draft();var v=version(a,"contractVersion");var r=request(v);f.run(()->f.onboarding.confirmContract(f.owner,a.contract,r));f.run(()->f.onboarding.confirmContract(f.owner,a.contract,r));assertThat(count("rental_confirmations","contract_version_id="+v.get("id"))).isOne();}
    @Test void tc07_wrongHashIsRejected(){var a=draft();f.error("CONTRACT_VERSION_CONFLICT",()->f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,new Confirmation(1,"0".repeat(64)))));}
    @Test void tc08_profileChangeInvalidatesVerification(){var a=draft();f.ready(a.contract,a.checkin);f.db.sql("UPDATE tenant_profiles SET permanent_address='Changed' WHERE id=:id").param("id",a.booking.profile()).update();f.error("TENANT_IDENTITY_NOT_VERIFIED",()->complete(a));}
    @Test void tc09_changedTermsInvalidateBothConfirmations(){var a=draft();f.ready(a.contract,a.checkin);var old=request(version(a,"contractVersion"));var terms=new CreateContract(LocalDate.now(),LocalDate.now().plusYears(1),BigDecimal.ZERO,5,30,null,new BigDecimal("1500"),List.of(new AgreedRate("ELECTRICITY","Electricity","FIXED",BigDecimal.ZERO,"month"),new AgreedRate("WATER","Water","FIXED",BigDecimal.ZERO,"month")),null,null,false);f.run(()->f.onboarding.changeTerms(f.owner,a.contract,new TermsChange(terms,"Agreed rent correction")));assertThat(count("contract_versions","contract_id="+a.contract)).isEqualTo(2);assertThat(f.onboarding.detail(f.owner,a.contract).get("contractConfirmed")).isEqualTo(false);f.error("CONTRACT_VERSION_CONFLICT",()->f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,old)));}
    @Test void tc10_handoverChangeNeedsNewTenantConfirmation(){var a=draft();f.ready(a.contract,a.checkin);f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(1L,LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,2,"Correct keys")));f.error("HANDOVER_NOT_CONFIRMED",()->complete(a));assertThat(count("handover_versions","checkin_id="+a.checkin)).isEqualTo(2);}
    @Test void tc11_actualCompletionActivatesOnce(){var a=draft();f.ready(a.contract,a.checkin);complete(a);assertThat(count("contracts","id="+a.contract+" AND status='ACTIVE'")).isOne();assertThat(count("tenant_residences","contract_id="+a.contract+" AND status='ACTIVE'")).isOne();f.error("CONTRACT_NOT_READY_FOR_CHECKIN",()->complete(a));}
    @Test void tc12_failedCompletionRollsBackEverything(){var a=draft();f.ready(a.contract,a.checkin);assertThatThrownBy(()->f.run(()->{f.lifecycle.completeCheckin(f.owner,a.checkin,completion());throw new IllegalStateException("Downstream failure");})).isInstanceOf(IllegalStateException.class);assertThat(count("contracts","id="+a.contract+" AND status='PENDING_CONFIRMATION'")).isOne();assertThat(count("rental_checkins","id="+a.checkin+" AND status='READY'")).isOne();assertThat(count("tenant_residences","contract_id="+a.contract)).isZero();}
    @Test void tc13_concurrentCompletionHasOneWinner() throws Exception {var a=draft();f.ready(a.contract,a.checkin);var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);try{Callable<Boolean> task=()->{start.await();try{complete(a);return true;}catch(com.thangit.boardinghouse.common.exception.AuthException e){return false;}};var x=pool.submit(task);var y=pool.submit(task);start.countDown();assertThat(List.of(x.get(20,TimeUnit.SECONDS),y.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);assertThat(count("tenant_residences","contract_id="+a.contract+" AND status='ACTIVE'")).isOne();}finally{pool.shutdownNow();}}
    @Test void tc14_otherTenantCannotReadOrConfirm(){var a=draft();var other=new AuthenticatedUser(6L,"other@test.invalid",RoleCode.TENANT);f.error("ONBOARDING_ACCESS_DENIED",()->f.onboarding.detail(other,a.contract));f.error("ONBOARDING_ACCESS_DENIED",()->f.run(()->f.onboarding.confirmContract(other,a.contract,request(version(a,"contractVersion")))));}
    @Test void tc15_technicianCannotReadOnboarding(){var a=draft();f.error("ONBOARDING_ACCESS_DENIED",()->f.onboarding.detail(new AuthenticatedUser(6L,"tech@test.invalid",RoleCode.TECHNICIAN),a.contract));}
    @Test void tc16_accountantCannotVerifyIdentity(){var a=draft();assertThatThrownBy(()->f.run(()->f.onboarding.verifyIdentity(f.accountant,a.contract,new Evidence("proof")))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);}
    @Test void tc17_foreignAssetRejected(){var a=draft();f.error("HANDOVER_ASSET_INVALID",()->f.run(()->f.onboarding.validatePrepare(a.contract,List.of(new AssetSnapshot(999999L,"Foreign",1,"GOOD",null)))));}
    @Test void tc18_newAssetRequiresNewInventory(){var a=draft();f.ready(a.contract,a.checkin);f.db.sql("INSERT INTO room_assets(room_id,name,quantity,condition_status) VALUES(:room,'Desk',1,'GOOD')").param("room",a.booking.room()).update();f.error("HANDOVER_ASSETS_INCOMPLETE",()->complete(a));}
    @Test void tc19_confirmedNoShowStaysPending(){var a=draft();f.ready(a.contract,a.checkin);assertThat(count("contracts","id="+a.contract+" AND status='PENDING_CONFIRMATION' AND signed_at IS NOT NULL")).isOne();assertThat(count("rooms","id="+a.booking.room()+" AND status='RESERVED'")).isOne();}
    @Test void tc20_legacyMigrationDoesNotGuessRent(){assertThat(count("contracts","id="+f.legacyContract+" AND agreed_monthly_rent IS NULL")).isOne();assertThat(count("contract_versions","contract_id="+f.legacyContract)).isZero();}
    @Test void tc21_initialPaymentRequirementCannotBeCheckboxed(){var a=draft();f.ready(a.contract,a.checkin);f.db.sql("UPDATE contracts SET initial_payment_required=TRUE WHERE id=:id").param("id",a.contract).update();f.run(()->f.onboarding.recordVersion(a.contract,1,"Initial payment required"));var r=request(version(a,"contractVersion"));f.run(()->f.onboarding.confirmContract(f.owner,a.contract,r));f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,r));f.error("INITIAL_PAYMENT_REQUIRED",()->complete(a));}
    @Test void tc22_wrongMeterFloorIsRejected(){var a=draft();f.db.sql("UPDATE contract_utility_rates SET calculation_method='METER',unit_price=3000 WHERE contract_id=:id AND code='ELECTRICITY'").param("id",a.contract).update();f.db.sql("INSERT INTO utility_meters(room_id,meter_type,meter_code,current_reading) VALUES(:room,'ELECTRICITY','E-test',1250)").param("room",a.booking.room()).update();f.error("METER_READING_INVALID",()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(0L,LocalDate.now(),new BigDecimal("1200"),null,1,"proof"))));}
    @Test void tc23_meterPolicyRequiresActualMeter(){var a=draft();f.db.sql("UPDATE contract_utility_rates SET calculation_method='METER' WHERE contract_id=:id AND code='WATER'").param("id",a.contract).update();f.error("ROOM_METER_REQUIRED",()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(0L,LocalDate.now(),null,BigDecimal.ZERO,1,"proof"))));}
    @Test void tc24_fixedPolicyAllowsNoPrivateMeter(){var a=draft();f.ready(a.contract,a.checkin);complete(a);assertThat(count("contract_meter_baselines","contract_id="+a.contract)).isZero();}
    @Test void tc25_completedTermsNeedAnnex(){var a=draft();f.ready(a.contract,a.checkin);complete(a);f.error("CONTRACT_AMENDMENT_REQUIRED",()->f.run(()->f.onboarding.changeTerms(f.owner,a.contract,new TermsChange(new CreateContract(LocalDate.now(),LocalDate.now().plusYears(1),BigDecimal.ZERO,5,30),"after activation"))));}
    @Test void tc26_wrongActualKeysRejected(){var a=draft();f.ready(a.contract,a.checkin);f.error("HANDOVER_VERSION_CONFLICT",()->f.run(()->f.lifecycle.completeCheckin(f.owner,a.checkin,new CompleteCheckin(true,true,true,BigDecimal.ZERO,BigDecimal.ZERO,2,null,1L))));}
    @Test void tc27_capacityBlocksAdditionalResident(){var a=draft();f.ready(a.contract,a.checkin);complete(a);long profile=f.insert("INSERT INTO tenant_profiles(tenant_code,full_name,phone) VALUES('"+f.key().substring(0,20)+"','Member','"+f.key().substring(0,18)+"')");f.error("ROOM_CAPACITY_EXCEEDED",()->f.run(()->new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db)).createResidence(profile,a.booking.property(),a.booking.room(),a.contract,LocalDate.now(),"OCCUPANT",1)));}
    @Test void tc28_firstUtilityBillUsesConfirmedBaseline(){var a=draft();f.ready(a.contract,a.checkin);
        f.db.sql("UPDATE contract_utility_rates SET calculation_method='METER',unit_price=3000 WHERE contract_id=:id AND code='ELECTRICITY'").param("id",a.contract).update();
        f.db.sql("INSERT INTO utility_meters(room_id,meter_type,meter_code,current_reading) VALUES(:room,'ELECTRICITY','E-1250',1250)").param("room",a.booking.room()).update();
        f.run(()->f.onboarding.recordVersion(a.contract,1,"Meter agreement"));var r=request(version(a,"contractVersion"));f.run(()->f.onboarding.confirmContract(f.owner,a.contract,r));f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,r));
        f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(1L,LocalDate.now(),new BigDecimal("1250"),null,1,"Meter photo")));f.run(()->f.onboarding.confirmHandover(f.tenant,a.contract,request(version(a,"handoverVersion"))));
        f.run(()->f.lifecycle.completeCheckin(f.owner,a.checkin,new CompleteCheckin(true,true,true,new BigDecimal("1250"),null,1,null,2L,true)));
        assertThat(count("contract_meter_baselines","contract_id="+a.contract+" AND reading=1250")).isOne();
        f.db.sql("INSERT INTO utility_readings(contract_id,billing_period,electricity_previous,electricity_current,electricity_unit_price,electricity_amount,water_amount) VALUES(:id,:period,0,1380,999,1378620,999)").param("id",a.contract).param("period",LocalDate.now().withDayOfMonth(1)).update();
        var u=f.inTx(()->new AdminInvoiceRepository(f.db).utility(a.contract,LocalDate.now().withDayOfMonth(1)).orElseThrow());assertThat(u.get("electricity_previous").toString()).isEqualTo("1250.00");assertThat(new BigDecimal(u.get("electricity_amount").toString())).isEqualByComparingTo("390000");assertThat(new BigDecimal(u.get("water_amount").toString())).isZero();
    }
    @Test void tc29_initialRentUsesActualPaymentAndExistingInvoice(){var a=draft();f.ready(a.contract,a.checkin);f.db.sql("UPDATE contracts SET initial_payment_required=TRUE WHERE id=:id").param("id",a.contract).update();f.run(()->f.onboarding.recordVersion(a.contract,1,"Require initial invoice"));var r=request(version(a,"contractVersion"));f.run(()->f.onboarding.confirmContract(f.owner,a.contract,r));f.run(()->f.onboarding.confirmContract(f.tenant,a.contract,r));
        var invoices=new com.thangit.boardinghouse.service.impl.AdminInvoiceServiceImpl(new AdminInvoiceRepository(f.db));var date=LocalDate.now();var request=new com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.SaveInvoice(a.booking.room(),a.contract,date.toString().substring(0,7),date.withDayOfMonth(1),date.withDayOfMonth(date.lengthOfMonth()),date,date.plusDays(5),List.of(),BigDecimal.ZERO,false,null,"ISSUE",null);
        long invoice=f.inTx(()->invoices.create(f.owner,request).id());f.run(()->f.onboarding.linkInvoice(f.owner,a.contract,new InitialInvoice(invoice)));f.error("INITIAL_PAYMENT_REQUIRED",()->complete(a));
        f.run(()->invoices.payment(f.owner,invoice,f.key(),new com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.RecordPayment(new BigDecimal("1000"),"CASH",java.time.LocalDateTime.now().minusSeconds(1),null,"Actual initial receipt",0L)));complete(a);assertThat(count("payments","invoice_id="+invoice+" AND status='CONFIRMED'")).isOne();f.error("INVOICE_PERIOD_EXISTS",()->f.run(()->invoices.create(f.owner,request)));
    }
    @Test void tc30_assetSnapshotSurvivesRoomCatalogueEdits(){var b=f.booking("0");long asset=f.insert("INSERT INTO room_assets(room_id,name,quantity,condition_status) VALUES("+b.room()+",'Original desk',1,'GOOD')");long c=f.contract(b,"0");long ci=f.inTx(()->f.lifecycle.prepareCheckin(f.owner,new PrepareCheckin(c,b.booking(),LocalDate.now(),null,null)).id());f.ready(c,ci);complete(new Case(b,c,ci));f.db.sql("UPDATE room_assets SET name='New catalogue name',condition_status='DAMAGED' WHERE id=:id").param("id",asset).update();assertThat(count("rental_checkin_assets","checkin_id="+ci+" AND asset_name='Original desk' AND condition_status='GOOD'")).isOne();assertThat(count("handover_versions","checkin_id="+ci+" AND content LIKE '%Original desk%'")).isOne();}
    @Test void cancelledBookingCannotCreateContract(){var b=f.booking("0");f.run(()->f.lifecycle.changeBookingStatus(f.owner,b.booking(),new ChangeBookingStatus("CANCELLED","No longer renting",0L)));f.error("BOOKING_DEPOSIT_REQUIRED",()->f.contract(b,"0"));}
    @Test void expiredBookingCannotCreateContract(){var b=f.booking("0");f.db.sql("UPDATE rental_bookings SET reservation_start=DATE_SUB(CURRENT_DATE,INTERVAL 3 DAY),reservation_end=CURRENT_DATE,status='EXPIRED' WHERE id=:id").param("id",b.booking()).update();assertThatThrownBy(()->f.contract(b,"0")).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);}
    @Test void accountantCannotCompleteCheckin(){var a=draft();f.ready(a.contract,a.checkin);assertThatThrownBy(()->f.run(()->f.lifecycle.completeCheckin(f.accountant,a.checkin,completion()))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);assertThat(count("contracts","id="+a.contract+" AND status='PENDING_CONFIRMATION'")).isOne();}
    @Test void reschedulingOutsideContractIsRejected(){var a=draft();f.error("CHECKIN_DATE_INVALID",()->f.run(()->f.onboarding.saveHandover(f.owner,a.contract,new Handover(0L,LocalDate.now().plusYears(2),BigDecimal.ZERO,BigDecimal.ZERO,1,"Rescheduled"))));assertThat(count("handover_versions","checkin_id="+a.checkin)).isZero();}
    @Test void repeatedPreparationKeepsOneCheckin(){var a=draft();f.error("CHECKIN_EXISTS",()->f.run(()->f.lifecycle.prepareCheckin(f.owner,new PrepareCheckin(a.contract,a.booking.booking(),LocalDate.now(),null,null))));assertThat(count("rental_checkins","contract_id="+a.contract)).isOne();}
    @Test void fixedPolicyCannotResetExistingMeter(){var a=draft();f.db.sql("INSERT INTO utility_meters(room_id,meter_type,meter_code,current_reading) VALUES(:room,'ELECTRICITY','Fixed-existing',1250)").param("room",a.booking.room()).update();f.ready(a.contract,a.checkin);complete(a);assertThat(count("utility_meters","room_id="+a.booking.room()+" AND current_reading=1250")).isOne();}
    @Test void serviceHeadcountUsesLinkedResidences(){var a=draft();f.ready(a.contract,a.checkin);complete(a);f.db.sql("UPDATE rooms SET capacity=2 WHERE id=:id").param("id",a.booking.room()).update();long profile=f.insert("INSERT INTO tenant_profiles(tenant_code,full_name,phone) VALUES('"+f.key().substring(0,20)+"','Household member','"+f.key().substring(0,18)+"')");f.run(()->new AdminTenantRepository(f.db,new RoomLifecycleGuard(f.db)).createResidence(profile,a.booking.property(),a.booking.room(),a.contract,LocalDate.now(),"OCCUPANT",1));assertThat(new AdminInvoiceRepository(f.db).serviceHeadcount(a.contract,LocalDate.now())).isEqualByComparingTo("2");assertThat(count("contracts","room_id="+a.booking.room())).isOne();}
}
