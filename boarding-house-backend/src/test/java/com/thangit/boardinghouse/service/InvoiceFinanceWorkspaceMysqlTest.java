package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.*;
import com.thangit.boardinghouse.repository.TenantInvoiceRepository;
import com.thangit.boardinghouse.service.impl.TenantInvoiceServiceImpl;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named="invoices.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class InvoiceFinanceWorkspaceMysqlTest {
    final MonthlyBillingMysqlTest b=new MonthlyBillingMysqlTest();
    @BeforeAll void setup() throws Exception {b.setup();}
    SaveInvoice request(MonthlyBillingMysqlTest.Case c,LocalDate open,LocalDate due){var r=b.request(c,"ISSUE");return new SaveInvoice(r.roomId(),r.contractId(),r.billingPeriod(),r.periodStartDate(),r.periodEndDate(),r.issueDate(),due,r.additionalItems(),r.discountAmount(),r.includePreviousDebt(),r.note(),r.action(),r.version(),open);}
    @Test void futureOpeningBlocksOwnerAndTenantWithoutChangingDebt(){
        var c=b.active(false);long id=b.f.inTx(()->b.invoices.create(b.f.owner,request(c,LocalDate.now().plusDays(2),LocalDate.now().plusDays(5))).id());
        b.error("PAYMENT_WINDOW_NOT_OPEN",()->b.pay(id,"1000"));
        assertThat(b.count("payments","invoice_id="+id)).isZero();
        assertThat(b.invoices.detail(b.f.owner,id).permissions().canRecordPayment()).isFalse();
        assertThat(new TenantInvoiceServiceImpl(new TenantInvoiceRepository(b.f.db)).detail(b.f.tenant,id).permissions().canPay()).isFalse();
        assertThat(b.n(b.row(id).get("remaining_amount").toString())).isEqualByComparingTo("1000");
    }
    @Test void overdueInvoiceStillAcceptsFullActualReceipt(){
        var c=b.active(false);long id=b.invoice(c,"ISSUE");
        b.f.db.sql("UPDATE invoices SET due_date=:due,payment_available_from=:open WHERE id=:id").param("id",id).param("due",LocalDate.now().minusDays(1)).param("open",LocalDate.now().minusDays(5)).update();
        assertThat(b.invoices.detail(b.f.owner,id).status()).isEqualTo("OVERDUE");b.pay(id,"1000");
        assertThat(b.row(id).get("status")).isEqualTo("PAID");
    }
    @Test void invalidWindowLeavesNoDraftOrItems(){var c=b.active(false);assertThatThrownBy(()->b.f.run(()->b.invoices.create(b.f.owner,request(c,LocalDate.now().plusDays(7),LocalDate.now().plusDays(5))))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);assertThat(b.count("invoices","contract_id="+c.contract())).isZero();}
    @Test void policyClampsMonthEndAndDoesNotRewriteExistingInvoice(){
        var c=b.active(false);long id=b.invoice(c,"ISSUE");Object original=b.row(id).get("payment_available_from");var policy=new InvoicePaymentPolicyService(b.f.db);
        b.f.run(()->policy.save(b.f.owner,new InvoicePaymentPolicyService.Save(c.property(),0,31,0,"Month end collection")));
        assertThat(InvoicePaymentPolicyService.resolve(b.f.db,c.property(),LocalDate.of(2026,2,1))).isEqualTo(LocalDate.of(2026,2,28));
        assertThat(InvoicePaymentPolicyService.resolve(b.f.db,c.property(),LocalDate.of(2028,2,1))).isEqualTo(LocalDate.of(2028,2,29));
        assertThat(b.row(id).get("payment_available_from")).isEqualTo(original);
        b.error("INVOICE_POLICY_VERSION_CONFLICT",()->b.f.run(()->policy.save(b.f.owner,new InvoicePaymentPolicyService.Save(c.property(),0,5,0,"Stale edit"))));
        assertThatThrownBy(()->b.f.run(()->policy.save(b.f.accountant,new InvoicePaymentPolicyService.Save(c.property(),1,5,0,"Unauthorized edit")))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
    }
    @Test void previewDoesNotCreateFinancialRows(){var c=b.active(false);var plan=b.invoices.preview(b.f.owner,b.request(c,"SAVE_DRAFT"));assertThat(plan.hash()).isNotBlank();assertThat(plan.items()).isNotEmpty();assertThat(b.count("invoices","contract_id="+c.contract())).isZero();}
    @Test void legacyNullOpeningPreservesHistoricalPaymentEligibility(){var c=b.active(false);long id=b.invoice(c,"ISSUE");b.f.db.sql("UPDATE invoices SET payment_available_from=NULL WHERE id=:id").param("id",id).update();b.pay(id,"1000");assertThat(b.row(id).get("status")).isEqualTo("PAID");assertThat(b.row(id).get("payment_available_from")).isNull();}
    @Test void accountantUiPermissionsMatchAssignedCapabilities(){var c=b.active(false);long id=b.invoice(c,"ISSUE");b.f.db.sql("UPDATE accountant_profiles SET can_record_payment=FALSE,can_create_adjustment=FALSE WHERE user_id=3").update();try{var permissions=b.invoices.detail(b.f.accountant,id).permissions();assertThat(permissions.canRecordPayment()).isFalse();assertThat(permissions.canAdjust()).isFalse();}finally{b.f.db.sql("UPDATE accountant_profiles SET can_record_payment=TRUE,can_create_adjustment=TRUE WHERE user_id=3").update();}}
    @Test void twoStaffCannotBothCollectTheFullBalance() throws Exception {
        var c=b.active(false);long id=b.invoice(c,"ISSUE");var latch=new java.util.concurrent.CountDownLatch(1);
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)){
            var accountant=new com.thangit.boardinghouse.service.impl.AccountantPortalServiceImpl(b.f.accounting);
            var first=pool.submit(()->{latch.await();try{b.pay(id,"1000");return true;}catch(RuntimeException expected){return false;}});
            var second=pool.submit(()->{latch.await();try{b.f.run(()->accountant.createPayment(b.f.accountant,b.f.key(),new com.thangit.boardinghouse.dto.request.accountant.AccountantRequests.PaymentCreate(id,b.n("1000"),"CASH",LocalDateTime.now().minusSeconds(1),null,"Verified actual receipt",true)));return true;}catch(RuntimeException expected){return false;}});
            latch.countDown();assertThat((first.get(20,java.util.concurrent.TimeUnit.SECONDS)?1:0)+(second.get(20,java.util.concurrent.TimeUnit.SECONDS)?1:0)).isEqualTo(1);
        }
        assertThat(b.count("payments","invoice_id="+id+" AND status='CONFIRMED'")).isOne();assertThat(b.n(b.row(id).get("paid_amount").toString())).isEqualByComparingTo("1000");
    }
    @Test void inAppReminderIsPersistedButEmailCannotClaimDelivery(){var c=b.active(false);long id=b.invoice(c,"ISSUE");long before=b.count("notifications","user_id=5");b.f.run(()->b.invoices.reminder(b.f.owner,id,new Reminder("IN_APP","Synthetic reminder")));assertThat(b.count("notifications","user_id=5")).isGreaterThan(before);assertThatThrownBy(()->b.f.run(()->b.invoices.reminder(b.f.owner,id,new Reminder("EMAIL","No sender")))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);}
    @Test void batchRejectsChangedSourceThenCreatesDraftExactlyOnce(){
        var c=b.active(false);var r=new BulkInvoice(c.property(),b.period.toString().substring(0,7),LocalDate.now(),LocalDate.now().plusDays(5),List.of(c.room()),"SAVE_DRAFT");
        var preview=b.batch.preview(b.f.owner,r).getFirst();assertThat(preview.contractId()).isEqualTo(c.contract());assertThat(preview.tenantName()).isNotEqualTo(preview.contractCode());assertThat(preview.items()).isNotEmpty();
        var stale=new BulkInvoice(r.propertyId(),r.billingPeriod(),r.issueDate(),r.dueDate(),r.roomIds(),r.action(),null,Map.of(c.contract(),"stale"));
        assertThat(b.batch.generate(b.f.owner,stale).created()).isEmpty();assertThat(b.count("invoices","contract_id="+c.contract())).isZero();
        var reviewed=new BulkInvoice(r.propertyId(),r.billingPeriod(),r.issueDate(),r.dueDate(),r.roomIds(),r.action(),null,Map.of(c.contract(),preview.calculationHash()));
        var created=b.batch.generate(b.f.owner,reviewed);assertThat(created.created()).hasSize(1);assertThat(b.row(created.created().getFirst().id()).get("status")).isEqualTo("DRAFT");
        assertThat(b.batch.generate(b.f.owner,reviewed).created()).isEmpty();assertThat(b.count("invoices","contract_id="+c.contract())).isOne();
    }
    @Test void printableInvoiceUsesRealItemsAndUtf8(){var c=b.active(false);long id=b.invoice(c,"ISSUE");String html=new String(b.invoices.print(b.f.owner,id),java.nio.charset.StandardCharsets.UTF_8);assertThat(html).contains("PHIẾU TÍNH TIỀN","Asia/Ho_Chi_Minh","1000","không phải hóa đơn điện tử thuế");}
    @Test void listDebtBreakdownAndExportShareScopeAndFilters(){
        var c=b.active(false);long id=b.invoice(c,"ISSUE");
        var page=b.invoices.list(b.f.owner,c.property(),null,null,c.room(),null,b.period.toString().substring(0,7),"OUTSTANDING",null,null,null,"debt",0,20);
        assertThat(page.content()).hasSize(1);assertThat(page.content().getFirst().breakdown().get("rent")).isEqualByComparingTo("1000");
        var summary=b.invoices.summary(b.f.owner,c.property(),null);assertThat(summary.totalInvoiceCount()).isEqualTo(1);assertThat(summary.debtTenantCount()).isEqualTo(1);
        var bytes=b.invoices.export(b.f.owner,c.property(),null,null,c.room(),null,null,"OUTSTANDING",null,null,null,"debt","xlsx");assertThat(bytes[0]).isEqualTo((byte)'P');assertThat(bytes[1]).isEqualTo((byte)'K');
        String excluded=new String(b.invoices.export(b.f.owner,c.property(),null,null,c.room(),"never-matches-invoice-code-xyz",null,null,null,null,null,"newest","csv"),java.nio.charset.StandardCharsets.UTF_8);assertThat(excluded).doesNotContain(b.invoices.detail(b.f.owner,id).invoiceCode());
        var other=new com.thangit.boardinghouse.security.AuthenticatedUser(2L,"other",com.thangit.boardinghouse.domain.auth.RoleCode.OWNER);
        assertThatThrownBy(()->b.invoices.print(other,id)).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
    }
}
