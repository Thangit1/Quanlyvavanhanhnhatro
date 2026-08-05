package com.thangit.boardinghouse.dto.request.invoice;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public final class TenantInvoiceRequests {
    private TenantInvoiceRequests() {}

    public record CreatePaymentSession(
            @DecimalMin(value = "1") BigDecimal amount,
            @NotBlank @Pattern(regexp = "CASH|BANK_TRANSFER") String paymentMethod) {}

    public record CreateReviewRequest(
            Long invoiceItemId,
            @NotBlank @Pattern(regexp = "WRONG_READING|WRONG_PRICE|WRONG_QUANTITY|MISSING_DISCOUNT|OTHER") String issueType,
            @NotBlank @Size(max = 1000) String description,
            @Size(max = 255) String expectedValue,
            @Size(max = 30) String contactPhone,
            @Size(max = 100) String preferredContactTime) {}
}
