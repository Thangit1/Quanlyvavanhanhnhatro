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
