package com.thangit.boardinghouse.dto.response.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TenantInvoiceResponses {
    private TenantInvoiceResponses() {}
    public record Page<T>(List<T> content,int page,int size,long totalElements,int totalPages) {}
    public record Summary(BigDecimal outstandingAmount,long overdueCount,long unpaidCount,Payment lastPayment) {}
    public record InvoiceRow(Long id,String invoiceCode,String billingPeriod,String propertyName,String roomCode,
            LocalDate issueDate,LocalDate dueDate,BigDecimal totalAmount,BigDecimal paidAmount,
            BigDecimal remainingAmount,long overdueDays,String status) {}
    public record Party(Long id,String name,String secondary) {}
    public record Item(Long id,String itemType,String name,String description,BigDecimal quantity,String unit,
            BigDecimal unitPrice,BigDecimal amount) {}
    public record UtilityReading(Long id,String type,BigDecimal previousValue,BigDecimal currentValue,
            BigDecimal consumption,BigDecimal unitPrice,BigDecimal amount) {}
    public record UtilityHistory(String billingPeriod,BigDecimal electricityConsumption,BigDecimal waterConsumption) {}
    public record Payment(Long id,String receiptCode,String invoiceCode,BigDecimal amount,String paymentMethod,
            String referenceCode,String status,LocalDateTime paidAt) {}
    public record Adjustment(Long id,String code,String type,BigDecimal amount,String reason,String status,LocalDateTime createdAt) {}
    public record Proof(Long id,BigDecimal amount,LocalDateTime transferredAt,String bankName,String transactionReference,
            String originalName,String status,String rejectionReason,LocalDateTime createdAt) {}
    public record Review(Long id,String requestCode,Long invoiceItemId,String issueType,String description,
            String expectedValue,String status,String managerResponse,LocalDateTime createdAt,LocalDateTime resolvedAt) {}
    public record PaymentMethod(String code,String label,String bankName,String accountName,String accountNumber,
            String bankBranch,String transferContent,boolean qrEnabled,boolean allowPartialPayment) {}
    public record Permissions(boolean canPay,boolean canRequestReview,boolean canDownload,boolean canPrint) {}
    public record InvoiceDetail(Long id,String invoiceCode,String billingPeriod,LocalDate periodStartDate,
            LocalDate periodEndDate,LocalDate issueDate,LocalDate dueDate,String status,Party property,Party room,
            Party contract,List<Item> items,List<UtilityReading> utilityReadings,List<UtilityHistory> utilityHistory,
            BigDecimal subtotalAmount,BigDecimal discountAmount,BigDecimal previousDebtAmount,
            BigDecimal lateFeeAmount,BigDecimal totalAmount,BigDecimal paidAmount,BigDecimal remainingAmount,
            List<Payment> payments,List<Adjustment> adjustments,List<Proof> paymentProofs,List<Review> reviewRequests,
            List<PaymentMethod> paymentMethods,Permissions permissions,long version) {}
    public record PaymentSession(Long id,Long invoiceId,BigDecimal amount,String paymentMethod,String status,
            String transferContent,LocalDateTime expiresAt) {}
    public record CreatedReview(Long id,String requestCode,String status) {}
    public record PaymentDetail(Payment payment,Party property,Party room) {}
    public record DocumentFile(String fileName,String contentType,byte[] content) {}
}
