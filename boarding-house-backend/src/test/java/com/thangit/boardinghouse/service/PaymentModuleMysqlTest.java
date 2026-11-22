package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.service.integration.PaymentProviderAdapter;
import java.util.*;
import java.util.concurrent.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.mock.env.MockEnvironment;

@EnabledIfSystemProperty(named="payment.module.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PaymentModuleMysqlTest {
    final InvoicePaymentAuditMysqlTest audit=new InvoicePaymentAuditMysqlTest();
    final MonthlyBillingMysqlTest b=audit.b;
    MockEnvironment environment;
    PaymentTransactionService transactions;
    @BeforeAll void setup() throws Exception {
        audit.setup();environment=new MockEnvironment().withProperty("app.payments.simulation-enabled","true");
        environment.setActiveProfiles("local");transactions=new PaymentTransactionService(b.f.db,environment);
    }
    long invoice(){return b.invoice(b.active(false),"ISSUE");}
    long create(long invoice,String key){return ((Number)b.f.inTx(()->transactions.simulate(b.f.tenant,invoice,key)).get("id")).longValue();}
    String state(long id){return b.f.db.sql("SELECT status FROM gateway_sessions WHERE id=:id").param("id",id).query(String.class).single();}
    @Test void simulationSuccessIsIdempotentAndNeverTouchesRealMoney(){
        long invoice=invoice();String key=b.f.key();long id=create(invoice,key);
        assertThat(create(invoice,key)).isEqualTo(id);
        var result=b.f.inTx(()->transactions.outcome(b.f.tenant,id,"SUCCESS"));
        assertThat(result.get("transactionStatus")).isEqualTo("SUCCESS");assertThat(result.get("realMoney")).isEqualTo(false);
        assertThat(b.f.inTx(()->transactions.outcome(b.f.tenant,id,"SUCCESS")).get("status")).isEqualTo("TEST_SUCCEEDED");
        assertThat(b.count("payments","invoice_id="+invoice)).isZero();
        assertThat(b.row(invoice).get("remaining_amount").toString()).isEqualTo("1000.00");
        assertThat(b.count("gateway_session_events","session_id="+id)).isEqualTo(2);
    }
    @Test void simultaneousSimulationRequestsReuseOnePendingAttempt() throws Exception {
        long invoice=invoice();try(var pool=Executors.newFixedThreadPool(2)){
            var gate=new CountDownLatch(1);
            var first=pool.submit(()->{gate.await();return create(invoice,b.f.key());});
            var second=pool.submit(()->{gate.await();return create(invoice,b.f.key());});gate.countDown();
            assertThat(first.get(20,TimeUnit.SECONDS)).isEqualTo(second.get(20,TimeUnit.SECONDS));
        }
        assertThat(b.count("gateway_sessions","invoice_id="+invoice+" AND status='PENDING'")).isOne();
    }
    @Test void cancelledAndFailedSimulationNeverChangesTheInvoice(){
        long invoice=invoice();long first=create(invoice,b.f.key());
        b.f.run(()->transactions.outcome(b.f.tenant,first,"CANCELLED"));assertThat(state(first)).isEqualTo("CANCELLED");
        long second=create(invoice,b.f.key());b.f.run(()->transactions.outcome(b.f.tenant,second,"FAILED"));
        assertThat(state(second)).isEqualTo("FAILED");assertThat(b.count("payments","invoice_id="+invoice)).isZero();
    }
    @Test void missingCallbackExpiresWithoutCreditingMoney(){
        long id=create(invoice(),b.f.key());
        b.f.db.sql("UPDATE gateway_sessions SET expires_at=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 DAY) WHERE id=:id").param("id",id).update();
        b.f.run(()->transactions.expirePending());assertThat(state(id)).isEqualTo("EXPIRED");
        assertThatThrownBy(()->b.f.run(()->transactions.outcome(b.f.tenant,id,"SUCCESS"))).isInstanceOf(AuthException.class);
        assertThat(b.count("gateway_session_events","session_id="+id+" AND to_status='EXPIRED'")).isOne();
    }
    @Test void productionProfileCannotEnableSimulationEvenWithFlag(){
        var prod=new MockEnvironment().withProperty("app.payments.simulation-enabled","true");prod.setActiveProfiles("local","prod");
        var service=new PaymentTransactionService(b.f.db,prod);
        assertThat(service.simulationEnabled()).isFalse();
        assertThatThrownBy(()->b.f.run(()->service.simulate(b.f.tenant,invoice(),b.f.key()))).isInstanceOf(AuthException.class);
    }
    @Test void anotherTenantCannotReadCancelOrCompleteAnAttempt(){
        long id=create(invoice(),b.f.key());var other=new AuthenticatedUser(2L,"other@test.invalid",RoleCode.TENANT);
        assertThatThrownBy(()->b.f.run(()->transactions.own(other,id))).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->b.f.run(()->transactions.cancel(other,id))).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->b.f.run(()->transactions.outcome(other,id,"SUCCESS"))).isInstanceOf(AuthException.class);
        assertThat(state(id)).isEqualTo("PENDING");
    }
    @Test void managerOutsidePropertyCannotReadOrReconcileTransactions(){
        var s=audit.session("VNPAY","TEST");
        var manager=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
        assertThatThrownBy(()->transactions.managementHistory(manager,s.property(),0,20)).isInstanceOf(AuthException.class);
        b.f.db.sql("UPDATE gateway_sessions SET status='REVIEW_REQUIRED' WHERE merchant_reference=:ref").param("ref",s.reference()).update();
        long id=b.f.db.sql("SELECT id FROM gateway_sessions WHERE merchant_reference=:ref").param("ref",s.reference()).query(Long.class).single();
        var reconciliation=new PaymentReconciliationService(b.f.db,b.invoices,transactions);
        assertThatThrownBy(()->b.f.run(()->reconciliation.resolve(manager,id,new PaymentReconciliationService.Decision("NO_COLLECTION","Outside scope",null)))).isInstanceOf(AuthException.class);
    }
    @Test void vnpReturnNeverSettlesAndCancellationIsSeparateFromFailure(){
        var s=audit.session("VNPAY","PRODUCTION");
        assertThat(audit.gateways.vnpReturn(audit.vnp(s,true)).toString()).contains("verified=true","settledByReturn=false");
        assertThat(audit.payments(s)).isZero();audit.gateways.vnpIpn(audit.vnp(s,false));
        assertThat(audit.status(s)).isEqualTo("CANCELLED");assertThat(audit.payments(s)).isZero();
    }
    @Test void lateVerifiedSuccessRequiresManualReconciliation(){
        var s=audit.session("VNPAY","PRODUCTION");
        b.f.db.sql("UPDATE gateway_sessions SET expires_at=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 DAY) WHERE merchant_reference=:ref").param("ref",s.reference()).update();
        audit.gateways.vnpIpn(audit.vnp(s,true));assertThat(audit.status(s)).isEqualTo("REVIEW_REQUIRED");assertThat(audit.payments(s)).isZero();
        long id=b.f.db.sql("SELECT id FROM gateway_sessions WHERE merchant_reference=:ref").param("ref",s.reference()).query(Long.class).single();
        var reconciliation=new PaymentReconciliationService(b.f.db,b.invoices,transactions);
        b.f.run(()->reconciliation.resolve(b.f.owner,id,new PaymentReconciliationService.Decision("CONFIRM","Verified actual provider statement",BusinessTime.now())));
        assertThat(audit.status(s)).isEqualTo("SUCCEEDED");assertThat(audit.payments(s)).isOne();
        assertThatThrownBy(()->b.f.run(()->reconciliation.resolve(b.f.owner,id,new PaymentReconciliationService.Decision("CONFIRM","Duplicate decision",BusinessTime.now())))).isInstanceOf(AuthException.class);
        assertThat(audit.payments(s)).isOne();
    }
    @Test void notificationProviderFailureCannotRollbackConfirmedReceipt(){
        long invoice=invoice();long property=((Number)b.row(invoice).get("property_id")).longValue();
        var communications=new CommunicationService(b.f.db);
        long rule=b.f.inTx(()->communications.saveRule(b.f.owner,null,new CommunicationService.Rule(property,"PAYMENT_CONFIRMED","TENANT",0,9,5,true,0)));
        b.f.db.sql("UPDATE communication_rules SET effective_from=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 2 MINUTE) WHERE id=:id").param("id",rule).update();
        for(String kind:List.of("EMAIL","ZALO"))b.f.db.sql("INSERT INTO integration_configs(owner_id,kind,provider,environment,enabled,settings,status) VALUES(1,:kind,:provider,'TEST',TRUE,'{}','CONFIGURED') ON DUPLICATE KEY UPDATE enabled=TRUE")
                .param("kind",kind).param("provider",kind.equals("EMAIL")?"SMTP":"ZBS").update();
        b.f.db.sql("INSERT INTO notification_preferences(user_id,email_enabled,zalo_enabled) VALUES(5,TRUE,TRUE) ON DUPLICATE KEY UPDATE email_enabled=TRUE,zalo_enabled=TRUE").update();
        b.pay(invoice,"1000");
        CommunicationSender broken=new CommunicationSender(){
            public boolean independentWorker(){return true;}
            public Result unavailableOrSend(String channel,String key,long user,String title,String body){throw new IllegalStateException("Simulated provider outage");}
            public Result send(long property,String channel,String key,long user,String title,String body){throw new IllegalStateException("Simulated provider outage");}
        };
        var jobs=new CommunicationJobs(b.f.db,communications,broken);
        b.f.run(()->jobs.scan(CommunicationService.now().plusSeconds(1)));
        var worker=new ExternalCommunicationWorker(b.f.db,jobs,broken,new org.springframework.jdbc.support.JdbcTransactionManager(b.f.dataSource));
        worker.runBatch(CommunicationService.now().plusSeconds(2));
        assertThat(b.row(invoice).get("status")).isEqualTo("PAID");assertThat(b.count("payments","invoice_id="+invoice)).isOne();
        assertThat(b.count("communication_deliveries","source_id="+invoice+" AND channel IN ('EMAIL','ZALO') AND status='UNKNOWN'")).isEqualTo(2);
    }
    @Test void ownedHistoryIsScopedAndExposesNoCredentialOrSigningMaterial(){
        long invoice=invoice();long id=create(invoice,b.f.key());
        assertThat(transactions.history(b.f.tenant,0,20).toString()).contains("SIMULATED").doesNotContain("checkout_signature","secret","TEST_SECRET");
        var other=new AuthenticatedUser(2L,"other@test.invalid",RoleCode.TENANT);
        assertThat(transactions.history(other,0,20).get("totalElements")).isEqualTo(0L);
        var owner=transactions.managementHistory(b.f.owner,null,0,100);
        assertThat(owner.toString()).contains("canReconcile=true");
        assertThat(state(id)).isEqualTo("PENDING");
    }
    @Test void vietQrAmountAndReferenceComeFromOwnedUnpaidInvoiceSession(){
        for(var entry:Map.<String,Object>of("bankTransferEnabled",true,"qrEnabled",true,"bankBin","970436","bankName","VCB","accountNumber","TEST123","accountName","TEST ACCOUNT").entrySet())
            b.f.db.sql("INSERT INTO system_settings(owner_id,setting_group,setting_key,setting_value,value_type) VALUES(1,'payments',:key,:value,:type) ON DUPLICATE KEY UPDATE setting_value=:value,value_type=:type")
                    .param("key",entry.getKey()).param("value",entry.getValue().toString()).param("type",entry.getValue() instanceof Boolean?"BOOLEAN":"STRING").update();
        long invoice=invoice();var tenant=new com.thangit.boardinghouse.service.impl.TenantInvoiceServiceImpl(new com.thangit.boardinghouse.repository.TenantInvoiceRepository(b.f.db));
        var session=b.f.inTx(()->tenant.createPaymentSession(b.f.tenant,invoice,b.f.key(),new com.thangit.boardinghouse.dto.request.invoice.TenantInvoiceRequests.CreatePaymentSession(new BigDecimal("1000"),"BANK_TRANSFER")));
        var bank=new BankTransferService(b.f.db,environment);
        var qr=b.f.inTx(()->bank.qr(b.f.tenant,invoice,session.id()));
        assertThat(qr.get("available")).isEqualTo(true);assertThat(qr.get("amount").toString()).isEqualTo("1000.00");
        assertThat(session.transferContent()).isEqualTo(BankTransferService.reference(invoice));
        assertThat(qr.get("qrUrl").toString()).contains("amount=1000&addInfo="+session.transferContent());
        assertThatThrownBy(()->b.f.inTx(()->bank.qr(new AuthenticatedUser(2L,"other@test.invalid",RoleCode.TENANT),invoice,session.id()))).isInstanceOf(AuthException.class);
        assertThat(b.count("payments","invoice_id="+invoice)).isZero();
    }
    @Test void actualGatewayCannotBeCompletedThroughSimulatorEndpoint(){
        var session=audit.session("VNPAY","TEST");
        long id=b.f.db.sql("SELECT id FROM gateway_sessions WHERE merchant_reference=:ref").param("ref",session.reference()).query(Long.class).single();
        assertThatThrownBy(()->b.f.run(()->transactions.outcome(b.f.tenant,id,"SUCCESS"))).isInstanceOf(AuthException.class);
        assertThat(audit.status(session)).isEqualTo("PENDING");
    }
    @Test void momoPendingAndZeroReferenceCancellationsAreNotMistakenForSuccess(){
        for(int attempt=0;attempt<2;attempt++){
            var session=audit.session("MOMO","TEST");
            var fields=new HashMap<String,String>();fields.put("orderId",session.reference());fields.put("requestId",session.reference());
            fields.put("partnerCode","TEST-PARTNER");fields.put("amount","1000");fields.put("transId","0");fields.put("resultCode","1000");
            fields.put("signature",com.thangit.boardinghouse.service.integration.GatewayPayments.hmac("HmacSHA256",InvoicePaymentAuditMysqlTest.TEST_SECRET,com.thangit.boardinghouse.service.integration.GatewayPayments.momoCanonical(InvoicePaymentAuditMysqlTest.TEST_SECRET,fields)));
            assertThat(audit.gateways.momoIpn(fields)).isEqualTo("PENDING");
            fields.put("resultCode","1006");fields.put("signature",com.thangit.boardinghouse.service.integration.GatewayPayments.hmac("HmacSHA256",InvoicePaymentAuditMysqlTest.TEST_SECRET,com.thangit.boardinghouse.service.integration.GatewayPayments.momoCanonical(InvoicePaymentAuditMysqlTest.TEST_SECRET,fields)));
            assertThat(audit.gateways.momoIpn(fields)).isEqualTo("CANCELLED");assertThat(audit.gateways.momoIpn(fields)).isEqualTo("DUPLICATE");
            assertThat(audit.payments(session)).isZero();
        }
    }
    @Test void manualNoCollectionDecisionIsNotReopenedByWebhookReplay(){
        var session=audit.session("VNPAY","PRODUCTION");
        b.f.db.sql("UPDATE gateway_sessions SET expires_at=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 DAY) WHERE merchant_reference=:ref").param("ref",session.reference()).update();
        var fields=audit.vnp(session,true);audit.gateways.vnpIpn(fields);
        long id=b.f.db.sql("SELECT id FROM gateway_sessions WHERE merchant_reference=:ref").param("ref",session.reference()).query(Long.class).single();
        var reconciliation=new PaymentReconciliationService(b.f.db,b.invoices,transactions);
        b.f.run(()->reconciliation.resolve(b.f.owner,id,new PaymentReconciliationService.Decision("NO_COLLECTION","Provider statement was reconciled externally",null)));
        audit.gateways.vnpIpn(fields);assertThat(audit.status(session)).isEqualTo("CANCELLED");assertThat(audit.payments(session)).isZero();
    }
    @Test void backendCreatesVnpaySandboxUrlAndReusesTheRequestKey(){
        var center=(com.thangit.boardinghouse.service.integration.IntegrationCenter)org.springframework.test.util.ReflectionTestUtils.getField(audit.gateways,"center");
        var original=center.config(1L,"PAYMENT");
        try{
            var config=new com.thangit.boardinghouse.service.integration.IntegrationCenter.Config(1L,"PAYMENT","VNPAY","TEST",true,
                    Map.of("vnpayEnabled",true,"tmnCode","TEST-MERCHANT","vnpayReturnUrl","https://test.invalid/tenant/payment-return"),"CONFIGURED",0);
            org.mockito.Mockito.when(center.config(1L,"PAYMENT")).thenReturn(config);
            long invoice=invoice();String key=b.f.key();
            var session=audit.gateways.create(b.f.tenant,invoice,"VNPAY",key,"127.0.0.1");
            assertThat(session.get("status")).isEqualTo("PENDING");
            assertThat(session.get("checkout_url").toString()).startsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?")
                    .contains("vnp_Amount=100000","vnp_SecureHash=");
            assertThat(audit.gateways.create(b.f.tenant,invoice,"VNPAY",key,"127.0.0.1").get("id")).isEqualTo(session.get("id"));
            assertThat(b.count("gateway_session_events","session_id="+session.get("id"))).isEqualTo(2);
            assertThat(b.count("payments","invoice_id="+invoice)).isZero();
        }finally{org.mockito.Mockito.when(center.config(1L,"PAYMENT")).thenReturn(original);}
    }
    @Test void momoCreateConnectionFailureIsAuditedAndNeverMarksInvoicePaid() throws Exception {
        var center=(com.thangit.boardinghouse.service.integration.IntegrationCenter)org.springframework.test.util.ReflectionTestUtils.getField(audit.gateways,"center");
        var original=center.config(1L,"PAYMENT");Object originalHttp=org.springframework.test.util.ReflectionTestUtils.getField(audit.gateways,"http");
        var http=org.mockito.Mockito.mock(java.net.http.HttpClient.class);
        try{
            var config=new com.thangit.boardinghouse.service.integration.IntegrationCenter.Config(1L,"PAYMENT","MOMO","TEST",true,
                    Map.of("momoEnabled",true,"partnerCode","TEST-PARTNER","momoIpnUrl","https://test.invalid/api/gateways/momo/ipn","momoRedirectUrl","https://test.invalid/tenant/payment-return"),"CONFIGURED",0);
            org.mockito.Mockito.when(center.config(1L,"PAYMENT")).thenReturn(config);
            org.mockito.Mockito.doThrow(new java.io.IOException("Simulated connection failure"))
                    .when(http).send(org.mockito.ArgumentMatchers.any(java.net.http.HttpRequest.class),org.mockito.ArgumentMatchers.any(java.net.http.HttpResponse.BodyHandler.class));
            org.springframework.test.util.ReflectionTestUtils.setField(audit.gateways,"http",http);
            long invoice=invoice();var session=audit.gateways.create(b.f.tenant,invoice,"MOMO",b.f.key(),"127.0.0.1");
            assertThat(session.get("status")).isEqualTo("FAILED");
            assertThat(b.count("gateway_session_events","session_id="+session.get("id")+" AND result_code='GATEWAY_CREATE_FAILED'")).isOne();
            assertThat(b.count("payments","invoice_id="+invoice)).isZero();
            assertThat(b.row(invoice).get("status")).isEqualTo("ISSUED");
        }finally{
            org.springframework.test.util.ReflectionTestUtils.setField(audit.gateways,"http",originalHttp);
            org.mockito.Mockito.when(center.config(1L,"PAYMENT")).thenReturn(original);
        }
    }
    @Test void transferSessionExpiryUsesBusinessClockEvenWhenDatabaseSessionIsUtc(){
        long invoice=invoice();
        var repository=new com.thangit.boardinghouse.repository.TenantInvoiceRepository(b.f.db);
        var session=b.f.inTx(()->repository.createSession(invoice,5,new BigDecimal("1000"),"BANK_TRANSFER",b.f.key(),BankTransferService.reference(invoice)));
        b.f.db.sql("UPDATE tenant_payment_sessions SET expires_at=:expired WHERE id=:id").param("id",session.id()).param("expired",BusinessTime.now().minusMinutes(1)).update();
        b.f.run(()->{
            b.f.db.sql("SET time_zone='+00:00'").update();
            try{
                assertThat(repository.activeSession(5,invoice)).isEmpty();
                repository.expireUnsubmittedSessions(invoice);
                assertThat(b.f.db.sql("SELECT status FROM tenant_payment_sessions WHERE id=:id").param("id",session.id()).query(String.class).single()).isEqualTo("EXPIRED");
            }finally{b.f.db.sql("SET time_zone='SYSTEM'").update();}
        });
    }
}
