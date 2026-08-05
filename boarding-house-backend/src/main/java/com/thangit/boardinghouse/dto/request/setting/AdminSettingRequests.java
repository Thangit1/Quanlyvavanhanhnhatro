package com.thangit.boardinghouse.dto.request.setting;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public final class AdminSettingRequests {
    private AdminSettingRequests() {}

    public record UpdateGeneral(
            @NotBlank @Size(max = 150) String systemName,
            @Email @Size(max = 190) String supportEmail,
            @Pattern(regexp = "^$|^[0-9+() .-]{8,20}$") String supportPhone,
            @NotBlank String defaultLanguage,
            @NotBlank String timezone,
            @NotBlank String currency,
            @NotBlank String dateFormat,
            @NotBlank String timeFormat) {}

    public record UpdateProperty(
            @NotBlank @Size(max = 150) String propertyName,
            @Size(max = 150) String managerName,
            @Pattern(regexp = "^$|^[0-9+() .-]{8,20}$") String managerPhone,
            @Email @Size(max = 190) String managerEmail,
            @Size(max = 100) String workingHours,
            @Min(1) @Max(31) int billingDay,
            @Min(1) @Max(31) int paymentDueDay,
            @Min(1) @Max(31) int meterReadingDay,
            @Min(1) @Max(20) int defaultMaximumOccupants,
            LocalTime quietHoursStart,
            LocalTime quietHoursEnd,
            boolean allowPets,
            boolean allowVisitors,
            @Size(max = 5000) String visitorRules,
            @Size(max = 5000) String vehicleRules,
            @Size(max = 10000) String houseRules,
            @Size(max = 255) String emergencyContact) {}

    public record UpdateBilling(
            boolean autoGenerateInvoices,
            @Min(1) @Max(31) int invoiceGenerationDay,
            @Min(1) @Max(31) int defaultDueDay,
            boolean allowPartialPayment,
            boolean carryForwardDebt,
            boolean lateFeeEnabled,
            String lateFeeType,
            @PositiveOrZero BigDecimal lateFeeValue,
            List<@Min(0) @Max(90) Integer> reminderDaysBeforeDue,
            List<@Min(0) @Max(90) Integer> reminderDaysAfterDue,
            boolean requireCancellationReason) {}

    public record AiFeatures(boolean tenantChatbot, boolean invoiceExplanation,
                             boolean contractExplanation, boolean maintenanceClassification,
                             boolean utilityAnomalyDetection) {}

    public record UpdateAi(String provider, @Size(max = 100) String model, String apiKey,
                           boolean enabled, AiFeatures features,
                           @Min(0) @Max(10000000) int monthlyRequestLimit,
                           @NotBlank String responseLanguage,
                           @Min(5) @Max(300) int requestTimeoutSeconds,
                           boolean storeConversationHistory,
                           @Min(1) @Max(3650) int historyRetentionDays,
                           boolean requireActionConfirmation) {}

    public record UpdateGroup(Map<String, Object> values) {}
}
