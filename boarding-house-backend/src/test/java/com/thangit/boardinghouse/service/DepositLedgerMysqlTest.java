package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.repository.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.DepositLedgerService.*;
import com.thangit.boardinghouse.service.impl.RentalLifecycleServiceImpl;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;

/** Opt-in, localhost only. Creates a NEW schema and retains it for inspection; never opens the application schema. */
@EnabledIfSystemProperty(named="prompt03.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DepositLedgerMysqlTest {
    JdbcClient db;TransactionTemplate tx;DepositLedgerService ledger;RentalLifecycleServiceImpl lifecycle;
    DriverManagerDataSource dataSource;
    AccountantPortalRepository accounting;ContractOnboardingService onboarding;CheckoutSettlementService checkoutWorkflow;
    final AuthenticatedUser owner=new AuthenticatedUser(1L,"owner@test.invalid",RoleCode.OWNER);
    final AuthenticatedUser accountant=new AuthenticatedUser(3L,"accountant@test.invalid",RoleCode.ACCOUNTANT);
    final AuthenticatedUser accountant2=new AuthenticatedUser(4L,"accountant2@test.invalid",RoleCode.ACCOUNTANT);
    final AuthenticatedUser tenant=new AuthenticatedUser(5L,"tenant@test.invalid",RoleCode.TENANT);
    long legacyContract,legacyReviewDeposit;

    @BeforeAll void setup()throws Exception {setup("prompt03_test_",null);}
    void setup(String prefix,String target)throws Exception {
        Properties props=new Properties();try(var reader=Files.newBufferedReader(Path.of("../.env"))){props.load(reader);}
        String schema=prefix+UUID.randomUUID().toString().replace("-","");
        String user=System.getProperty("prompt03.mysql.user",props.getProperty("DB_USERNAME","root")),password=System.getProperty("prompt03.mysql.password",props.getProperty("DB_PASSWORD",""));
        int port=Integer.getInteger("prompt03.mysql.port",3306);
        String server="jdbc:mysql://127.0.0.1:"+port+"/";
        var admin=new DriverManagerDataSource(server+"?serverTimezone=UTC",user,password);
        JdbcClient.create(admin).sql("CREATE DATABASE "+schema+" CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci").update();
        var ds=new DriverManagerDataSource(server+schema+"?serverTimezone=UTC",user,password);
        dataSource=ds;
        db=JdbcClient.create(ds);tx=new TransactionTemplate(new JdbcTransactionManager(ds));
        Flyway.configure().dataSource(ds).target("21").load().migrate();
        for(int i=1;i<=6;i++)db.sql("INSERT INTO users(id,email,password_hash,full_name) VALUES(:id,:email,'test-only','Test')").param("id",i).param("email","p03-"+i+"@test.invalid").update();
        for(int i:List.of(3,4))db.sql("INSERT INTO accountant_profiles(user_id,employee_code) VALUES(:id,:code)").param("id",i).param("code","KT-"+i).update();
        long p=insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'LEGACY','Legacy','Test')");
        long r=insert("INSERT INTO rooms(property_id,code,monthly_rent) VALUES("+p+",'L',1000)");
        legacyContract=insert("INSERT INTO contracts(room_id,tenant_id,code,start_date,end_date,deposit_amount) VALUES("+r+",5,'LEGACY',CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 1 YEAR),3000000)");
        long reviewContract=insert("INSERT INTO contracts(room_id,tenant_id,code,start_date,end_date,deposit_amount) VALUES("+r+",5,'LEGACY-REVIEW',CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 1 YEAR),3000000)");
        legacyReviewDeposit=insert("INSERT INTO tenant_deposits(contract_id,property_id,tenant_id,required_amount,balance_amount) VALUES("+reviewContract+","+p+",5,3000000,500000)");
        db.sql("INSERT INTO deposit_transactions(deposit_id,transaction_code,transaction_type,amount,transacted_by) VALUES(:id,'LEGACY-RECEIPT','COLLECT',500000,3)").param("id",legacyReviewDeposit).update();
        var flyway=Flyway.configure().dataSource(ds);if(target!=null)flyway.target(target);flyway.load().migrate();
        var guard=new RoomLifecycleGuard(db);var repo=new RentalLifecycleRepository(db,guard);accounting=new AccountantPortalRepository(db);
        onboarding=new ContractOnboardingService(db,guard,accounting);ledger=new DepositLedgerService(db,repo,accounting,onboarding);lifecycle=new RentalLifecycleServiceImpl(repo,ledger,guard,onboarding);
        checkoutWorkflow=new CheckoutSettlementService(db,ledger,guard);lifecycle.setCheckoutWorkflow(checkoutWorkflow);
        System.out.println("Prompt03 isolated MySQL schema retained: "+schema);
    }
    long insert(String sql){var kh=new GeneratedKeyHolder();db.sql(sql).update(kh,"id");return kh.getKey().longValue();}
    <T>T inTx(Supplier<T> fn){return tx.execute(s->fn.get());}
    void run(Runnable fn){inTx(()->{fn.run();return null;});}
    @SuppressWarnings("unchecked")
    void ready(long contract,long ci){ready(contract,ci,BigDecimal.ZERO,BigDecimal.ZERO);}
    void ready(long contract,long ci,BigDecimal electricity,BigDecimal water){
        db.sql("UPDATE tenant_profiles tp JOIN contracts c ON c.tenant_profile_id=tp.id SET tp.date_of_birth='2000-01-01',tp.identity_type='CCCD',tp.identity_number=CONCAT('TEST-',tp.id),tp.permanent_address='Test address' WHERE c.id=:id").param("id",contract).update();
        run(()->onboarding.recordVersion(contract,1,"Complete fixture profile"));
        run(()->onboarding.verifyIdentity(owner,contract,new ContractOnboardingService.Evidence("ID-TEST")));
        var v=(Map<String,Object>)onboarding.detail(owner,contract).get("contractVersion");
        var confirmation=new ContractOnboardingService.Confirmation(((Number)v.get("version")).longValue(),v.get("content_hash").toString());
        run(()->onboarding.confirmContract(owner,contract,confirmation));run(()->onboarding.confirmContract(tenant,contract,confirmation));
        long version=db.sql("SELECT version FROM rental_checkins WHERE id=:id").param("id",ci).query(Long.class).single();
        run(()->onboarding.saveHandover(owner,contract,new ContractOnboardingService.Handover(version,LocalDate.now(),electricity,water,1,"CI-TEST")));
        var hv=(Map<String,Object>)onboarding.detail(owner,contract).get("handoverVersion");
        run(()->onboarding.confirmHandover(tenant,contract,new ContractOnboardingService.Confirmation(((Number)hv.get("version")).longValue(),hv.get("content_hash").toString())));
    }
    BigDecimal amount(String s){return new BigDecimal(s);}
    void repairAndAccept(long room){var maintenance=new com.thangit.boardinghouse.service.impl.AdminMaintenanceServiceImpl(new AdminMaintenanceRepository(db,new RoomLifecycleGuard(db)));var ids=db.sql("SELECT id FROM maintenance_requests WHERE room_id=:id AND source='CHECKOUT' AND status='NEW'").param("id",room).query(Long.class).list();for(long id:ids){run(()->maintenance.workLog(owner,id,new com.thangit.boardinghouse.dto.request.maintenance.AdminMaintenanceRequests.WorkLogRequest("WAITING_PARTS",50,"Confirmed repair","Parts prepared","Physical repair test",LocalDateTime.now().minusMinutes(2),LocalDateTime.now().minusMinutes(1),0L)));run(()->maintenance.complete(owner,id,new com.thangit.boardinghouse.dto.request.maintenance.AdminMaintenanceRequests.CompleteRequest("Cause verified","Repair completed",1L)));run(()->maintenance.inspect(owner,id,new com.thangit.boardinghouse.dto.request.maintenance.AdminMaintenanceRequests.InspectionRequest("PASSED",5,"Inspected before relet",true,true,2L)));}}
    @SuppressWarnings("unchecked")
    CompleteCheckout readyCheckout(long co,BigDecimal charge,String description){
        long contract=db.sql("SELECT contract_id FROM rental_checkouts WHERE id=:id").param("id",co).query(Long.class).single();
        long version=db.sql("SELECT version FROM rental_checkouts WHERE id=:id").param("id",co).query(Long.class).single();
        run(()->checkoutWorkflow.approveSchedule(owner,co,new CheckoutSettlementService.Schedule(LocalDate.now(),version,"Test agreed schedule","SCHEDULE-TEST")));
        var assets=db.sql("SELECT a.* FROM rental_checkin_assets a JOIN rental_checkins ci ON ci.id=a.checkin_id WHERE ci.contract_id=:id ORDER BY a.id").param("id",contract).query().listOfRows().stream().map(a->new CheckoutSettlementService.Asset(((Number)a.get("id")).longValue(),((Number)a.get("quantity")).intValue(),a.get("condition_status").toString(),"NATURAL_WEAR","ASSET-TEST",null)).toList();
        long inspectVersion=db.sql("SELECT version FROM rental_checkouts WHERE id=:id").param("id",co).query(Long.class).single();
        run(()->checkoutWorkflow.inspect(owner,co,new CheckoutSettlementService.Inspection(inspectVersion,LocalDateTime.now(),BigDecimal.ZERO,BigDecimal.ZERO,1,false,charge.signum()>0,"HANDOVER-TEST",null,assets)));
        if(charge.signum()>0){long fee=inTx(()->checkoutWorkflow.proposeCharge(owner,co,new CheckoutSettlementService.ChargeRequest("TEST-CHARGE-"+co,"DAMAGE",description,charge,"REPAIR-EVIDENCE","Verified actual repair estimate",null)));run(()->checkoutWorkflow.decideCharge(owner,co,fee,new CheckoutSettlementService.ChargeDecision(true,"Evidence checked")));}
        var plan=inTx(()->checkoutWorkflow.preview(owner,co));long approveVersion=db.sql("SELECT version FROM rental_checkouts WHERE id=:id").param("id",co).query(Long.class).single();
        run(()->checkoutWorkflow.approve(owner,co,new CheckoutSettlementService.Approval(approveVersion,plan.hash(),"CONTRACT-TEST","Reviewed final statement","NONE")));
        var approved=(Map<String,Object>)checkoutWorkflow.detail(owner,contract).get("approved");
        run(()->checkoutWorkflow.confirm(tenant,co,new CheckoutSettlementService.Confirmation(((Number)approved.get("version")).longValue(),approved.get("content_hash").toString())));
        return new CompleteCheckout(LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,checkoutWorkflow.completionCharges(((Number)approved.get("id")).longValue()),"Approved physical handover",((Number)approved.get("version")).longValue());
    }
    String key(){return UUID.randomUUID().toString();}
    Cash cash(String n){return new Cash(amount(n),"CASH",LocalDateTime.now().minusSeconds(2).withNano(0),null,"PT-test","Xác nhận thực thu/chi",false);}
    record Fixture(long property,long room,long profile,long booking,long deposit) {}
    Fixture booking(String required){return inTx(()->{
        String code=key();long property=insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'"+code.substring(0,20)+"','Test','Local test')");
        db.sql("INSERT INTO accountant_property_assignments(accountant_id,property_id,granted_by) VALUES(3,:p,1),(4,:p,1)").param("p",property).update();
        long room=insert("INSERT INTO rooms(property_id,code,monthly_rent) VALUES("+property+",'T',1000)");
        long profile=db.sql("SELECT id FROM tenant_profiles WHERE user_id=5").query(Long.class).optional().orElseGet(()->insert("INSERT INTO tenant_profiles(tenant_code,user_id,full_name,phone) VALUES('"+code.substring(0,20)+"',5,'Test','"+code.substring(0,18)+"')"));
        db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,move_in_date) VALUES(:t,:p,CURRENT_DATE)").param("t",profile).param("p",property).update();
        var b=lifecycle.createBooking(owner,new CreateBooking(profile,room,LocalDate.now(),LocalDate.now().plusDays(7),amount(required),null,null));
        long deposit=db.sql("SELECT id FROM tenant_deposits WHERE booking_id=:id").param("id",b.id()).query(Long.class).single();return new Fixture(property,room,profile,b.id(),deposit);
    });}
    long contract(Fixture f,String required){return contract(f,required,null);}
    long contract(Fixture f,String required,BigDecimal rent){return inTx(()->lifecycle.createContract(owner,f.booking,new CreateContract(LocalDate.now(),LocalDate.now().plusYears(1),amount(required),5,30,null,rent,List.of(new AgreedRate("ELECTRICITY","Electricity","FIXED",BigDecimal.ZERO,"month"),new AgreedRate("WATER","Water","FIXED",BigDecimal.ZERO,"month")),null,null,false)).id());}
    long contractDeposit(long contract){return db.sql("SELECT id FROM tenant_deposits WHERE contract_id=:id").param("id",contract).query(Long.class).single();}
    BigDecimal balance(long id){return db.sql("SELECT balance_amount FROM tenant_deposits WHERE id=:id").param("id",id).query(BigDecimal.class).single();}
    long count(String where){return db.sql("SELECT COUNT(*) FROM deposit_transactions WHERE "+where).query(Long.class).single();}
    void error(String code,Runnable action){assertThatThrownBy(action::run).isInstanceOf(AuthException.class).extracting(e->((AuthException)e).code()).isEqualTo(code);}
    long cancelAndRequest(Fixture f,String refund,String retained){run(()->lifecycle.changeBookingStatus(owner,f.booking,new ChangeBookingStatus("CANCELLED","Theo thỏa thuận",1L)));return inTx(()->ledger.requestRefund(accountant,f.deposit,new Refund(amount(refund),amount(retained),"Theo điều khoản hủy đã thống nhất")));}

    @Test void tc01_bookingStartsUnpaid(){var f=booking("500000");assertThat(balance(f.deposit)).isZero();assertThat(db.sql("SELECT status FROM rental_bookings WHERE id=:id").param("id",f.booking).query(String.class).single()).isEqualTo("RESERVED");}
    @Test void tc02_cannotFakeDeposited(){var f=booking("500000");error("BOOKING_RECEIPT_REQUIRED",()->run(()->lifecycle.changeBookingStatus(owner,f.booking,new ChangeBookingStatus("DEPOSITED",null,0L))));}
    @Test void tc03_confirmedCollectionHasEvidence(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));assertThat(balance(f.deposit)).isEqualByComparingTo("500000");assertThat(db.sql("SELECT deposit_status FROM rental_bookings WHERE id=:id").param("id",f.booking).query(String.class).single()).isEqualTo("PAID");}
    @Test void tc04_duplicateCollectionIsIdempotent(){var f=booking("500000");String key=key();Cash r=cash("500000");run(()->ledger.collect(accountant,f.deposit,key,r));run(()->ledger.collect(accountant2,f.deposit,key,r));assertThat(count("deposit_id="+f.deposit)).isEqualTo(1);error("IDEMPOTENCY_KEY_REUSED",()->run(()->ledger.collect(accountant,f.deposit,key,cash("1"))));}
    @Test void tc05_zeroReservationCanCreateContract(){var f=booking("0");assertThat(contract(f,"3000000")).isPositive();}
    @Test void tc06_transferReducesRemainingDue(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));long c=contract(f,"3000000");assertThat(balance(f.deposit)).isZero();assertThat(balance(contractDeposit(c))).isEqualByComparingTo("500000");var account=ledger.accounts(owner).stream().filter(d->d.get("contract_id") instanceof Number n && n.longValue()==c).findFirst().orElseThrow();assertThat(account.get("remaining_deposit_due").toString()).isEqualTo("2500000.00");}
    @Test void tc07_cannotTransferTwice(){var f=booking("0");contract(f,"3000000");error("BOOKING_DEPOSIT_REQUIRED",()->contract(f,"3000000"));}
    @Test void tc08_topUpPreservesRequirement(){var f=booking("0");long c=contract(f,"3000000"),d=contractDeposit(c);run(()->ledger.collect(accountant,d,key(),cash("1000000")));assertThat(balance(d)).isEqualByComparingTo("1000000");assertThat(db.sql("SELECT deposit_amount FROM contracts WHERE id=:id").param("id",c).query(BigDecimal.class).single()).isEqualByComparingTo("3000000");}
    @Test void tc09_checkinRequiresActualFunds(){var f=booking("0");long c=contract(f,"3000000");long ci=inTx(()->lifecycle.prepareCheckin(owner,new PrepareCheckin(c,f.booking,LocalDate.now(),null,null)).id());error("CHECKIN_DEPOSIT_INSUFFICIENT",()->run(()->lifecycle.completeCheckin(owner,ci,new CompleteCheckin(true,true,true,amount("0"),amount("0"),1,null,0L))));}
    @Test void tc10_unpaidCancellationHasNoRefund(){var f=booking("500000");run(()->lifecycle.changeBookingStatus(owner,f.booking,new ChangeBookingStatus("CANCELLED","Chưa thu",0L)));assertThat(count("deposit_id="+f.deposit)).isZero();assertThat(db.sql("SELECT COUNT(*) FROM deposit_refund_requests WHERE deposit_id=:id").param("id",f.deposit).query(Long.class).single()).isZero();}
    @Test void tc11_fullCancellationRefund(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));long r=cancelAndRequest(f,"500000","0");run(()->ledger.approveRefund(owner,f.deposit,r));run(()->ledger.payRefund(accountant,f.deposit,r,key(),cash("500000")));assertThat(balance(f.deposit)).isZero();}
    @Test void tc12_partialRetention(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));long r=cancelAndRequest(f,"300000","200000");run(()->ledger.approveRefund(owner,f.deposit,r));assertThat(balance(f.deposit)).isEqualByComparingTo("300000");run(()->ledger.payRefund(accountant,f.deposit,r,key(),cash("300000")));assertThat(balance(f.deposit)).isZero();}
    @Test void tc13_cannotRefundMoreThanBalance(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));error("REFUND_EXCEEDS_BALANCE",()->cancelAndRequest(f,"500001","0"));}
    @Test void tc14_twoAccountantsCannotDoubleRefund()throws Exception{var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));long r=cancelAndRequest(f,"500000","0");run(()->ledger.approveRefund(owner,f.deposit,r));Cash cash=cash("500000");var gate=new CountDownLatch(1);try(var pool=Executors.newFixedThreadPool(2)){List<Future<Boolean>> futures=new ArrayList<>();for(var p:List.of(accountant,accountant2))futures.add(pool.submit(()->{gate.await();try{run(()->ledger.payRefund(p,f.deposit,r,key(),cash));return true;}catch(AuthException ex){return false;}}));gate.countDown();int success=0;for(var future:futures)if(future.get(30,TimeUnit.SECONDS))success++;assertThat(success).isEqualTo(1);}assertThat(balance(f.deposit)).isZero();assertThat(count("deposit_id="+f.deposit+" AND transaction_type='REFUND'")).isEqualTo(1);}
    @Test void tc15_depositDoesNotCreateRentPayment(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));assertThat(db.sql("SELECT COUNT(*) FROM payments WHERE property_id=:id").param("id",f.property).query(Long.class).single()).isZero();}
    @Test void tc16_transferCreatesNoNewCash(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));long c=contract(f,"3000000");assertThat(count("deposit_id IN ("+f.deposit+","+contractDeposit(c)+") AND payment_method IS NOT NULL")).isEqualTo(1);}

    record Checkout(long contract,long deposit,long checkout){}
    Checkout settlement(String deposit,String debt,String charges){var f=booking("0");long c=contract(f,deposit,BigDecimal.ZERO),d=contractDeposit(c);if(amount(deposit).signum()>0)run(()->ledger.collect(accountant,d,key(),cash(deposit)));long ci=inTx(()->lifecycle.prepareCheckin(owner,new PrepareCheckin(c,f.booking,LocalDate.now(),null,null)).id());ready(c,ci);run(()->lifecycle.completeCheckin(owner,ci,new CompleteCheckin(true,true,true,BigDecimal.ZERO,BigDecimal.ZERO,1,null,1L)));
        if(amount(debt).signum()>0)db.sql("INSERT INTO invoices(contract_id,property_id,room_id,tenant_id,code,billing_period,issue_date,due_date,total_amount,subtotal_amount,remaining_amount,status) VALUES(:c,:p,:r,5,:code,CURRENT_DATE,CURRENT_DATE,CURRENT_DATE,:a,:a,:a,'ISSUED')").param("c",c).param("p",f.property).param("r",f.room).param("code",key()).param("a",amount(debt)).update();
        long co=inTx(()->lifecycle.requestCheckout(owner,new RequestCheckout(c,LocalDate.now(),"Kết thúc thuê")).id());var completion=readyCheckout(co,amount(charges),"Verified damage");run(()->lifecycle.completeCheckout(owner,co,completion));return new Checkout(c,d,co);}
    @Test void tc17_settlementUsesActualBalance(){var co=settlement("3000000","1000000","400000");assertThat(balance(co.deposit)).isEqualByComparingTo("1600000");assertThat(db.sql("SELECT refund_amount FROM rental_checkouts WHERE id=:id").param("id",co.checkout).query(BigDecimal.class).single()).isEqualByComparingTo("1600000");}
    @Test void tc18_offsetReducesDebtWithoutCash(){var co=settlement("3000000","1000000","400000");assertThat(db.sql("SELECT SUM(remaining_amount) FROM invoices WHERE contract_id=:id").param("id",co.contract).query(BigDecimal.class).single()).isZero();assertThat(db.sql("SELECT COUNT(*) FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE contract_id=:id)").param("id",co.contract).query(Long.class).single()).isZero();assertThat(db.sql("SELECT SUM(a.amount) FROM deposit_invoice_allocations a JOIN invoices i ON i.id=a.invoice_id WHERE i.contract_id=:id").param("id",co.contract).query(BigDecimal.class).single()).isEqualByComparingTo("1400000");}
    @Test void tc19_unpaidRefundPreventsClosure(){var co=settlement("3000000","1000000","400000");error("CHECKOUT_FINANCE_PENDING",()->run(()->ledger.closeCheckout(owner,co.deposit)));assertThat(db.sql("SELECT status FROM rental_checkouts WHERE id=:id").param("id",co.checkout).query(String.class).single()).isEqualTo("SETTLEMENT");}
    @Test void tc20_partialThenFullRefundClosesCheckout(){var co=settlement("3000000","1000000","400000");long r=db.sql("SELECT id FROM deposit_refund_requests WHERE checkout_id=:id").param("id",co.checkout).query(Long.class).single();run(()->ledger.approveRefund(owner,co.deposit,r));String key=key();Cash cash=cash("600000");run(()->ledger.payRefund(accountant,co.deposit,r,key,cash));run(()->ledger.payRefund(accountant2,co.deposit,r,key,cash));assertThat(balance(co.deposit)).isEqualByComparingTo("1000000");run(()->ledger.payRefund(accountant,co.deposit,r,key(),cash("1000000")));run(()->ledger.closeCheckout(owner,co.deposit));assertThat(db.sql("SELECT status FROM contracts WHERE id=:id").param("id",co.contract).query(String.class).single()).isEqualTo("TERMINATED");}
    @Test void tc21_transactionFailureRollsBack(){var f=booking("500000");String key=key();assertThatThrownBy(()->run(()->{ledger.collect(accountant,f.deposit,key,cash("500000"));throw new IllegalStateException("simulated downstream failure");})).isInstanceOf(IllegalStateException.class);assertThat(balance(f.deposit)).isZero();assertThat(count("idempotency_key='"+key+"'")).isZero();}
    @Test void tc22_scopeAndRoleAreEnforced(){var f=booking("500000");error("DEPOSIT_WRITE_DENIED",()->run(()->ledger.collect(tenant,f.deposit,key(),cash("1"))));var other=new AuthenticatedUser(6L,"other@test.invalid",RoleCode.TENANT);error("DEPOSIT_ACCESS_DENIED",()->ledger.detail(other,f.deposit));error("DEPOSIT_APPROVAL_DENIED",()->run(()->ledger.approveRefund(accountant,f.deposit,1)));}
    @Test void tc23_closedPeriodRejectsCollection(){var f=booking("500000");db.sql("INSERT INTO accounting_periods(property_id,period_code,start_date,end_date,status) VALUES(:id,DATE_FORMAT(CURRENT_DATE,'%Y-%m'),DATE_FORMAT(CURRENT_DATE,'%Y-%m-01'),LAST_DAY(CURRENT_DATE),'CLOSED')").param("id",f.property).update();error("ACCOUNTING_PERIOD_CLOSED",()->run(()->ledger.collect(accountant,f.deposit,key(),cash("500000"))));}
    @Test void tc24_ledgerMatchesAccountantBalance(){var f=booking("0");long c=contract(f,"3000000"),d=contractDeposit(c);run(()->ledger.collect(accountant,d,key(),cash("1500000")));assertThat(ledger.accounts(accountant).stream().filter(a->((Number)a.get("id")).longValue()==d).findFirst().orElseThrow().get("balance_amount").toString()).isEqualTo("1500000.00");assertThat(db.sql("SELECT COUNT(*) FROM deposit_balance_anomalies WHERE id=:id").param("id",d).query(Long.class).single()).isZero();}
    @Test void tc25_migrationDoesNotInventHistoricalCash(){long d=contractDeposit(legacyContract);assertThat(balance(d)).isZero();assertThat(count("deposit_id="+d)).isZero();assertThat(db.sql("SELECT deposit_amount FROM contracts WHERE id=:id").param("id",legacyContract).query(BigDecimal.class).single()).isEqualByComparingTo("3000000");}
    @Test void bankReceiptRequiresReconciliation(){var f=booking("500000");Cash c=new Cash(amount("500000"),"BANK_TRANSFER",LocalDateTime.now().minusMinutes(1),"bank-ref", "proof","test",false);error("BANK_RECONCILIATION_REQUIRED",()->run(()->ledger.collect(accountant,f.deposit,key(),c)));}
    @Test void unexplainedBalanceIsBlocked(){var f=booking("500000");db.sql("UPDATE tenant_deposits SET balance_amount=1 WHERE id=:id").param("id",f.deposit).update();error("DEPOSIT_LEDGER_MISMATCH",()->run(()->ledger.collect(accountant,f.deposit,key(),cash("1"))));}
    @Test void legacyUnprovenLedgerRemainsUnderReview(){assertThat(balance(legacyReviewDeposit)).isEqualByComparingTo("500000");assertThat(count("deposit_id="+legacyReviewDeposit+" AND status='CONFIRMED'")).isZero();error("DEPOSIT_RECONCILIATION_REQUIRED",()->run(()->ledger.collect(owner,legacyReviewDeposit,key(),cash("1"))));}
    @Test void tenantCanReadOwnUnsignedBigintAccount(){var f=booking("500000");assertThat(((Number)ledger.detail(tenant,f.deposit).get("id")).longValue()).isEqualTo(f.deposit);}
    @Test void loweringRequirementCreatesRefundWithoutInventingPayout(){var f=booking("0");long c=contract(f,"3000000"),d=contractDeposit(c);run(()->ledger.collect(accountant,d,key(),cash("3000000")));run(()->ledger.requirement(owner,d,new Requirement(amount("2000000"),"PL-01","Giảm cọc theo thỏa thuận")));assertThat(balance(d)).isEqualByComparingTo("3000000");long r=db.sql("SELECT id FROM deposit_refund_requests WHERE deposit_id=:id").param("id",d).query(Long.class).single();run(()->ledger.approveRefund(owner,d,r));run(()->ledger.payRefund(accountant,d,r,key(),cash("1000000")));assertThat(balance(d)).isEqualByComparingTo("2000000");}
    @Test void contractTransferIsInternalAndIdempotent(){var a=booking("0");long ca=contract(a,"3000000"),da=contractDeposit(ca);var b=booking("0");long cb=contract(b,"3000000"),dbId=contractDeposit(cb);run(()->ledger.collect(accountant,da,key(),cash("3000000")));String key=key();Transfer r=new Transfer(dbId,amount("500000"),"PL-TRANSFER","Hai bên thống nhất điều chuyển cọc");run(()->ledger.transferContract(owner,da,key,r));run(()->ledger.transferContract(owner,da,key,r));assertThat(balance(da)).isEqualByComparingTo("2500000");assertThat(balance(dbId)).isEqualByComparingTo("500000");assertThat(count("deposit_id="+dbId+" AND payment_method IS NOT NULL")).isZero();}
    @Test void reservationExcessRemainsAvailableUntilRefunded(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));long c=inTx(()->lifecycle.createContract(owner,f.booking,new CreateContract(LocalDate.now(),LocalDate.now().plusYears(1),amount("300000"),5,30,amount("300000"))).id());assertThat(balance(f.deposit)).isEqualByComparingTo("200000");error("RESERVATION_UNSETTLED",()->run(()->ledger.requireFunded(c)));long r=inTx(()->ledger.requestRefund(owner,f.deposit,new Refund(amount("200000"),BigDecimal.ZERO,"Hoàn giữ chỗ dư")));run(()->ledger.approveRefund(owner,f.deposit,r));run(()->ledger.payRefund(accountant,f.deposit,r,key(),cash("200000")));run(()->ledger.requireFunded(c));}
    @Test void refundFailureRollsBackLedgerAndRequest(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));long r=cancelAndRequest(f,"500000","0");run(()->ledger.approveRefund(owner,f.deposit,r));String key=key();assertThatThrownBy(()->run(()->{ledger.payRefund(accountant,f.deposit,r,key,cash("500000"));throw new IllegalStateException("failed downstream");})).isInstanceOf(IllegalStateException.class);assertThat(balance(f.deposit)).isEqualByComparingTo("500000");assertThat(count("idempotency_key='"+key+"'")).isZero();assertThat(db.sql("SELECT paid_amount FROM deposit_refund_requests WHERE id=:id").param("id",r).query(BigDecimal.class).single()).isZero();}
    @Test void cashbookIncludesOnlyRealDepositCash(){var f=booking("500000");run(()->ledger.collect(accountant,f.deposit,key(),cash("500000")));long c=contract(f,"3000000");var book=accounting.books(3L,f.property,LocalDate.now().toString().substring(0,7),"CASH",0,100);assertThat(((Number)book.get("totalElements")).longValue()).isEqualTo(1);assertThat(accounting.paymentByReference(f.property,"BANK_TRANSFER","not-found")).isEmpty();}
    @Test void bankReferenceCannotBeReusedAcrossDepositAndRent(){var f=booking("500000");String ref=key();Cash cash=new Cash(amount("500000"),"BANK_TRANSFER",LocalDateTime.now().minusMinutes(1),ref,"BANK-STATEMENT","Đã đối soát",true);run(()->ledger.collect(accountant,f.deposit,key(),cash));assertThat(accounting.paymentByReference(f.property,"BANK_TRANSFER",ref)).isPresent();var b=booking("500000");error("DEPOSIT_REFERENCE_DUPLICATE",()->run(()->ledger.collect(accountant,b.deposit,key(),cash)));}
}
