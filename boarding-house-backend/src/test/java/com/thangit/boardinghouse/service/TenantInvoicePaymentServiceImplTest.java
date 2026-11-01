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

        AuthException error=assertThrows(AuthException.class,()->service.createPaymentSession(tenant,8L,"session-key",new CreatePaymentSession(new BigDecimal("200000"),"BANK_TRANSFER")));

        assertEquals("IDEMPOTENCY_KEY_REUSED",error.code());
        verify(repository,never()).invoice(anyLong(),anyLong(),anyBoolean());
    }

    @Test void submittingProofOnlyCreatesPendingEvidenceAndDoesNotConfirmPayment(){
        LocalDateTime transferredAt=LocalDateTime.now().minusMinutes(10);
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        when(repository.createProof(isNull(),eq(8L),eq(12L),eq(new BigDecimal("100000")),eq(transferredAt),eq("VCB"),eq("TX-1"),anyString(),eq("image/png"),any(),isNull())).thenReturn(77L);
        Proof proof=new Proof(77L,new BigDecimal("100000"),transferredAt,"VCB","TX-1","proof.png","PENDING",null,LocalDateTime.now());
        when(repository.proofs(8L)).thenReturn(List.of(proof));
        MockMultipartFile file=png();

        Proof result=service.submitProof(tenant,8L,null,new BigDecimal("100000"),transferredAt,"VCB","TX-1",null,file);

        assertEquals("PENDING",result.status());
        verify(repository).createProof(isNull(),eq(8L),eq(12L),any(),any(),any(),any(),any(),any(),any(),any());
        verify(repository).history(8L,"PAYMENT_PROOF_SUBMITTED","ISSUED",12L);
    }

    @Test void aSessionCannotSubmitTwoPendingProofs(){
        when(repository.invoice(12L,8L,true)).thenReturn(Optional.of(payableInvoice()));
        PaymentSession session=new PaymentSession(30L,8L,new BigDecimal("100000"),"BANK_TRANSFER","AWAITING_TRANSFER","HD-8",LocalDateTime.now().plusHours(1));
        when(repository.sessionById(12L,8L,30L)).thenReturn(Optional.of(session));
        when(repository.proofExistsForSession(30L)).thenReturn(true);

        AuthException error=assertThrows(AuthException.class,()->service.submitProof(tenant,8L,30L,new BigDecimal("100000"),LocalDateTime.now().minusMinutes(10),"VCB","TX-1",null,png()));

        assertEquals("PAYMENT_PROOF_DUPLICATE",error.code());
        verify(repository,never()).createProof(any(),anyLong(),anyLong(),any(),any(),any(),any(),any(),any(),any(),any());
    }

    private Map<String,Object> payableInvoice(){Map<String,Object> invoice=new HashMap<>();invoice.put("id",8L);invoice.put("status","ISSUED");invoice.put("remaining_amount",new BigDecimal("500000"));invoice.put("due_date",LocalDate.now().plusDays(5));return invoice;}
    private MockMultipartFile png(){return new MockMultipartFile("file","proof.png","image/png",new byte[]{(byte)0x89,'P','N','G',13,10,26,10});}
}
