package com.thangit.boardinghouse.dto.request.invoice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminInvoiceRequests {
    private AdminInvoiceRequests() {}
    public record AdditionalItem(@NotBlank @Size(max=150) String name,
            @NotNull @DecimalMin("0.001") BigDecimal quantity,@NotBlank @Size(max=30) String unit,
            @NotNull @DecimalMin("0.0") BigDecimal unitPrice,@NotBlank @Size(max=500) String reason) {}
    public record SaveInvoice(@NotNull Long roomId,@NotNull Long contractId,
            @NotBlank @Pattern(regexp="^\\d{4}-(0[1-9]|1[0-2])$") String billingPeriod,
            @NotNull LocalDate periodStartDate,@NotNull LocalDate periodEndDate,
            LocalDate issueDate,@NotNull LocalDate dueDate,@Valid List<AdditionalItem> additionalItems,
            @DecimalMin("0.0") BigDecimal discountAmount,boolean includePreviousDebt,
            @Size(max=1000) String note,@NotBlank @Pattern(regexp="SAVE_DRAFT|ISSUE") String action,Long version) {}
    public record BulkInvoice(@NotNull Long propertyId,
            @NotBlank @Pattern(regexp="^\\d{4}-(0[1-9]|1[0-2])$") String billingPeriod,
            @NotNull LocalDate issueDate,@NotNull LocalDate dueDate,List<Long> roomIds,
            @Pattern(regexp="SAVE_DRAFT|ISSUE") String action) {}
    public record RecordPayment(@NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank @Pattern(regexp="CASH|BANK_TRANSFER|CARD|OTHER") String paymentMethod,
            @NotNull LocalDateTime paidAt,@Size(max=100) String referenceCode,@Size(max=500) String note,Long version) {}
    public record CancelInvoice(@NotBlank @Size(max=500) String reason,Long version) {}
    public record Adjustment(@NotBlank @Pattern(regexp="INCREASE|DECREASE") String adjustmentType,
            @NotNull @DecimalMin("0.01") BigDecimal amount,@NotBlank @Size(max=500) String reason,Long version) {}
    public record Reminder(@NotBlank @Pattern(regexp="EMAIL|SMS|IN_APP|ZALO") String channel,
            @Size(max=1000) String message) {}
}
