package com.thangit.boardinghouse.dto.request.maintenance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TechnicianRequests {
    private TechnicianRequests() {}

    public record Versioned(@PositiveOrZero long version) {}
    public record Reason(@PositiveOrZero long version, @NotBlank @Size(max=1000) String reason,
                         @Size(max=1000) String note) {}
    public record CheckIn(@PositiveOrZero long version, LocalDateTime checkedInAt,
                          @DecimalMin("-90") @DecimalMax("90") BigDecimal latitude,
                          @DecimalMin("-180") @DecimalMax("180") BigDecimal longitude,
                          @Size(max=1000) String note) {}
    public record Reschedule(@PositiveOrZero long version, @NotNull LocalDateTime proposedStart,
                             @NotBlank @Size(max=1000) String reason) {}
    public record WorkLog(@PositiveOrZero long version, @NotBlank @Size(max=30) String activityType,
                          @NotBlank @Size(max=2000) String description,
                          @Size(max=2000) String result,
                          @Min(0) @Max(100) int progressPercent,
                          @Min(1) @Max(1440) int durationMinutes,
                          @Size(max=1000) String note) {}
    public record Diagnosis(@PositiveOrZero long version,
                            @NotBlank @Size(max=2000) String observedCondition,
                            @Size(max=2000) String symptoms,
                            @Size(max=2000) String preliminaryCause,
                            @Size(max=2000) String rootCause,
                            @NotBlank @Pattern(regexp="LOW|MEDIUM|HIGH|CRITICAL") String damageLevel,
                            boolean assetUsable, boolean safetyRisk, boolean replacementRequired,
                            boolean supportRequired, boolean externalVendorRequired,
                            @NotBlank @Size(max=2000) String recommendedSolution) {}
    public record MaterialItem(Long materialId, @NotBlank @Size(max=150) String materialName,
                               @NotNull @DecimalMin("0.01") BigDecimal quantity,
                               @NotBlank @Size(max=30) String unit,
                               @NotBlank @Size(max=1000) String reason) {}
    public record MaterialRequest(@PositiveOrZero long version,
                                  @NotEmpty List<@Valid MaterialItem> items,
                                  LocalDateTime neededAt,
                                  @Pattern(regexp="LOW|MEDIUM|HIGH|URGENT") String urgency,
                                  @Size(max=1000) String note) {}
    public record MaterialUsage(@PositiveOrZero long version, @Positive long materialRequestItemId,
                                @NotNull @DecimalMin("0.0") BigDecimal usedQuantity,
                                @NotNull @DecimalMin("0.0") BigDecimal returnedQuantity,
                                @Size(max=1000) String note) {}
    public record CostItem(@NotBlank @Pattern(regexp="MATERIAL|LABOR|EXTERNAL_SERVICE|OTHER") String costType,
                           @NotBlank @Size(max=150) String name,
                           @NotNull @DecimalMin("0.01") BigDecimal quantity,
                           @NotNull @DecimalMin("0.0") BigDecimal unitPrice,
                           @NotBlank @Size(max=1000) String reason) {}
    public record CostProposal(@PositiveOrZero long version, @NotEmpty List<@Valid CostItem> items,
                               @NotBlank @Pattern(regexp="OWNER|TENANT|SHARED|PENDING_REVIEW") String proposedResponsibility,
                               @Size(max=1000) String note) {}
    public record ChecklistItem(@Positive long checklistItemId,
                                @NotBlank @Pattern(regexp="PASSED|FAILED|NOT_APPLICABLE") String result,
                                @Size(max=1000) String note) {}
    public record Checklist(@PositiveOrZero long version, @NotEmpty List<@Valid ChecklistItem> items) {}
    public record Complete(@PositiveOrZero long version, @NotBlank @Size(max=2000) String rootCause,
                           @NotBlank @Size(max=2000) String resolution,
                           LocalDateTime startedAt, LocalDateTime completedAt,
                           @NotBlank @Size(max=30) String assetConditionAfter,
                           @NotBlank @Size(max=2000) String testResult,
                           boolean followUpRequired, LocalDate followUpDate,
                           @Size(max=2000) String recommendation,
                           @Size(max=1000) String note) {}
    public record Message(@NotBlank @Size(max=2000) String content, boolean internal) {}
    public record ProfileUpdate(@Email @Size(max=255) String email,
                                @Pattern(regexp="^[0-9+ .()-]{8,20}$") String phone,
                                @PositiveOrZero long version) {}
    public record PreferenceUpdate(boolean notifyAssignment, boolean notifySchedule,
                                   boolean notifyUrgent, boolean notifyMaterial,
                                   @PositiveOrZero long version) {}
    public record PasswordChange(@NotBlank String currentPassword,
                                 @NotBlank @Size(min=10,max=72) String newPassword) {}
}
