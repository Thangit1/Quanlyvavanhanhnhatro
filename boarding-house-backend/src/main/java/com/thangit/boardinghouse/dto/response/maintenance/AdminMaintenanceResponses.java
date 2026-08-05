package com.thangit.boardinghouse.dto.response.maintenance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminMaintenanceResponses {
    private AdminMaintenanceResponses() {}

    public record Summary(long openRequests, long newRequests, long urgentRequests,
                          long unassignedRequests, long inProgressRequests, long overdueRequests,
                          long inspectionPendingRequests, BigDecimal monthlyCost,
                          BigDecimal averageResolutionHours, BigDecimal onTimeRate) {}

    public record Option(long id, String name, Long parentId, String detail) {}

    public record Options(List<Option> properties, List<Option> buildings, List<Option> floors,
                          List<Option> rooms, List<Option> assets, List<Option> technicians) {}

    public record RequestRow(long id, String requestCode, String title, String category,
                             String priority, String status, boolean safetyRisk,
                             Option property, Option room, Option reporter, Option assignee,
                             LocalDateTime createdAt, LocalDateTime scheduledStart,
                             LocalDateTime slaDueAt, long waitingHours, boolean overdue,
                             BigDecimal estimatedCost, BigDecimal actualCost,
                             int progressPercent, long version) {}

    public record Page<T>(List<T> content, long totalElements, int totalPages,
                          int page, int size) {}

    public record WorkLog(long id, String actionType, int progressPercent, String diagnosis,
                          String workPerformed, String note, LocalDateTime startedAt,
                          LocalDateTime endedAt, Option actor, LocalDateTime createdAt) {}

    public record MaterialUsage(long id, String name, BigDecimal quantity, String unit,
                                BigDecimal unitPrice, BigDecimal amount, String status,
                                LocalDateTime createdAt) {}

    public record Cost(long id, BigDecimal laborCost, BigDecimal materialCost,
                       BigDecimal externalServiceCost, BigDecimal otherCost,
                       BigDecimal totalCost, String responsibility,
                       BigDecimal tenantShareAmount, String approvalStatus,
                       String note, LocalDateTime createdAt) {}

    public record Inspection(long id, String result, Integer rating, String comment,
                             boolean assetWorking, boolean costConfirmed, Option inspector,
                             LocalDateTime inspectedAt) {}

    public record History(long id, String action, String previousStatus, String newStatus,
                          String description, Option actor, LocalDateTime createdAt) {}

    public record Schedule(long id, LocalDateTime start, LocalDateTime end,
                           int durationMinutes, boolean tenantPresenceRequired, String status) {}

    public record Permissions(boolean canTriage, boolean canAssign, boolean canSchedule,
                              boolean canStart, boolean canUpdateProgress, boolean canAddMaterial,
                              boolean canSubmitCost, boolean canApproveCost, boolean canComplete,
                              boolean canInspect, boolean canReopen, boolean canCancel) {}

    public record Detail(RequestRow request, String description, String source,
                         String maintenanceType, Option asset, LocalDateTime detectedAt,
                         LocalDateTime preferredServiceTime, String diagnosis, String resolution,
                         String costResponsibility, List<Schedule> schedules,
                         List<WorkLog> workLogs, List<MaterialUsage> materials,
                         List<Cost> costs, List<Inspection> inspections,
                         List<History> history, Permissions permissions) {}

    public record Created(long id, String requestCode, String status) {}

    public record CalendarItem(long id, String requestCode, String title, String priority,
                               String status, String propertyName, String roomCode,
                               String assigneeName, LocalDateTime start, LocalDateTime end) {}

    public record Plan(long id, long propertyId, String propertyName, String name,
                       String assetCategory, String frequencyType, int frequencyInterval,
                       LocalDate startDate, LocalDate endDate, Option assignee,
                       int reminderDaysBefore, BigDecimal estimatedCost,
                       String status, LocalDate nextRunDate) {}

    public record Material(long id, long propertyId, String propertyName, String code,
                           String name, String unit, BigDecimal stockQuantity,
                           BigDecimal minimumQuantity, BigDecimal unitPrice, String status) {}

    public record Report(BigDecimal totalCost, BigDecimal ownerCost, BigDecimal tenantCost,
                         long resolvedRequests, BigDecimal averageHours,
                         List<Option> topCategories) {}
}
