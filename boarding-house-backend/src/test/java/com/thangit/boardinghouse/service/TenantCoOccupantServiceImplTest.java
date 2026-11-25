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

    @Test void tenantWithoutResidenceGetsDomainNotFoundRatherThanServerFailure(){
        var tenant=new AuthenticatedUser(8L,"tenant@test.invalid",RoleCode.TENANT);
        when(repository.activeContext(8L)).thenReturn(java.util.Optional.empty());
        var error=assertThrows(AuthException.class,()->service.overview(tenant));
        assertEquals(org.springframework.http.HttpStatus.NOT_FOUND,error.status());
        assertEquals("CO_OCCUPANT_NOT_FOUND",error.code());
        verify(repository).activeContext(8L);
        verifyNoMoreInteractions(repository);
    }

    @Test void residenceWithoutContractCannotRegisterAnotherOccupant(){
        var tenant=new AuthenticatedUser(8L,"tenant@test.invalid",RoleCode.TENANT);
        when(repository.activeContext(8L)).thenReturn(java.util.Optional.of(context(null,null,null)));
        var overview=service.overview(tenant);
        assertFalse(overview.permissions().canCreateOccupantRequest());
        assertTrue(overview.permissions().createDisabledReason().contains("hợp đồng"));
    }

    @Test void representativeWithValidContractAndCapacityCanRegister(){
        var tenant=new AuthenticatedUser(8L,"tenant@test.invalid",RoleCode.TENANT);
        when(repository.activeContext(8L)).thenReturn(java.util.Optional.of(context(1L,"ACTIVE",java.time.LocalDate.now().plusMonths(6))));
        assertTrue(service.overview(tenant).permissions().canCreateOccupantRequest());
    }

    private TenantCoOccupantRepository.ActiveContext context(Long contract,String status,java.time.LocalDate end){
        return new TenantCoOccupantRepository.ActiveContext(1,5,"REPRESENTATIVE",3,1,contract,"Property","Address",null,null,"101","Studio",java.math.BigDecimal.TEN,2,"OCCUPIED","HD-TEST",end,status,"Representative",1);
    }

    @Test void vietnameseNameCanBeSubmittedForAnEligibleResidence(){
        var tenant=new AuthenticatedUser(8L,"tenant@test.invalid",RoleCode.TENANT);
        var context=context(1L,"ACTIVE",java.time.LocalDate.now().plusMonths(6));
        when(repository.activeContext(8L)).thenReturn(java.util.Optional.of(context));
        var created=mock(TenantCoOccupantRepository.RequestBase.class);
        when(created.code()).thenReturn("CO-TEST");
        when(created.status()).thenReturn("SUBMITTED");
        when(repository.create(eq(8L),eq(context),eq("name-test"),any())).thenReturn(11L);
        when(repository.request(context,11L)).thenReturn(java.util.Optional.of(created));
        var result=service.create(tenant,"name-test",request("Nguyễn Văn An"));
        assertEquals(11L,result.id());
        assertEquals("SUBMITTED",result.status());
    }

    @Test void numericNameIsRejectedBeforeWriting(){
        var tenant=new AuthenticatedUser(8L,"tenant@test.invalid",RoleCode.TENANT);
        when(repository.activeContext(8L)).thenReturn(java.util.Optional.of(context(1L,"ACTIVE",java.time.LocalDate.now().plusMonths(6))));
        var error=assertThrows(AuthException.class,()->service.create(tenant,"invalid-name",request("12345")));
        assertEquals("CO_OCCUPANT_INVALID",error.code());
        verify(repository,never()).create(anyLong(),any(),anyString(),any());
    }

    private com.thangit.boardinghouse.dto.request.occupant.TenantCoOccupantRequests.CreateRequest request(String name){
        return new com.thangit.boardinghouse.dto.request.occupant.TenantCoOccupantRequests.CreateRequest(name,java.time.LocalDate.of(2000,1,1),null,"0912345678",null,"Địa chỉ thường trú",null,"Việt Nam",null,null,"FRIEND",null,new com.thangit.boardinghouse.dto.request.occupant.TenantCoOccupantRequests.IdentityDocument("CITIZEN_ID","012345678901",null,null,null),java.time.LocalDate.now(),null,null,"Đăng ký đến ở cùng người thuê",null,false);
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
