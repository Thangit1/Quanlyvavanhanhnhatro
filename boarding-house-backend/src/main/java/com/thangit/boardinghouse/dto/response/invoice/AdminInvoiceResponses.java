package com.thangit.boardinghouse.dto.response.invoice;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminInvoiceResponses {
    private AdminInvoiceResponses() {}
    public record Summary(BigDecimal totalInvoiceAmount,BigDecimal totalPaidAmount,BigDecimal totalOutstandingAmount,
            BigDecimal collectionRate,long draftInvoiceCount,long unpaidInvoiceCount,long partiallyPaidInvoiceCount,
            long paidInvoiceCount,long overdueInvoiceCount) {}
    public record Option(Long id,String label,Long parentId) {}
    public record InvoiceOptions(List<Option> properties,List<Option> buildings,List<Option> floors,List<Option> rooms,List<Option> contracts) {}
    public record Party(Long id,String name,String secondary) {}
    public record InvoiceRow(Long id,String invoiceCode,String billingPeriod,Party property,Party room,Party tenant,
            Party contract,LocalDate issueDate,LocalDate dueDate,BigDecimal totalAmount,BigDecimal paidAmount,
            BigDecimal remainingAmount,long overdueDays,String status,Party createdBy,boolean automated,
            boolean hasAdjustment,long version,LocalDateTime createdAt) {}
    public record Page<T>(List<T> content,int page,int size,long totalElements,int totalPages) {}
    public record Item(Long id,String itemType,String name,String description,BigDecimal quantity,String unit,
            BigDecimal unitPrice,BigDecimal amount,String sourceType,Long sourceId) {}
    public record Payment(Long id,String receiptCode,BigDecimal amount,String paymentMethod,String referenceCode,
            String note,String status,String receiverName,LocalDateTime paidAt) {}
    public record AdjustmentItem(Long id,String code,String type,BigDecimal amount,String reason,String status,
            String requesterName,LocalDateTime createdAt) {}
    public record NotificationItem(Long id,String channel,String recipient,String status,LocalDateTime sentAt,LocalDateTime createdAt) {}
    public record History(Long id,String action,String previousStatus,String newStatus,String reason,String actorName,LocalDateTime createdAt) {}
    public record Permissions(boolean canEdit,boolean canIssue,boolean canRecordPayment,boolean canSendReminder,
            boolean canAdjust,boolean canCancel,boolean canDownload,boolean canPrint) {}
    public record InvoiceDetail(Long id,String invoiceCode,String billingPeriod,LocalDate periodStartDate,
            LocalDate periodEndDate,LocalDate issueDate,LocalDate dueDate,String status,Party property,Party room,
            Party tenant,Party contract,List<Item> items,BigDecimal subtotalAmount,BigDecimal discountAmount,
            BigDecimal previousDebtAmount,BigDecimal lateFeeAmount,BigDecimal totalAmount,BigDecimal paidAmount,
            BigDecimal remainingAmount,String note,List<Payment> payments,List<AdjustmentItem> adjustments,
            List<NotificationItem> notifications,List<History> history,Permissions permissions,long version) {}
    public record CreateResult(Long id,String invoiceCode,String status) {}
    public record BulkPreviewRow(Long roomId,String roomCode,String tenantName,BigDecimal estimatedAmount,String status,String warning) {}
    public record BulkResult(List<CreateResult> created,List<BulkPreviewRow> skipped) {}
}
