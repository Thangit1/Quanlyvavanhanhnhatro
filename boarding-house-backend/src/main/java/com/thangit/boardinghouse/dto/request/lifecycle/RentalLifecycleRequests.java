package com.thangit.boardinghouse.dto.request.lifecycle;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class RentalLifecycleRequests {
    private RentalLifecycleRequests() {}

    public record CreateBooking(
            @NotNull Long tenantProfileId,
            @NotNull Long roomId,
            @NotNull LocalDate reservationStart,
            @NotNull LocalDate reservationEnd,
            @NotNull @DecimalMin("0") BigDecimal depositAmount,
            @Size(max = 50) String source,
            @Size(max = 1000) String note) {}

    public record ChangeBookingStatus(
            @NotBlank @Pattern(regexp = "RESERVED|DEPOSITED|CANCELLED|EXPIRED") String status,
            @Size(max = 500) String reason,
            Long version) {}

    public record CreateContract(
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @NotNull @DecimalMin("0") BigDecimal depositAmount,
            @Min(1) int paymentDueDay,
            @Min(0) int noticePeriodDays) {}

    public record AssetSnapshot(
            Long roomAssetId,
            @NotBlank @Size(max = 150) String assetName,
            @Min(1) int quantity,
            @NotBlank @Pattern(regexp = "NEW|GOOD|FAIR|DAMAGED|MISSING") String conditionStatus,
            @Size(max = 500) String note) {}

    public record PrepareCheckin(
            @NotNull Long contractId,
            Long bookingId,
            @NotNull LocalDate scheduledDate,
            @Valid List<AssetSnapshot> assets,
            @Size(max = 1000) String note) {}

    public record CompleteCheckin(
            boolean identityVerified,
            boolean contractVerified,
            boolean depositVerified,
            @DecimalMin("0") BigDecimal electricityReading,
            @DecimalMin("0") BigDecimal waterReading,
            @Min(0) int keysCardsCount,
            @Size(max = 1000) String note,
            Long version) {}

    public record RequestCheckout(
            @NotNull Long contractId,
            @NotNull LocalDate requestedDate,
            @NotBlank @Size(max = 500) String reason) {}

    public record CheckoutCharge(
            @NotBlank @Pattern(regexp = "UTILITY|DAMAGE|CLEANING|PENALTY|OTHER") String chargeType,
            @NotBlank @Size(max = 255) String description,
            @NotNull @DecimalMin("0") BigDecimal amount) {}

    public record CompleteCheckout(
            @NotNull LocalDate actualDate,
            @DecimalMin("0") BigDecimal finalElectricityReading,
            @DecimalMin("0") BigDecimal finalWaterReading,
            @Valid List<CheckoutCharge> charges,
            @Size(max = 1000) String note,
            Long version) {}
}
