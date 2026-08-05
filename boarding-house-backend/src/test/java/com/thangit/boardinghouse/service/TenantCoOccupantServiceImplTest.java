package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.TenantCoOccupantRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.TenantCoOccupantServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantCoOccupantServiceImplTest {
    @Mock TenantCoOccupantRepository repository;
    private TenantCoOccupantServiceImpl service;
    @BeforeEach void setUp(){service=new TenantCoOccupantServiceImpl(repository);}

    @Test void nonTenantCannotReadOccupants(){
        var owner=new AuthenticatedUser(1L,"owner@example.com", RoleCode.OWNER);
        assertThrows(AuthException.class,()->service.overview(owner));
        verifyNoInteractions(repository);
    }

    @Test void submittedRequestCanBeCancelledButNotSupplemented(){
        var permissions=TenantCoOccupantRepository.permissions("SUBMITTED");
        assertTrue(permissions.canCancel());
        assertFalse(permissions.canSubmitAdditionalInformation());
    }

    @Test void moreInformationRequestAllowsSupplementAndCancellation(){
        var permissions=TenantCoOccupantRepository.permissions("NEED_MORE_INFORMATION");
        assertTrue(permissions.canCancel());
        assertTrue(permissions.canUpdate());
        assertTrue(permissions.canSubmitAdditionalInformation());
    }

    @Test void approvedRequestCannotBeModified(){
        var permissions=TenantCoOccupantRepository.permissions("APPROVED");
        assertFalse(permissions.canCancel());
        assertFalse(permissions.canUpdate());
        assertFalse(permissions.canSubmitAdditionalInformation());
    }
}
