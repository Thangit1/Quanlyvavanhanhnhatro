package com.thangit.boardinghouse.service;

import static com.thangit.boardinghouse.dto.response.invoice.TenantInvoiceResponses.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.invoice.TenantInvoiceRequests.CreatePaymentSession;
import com.thangit.boardinghouse.repository.TenantInvoiceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.TenantInvoiceServiceImpl;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class TenantInvoicePaymentServiceImplTest {
    @Mock TenantInvoiceRepository repository;
    private TenantInvoiceServiceImpl service;
    private final AuthenticatedUser tenant=new AuthenticatedUser(12L,"tenant@example.com",RoleCode.TENANT);

    @BeforeEach void setUp(){service=new TenantInvoiceServiceImpl(repository);}

    @Test void sessionIdempotencyKeyWithDifferentPayloadIsRejected(){
        PaymentSession original=new PaymentSession(30L,8L,new BigDecimal("100000"),"BANK_TRANSFER","AWAITING_TRANSFER","HD-8",LocalDateTime.now().plusHours(1));
        when(repository.session(12L,"session-key")).thenReturn(Optional.of(original));
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));

        AuthException error=assertThrows(AuthException.class,()->service.createPaymentSession(tenant,8L,"session-key",new CreatePaymentSession(new BigDecimal("200000"),"BANK_TRANSFER")));

        assertEquals("IDEMPOTENCY_KEY_REUSED",error.code());
        verify(repository,never()).createSession(anyLong(),anyLong(),any(),anyString(),anyString(),any());
    }

    @Test void submittingProofOnlyCreatesPendingEvidenceAndDoesNotConfirmPayment(){
        LocalDateTime transferredAt=LocalDateTime.now().minusMinutes(10);
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        when(repository.createProof(isNull(),eq(8L),eq(12L),eq(new BigDecimal("500000")),eq(transferredAt),eq("VCB"),eq("TX-1"),anyString(),eq("image/png"),any(),isNull())).thenReturn(77L);
        Proof proof=new Proof(77L,new BigDecimal("500000"),transferredAt,"VCB","TX-1","proof.png","PENDING",null,LocalDateTime.now());
        when(repository.proofs(8L)).thenReturn(List.of(proof));
        MockMultipartFile file=png();

        Proof result=service.submitProof(tenant,8L,null,new BigDecimal("500000"),transferredAt,"VCB","TX-1",null,file);

        assertEquals("PENDING",result.status());
        verify(repository).createProof(isNull(),eq(8L),eq(12L),any(),any(),any(),any(),any(),any(),any(),any());
        verify(repository).history(8L,"PAYMENT_PROOF_SUBMITTED","ISSUED",12L);
    }

    @Test void aSessionCannotSubmitTwoPendingProofs(){
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        PaymentSession session=new PaymentSession(30L,8L,new BigDecimal("500000"),"BANK_TRANSFER","AWAITING_TRANSFER","HD-8",LocalDateTime.now().plusHours(1));
        when(repository.sessionById(12L,8L,30L)).thenReturn(Optional.of(session));
        when(repository.proofExistsForSession(30L)).thenReturn(true);

        AuthException error=assertThrows(AuthException.class,()->service.submitProof(tenant,8L,30L,new BigDecimal("500000"),LocalDateTime.now().minusMinutes(10),"VCB","TX-1",null,png()));

        assertEquals("PAYMENT_PROOF_DUPLICATE",error.code());
        verify(repository,never()).createProof(any(),anyLong(),anyLong(),any(),any(),any(),any(),any(),any(),any(),any());
    }

    @Test void tenantCannotRequestLessThanFullBalance(){
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        AuthException e=assertThrows(AuthException.class,()->service.createPaymentSession(tenant,8,"partial",new CreatePaymentSession(new BigDecimal("100000"),"BANK_TRANSFER")));
        assertEquals("PARTIAL_PAYMENT_DISABLED",e.code());
        verify(repository,never()).createSession(anyLong(),anyLong(),any(),anyString(),anyString(),any());
    }

    @Test void partialTransferProofDoesNotCreateEvidenceOrConfirmPayment(){
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        AuthException error=assertThrows(AuthException.class,()->service.submitProof(tenant,8L,null,
                new BigDecimal("100000"),LocalDateTime.now().minusMinutes(10),"VCB","SHORT",null,png()));
        assertEquals("PARTIAL_PAYMENT_DISABLED",error.code());
        verify(repository,never()).createProof(any(),anyLong(),anyLong(),any(),any(),any(),any(),any(),any(),any(),any());
    }

    @Test void missingAmountIsRejected(){
        assertEquals("PAYMENT_AMOUNT_INVALID",assertThrows(AuthException.class,()->service.createPaymentSession(tenant,8,"key",new CreatePaymentSession(null,"CASH"))).code());
    }
    @Test void oldKeyCannotReplayLegacyPartialPaymentInstructions(){
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        when(repository.session(12L,"legacy")).thenReturn(Optional.of(new PaymentSession(30L,8L,new BigDecimal("100000"),"CASH","AWAITING_TRANSFER",null,LocalDateTime.now().plusHours(1))));
        assertEquals("PAYMENT_SESSION_BALANCE_CHANGED",assertThrows(AuthException.class,()->service.createPaymentSession(tenant,8,"legacy",new CreatePaymentSession(new BigDecimal("100000"),"CASH"))).code());
    }

    @Test void activeSessionIsReusedWithNewKey(){
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        PaymentSession active=new PaymentSession(30L,8L,new BigDecimal("500000"),"BANK_TRANSFER","PROOF_SUBMITTED","HD-8",LocalDateTime.now().minusDays(1));
        when(repository.activeSession(12L,8L)).thenReturn(Optional.of(active));
        assertSame(active,service.createPaymentSession(tenant,8,"new-key",new CreatePaymentSession(new BigDecimal("500000"),"BANK_TRANSFER")));
        verify(repository,never()).createSession(anyLong(),anyLong(),any(),anyString(),anyString(),any());
    }

    @Test void cannotSwitchMethodWhileTransferAwaitsReconciliation(){
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        when(repository.activeSession(12L,8L)).thenReturn(Optional.of(new PaymentSession(30L,8L,new BigDecimal("500000"),"BANK_TRANSFER","PROOF_SUBMITTED","HD-8",LocalDateTime.now().plusHours(1))));
        assertEquals("PAYMENT_ALREADY_PENDING",assertThrows(AuthException.class,()->service.createPaymentSession(tenant,8,"cash-key",new CreatePaymentSession(new BigDecimal("500000"),"CASH"))).code());
    }

    @Test void overdueInvoiceStillAcceptsFullPaymentSession(){
        Map<String,Object> invoice=payableInvoice();invoice.put("due_date",LocalDate.now().minusDays(3));
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(invoice));
        when(repository.paymentSettings(1L)).thenReturn(Map.of("cashEnabled",true));
        PaymentSession created=new PaymentSession(31L,8L,new BigDecimal("500000"),"CASH","AWAITING_TRANSFER",null,LocalDateTime.now().plusHours(1));
        when(repository.createSession(8,12,new BigDecimal("500000"),"CASH","late",null)).thenReturn(created);
        assertSame(created,service.createPaymentSession(tenant,8,"late",new CreatePaymentSession(new BigDecimal("500000"),"CASH")));
    }

    @Test void anotherTenantsInvoiceCannotBeResumed(){
        assertEquals("TENANT_INVOICE_NOT_FOUND",assertThrows(AuthException.class,()->service.activePaymentSession(tenant,99)).code());
        verify(repository,never()).activeSession(anyLong(),anyLong());
    }

    @Test void paidInvoiceDoesNotExposeOldSession(){
        Map<String,Object> invoice=payableInvoice();invoice.put("remaining_amount",BigDecimal.ZERO);
        when(repository.invoice(12L,8L,false)).thenReturn(Optional.of(invoice));
        assertNull(service.activePaymentSession(tenant,8));
    }

    private Map<String,Object> payableInvoice(){Map<String,Object> invoice=new HashMap<>();invoice.put("id",8L);invoice.put("owner_id",1L);invoice.put("status","ISSUED");invoice.put("remaining_amount",new BigDecimal("500000"));invoice.put("due_date",LocalDate.now().plusDays(5));return invoice;}
    private MockMultipartFile png(){return new MockMultipartFile("file","proof.png","image/png",new byte[]{(byte)0x89,'P','N','G',13,10,26,10});}
}
