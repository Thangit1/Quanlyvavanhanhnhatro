package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.accountant.AccountantRequests.*;
import com.thangit.boardinghouse.repository.AccountantPortalRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AccountantPortalServiceImpl;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AccountantPortalServiceImplTest {
    @Mock AccountantPortalRepository repository;
    private AccountantPortalServiceImpl service;
    private final AuthenticatedUser accountant=new AuthenticatedUser(5L,"accountant@example.com",RoleCode.ACCOUNTANT);

    @BeforeEach void setUp(){service=new AccountantPortalServiceImpl(repository);lenient().when(repository.profileExists(5L)).thenReturn(true);lenient().when(repository.allowPartial(anyLong())).thenReturn(true);}

    @Test void ownerCannotUseDedicatedAccountantPortal(){
        AuthException error=assertThrows(AuthException.class,()->service.dashboard(new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER),null,"2026-08"));
        assertEquals("ACCOUNTANT_ACCESS_DENIED",error.code());
    }

    @Test void propertyOutsideAssignmentIsRejected(){
        when(repository.canAccess(5L,91L)).thenReturn(false);
        AuthException error=assertThrows(AuthException.class,()->service.invoices(accountant,91L,"2026-08",null,null,0,20));
        assertEquals("ACCOUNTANT_PROPERTY_DENIED",error.code());
    }

    @Test void paymentCannotExceedCurrentInvoiceDebt(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey(5L,"pay-1")).thenReturn(Optional.empty());
        when(repository.invoice(5L,8L,true)).thenReturn(Optional.of(invoice("ISSUED",new BigDecimal("500000"))));
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("600000"),"BANK_TRANSFER",LocalDateTime.now(),"BANK-1",null,true);
        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-1",request));
        assertEquals("PAYMENT_EXCEEDS_DEBT",error.code());
        verify(repository,never()).createPayment(anyMap(),any(),anyLong(),anyString());
    }

    @Test void closedPeriodBlocksNewPayment(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey(5L,"pay-2")).thenReturn(Optional.empty());
        when(repository.invoice(5L,8L,true)).thenReturn(Optional.of(invoice("ISSUED",new BigDecimal("500000"))));
        when(repository.locked(eq(3L),any(LocalDate.class))).thenReturn(true);
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("100000"),"CASH",LocalDateTime.now(),null,null,false);
        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-2",request));
        assertEquals("ACCOUNTING_PERIOD_CLOSED",error.code());
    }

    @Test void cashPaymentCreatesAllocationReceiptAuditAndNotification(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey(5L,"cash-1")).thenReturn(Optional.empty());
        Map<String,Object> invoice=invoice("ISSUED",new BigDecimal("500000"));
        when(repository.invoice(5L,8L,true)).thenReturn(Optional.of(invoice));
        when(repository.createPayment(eq(invoice),any(PaymentCreate.class),eq(5L),eq("cash-1"))).thenReturn(44L);
        when(repository.applyPayment(8L,new BigDecimal("500000"),2L)).thenReturn(1);
        when(repository.receipt(44L,invoice,new BigDecimal("500000"),5L,"Thu tại quầy")).thenReturn(70L);
        when(repository.payment(5L,44L,false)).thenReturn(Optional.of(Map.of("id",44L,"status","CONFIRMED")));
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("500000"),"CASH",LocalDateTime.of(2026,8,15,10,30),null,"Thu tại quầy",true);

        Map<String,Object> result=service.createPayment(accountant,"cash-1",request);

        assertEquals(44L,result.get("id"));
        assertEquals(70L,result.get("receiptId"));
        verify(repository).allocation(44L,8L,new BigDecimal("500000"));
        verify(repository).audit(3L,5L,"PAYMENT",44L,"CONFIRMED","Phân bổ vào hóa đơn HD-8");
        verify(repository).notifyPayment(eq(12L),anyString(),contains("HD-8"));
    }

    @Test void repeatedIdempotencyKeyReturnsOriginalPaymentWithoutApplyingAgain(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        LocalDateTime paidAt=LocalDateTime.of(2026,8,15,10,30);
        Map<String,Object> original=payment(8L,new BigDecimal("100000"),"CASH",paidAt,null,null);
        when(repository.paymentByKey(5L,"pay-repeat")).thenReturn(Optional.of(original));
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("100000"),"CASH",paidAt,null,null,false);

        assertSame(original,service.createPayment(accountant,"pay-repeat",request));
        verify(repository,never()).invoice(anyLong(),anyLong(),anyBoolean());
        verify(repository,never()).applyPayment(anyLong(),any(),anyLong());
    }

    @Test void idempotencyKeyCannotBeReusedForAnotherInvoice(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey(5L,"pay-reused")).thenReturn(Optional.of(Map.of("id",44L,"invoice_id",9L)));
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("100000"),"CASH",LocalDateTime.now(),null,null,false);

        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-reused",request));
        assertEquals("IDEMPOTENCY_KEY_REUSED",error.code());
        verify(repository,never()).applyPayment(anyLong(),any(),anyLong());
    }

    @Test void idempotencyKeyCannotBeReusedWithDifferentAmountOnSameInvoice(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        LocalDateTime paidAt=LocalDateTime.of(2026,8,15,10,30);
        when(repository.paymentByKey(5L,"pay-reused-payload")).thenReturn(Optional.of(payment(8L,new BigDecimal("100000"),"CASH",paidAt,null,null)));
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("200000"),"CASH",paidAt,null,null,false);

        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-reused-payload",request));
        assertEquals("IDEMPOTENCY_KEY_REUSED",error.code());
        verify(repository,never()).applyPayment(anyLong(),any(),anyLong());
    }

    @Test void idempotencyKeyCannotChangeReceiptOption(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        LocalDateTime paidAt=LocalDateTime.of(2026,8,15,10,30);
        when(repository.paymentByKey(5L,"pay-receipt-option")).thenReturn(Optional.of(payment(8L,new BigDecimal("100000"),"CASH",paidAt,null,null)));
        when(repository.hasReceipt(44L)).thenReturn(false);
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("100000"),"CASH",paidAt,null,null,true);

        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-receipt-option",request));

        assertEquals("IDEMPOTENCY_KEY_REUSED",error.code());
    }

    @Test void duplicateBankReferenceIsRejectedBeforeInsert(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey(5L,"pay-reference")).thenReturn(Optional.empty());
        when(repository.invoice(5L,8L,true)).thenReturn(Optional.of(invoice("ISSUED",new BigDecimal("500000"))));
        when(repository.paymentByReference(3L,"BANK_TRANSFER","BANK-DUP")).thenReturn(Optional.of(Map.of("id",55L)));
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("100000"),"BANK_TRANSFER",LocalDateTime.now(),"BANK-DUP",null,true);

        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-reference",request));
        assertEquals("PAYMENT_REFERENCE_DUPLICATE",error.code());
        verify(repository,never()).createPayment(anyMap(),any(),anyLong(),anyString());
    }

    @Test void cancelledInvoiceCannotReceivePayment(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey(5L,"pay-cancelled")).thenReturn(Optional.empty());
        when(repository.invoice(5L,8L,true)).thenReturn(Optional.of(invoice("CANCELLED",new BigDecimal("500000"))));
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("100000"),"CASH",LocalDateTime.now(),null,null,false);

        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-cancelled",request));
        assertEquals("INVOICE_NOT_PAYABLE",error.code());
    }

    @Test void partialPaymentFollowsOwnerPolicy(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey(5L,"partial-disabled")).thenReturn(Optional.empty());
        when(repository.invoice(5L,8L,true)).thenReturn(Optional.of(invoice("ISSUED",new BigDecimal("500000"))));
        when(repository.allowPartial(3L)).thenReturn(false);
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("100000"),"CASH",LocalDateTime.now(),null,null,false);

        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"partial-disabled",request));

        assertEquals("PARTIAL_PAYMENT_DISABLED",error.code());
        verify(repository,never()).createPayment(anyMap(),any(),anyLong(),anyString());
    }

    @Test void reversingPaymentRestoresInvoiceAndVoidsAllocationAndReceipt(){
        when(repository.permission(5L,"can_create_adjustment")).thenReturn(true);
        Map<String,Object> payment=new HashMap<>();payment.put("id",44L);payment.put("property_id",3L);
        payment.put("invoice_id",8L);payment.put("tenant_id",12L);payment.put("amount",new BigDecimal("200000"));payment.put("status","CONFIRMED");
        payment.put("paid_at",LocalDateTime.of(2026,8,15,10,30));payment.put("receipt_code","PT-44");
        when(repository.payment(5L,44L,true)).thenReturn(Optional.of(payment));
        when(repository.payment(5L,44L,false)).thenReturn(Optional.of(Map.of("id",44L,"status","REVERSED")));
        when(repository.reversePayment(44L,5L,"Sai giao dịch")).thenReturn(1);

        service.reversePayment(accountant,44L,new Reason("Sai giao dịch",0L));

        verify(repository).reverseAllocation(44L);
        verify(repository).reverseReceipt(44L);
        verify(repository).reverseInvoice(8L,new BigDecimal("200000"));
    }

    @Test void reversedPaymentCannotBeReversedAgain(){
        when(repository.permission(5L,"can_create_adjustment")).thenReturn(true);
        when(repository.payment(5L,44L,true)).thenReturn(Optional.of(Map.of("id",44L,"property_id",3L,"status","REVERSED")));

        AuthException error=assertThrows(AuthException.class,()->service.reversePayment(accountant,44L,new Reason("Lặp lại",0L)));
        assertEquals("PAYMENT_NOT_REVERSIBLE",error.code());
        verify(repository,never()).reverseInvoice(anyLong(),any());
    }

    @Test void rejectingProofDoesNotChangeInvoiceDebt(){
        when(repository.permission(5L,"can_review_proof")).thenReturn(true);
        Map<String,Object> proof=new HashMap<>();proof.put("id",71L);proof.put("property_id",3L);proof.put("tenant_id",12L);proof.put("status","PENDING");
        when(repository.proof(5L,71L,true)).thenReturn(Optional.of(proof));
        when(repository.rejectProof(71L,5L,"Không thấy tiền vào tài khoản")).thenReturn(1);
        when(repository.proof(5L,71L,false)).thenReturn(Optional.of(Map.of("id",71L,"status","REJECTED")));

        service.rejectProof(accountant,71L,new Reason("Không thấy tiền vào tài khoản",0L));

        verify(repository,never()).applyPayment(anyLong(),any(),anyLong());
        verify(repository,never()).reverseInvoice(anyLong(),any());
        verify(repository).notifyPayment(eq(12L),anyString(),contains("Không thấy tiền"));
    }

    @Test void alreadyApprovedProofCannotBeConfirmedAgain(){
        when(repository.permission(5L,"can_review_proof")).thenReturn(true);
        Map<String,Object> proof=new HashMap<>();proof.put("id",71L);proof.put("property_id",3L);proof.put("status","APPROVED");
        when(repository.proof(5L,71L,true)).thenReturn(Optional.of(proof));

        AuthException error=assertThrows(AuthException.class,()->service.approveProof(accountant,71L,"proof-key",new ProofDecision(0L,"Đã đối soát",true)));

        assertEquals("PROOF_ALREADY_REVIEWED",error.code());
        verify(repository,never()).createPayment(anyMap(),any(),anyLong(),anyString());
    }

    @Test void tenantCannotApproveOwnProof(){
        AuthenticatedUser tenant=new AuthenticatedUser(12L,"tenant@example.com",RoleCode.TENANT);

        AuthException error=assertThrows(AuthException.class,()->service.approveProof(tenant,71L,"proof-key",new ProofDecision(0L,"Tự duyệt",true)));

        assertEquals("ACCOUNTANT_ACCESS_DENIED",error.code());
        verify(repository,never()).approveProof(anyLong(),anyLong());
    }

    private Map<String,Object> invoice(String status,BigDecimal remaining){Map<String,Object> m=new HashMap<>();m.put("id",8L);m.put("property_id",3L);m.put("tenant_id",12L);m.put("code","HD-8");m.put("status",status);m.put("remaining_amount",remaining);m.put("version",2L);return m;}
    private Map<String,Object> payment(long invoiceId,BigDecimal amount,String method,LocalDateTime paidAt,String reference,String note){Map<String,Object> m=new HashMap<>();m.put("id",44L);m.put("invoice_id",invoiceId);m.put("amount",amount);m.put("payment_method",method);m.put("paid_at",paidAt);m.put("reference_code",reference);m.put("note",note);return m;}
}
