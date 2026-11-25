package com.thangit.boardinghouse.dto.response.notification;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public final class TenantNotificationResponses {
    private TenantNotificationResponses() {}
    public record Page<T>(List<T> content,int page,int size,long totalElements,int totalPages,long unreadCount) {}
    public record Summary(long totalUnread,long requiresActionCount,long invoiceNotificationCount,
                          long maintenanceNotificationCount,long currentMonthNotificationCount) {}
    public record UnreadCount(long unreadCount) {}
    public record Place(String propertyName,String roomCode) {}
    public record Reference(String type,Long id) {}
    public record Action(String type,String label,boolean primary) {}
    public record Permissions(boolean canMarkRead,boolean canMarkUnread,boolean canArchive,
                              boolean canRestore,boolean canAcknowledge,boolean canOpenReference) {}
    public record NotificationRow(Long id,String notificationCode,String category,String severity,
                                  String title,String summary,LocalDateTime createdAt,boolean read,
                                  LocalDateTime readAt,boolean archived,boolean requiresAction,
                                  boolean requiresAcknowledgement,Place place,Reference reference,
                                  Action primaryAction,Permissions permissions) {}
    public record NotificationDetail(Long id,String notificationCode,String category,String severity,
                                     String title,String content,LocalDateTime createdAt,boolean read,
                                     LocalDateTime readAt,boolean archived,boolean requiresAction,
                                     boolean requiresAcknowledgement,LocalDateTime acknowledgedAt,
                                     LocalDateTime expiresAt,Place place,Reference reference,List<Action> actions,
                                     Permissions permissions,long version) {}
    public record ActionResult(Long id,boolean read,boolean archived,boolean acknowledged,long version) {}
    public record BulkResult(int affected) {}
    public record PreferenceData(boolean inApp,boolean email,List<String> availableChannels,
                                 Map<String,Boolean> categories,String digestMode,
                                 boolean quietHoursEnabled,LocalTime quietHoursStart,LocalTime quietHoursEnd,
                                 long version) {}
}
