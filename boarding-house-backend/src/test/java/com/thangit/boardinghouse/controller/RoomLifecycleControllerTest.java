package com.thangit.boardinghouse.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.ChangeStatus;
import com.thangit.boardinghouse.service.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class RoomLifecycleControllerTest {
    AdminPropertyService properties=mock(AdminPropertyService.class);
    RentalLifecycleService lifecycle=mock(RentalLifecycleService.class);
    AdminContractService contracts=mock(AdminContractService.class);
    MockMvc mvc=MockMvcBuilders.standaloneSetup(new AdminPropertyController(properties),new RentalLifecycleController(lifecycle),new AdminContractController(contracts))
            .setControllerAdvice(new com.thangit.boardinghouse.common.exception.GlobalExceptionHandler())
            .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
    @Test void roomStatusRequiresVersion()throws Exception {
        mvc.perform(patch("/api/admin/rooms/1/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"READY\",\"reason\":\"inspection\",\"readinessConfirmed\":true}"))
                .andExpect(status().isBadRequest());verifyNoInteractions(properties);
    }
    @Test void readinessConfirmationIsPartOfApiContract()throws Exception {
        mvc.perform(patch("/api/admin/rooms/1/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"READY\",\"reason\":\"inspection\",\"version\":2,\"readinessConfirmed\":true}"))
                .andExpect(status().isOk());var request=ArgumentCaptor.forClass(ChangeStatus.class);verify(properties).changeStatus(isNull(),eq(1L),request.capture());assertThat(request.getValue().readinessConfirmed()).isTrue();
    }
    @Test void checkinRequiresInitialMeterReadings()throws Exception {
        mvc.perform(post("/api/admin/rental-lifecycle/checkins/1/complete").contentType(MediaType.APPLICATION_JSON).content("{\"identityVerified\":true,\"contractVerified\":true,\"depositVerified\":true,\"keysCardsCount\":1,\"version\":0}"))
                .andExpect(status().isBadRequest());verifyNoInteractions(lifecycle);
    }
    @Test void bookingExtensionRequiresReason()throws Exception {
        mvc.perform(patch("/api/admin/rental-lifecycle/bookings/1/expiry").contentType(MediaType.APPLICATION_JSON).content("{\"reservationEnd\":\"2026-12-01\",\"version\":0}"))
                .andExpect(status().isBadRequest());verifyNoInteractions(lifecycle);
    }
    @Test void leaseExtensionApprovalRequiresReason()throws Exception {
        mvc.perform(post("/api/admin/contracts/1/extensions/2/approve").contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"\"}"))
                .andExpect(status().isBadRequest());verifyNoInteractions(contracts);
    }
    @Test void databaseLockConflictIsHttp409()throws Exception {
        when(properties.changeStatus(any(),eq(1L),any())).thenThrow(new org.springframework.dao.CannotAcquireLockException("concurrent test"));
        mvc.perform(patch("/api/admin/rooms/1/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"READY\",\"reason\":\"inspection\",\"version\":2,\"readinessConfirmed\":true}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("CONCURRENT_UPDATE"));
    }
}
