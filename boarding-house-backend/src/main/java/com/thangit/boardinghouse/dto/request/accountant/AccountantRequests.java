package com.thangit.boardinghouse.dto.request.accountant;

import com.thangit.boardinghouse.common.validation.VietnamPhones;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;

public final class AccountantRequests {
    private AccountantRequests() {}

    public record PaymentCreate(
        @NotNull Long invoiceId,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotBlank @Pattern(regexp="CASH|BANK_TRANSFER|CARD|EWALLET") String paymentMethod,
        @NotNull LocalDateTime paidAt,
        @Size(max=100) String referenceCode,
        @Size(max=500) String note,
        boolean issueReceipt) {}
    public record Versioned(@PositiveOrZero long version) {}
    public record ProofDecision(@PositiveOrZero long version,@Size(max=500) String note,boolean issueReceipt) {}
    public record Reason(@NotBlank @Size(max=1000) String reason,@PositiveOrZero long version) {}
    public record Reminder(@NotBlank @Pattern(regexp="EMAIL|SMS|IN_APP") String channel,@NotBlank @Size(max=255) String recipient,@NotBlank @Size(max=1000) String message) {}
    public record PromiseCreate(@NotNull @DecimalMin("0.01") BigDecimal amount,@NotNull @FutureOrPresent LocalDate promisedDate,@Size(max=1000) String note) {}
    public record DepositTransaction(@NotBlank @Pattern(regexp="COLLECT|DEDUCT|REFUND") String type,@NotNull @DecimalMin("0.01") BigDecimal amount,@Size(max=1000) String reason,@Size(max=100) String referenceCode,@PositiveOrZero long version) {}
    public record VoucherCreate(@NotNull Long propertyId,@NotBlank @Size(max=200) String payeeName,@NotNull @DecimalMin("0.01") BigDecimal amount,@NotBlank @Pattern(regexp="REPAIR|MAINTENANCE|MATERIAL|UTILITIES|PAYROLL|OPERATING|OUTSOURCING|ASSET_PURCHASE|OTHER") String category,@NotBlank @Pattern(regexp="CASH|BANK_TRANSFER|CARD|EWALLET") String paymentMethod,@NotNull LocalDate voucherDate,@NotBlank @Size(max=1000) String description,@Positive Long expenseId) { public VoucherCreate(Long propertyId,String payeeName,BigDecimal amount,String category,String paymentMethod,LocalDate voucherDate,String description){this(propertyId,payeeName,amount,category,paymentMethod,voucherDate,description,null);} }
    public record OtherIncomeCreate(@NotNull Long propertyId,@NotBlank @Size(max=60) String category,@NotNull @DecimalMin("0.01") BigDecimal amount,@NotNull LocalDate incomeDate,@NotBlank @Size(max=1000) String description,@NotBlank @Pattern(regexp="CASH|BANK_TRANSFER|CARD|EWALLET") String paymentMethod,@Size(max=100) String referenceCode) { public OtherIncomeCreate(Long propertyId,String category,BigDecimal amount,LocalDate incomeDate,String description,String paymentMethod){this(propertyId,category,amount,incomeDate,description,paymentMethod,null);} }
    public record MatchCreate(@NotNull Long paymentId,@Size(max=500) String reason) {}
    public record PeriodAction(@PositiveOrZero long version,@Size(max=1000) String note) {}
    public record ProfileUpdate(@NotBlank @Email String email,@NotBlank @Size(max=150) String fullName,
                                @Pattern(regexp=VietnamPhones.OPTIONAL_REGEX,message=VietnamPhones.INVALID_MESSAGE) String phone) {}
    public record Preferences(boolean notifyPayment,boolean notifyOverdue,boolean notifyReconciliation,@PositiveOrZero long version) {}
}
