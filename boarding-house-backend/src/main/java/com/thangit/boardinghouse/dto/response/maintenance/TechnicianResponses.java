package com.thangit.boardinghouse.dto.response.maintenance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TechnicianResponses {
    private TechnicianResponses() {}

    public record Option(Long id, String code, String name, String detail) {}
    public record Technician(long id, String employeeCode, String fullName, String email,
                             String phone, String avatarUrl, String expertise, String workingArea,
                             String workSchedule, String workingStatus, long version) {}
    public record Summary(long todayTaskCount, long inProgressTaskCount, long urgentTaskCount,
                          long overdueTaskCount, long waitingPartsTaskCount,
                          long inspectionPendingCount, long completedThisMonthCount,
                          BigDecimal onTimeCompletionRate) {}
    public record Permissions(boolean canAccept, boolean canDecline, boolean canStartTravel,
                              boolean canCheckIn, boolean canStart, boolean canPause,
                              boolean canResume, boolean canUpdateProgress,
                              boolean canAddDiagnosis, boolean canRequestMaterial,
                              boolean canProposeCost, boolean canAddAttachment,
                              boolean canComplete, boolean canRequestTransfer) {}
    public record TaskRow(long id, String taskCode, String requestCode, String title,
                          String category, String priority, String taskType,
                          String assignmentRole, Option property, Option room, Option asset,
                          LocalDateTime scheduledStart, int estimatedDurationMinutes,
                          LocalDateTime slaDueAt, boolean overdue,
                          boolean tenantPresenceRequired, String status,
                          int progressPercent, long version, Permissions permissions) {}
    public record Page<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}
    public record Dashboard(Technician technician, Summary summary, TaskRow currentTask,
                            List<TaskRow> nextTasks, List<TaskRow> urgentTasks,
                            List<String> pendingActions, List<Notification> recentNotifications,
                            boolean aiAvailable) {}
    public record Contact(String fullName, String phone, String availableTime,
                          boolean tenantPresenceRequired, String accessNote, boolean petsPresent) {}
    public record Schedule(long id, LocalDateTime start, LocalDateTime end, int durationMinutes,
                           boolean tenantPresenceRequired, String status) {}
    public record Diagnosis(long id, String observedCondition, String symptoms,
                            String preliminaryCause, String rootCause, String damageLevel,
                            boolean assetUsable, boolean safetyRisk, boolean replacementRequired,
                            boolean supportRequired, boolean externalVendorRequired,
                            String recommendedSolution, LocalDateTime updatedAt) {}
    public record WorkLog(long id, String activityType, String description, String result,
                          int progressPercent, int durationMinutes, String note,
                          LocalDateTime createdAt) {}
    public record Checklist(long id, String label, boolean required, String result,
                            String note, int displayOrder) {}
    public record Material(long id, Long materialId, String code, String name, BigDecimal quantity,
                           String unit, BigDecimal unitPrice, BigDecimal amount, String status,
                           BigDecimal usedQuantity, BigDecimal returnedQuantity,
                           LocalDateTime createdAt) {}
    public record Cost(long id, BigDecimal laborCost, BigDecimal materialCost,
                       BigDecimal externalServiceCost, BigDecimal otherCost,
                       BigDecimal totalCost, String responsibility,
                       String approvalStatus, String note, LocalDateTime createdAt) {}
    public record Attachment(long id, String type, String name, String mimeType, long size,
                             String caption, String url, LocalDateTime createdAt) {}
    public record MessageRow(long id, String senderName, String senderRole, String content,
                             boolean internal, LocalDateTime createdAt) {}
    public record History(long id, String action, String previousStatus, String newStatus,
                          String description, LocalDateTime createdAt) {}
    public record Inspection(String result, Integer rating, String comment,
                             boolean assetWorking, boolean costConfirmed,
                             String inspectorName, LocalDateTime inspectedAt) {}
    public record TaskDetail(TaskRow task, String description, boolean safetyRisk,
                             Contact tenantContact, Schedule schedule, Diagnosis diagnosis,
                             List<Checklist> checklist, List<WorkLog> workLogs,
                             List<Material> materials, List<Cost> costs,
                             List<Attachment> attachments, List<MessageRow> messages,
                             Inspection inspection, List<History> history,
                             Permissions permissions) {}
    public record CalendarItem(long id, String taskCode, String title, String priority,
                               String status, String propertyName, String roomCode,
                               LocalDateTime start, LocalDateTime end) {}
    public record PreventivePlan(long id, String propertyName, String name, String assetCategory,
                                 String frequencyType, int frequencyInterval, LocalDate nextRunDate,
                                 String status, BigDecimal estimatedCost) {}
    public record Asset(long id, String assetCode, String name, String brand, String model,
                        String serialNumber, String condition, String propertyName,
                        String roomCode, LocalDate installedAt, LocalDate warrantyExpiry,
                        LocalDate lastMaintainedAt, long maintenanceCount) {}
    public record MaterialCatalog(long id, String code, String name, String unit,
                                  BigDecimal stockQuantity, BigDecimal minimumQuantity,
                                  BigDecimal unitPrice, String propertyName, String status) {}
    public record MaterialRequestRow(long id, String taskCode, String taskTitle, String urgency,
                                     String status, LocalDateTime neededAt, String note,
                                     LocalDateTime createdAt, List<Material> items, long version) {}
    public record Notification(long id, String title, String content, String type,
                               boolean read, LocalDateTime createdAt) {}
    public record Performance(long assignedTasks, long completedTasks, long onTimeTasks,
                              long overdueTasks, long firstPassTasks, long reopenedTasks,
                              BigDecimal averageResolutionHours, BigDecimal waitingPartsHours,
                              long urgentTasks, BigDecimal averageRating,
                              List<MetricPoint> trend, List<MetricPoint> categories) {}
    public record MetricPoint(String label, BigDecimal value) {}
    public record Account(Technician technician, BigDecimal costLimit,
                          boolean notifyAssignment, boolean notifySchedule,
                          boolean notifyUrgent, boolean notifyMaterial,
                          List<Session> sessions) {}
    public record Session(long id, String userAgent, String ipAddress,
                          LocalDateTime createdAt, LocalDateTime lastActiveAt, boolean active) {}
    public record ActionResult(long taskId, String status, long version, String message) {}
    public record FileData(String name, String mimeType, byte[] content) {}
}
