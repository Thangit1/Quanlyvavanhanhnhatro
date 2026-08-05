package com.thangit.boardinghouse.dto.response.setting;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public final class AdminSettingResponses {
    private AdminSettingResponses() {}

    public record Permissions(boolean canEditGeneral, boolean canEditBilling,
                              boolean canEditSecurity, boolean canManageIntegrations,
                              boolean canManageBackup, boolean canViewAuditLogs,
                              boolean canEditProperty) {}
    public record Overview(String systemName, String logoUrl, String defaultLanguage, String timezone,
                           String currency, Map<String, Boolean> configuredIntegrations,
                           Map<String, Boolean> security, LocalDateTime lastUpdatedAt,
                           String lastUpdatedBy, Permissions permissions, List<PropertyOption> properties) {}
    public record PropertyOption(Long id, String name) {}
    public record General(String systemName, String supportEmail, String supportPhone,
                          String defaultLanguage, String timezone, String currency,
                          String dateFormat, String timeFormat, String logoUrl) {}
    public record PropertySetting(Long propertyId, String propertyName, String propertyCode,
                                  String address, String managerName, String managerPhone,
                                  String managerEmail, String workingHours, int billingDay,
                                  int paymentDueDay, int meterReadingDay, int defaultMaximumOccupants,
                                  LocalTime quietHoursStart, LocalTime quietHoursEnd,
                                  boolean allowPets, boolean allowVisitors, String visitorRules,
                                  String vehicleRules, String houseRules, String emergencyContact) {}
    public record Billing(boolean autoGenerateInvoices, int invoiceGenerationDay, int defaultDueDay,
                          boolean allowPartialPayment, boolean carryForwardDebt,
                          boolean lateFeeEnabled, String lateFeeType, BigDecimal lateFeeValue,
                          List<Integer> reminderDaysBeforeDue, List<Integer> reminderDaysAfterDue,
                          boolean requireCancellationReason) {}
    public record AiFeatures(boolean tenantChatbot, boolean invoiceExplanation,
                             boolean contractExplanation, boolean maintenanceClassification,
                             boolean utilityAnomalyDetection) {}
    public record Ai(String provider, String model, boolean enabled, boolean configured,
                     String connectionStatus, AiFeatures features, int monthlyRequestLimit,
                     String responseLanguage, int requestTimeoutSeconds,
                     boolean storeConversationHistory, int historyRetentionDays,
                     boolean requireActionConfirmation) {}
    public record GroupSettings(String group, Map<String, Object> values, boolean editable) {}
    public record AuditLog(Long id, Long userId, String userName, String settingGroup,
                           String scopeType, Long scopeId, String action, String oldValue,
                           String newValue, String result, String ipAddress,
                           String userAgent, LocalDateTime createdAt) {}
    public record AuditPage(List<AuditLog> content, int page, int size,
                            long totalElements, int totalPages) {}
    public record ConnectionTest(boolean connected, String message) {}
}
