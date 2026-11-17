package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.dto.request.invoice.TenantInvoiceRequests.CreatePaymentSession;
import com.thangit.boardinghouse.repository.TenantInvoiceRepository;
import com.thangit.boardinghouse.service.impl.TenantInvoiceServiceImpl;
import java.math.BigDecimal;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Runs migrations and concurrent transactions against a new schema on a localhost test server. */
@EnabledIfSystemProperty(named="monthly.payments.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MonthlyPaymentSessionMysqlTest {
    final MonthlyBillingMysqlTest billing=new MonthlyBillingMysqlTest();
    TenantInvoiceServiceImpl tenant;

    @BeforeAll void setup() throws Exception {
        billing.setup();
        tenant=new TenantInvoiceServiceImpl(new TenantInvoiceRepository(billing.f.db));
        billing.f.db.sql("INSERT INTO system_settings(owner_id,setting_group,setting_key,setting_value,value_type) VALUES(1,'payments','cashEnabled','true','BOOLEAN')").update();
        billing.f.db.sql("INSERT INTO billing_settings(owner_id) VALUES(1)").update();
    }
    long invoice(){return billing.invoice(billing.active(false),"ISSUE");}
    long session(long invoice,String key){return billing.f.inTx(()->tenant.createPaymentSession(billing.f.tenant,invoice,key,new CreatePaymentSession(new BigDecimal("1000"),"CASH")).id());}

    @Test void concurrentDifferentKeysProduceOnlyOneActiveSession() throws Exception {
        long invoice=invoice();
        try(var pool=Executors.newFixedThreadPool(2)){
            var gate=new CountDownLatch(1);
            var a=pool.submit(()->{gate.await();return session(invoice,"parallel-a-"+invoice);});
            var b=pool.submit(()->{gate.await();return session(invoice,"parallel-b-"+invoice);});
            gate.countDown();
            assertThat(a.get(15,TimeUnit.SECONDS)).isEqualTo(b.get(15,TimeUnit.SECONDS));
        }
        assertThat(billing.count("tenant_payment_sessions","invoice_id="+invoice)).isOne();
    }
    @Test void concurrentSameKeyIsIdempotent() throws Exception {
        long invoice=invoice();
        try(var pool=Executors.newFixedThreadPool(2)){
            var a=pool.submit(()->session(invoice,"same-"+invoice));
            var b=pool.submit(()->session(invoice,"same-"+invoice));
            assertThat(a.get(15,TimeUnit.SECONDS)).isEqualTo(b.get(15,TimeUnit.SECONDS));
        }
    }
    @Test void sessionSurvivesNewServiceInstance(){
        long invoice=invoice(),id=session(invoice,"restart-"+invoice);
        var restarted=new TenantInvoiceServiceImpl(new TenantInvoiceRepository(billing.f.db));
        assertThat(restarted.activePaymentSession(billing.f.tenant,invoice).id()).isEqualTo(id);
    }
    @Test void expiredUnsubmittedSessionCanBeRetried(){
        long invoice=invoice(),old=session(invoice,"old-"+invoice);
        billing.f.db.sql("UPDATE tenant_payment_sessions SET expires_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE id=:id").param("id",old).update();
        assertThat(session(invoice,"retry-"+invoice)).isNotEqualTo(old);
        assertThat(billing.f.db.sql("SELECT status FROM tenant_payment_sessions WHERE id=:id").param("id",old).query(String.class).single()).isEqualTo("EXPIRED");
    }
    @Test void proofAwaitingReconciliationDoesNotExpireOrCreateAnotherSession(){
        long invoice=invoice(),old=session(invoice,"proof-"+invoice);
        billing.f.db.sql("UPDATE tenant_payment_sessions SET status='PROOF_SUBMITTED',expires_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE id=:id").param("id",old).update();
        assertThat(session(invoice,"proof-retry-"+invoice)).isEqualTo(old);
    }
    @Test void requestForShortAmountCannotCreateSession(){
        long invoice=invoice();
        billing.error("PARTIAL_PAYMENT_DISABLED",()->billing.f.run(()->tenant.createPaymentSession(billing.f.tenant,invoice,"short-"+invoice,new CreatePaymentSession(new BigDecimal("600"),"CASH"))));
        assertThat(billing.count("tenant_payment_sessions","invoice_id="+invoice)).isZero();
    }
    @Test void legacyPartialSessionCannotBeUsedAsPaymentInstructions(){
        long invoice=invoice(),old=session(invoice,"legacy-"+invoice);
        billing.f.db.sql("UPDATE tenant_payment_sessions SET amount=100 WHERE id=:id").param("id",old).update();
        assertThat(tenant.activePaymentSession(billing.f.tenant,invoice)).isNull();
        assertThat(session(invoice,"legacy-replacement-"+invoice)).isNotEqualTo(old);
        assertThat(billing.f.db.sql("SELECT status FROM tenant_payment_sessions WHERE id=:id").param("id",old).query(String.class).single()).isEqualTo("EXPIRED");
    }
    @Test void reconciledShortBankReceiptReleasesSessionForExactRemainder(){
        long invoice=invoice();session(invoice,"before-short-"+invoice);
        assertThat(billing.f.db.sql("SELECT allow_partial_payment FROM billing_settings WHERE owner_id=1").query(Boolean.class).single()).isFalse();
        billing.f.run(()->billing.invoices.payment(billing.f.owner,invoice,"bank-short-"+invoice,
            new com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.RecordPayment(
                new BigDecimal("600"),"BANK_TRANSFER",java.time.LocalDateTime.now().minusSeconds(1),"BANK-"+invoice,"Verified bank statement short receipt",null)));
        assertThat(tenant.detail(billing.f.tenant,invoice).remainingAmount()).isEqualByComparingTo("400");
        assertThat(tenant.activePaymentSession(billing.f.tenant,invoice)).isNull();
        var next=billing.f.inTx(()->tenant.createPaymentSession(billing.f.tenant,invoice,"remainder-"+invoice,new CreatePaymentSession(new BigDecimal("400"),"CASH")));
        assertThat(next.amount()).isEqualByComparingTo("400");
        billing.f.run(()->billing.invoices.payment(billing.f.owner,invoice,"cash-rest-"+invoice,
            new com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.RecordPayment(
                new BigDecimal("400"),"CASH",java.time.LocalDateTime.now().minusSeconds(1),null,"Actual remaining cash received",null)));
        assertThat(tenant.detail(billing.f.tenant,invoice).status()).isEqualTo("PAID");
        assertThat(billing.count("invoice_balance_reconciliation","id="+invoice)).isZero();
        billing.error("INVOICE_NOT_PAYABLE",()->billing.f.run(()->tenant.createPaymentSession(billing.f.tenant,invoice,"paid-new-"+invoice,new CreatePaymentSession(BigDecimal.ONE,"CASH"))));
    }
}
