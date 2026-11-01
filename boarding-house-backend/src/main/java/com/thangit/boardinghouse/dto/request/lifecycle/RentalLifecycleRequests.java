package com.thangit.boardinghouse.dto.request.lifecycle;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
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
            @NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal depositAmount,
            @Size(max = 50) String source,
            @Size(max = 1000) String note) {}

    public record ChangeBookingStatus(
            @NotBlank @Pattern(regexp = "RESERVED|DEPOSITED|CANCELLED|EXPIRED") String status,
            @Size(max = 500) String reason,
            Long version) {}
    public record ExtendBooking(@NotNull LocalDate reservationEnd,
            @NotBlank @Size(max=500) String reason,@NotNull Long version) {}

    public record CreateContract(
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal depositAmount,
            @Min(1) @Max(28) int paymentDueDay,
            @Min(0) int noticePeriodDays,
            @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal reservationTransferAmount,
            @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal monthlyRent,
            @Valid @Size(max=2) List<AgreedRate> utilityRates,
            @Valid @Size(max=30) List<AgreedService> services,
            @Valid @Size(max=30) List<AgreedTerm> terms,
            boolean initialPaymentRequired) {
        public CreateContract(LocalDate start,LocalDate end,BigDecimal deposit,int due,int notice) {this(start,end,deposit,due,notice,null,null,null,null,null,false);}
        public CreateContract(LocalDate start,LocalDate end,BigDecimal deposit,int due,int notice,BigDecimal transfer) {this(start,end,deposit,due,notice,transfer,null,null,null,null,false);}
    }
    public record AgreedRate(@NotBlank @Pattern(regexp="ELECTRICITY|WATER") String code,
            @NotBlank @Size(max=100) String name,@NotBlank @Pattern(regexp="METER|FIXED") String calculationMethod,
            @NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal unitPrice,@NotBlank @Size(max=30) String unit) {}
    public record AgreedService(@NotBlank @Size(max=30) String code,@NotBlank @Size(max=100) String name,
            @NotBlank @Pattern(regexp="FIXED|PER_PERSON") String calculationMethod,@NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal unitPrice) {}
    public record AgreedTerm(@NotBlank @Size(max=200) String title,@NotBlank @Size(max=5000) String content) {}

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
            Long version,boolean policyBasedMeters) {
        public CompleteCheckin(boolean identity,boolean contract,boolean deposit,BigDecimal electricity,BigDecimal water,int keys,String note,Long version){this(identity,contract,deposit,electricity,water,keys,note,version,false);}
        @jakarta.validation.constraints.AssertTrue(message="Cần chỉ số điện nước hoặc kiểm tra theo chính sách hợp đồng tại backend")
        public boolean isMeterRequestComplete(){return policyBasedMeters||(electricityReading!=null&&waterReading!=null);}
    }

    public record RequestCheckout(
            @NotNull Long contractId,
            @NotNull LocalDate requestedDate,
            @NotBlank @Size(max = 500) String reason) {}

    public record CheckoutCharge(
            @NotBlank @Pattern(regexp = "UTILITY|DAMAGE|CLEANING|PENALTY|OTHER") String chargeType,
            @NotBlank @Size(max = 255) String description,
            @NotNull @DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal amount) {}

    public record CompleteCheckout(
            @NotNull LocalDate actualDate,
            @DecimalMin("0") BigDecimal finalElectricityReading,
            @DecimalMin("0") BigDecimal finalWaterReading,
            @Valid List<CheckoutCharge> charges,
            @Size(max = 1000) String note,
            Long version) {}
}
