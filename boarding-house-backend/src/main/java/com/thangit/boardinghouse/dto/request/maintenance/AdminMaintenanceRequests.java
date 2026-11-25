package com.thangit.boardinghouse.dto.request.maintenance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class AdminMaintenanceRequests {
    private AdminMaintenanceRequests() {}

    public record CreateRequest(
            @NotNull Long propertyId,
            Long roomId,
            Long assetId,
            Long reporterId,
            @NotBlank String source,
            @NotBlank String maintenanceType,
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 5000) String description,
            @NotBlank String category,
            @NotBlank String priority,
            boolean safetyRisk,
            LocalDateTime detectedAt,
            LocalDateTime preferredServiceTime,
            @DecimalMin("0") BigDecimal estimatedCost,
            String costResponsibility) {}

    public record TriageRequest(@NotBlank String category, @NotBlank String priority,
                                @NotNull @FutureOrPresent LocalDateTime slaDueAt,
                                boolean safetyRisk, @NotNull Long version) {}

    public record AssignRequest(@NotNull Long technicianId, @FutureOrPresent LocalDateTime plannedStart,
                                LocalDateTime plannedEnd, @Size(max = 1000) String note,
                                @NotNull Long version) {}

    public record ScheduleRequest(@NotNull @FutureOrPresent LocalDateTime scheduledStart,
                                  @NotNull LocalDateTime scheduledEnd,
                                  @Min(15) Integer estimatedDurationMinutes,
                                  boolean tenantPresenceRequired,
                                  @Size(max = 1000) String note,
                                  @NotNull Long version) {}

    public record WorkLogRequest(@NotBlank String actionType,
                                 @Min(0) @Max(100) int progressPercent,
                                 @Size(max = 5000) String diagnosis,
                                 @Size(max = 5000) String workPerformed,
                                 @Size(max = 5000) String note,
                                 LocalDateTime startedAt,
                                 LocalDateTime endedAt,
                                 @NotNull Long version) {}

    public record MaterialUsageRequest(Long materialId, @NotBlank String materialName,
                                       @Positive BigDecimal quantity, @NotBlank String unit,
                                       @DecimalMin("0") BigDecimal unitPrice,
                                       @NotNull Long version) {}

    public record CostRequest(@DecimalMin("0") BigDecimal laborCost,
                              @DecimalMin("0") BigDecimal materialCost,
                              @DecimalMin("0") BigDecimal externalServiceCost,
                              @DecimalMin("0") BigDecimal otherCost,
                              @NotBlank String responsibility,
                              @DecimalMin("0") BigDecimal tenantShareAmount,
                              @Size(max = 1000) String note,
                              @NotNull Long version) {}

    public record CompleteRequest(@NotBlank @Size(max = 5000) String diagnosis,
                                  @NotBlank @Size(max = 5000) String resolution,
                                  @NotNull Long version) {}

    public record InspectionRequest(@NotBlank String result, @Min(1) @Max(5) Integer rating,
                                    @Size(max = 1000) String comment, boolean assetWorking,
                                    boolean costConfirmed, @NotNull Long version) {}

    public record ReasonRequest(@NotBlank @Size(max = 1000) String reason, @NotNull Long version) {}

    public record PlanRequest(@NotNull Long propertyId, @NotBlank String name,
                              @NotBlank String assetCategory, @NotBlank String frequencyType,
                              @Positive int frequencyInterval, @NotNull LocalDate startDate,
                              LocalDate endDate, Long assigneeId, @Min(0) int reminderDaysBefore,
                              @DecimalMin("0") BigDecimal estimatedCost, boolean active) {}

    public record MaterialRequest(@NotNull Long propertyId, @NotBlank String code,
                                  @NotBlank String name, @NotBlank String unit,
                                  @DecimalMin("0") BigDecimal stockQuantity,
                                  @DecimalMin("0") BigDecimal minimumQuantity,
                                  @DecimalMin("0") BigDecimal unitPrice) {}
}
