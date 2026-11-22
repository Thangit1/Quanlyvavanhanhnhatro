package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verifyNoInteractions;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.notification.TenantNotificationResponses.Reference;
import com.thangit.boardinghouse.repository.TenantNotificationRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.TenantNotificationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantNotificationServiceImplTest {
    @Test void stalePreferencesCannotOverwriteChangesFromNewCenter(){
        org.mockito.Mockito.when(repository.preference(5)).thenReturn(java.util.Optional.of(new TenantNotificationRepository.PreferenceRow(true,false,null,"IMMEDIATE",false,null,null,2)));
        var p=new AuthenticatedUser(5L,"tenant@test.invalid",RoleCode.TENANT);
        var r=new com.thangit.boardinghouse.dto.request.notification.TenantNotificationRequests.Preferences(true,false,java.util.Map.of(),"IMMEDIATE",new com.thangit.boardinghouse.dto.request.notification.TenantNotificationRequests.QuietHours(false,null,null),1L);
        assertThrows(AuthException.class,()->service.preferences(p,r));
        org.mockito.Mockito.verify(repository,org.mockito.Mockito.never()).savePreference(org.mockito.ArgumentMatchers.anyLong(),org.mockito.ArgumentMatchers.anyBoolean(),org.mockito.ArgumentMatchers.anyBoolean(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyBoolean(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.anyLong());
    }
    @Mock TenantNotificationRepository repository;
    private TenantNotificationServiceImpl service;

    @BeforeEach void setUp(){service=new TenantNotificationServiceImpl(repository);}

    @Test void nonTenantCannotReadNotifications(){
        var owner=new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);
        assertThrows(AuthException.class,()->service.summary(owner));
        verifyNoInteractions(repository);
    }

    @Test void unreadActiveNotificationHasOnlyValidStateActions(){
        var permissions=TenantNotificationRepository.permissions(false,false,false,false,null);
        assertTrue(permissions.canMarkRead());
        assertTrue(permissions.canArchive());
        assertFalse(permissions.canMarkUnread());
        assertFalse(permissions.canRestore());
        assertFalse(permissions.canAcknowledge());
        assertFalse(permissions.canOpenReference());
    }

    @Test void archivedAcknowledgementNotificationExposesRestoreAndAcknowledge(){
        var permissions=TenantNotificationRepository.permissions(true,true,true,false,new Reference("INVOICE",9L));
        assertTrue(permissions.canMarkUnread());
        assertTrue(permissions.canRestore());
        assertTrue(permissions.canAcknowledge());
        assertTrue(permissions.canOpenReference());
        assertFalse(permissions.canArchive());
    }
}
