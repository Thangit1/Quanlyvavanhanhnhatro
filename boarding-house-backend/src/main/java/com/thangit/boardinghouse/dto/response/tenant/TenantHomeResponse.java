package com.thangit.boardinghouse.dto.response.tenant;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record TenantHomeResponse(
        TenantUser user,
        Rental rental,
        Contract contract,
        Invoice currentInvoice,
        UtilityUsage utilityUsage,
        List<MaintenanceRequest> recentMaintenanceRequests,
        List<Notification> recentNotifications,
        List<UtilityHistory> utilityHistory
) {
    public record TenantUser(Long id, String fullName, String avatarUrl, long unreadNotificationCount) {}
    public record Rental(String propertyName, String propertyAddress, String buildingName, String floorName,
                         Long roomId, String roomCode, BigDecimal area, int occupantCount,
                         BigDecimal monthlyRent, String roomImageUrl) {}
    public record Contract(Long id, String contractCode, LocalDate startDate, LocalDate endDate,
                           BigDecimal depositAmount, long daysRemaining, String status) {}
    public record Invoice(Long id, String code, String billingPeriod, BigDecimal totalAmount,
                          BigDecimal paidAmount, BigDecimal remainingAmount, LocalDate dueDate,
                          long daysUntilDue, String status, LocalDateTime paidAt) {}
    public record UtilityUsage(Utility electricity, Utility water) {}
    public record Utility(BigDecimal previousIndex, BigDecimal currentIndex, BigDecimal usage,
                          BigDecimal unitPrice, BigDecimal amount) {}
    public record MaintenanceRequest(Long id, String code, String title, String issueType, String priority,
                                     String status, String assigneeName, LocalDateTime createdAt) {}
    public record Notification(Long id, String title, String content, String type,
                               boolean read, LocalDateTime createdAt) {}
    public record UtilityHistory(String period, BigDecimal electricityUsage, BigDecimal waterUsage) {}
}
