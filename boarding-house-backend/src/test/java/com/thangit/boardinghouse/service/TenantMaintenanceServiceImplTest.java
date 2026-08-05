package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.verifyNoInteractions;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.maintenance.TenantMaintenanceResponses.Permissions;
import com.thangit.boardinghouse.repository.TenantMaintenanceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.TenantMaintenanceServiceImpl;
import org.junit.jupiter.api.BeforeEach;import org.junit.jupiter.api.Test;import org.junit.jupiter.api.extension.ExtendWith;import org.mockito.Mock;import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenantMaintenanceServiceImplTest {
    @Mock TenantMaintenanceRepository repository;
    private TenantMaintenanceServiceImpl service;
    @BeforeEach void setUp(){service=new TenantMaintenanceServiceImpl(repository,"","none");}

    @Test void nonTenantCannotReadMaintenance(){AuthenticatedUser owner=new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);assertThrows(AuthException.class,()->service.summary(owner));verifyNoInteractions(repository);}
    @Test void submittedRequestCanOnlyUseEarlyActions(){Permissions p=TenantMaintenanceRepository.permissions("SUBMITTED",false);assertTrue(p.canCancel());assertTrue(p.canAddInformation());assertFalse(p.canProvideFeedback());assertFalse(p.canReopen());}
    @Test void inspectionPendingAllowsFeedbackButNotCancellation(){Permissions p=TenantMaintenanceRepository.permissions("INSPECTION_PENDING",true);assertTrue(p.canProvideFeedback());assertFalse(p.canCancel());assertFalse(p.canConfirmSchedule());}
    @Test void resolvedRequestCanOnlyBeReopened(){Permissions p=TenantMaintenanceRepository.permissions("RESOLVED",false);assertTrue(p.canReopen());assertFalse(p.canCancel());assertFalse(p.canUpload());assertFalse(p.canSendMessage());}
}
