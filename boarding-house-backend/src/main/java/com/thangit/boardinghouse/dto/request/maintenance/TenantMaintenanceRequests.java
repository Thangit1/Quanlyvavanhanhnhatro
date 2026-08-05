package com.thangit.boardinghouse.dto.request.maintenance;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;

public final class TenantMaintenanceRequests {
    private TenantMaintenanceRequests() {}
    public record PreferredSchedule(@NotNull LocalDate preferredDate,
                                    @NotBlank @Pattern(regexp="08:00-10:00|10:00-12:00|13:30-15:30|15:30-17:30|18:00-20:00") String timeSlot,
                                    boolean tenantPresenceRequired,
                                    @Pattern(regexp="ANYTIME|TENANT_PRESENT") String accessPreference,
                                    @Size(max=1000) String accessNote,boolean petsPresent) {}
    public record CreateRequest(@NotNull Long roomId,@NotBlank @Pattern(regexp="ROOM|BATHROOM|BALCONY|KITCHEN|HALLWAY|STAIRS|PARKING|GATE|COMMON_OTHER") String areaCode,
        Long assetId,@NotBlank @Size(min=5,max=200) String title,@NotBlank @Size(min=10,max=5000) String description,
        @NotBlank @Pattern(regexp="ELECTRICAL|WATER|INTERNET|AIR_CONDITIONER|WATER_HEATER|DOOR_LOCK|FURNITURE|APPLIANCE|STRUCTURE|LEAKAGE|SANITATION|SECURITY|FIRE_SAFETY|COMMON_AREA|ELEVATOR|OTHER") String category,
        @NotBlank @Pattern(regexp="LOW|MEDIUM|HIGH|URGENT") String reportedPriority,@NotNull LocalDateTime detectedAt,
        boolean safetyRisk,boolean continuousIssue,Boolean assetUsable,@Valid @NotNull PreferredSchedule preferredSchedule,
        @NotBlank @Pattern(regexp="^[0-9+() .-]{8,30}$") String contactPhone,@Size(max=1000) String note) {}
    public record AdditionalInformation(@NotBlank @Size(max=2000) String content,
        @Pattern(regexp="^[0-9+() .-]{8,30}$") String contactPhone,@NotNull Long version) {}
    public record Message(@NotBlank @Size(max=2000) String content) {}
    public record ScheduleResponse(@NotBlank @Pattern(regexp="CONFIRMED|REQUEST_RESCHEDULE") String response,
        LocalDateTime preferredStart,@Size(max=1000) String note,@NotNull Long version) {}
    public record Cancel(@NotBlank @Pattern(regexp="SELF_RESOLVED|WRONG_REQUEST|NO_LONGER_NEEDED|RESOLVED_OTHER_WAY|OTHER") String reason,
        @Size(max=1000) String note,@NotNull Long version) {}
    public record Feedback(@NotBlank @Pattern(regexp="PASSED|PARTIALLY_RESOLVED|FAILED") String result,
        @Min(1) @Max(5) int rating,@Min(1) @Max(5) Integer staffAttitudeRating,
        @Min(1) @Max(5) Integer resolutionTimeRating,@Size(max=2000) String comment,
        boolean assetWorking,@NotNull Long version) {}
    public record Reopen(@NotBlank @Size(min=10,max=1000) String reason,LocalDateTime recurringAt,
        @NotBlank @Pattern(regexp="LOW|MEDIUM|HIGH|URGENT") String currentPriority,
        LocalDateTime preferredServiceTime,@NotNull Long version) {}
}
