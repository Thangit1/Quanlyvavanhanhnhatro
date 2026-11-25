package com.thangit.boardinghouse.dto.response.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record DashboardResponse(
        List<PropertyOption> availableProperties,
        Summary summary,
        List<RoomStatus> roomStatusSummary,
        List<RevenuePoint> revenueHistory,
        List<RoomItem> roomMap,
        List<OverdueInvoice> overdueInvoices,
        List<ExpiringContract> expiringContracts,
        List<MaintenanceItem> maintenanceRequests,
        List<OperationalAlert> operationalAlerts,
        List<RecentActivity> recentActivities,
        List<AiInsight> aiInsights
) {
    public record PropertyOption(Long id, String name) {}
    public record Summary(long totalProperties, long totalRooms, long occupiedRooms, long vacantRooms,
                          long reservedRooms, long maintenanceRooms, BigDecimal occupancyRate,
                          BigDecimal currentRevenue, BigDecimal previousRevenue,
                          BigDecimal revenueChangePercent, BigDecimal outstandingDebt,
                          long expiringContracts, long openMaintenanceRequests) {}
    public record RoomStatus(String status, long count) {}
    public record RevenuePoint(String period, BigDecimal revenue, BigDecimal expense, BigDecimal outstandingDebt) {}
    public record RoomItem(Long id, String propertyName, String buildingName, String floorName, String roomCode,
                           String tenantName, String status, LocalDate contractEndDate,
                           BigDecimal outstandingDebt, boolean hasOpenMaintenance) {}
    public record OverdueInvoice(Long id, String code, String roomCode, String tenantName, String billingPeriod,
                                 BigDecimal remainingAmount, LocalDate dueDate, long overdueDays, String status) {}
    public record ExpiringContract(Long id, String code, String roomCode, String tenantName,
                                   LocalDate endDate, long daysRemaining, String status) {}
    public record MaintenanceItem(Long id, String code, String propertyName, String roomCode, String title,
                                  String issueType, String priority, String assigneeName,
                                  long waitingHours, String status) {}
    public record OperationalAlert(String code, String severity, String title, String description, String actionUrl) {}
    public record RecentActivity(Long id, String type, String description, String actorName,
                                 String targetUrl, LocalDateTime createdAt) {}
    public record AiInsight(String label, String content, BigDecimal confidence) {}
}
