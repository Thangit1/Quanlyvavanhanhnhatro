package com.thangit.boardinghouse.dto.response.maintenance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TenantMaintenanceResponses {
    private TenantMaintenanceResponses() {}
    public record Page<T>(List<T> content,int page,int size,long totalElements,int totalPages) {}
    public record Summary(long openRequestCount,long inProgressRequestCount,long needsTenantResponseCount,
                          long inspectionPendingCount,long resolvedThisMonthCount) {}
    public record Permissions(boolean canView,boolean canCancel,boolean canAddInformation,
        boolean canConfirmSchedule,boolean canRequestReschedule,boolean canSendMessage,
        boolean canProvideFeedback,boolean canReopen,boolean canUpload) {}
    public record RequestRow(long id,String requestCode,String title,String category,String priority,
        String propertyName,String roomCode,String areaCode,String status,LocalDateTime createdAt,
        LocalDateTime updatedAt,LocalDateTime scheduledAt,String technicianName,Long thumbnailAttachmentId,
        Permissions permissions,long version) {}
    public record Location(long propertyId,String propertyName,String propertyAddress,String buildingName,
        String floorName,long roomId,String roomCode,String areaCode,String areaName,long contractId,String contractCode) {}
    public record Asset(long id,String name,String conditionStatus) {}
    public record AvailableLocation(Location location,List<Asset> assets,String managerPhone) {}
    public record Attachment(long id,String attachmentType,String fileName,String mimeType,long fileSize,
        String caption,long uploadedBy,LocalDateTime createdAt,String downloadUrl) {}
    public record MessageItem(long id,long senderId,String senderName,boolean mine,String messageType,
        String content,LocalDateTime createdAt,LocalDateTime readAt) {}
    public record Timeline(long id,String action,String previousStatus,String newStatus,String description,
        String actorName,LocalDateTime createdAt) {}
    public record Schedule(long id,LocalDateTime scheduledStart,LocalDateTime scheduledEnd,int durationMinutes,
        boolean tenantPresenceRequired,String status,String tenantResponse,LocalDateTime responseAt) {}
    public record Technician(Long id,String fullName,String position) {}
    public record FeedbackInfo(String result,int rating,Integer staffAttitudeRating,Integer resolutionTimeRating,
        String comment,boolean assetWorking,LocalDateTime createdAt) {}
    public record TenantCost(BigDecimal amount,String responsibility,String approvalStatus) {}
    public record Detail(long id,String requestCode,String title,String description,String category,
        String tenantReportedPriority,String confirmedPriority,String status,boolean safetyRisk,
        boolean continuousIssue,Boolean assetUsable,LocalDateTime detectedAt,LocalDateTime createdAt,
        LocalDateTime updatedAt,LocalDate preferredDate,String preferredTimeSlot,String contactPhone,
        String accessPreference,String accessNote,boolean petsPresent,Location location,Asset asset,
        Schedule schedule,Technician technician,List<Attachment> attachments,List<Timeline> publicTimeline,
        List<MessageItem> messages,String diagnosis,String resolution,FeedbackInfo feedback,TenantCost tenantCost,
        Permissions permissions,long version) {}
    public record Created(long id,String requestCode,String status) {}
    public record Uploaded(List<Attachment> attachments) {}
    public record ActionResult(long id,String status,long version) {}
    public record FileData(String fileName,String mimeType,byte[] content) {}
    public record AiAvailability(boolean available,String reason) {}
}
