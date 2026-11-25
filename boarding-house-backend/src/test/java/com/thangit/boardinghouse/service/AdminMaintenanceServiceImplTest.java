package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.maintenance.AdminMaintenanceRequests.CreateRequest;
import com.thangit.boardinghouse.repository.AdminMaintenanceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AdminMaintenanceServiceImpl;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminMaintenanceServiceImplTest {
    @Mock AdminMaintenanceRepository repository;
    private AdminMaintenanceServiceImpl service;
    private final AuthenticatedUser owner = new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);

    @BeforeEach void setUp(){ service=new AdminMaintenanceServiceImpl(repository); }

    @Test void invalidCategoryIsRejectedByBackend(){
        when(repository.canAccess(1L,RoleCode.OWNER,2L)).thenReturn(true);
        CreateRequest request=new CreateRequest(2L,3L,null,null,"ADMIN","CORRECTIVE","Hỏng thiết bị","Thiết bị không hoạt động","UNKNOWN","HIGH",false,null,null,BigDecimal.ZERO,"OWNER");
        assertThrows(AuthException.class,()->service.create(owner,request));
    }

    @Test void staleVersionCannotStartMaintenance(){
        when(repository.request(9L,true)).thenReturn(Optional.of(Map.of("id",9L,"property_id",2L,"status","SCHEDULED","version",3L)));
        when(repository.canAccess(1L,RoleCode.OWNER,2L)).thenReturn(true);
        when(repository.transition(9L,"ASSIGNED,SCHEDULED,REOPENED,ON_HOLD","IN_PROGRESS",2L,",progress_percent=GREATEST(progress_percent,1)")).thenReturn(0);
        assertThrows(AuthException.class,()->service.start(owner,9L,2L));
    }
}
