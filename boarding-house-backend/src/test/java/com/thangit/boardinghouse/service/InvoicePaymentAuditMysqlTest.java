package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.RecordPayment;
import com.thangit.boardinghouse.service.integration.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.support.JdbcTransactionManager;
import tools.jackson.databind.json.JsonMapper;

/** Signed callbacks are generated locally; never contacts a payment gateway or sends email. */
@EnabledIfSystemProperty(named="prompt11.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class InvoicePaymentAuditMysqlTest {
    final MonthlyBillingMysqlTest b=new MonthlyBillingMysqlTest();
    GatewayPayments gateways;
    CommunicationService communications;
    CommunicationJobs jobs;
    static final String TEST_SECRET="isolated-audit-test-signing-key";

    @BeforeAll void setup() throws Exception {
        if(Integer.getInteger("prompt03.mysql.port",0)==0||Integer.getInteger("prompt03.mysql.port",0)==3306)
            throw new IllegalStateException("An isolated non-3306 MySQL port is required");
        b.setup();
        for(var entry:Map.of(1,"OWNER",5,"TENANT").entrySet())
            b.f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE code=:role")
                    .param("id",entry.getKey()).param("role",entry.getValue()).update();
        var center=mock(IntegrationCenter.class);
        var vault=mock(IntegrationVault.class);
        var config=new IntegrationCenter.Config(1L,"PAYMENT","VNPAY","PRODUCTION",true,
                Map.of("tmnCode","TEST-MERCHANT","partnerCode","TEST-PARTNER"),"CONFIGURED",0);
        when(center.config(1L,"PAYMENT")).thenReturn(config);
        when(vault.read(eq(1L),eq("PAYMENT"),anyString())).thenReturn(TEST_SECRET);
        gateways=new GatewayPayments(b.f.db,center,vault,b.invoices,new JsonMapper(),new JdbcTransactionManager(b.f.dataSource));
        communications=new CommunicationService(b.f.db);
        jobs=new CommunicationJobs(b.f.db,communications,(channel,key,user,title,body)->{
            throw new AssertionError("External delivery is prohibited in audit tests");
        });
    }
    record Session(long invoice,long property,String reference,String provider,String environment){}
    Session session(String provider,String environment) {
        var c=b.active(false);long invoice=b.invoice(c,"ISSUE");
        String ref="AUDIT"+UUID.randomUUID().toString().replace("-","");
        b.f.db.sql("INSERT INTO gateway_sessions(invoice_id,owner_id,tenant_id,provider,environment,request_key,merchant_reference,amount,status,expires_at) VALUES(:invoice,1,5,:provider,:environment,:key,:reference,1000,'PENDING',:expires)")
                .param("invoice",invoice).param("provider",provider).param("environment",environment)
                .param("key",b.f.key()).param("reference",ref).param("expires",BusinessTime.now().plusMinutes(15)).update();
        return new Session(invoice,c.property(),ref,provider,environment);
    }
    Map<String,String> vnp(Session s,boolean success) {
        var fields=new HashMap<String,String>();
        fields.put("vnp_TxnRef",s.reference());fields.put("vnp_TmnCode","TEST-MERCHANT");
        fields.put("vnp_Amount","100000");fields.put("vnp_TransactionNo","TX"+s.reference());
        fields.put("vnp_ResponseCode",success?"00":"24");fields.put("vnp_TransactionStatus",success?"00":"02");
        sign(fields);return fields;
    }
    void sign(Map<String,String> fields){fields.put("vnp_SecureHash",GatewayPayments.hmac("HmacSHA512",TEST_SECRET,GatewayPayments.vnpCanonical(fields)));}
    String status(Session s){return b.f.db.sql("SELECT status FROM gateway_sessions WHERE merchant_reference=:ref").param("ref",s.reference()).query(String.class).single();}
    long payments(Session s){return b.count("payments","invoice_id="+s.invoice());}

    @Test void verifiedProductionCallbackCreditsExactlyOnceIncludingConcurrentReplay() throws Exception {
        var s=session("VNPAY","PRODUCTION");var fields=vnp(s,true);
        try(var pool=Executors.newFixedThreadPool(2)){
            var gate=new CountDownLatch(1);
            var first=pool.submit(()->{gate.await();return gateways.vnpIpn(fields);});
            var second=pool.submit(()->{gate.await();return gateways.vnpIpn(fields);});
            gate.countDown();first.get(30,TimeUnit.SECONDS);second.get(30,TimeUnit.SECONDS);
        }
        assertThat(status(s)).isEqualTo("SUCCEEDED");assertThat(payments(s)).isOne();
        assertThat(b.row(s.invoice()).get("status")).isEqualTo("PAID");
        assertThat(b.count("financial_receipts","payment_id IN (SELECT id FROM payments WHERE invoice_id="+s.invoice()+")")).isOne();
        assertThat(b.f.db.sql("SELECT SUM(amount) FROM payments WHERE invoice_id=:id AND status='CONFIRMED'").param("id",s.invoice()).query(BigDecimal.class).single()).isEqualByComparingTo("1000");
        assertThat(gateways.vnpIpn(fields).toString()).contains("DUPLICATE");
        assertThat(payments(s)).isOne();
    }
    @Test void wrongSignatureOrAmountCannotAffectInvoiceOrRevenue(){
        var s=session("VNPAY","PRODUCTION");var wrong=vnp(s,true);wrong.put("vnp_SecureHash","invalid");
        assertThat(gateways.vnpIpn(wrong).toString()).contains("97");
        wrong=vnp(s,true);wrong.put("vnp_Amount","90000");sign(wrong);
        assertThat(gateways.vnpIpn(wrong).toString()).contains("04");
        assertThat(payments(s)).isZero();assertThat(status(s)).isEqualTo("PENDING");
        assertThat(b.row(s.invoice()).get("remaining_amount").toString()).isEqualTo("1000.00");
    }
    @Test void sandboxSuccessIsLabelledAndNeverBecomesCollectedRevenue(){
        var s=session("VNPAY","TEST");gateways.vnpIpn(vnp(s,true));
        assertThat(status(s)).isEqualTo("TEST_SUCCEEDED");assertThat(payments(s)).isZero();
        assertThat(b.row(s.invoice()).get("status")).isEqualTo("ISSUED");
    }
    @Test void verifiedMomoCallbackAndDuplicateCreditOnlyOnce(){
        var s=session("MOMO","PRODUCTION");var fields=new HashMap<String,String>();
        fields.put("orderId",s.reference());fields.put("requestId",s.reference());fields.put("partnerCode","TEST-PARTNER");
        fields.put("amount","1000");fields.put("transId","MM"+s.reference());fields.put("resultCode","0");
        fields.put("signature",GatewayPayments.hmac("HmacSHA256",TEST_SECRET,GatewayPayments.momoCanonical(TEST_SECRET,fields)));
        assertThat(gateways.momoIpn(fields)).isEqualTo("SUCCEEDED");
        assertThat(gateways.momoIpn(fields)).isEqualTo("DUPLICATE");assertThat(payments(s)).isOne();
        fields.put("amount","999");assertThatThrownBy(()->gateways.momoIpn(fields)).isInstanceOf(AuthException.class);
    }
    @Test void reviewRequiredCannotBeAutomaticallyCreditedByARepeatedCallback(){
        var s=session("VNPAY","PRODUCTION");
        b.f.db.sql("UPDATE invoices SET total_amount=900,remaining_amount=900 WHERE id=:id").param("id",s.invoice()).update();
        gateways.vnpIpn(vnp(s,true));assertThat(status(s)).isEqualTo("REVIEW_REQUIRED");
        b.f.db.sql("UPDATE invoices SET total_amount=1000,remaining_amount=1000 WHERE id=:id").param("id",s.invoice()).update();
        assertThat(gateways.vnpIpn(vnp(s,true)).toString()).contains("DUPLICATE");assertThat(payments(s)).isZero();
    }
    @Test void failedCallbackIsIdempotentAndPreparesOnlyOneCommittedFailureNotification(){
        var s=session("VNPAY","TEST");
        long rule=b.f.inTx(()->communications.saveRule(b.f.owner,null,new CommunicationService.Rule(s.property(),"PAYMENT_FAILED","TENANT",0,9,5,true,0)));
        var fields=vnp(s,false);gateways.vnpIpn(fields);
        Object completed=b.f.db.sql("SELECT completed_at FROM gateway_sessions WHERE merchant_reference=:ref").param("ref",s.reference()).query(java.sql.Timestamp.class).single();
        assertThat(gateways.vnpIpn(fields).toString()).contains("DUPLICATE");
        assertThat(b.f.db.sql("SELECT completed_at FROM gateway_sessions WHERE merchant_reference=:ref").param("ref",s.reference()).query(java.sql.Timestamp.class).single()).isEqualTo(completed);
        b.f.run(()->jobs.scan(CommunicationService.now()));b.f.run(()->jobs.scan(CommunicationService.now()));
        assertThat(b.count("communication_deliveries","rule_id="+rule)).isOne();
        assertThat(b.count("communication_deliveries","rule_id="+rule+" AND channel<>'IN_APP'")).isZero();
        assertThat(jobs.sourceBody(jobs.sources(s.property(),"PAYMENT_FAILED").getFirst())).contains("TEST","chưa được tất toán");
        assertThat(payments(s)).isZero();assertThat(b.row(s.invoice()).get("status")).isEqualTo("ISSUED");
    }
    @Test void rolledBackFailureHasNoObservableBusinessEvent(){
        var s=session("VNPAY","TEST");
        assertThatThrownBy(()->b.f.run(()->{
            b.f.db.sql("UPDATE gateway_sessions SET status='FAILED',completed_at=CURRENT_TIMESTAMP(6) WHERE merchant_reference=:ref").param("ref",s.reference()).update();
            throw new IllegalStateException("intentional test rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(jobs.sources(s.property(),"PAYMENT_FAILED")).isEmpty();
    }
    @Test void dueSoonAliasReusesExistingRuleIdentityAndThreeDayWindow(){
        var s=session("VNPAY","TEST");
        b.f.db.sql("UPDATE invoices SET due_date=:due WHERE id=:id").param("id",s.invoice()).param("due",BusinessTime.today().plusDays(3)).update();
        var request=new CommunicationService.Rule(s.property(),"INVOICE_DUE_SOON","TENANT",3,9,5,true,0);
        assertThat(request.eventType()).isEqualTo("INVOICE_BEFORE_DUE");
        long rule=b.f.inTx(()->communications.saveRule(b.f.owner,null,request));
        b.f.run(()->jobs.scan(CommunicationService.now()));b.f.run(()->jobs.scan(CommunicationService.now()));
        assertThat(b.count("communication_deliveries","rule_id="+rule)).isOne();
        assertThatThrownBy(()->b.f.run(()->communications.saveRule(b.f.owner,null,
                new CommunicationService.Rule(s.property(),"INVOICE_BEFORE_DUE","TENANT",3,9,5,true,0))))
                .isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
    }
    @Test void invalidReceiptNeverWritesPaymentAllocationOrReceipt(){
        var s=session("VNPAY","TEST");
        for(String amount:List.of("-1","0","1.001","1001")){
            assertThatThrownBy(()->b.f.run(()->b.invoices.payment(b.f.owner,s.invoice(),b.f.key(),
                    new RecordPayment(new BigDecimal(amount),"CASH",BusinessTime.now(),null,"Test",null))))
                    .isInstanceOf(AuthException.class);
        }
        assertThatThrownBy(()->b.f.run(()->b.invoices.payment(b.f.owner,s.invoice(),b.f.key(),
                new RecordPayment(new BigDecimal("1000"),"BANK_TRANSFER",BusinessTime.now(),null,"Not a bank reference",null))))
                .isInstanceOf(AuthException.class);
        assertThat(payments(s)).isZero();assertThat(b.count("financial_receipts","payment_id IN (SELECT id FROM payments WHERE invoice_id="+s.invoice()+")")).isZero();
    }
}
