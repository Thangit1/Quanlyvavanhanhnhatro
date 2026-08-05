package com.thangit.boardinghouse.service;

import static com.thangit.boardinghouse.dto.response.invoice.TenantInvoiceResponses.*;
import com.thangit.boardinghouse.dto.request.invoice.TenantInvoiceRequests.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.springframework.web.multipart.MultipartFile;

public interface TenantInvoiceService {
    Summary summary(AuthenticatedUser principal);
    Page<InvoiceRow> invoices(AuthenticatedUser principal,String status,String search,LocalDate from,LocalDate to,int page,int size,String sort);
    InvoiceDetail detail(AuthenticatedUser principal,long invoiceId);
    PaymentSession createPaymentSession(AuthenticatedUser principal,long invoiceId,String idempotencyKey,CreatePaymentSession request);
    Proof submitProof(AuthenticatedUser principal,long invoiceId,Long sessionId,BigDecimal amount,LocalDateTime transferredAt,
                      String bankName,String transactionReference,String note,MultipartFile file);
    CreatedReview createReview(AuthenticatedUser principal,long invoiceId,CreateReviewRequest request);
    Page<Payment> payments(AuthenticatedUser principal,int page,int size);
    PaymentDetail payment(AuthenticatedUser principal,long paymentId);
    DocumentFile invoiceDocument(AuthenticatedUser principal,long invoiceId);
    DocumentFile receiptDocument(AuthenticatedUser principal,long paymentId);
}
