package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.*;
import com.thangit.boardinghouse.repository.TechnicianPortalRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.TechnicianPortalServiceImpl;
import java.time.LocalDateTime;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@ExtendWith(MockitoExtension.class)
class TechnicianPortalServiceImplTest {
    @Mock TechnicianPortalRepository repository;
    private TechnicianPortalServiceImpl service;
    private final AuthenticatedUser technician=new AuthenticatedUser(25L,"tech@example.com",RoleCode.TECHNICIAN);
    @BeforeEach void setUp(){service=new TechnicianPortalServiceImpl(repository,new BCryptPasswordEncoder(),"none");}

    @Test void nonTechnicianCannotOpenPortal(){
        var owner=new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);
        AuthException ex=assertThrows(AuthException.class,()->service.dashboard(owner));
        assertEquals("TECHNICIAN_ACCESS_DENIED",ex.code());
    }

    @Test void unassignedTaskIsHiddenAsNotFound(){
        when(repository.taskData(25L,99L,false)).thenReturn(Optional.empty());
        AuthException ex=assertThrows(AuthException.class,()->service.detail(technician,99L));
        assertEquals("TECHNICIAN_TASK_NOT_FOUND",ex.code());
    }

    @Test void staleVersionCannotAcceptTask(){
        when(repository.taskData(25L,9L,true)).thenReturn(Optional.of(new HashMap<>(Map.of("id",9L,"status","ASSIGNED","code","SC-9","version",3L))));
        when(repository.transition(eq(25L),eq(9L),eq(2L),anyList(),eq("ACCEPTED"),anyString())).thenReturn(0);
        AuthException ex=assertThrows(AuthException.class,()->service.accept(technician,9L,new Versioned(2L)));
        assertEquals("TASK_VERSION_CONFLICT",ex.code());
    }

    @Test void completionRequiresDiagnosisBeforeInspection(){
        when(repository.taskData(25L,9L,true)).thenReturn(Optional.of(new HashMap<>(Map.of("id",9L,"status","IN_PROGRESS","code","SC-9","version",3L))));
        when(repository.diagnosis(9L)).thenReturn(Optional.empty());
        var request=new Complete(3L,"Nguyên nhân","Đã xử lý",null,LocalDateTime.now(),"GOOD","Chạy thử đạt",false,null,null,null);
        AuthException ex=assertThrows(AuthException.class,()->service.complete(technician,9L,request));
        assertEquals("DIAGNOSIS_REQUIRED",ex.code());
    }

    @Test void permissionsNeverAllowTechnicianToApproveOrInspect(){
        var permissions=TechnicianPortalRepository.permissions("IN_PROGRESS");
        assertTrue(permissions.canUpdateProgress());
        assertTrue(permissions.canComplete());
        assertFalse(permissions.canAccept());
    }
}
