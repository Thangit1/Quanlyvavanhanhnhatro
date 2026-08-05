package com.thangit.boardinghouse.service;

import static com.thangit.boardinghouse.dto.request.notification.TenantNotificationRequests.*;
import static com.thangit.boardinghouse.dto.response.notification.TenantNotificationResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.List;

public interface TenantNotificationService {
    Summary summary(AuthenticatedUser p);
    UnreadCount unread(AuthenticatedUser p);
    List<NotificationRow> recent(AuthenticatedUser p,int limit);
    Page<NotificationRow> list(AuthenticatedUser p,String keyword,String category,String severity,String readStatus,
        Boolean requiresAction,boolean archived,LocalDate startDate,LocalDate endDate,String sort,int page,int size);
    NotificationDetail detail(AuthenticatedUser p,long id);
    ActionResult read(AuthenticatedUser p,long id);
    ActionResult unread(AuthenticatedUser p,long id);
    BulkResult markAllRead(AuthenticatedUser p);
    ActionResult archive(AuthenticatedUser p,long id);
    ActionResult restore(AuthenticatedUser p,long id);
    ActionResult acknowledge(AuthenticatedUser p,long id);
    BulkResult bulk(AuthenticatedUser p,BulkAction request);
    PreferenceData preferences(AuthenticatedUser p);
    PreferenceData preferences(AuthenticatedUser p,Preferences request);
}
