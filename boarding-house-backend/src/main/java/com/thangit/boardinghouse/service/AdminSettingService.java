package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.*;
import com.thangit.boardinghouse.dto.response.setting.AdminSettingResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;

public interface AdminSettingService {
    Overview overview(AuthenticatedUser principal);
    General general(AuthenticatedUser principal);
    General updateGeneral(AuthenticatedUser principal, UpdateGeneral request);
    GroupSettings group(AuthenticatedUser principal, String group);
    GroupSettings updateGroup(AuthenticatedUser principal, String group, UpdateGroup request);
    PropertySetting property(AuthenticatedUser principal, long propertyId);
    PropertySetting updateProperty(AuthenticatedUser principal, long propertyId, UpdateProperty request);
    Billing billing(AuthenticatedUser principal);
    Billing updateBilling(AuthenticatedUser principal, UpdateBilling request);
    Ai ai(AuthenticatedUser principal);
    Ai updateAi(AuthenticatedUser principal, UpdateAi request);
    ConnectionTest testAi(AuthenticatedUser principal);
    AuditPage auditLogs(AuthenticatedUser principal, String group, int page, int size);
}
