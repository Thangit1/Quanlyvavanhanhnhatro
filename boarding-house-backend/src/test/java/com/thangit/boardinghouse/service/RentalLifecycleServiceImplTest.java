package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.ChangeBookingStatus;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.CheckoutCharge;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.CompleteCheckout;
import com.thangit.boardinghouse.repository.RentalLifecycleRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.RentalLifecycleServiceImpl;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class RentalLifecycleServiceImplTest {
    private final RentalLifecycleRepository repository=mock(RentalLifecycleRepository.class);
    private final RentalLifecycleService service=new RentalLifecycleServiceImpl(repository);

    @Test void tenantCannotAccessInternalLifecycle(){
        assertThatThrownBy(()->service.board(new AuthenticatedUser(7L,"tenant@example.com",RoleCode.TENANT),null))
                .isInstanceOf(AuthException.class).extracting(e->((AuthException)e).code()).isEqualTo("LIFECYCLE_ACCESS_DENIED");
        verifyNoInteractions(repository);
    }

    @Test void invalidBookingTransitionIsRejected(){
        var principal=new AuthenticatedUser(2L,"manager@example.com",RoleCode.MANAGER);
        when(repository.booking(10L)).thenReturn(java.util.Optional.of(Map.of("id",10L,"property_id",3L,"room_id",8L,"status","CONTRACT_CREATED")));
        when(repository.propertyAccess(2L,RoleCode.MANAGER,3L)).thenReturn(true);
        assertThatThrownBy(()->service.changeBookingStatus(principal,10L,new ChangeBookingStatus("CANCELLED","test",0L)))
                .isInstanceOf(AuthException.class).extracting(e->((AuthException)e).code()).isEqualTo("BOOKING_TRANSITION_INVALID");
        verify(repository,never()).changeBooking(anyLong(),anyString(),any(),anyLong());
    }

    @Test void checkoutSettlementOffsetsDepositAgainstDebtAndCharges(){
        var principal=new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);
        Map<String,Object> checkout=Map.of("id",5L,"contract_id",11L,"property_id",3L,"room_id",8L,"tenant_profile_id",4L);
        Map<String,Object> contract=Map.of("id",11L,"property_id",3L,"room_id",8L,"status","ACTIVE","outstanding_debt",new BigDecimal("1000"),"deposit_amount",new BigDecimal("2000"));
        when(repository.checkout(5L)).thenReturn(java.util.Optional.of(checkout));when(repository.contract(11L)).thenReturn(java.util.Optional.of(contract));
        when(repository.propertyAccess(1L,RoleCode.OWNER,3L)).thenReturn(true);when(repository.settleCheckout(anyLong(),any(),any(),any(),any(),any(),any(),anyLong())).thenReturn(1);when(repository.finishCheckout(anyMap(),any(),anyLong())).thenReturn("CLEANING");
        var result=service.completeCheckout(principal,5L,new CompleteCheckout(LocalDate.now(),null,null,List.of(new CheckoutCharge("CLEANING","Vệ sinh",new BigDecimal("500"))),null,0L));
        assertThat(result.refundAmount()).isEqualByComparingTo("500");assertThat(result.balanceDue()).isZero();assertThat(result.roomStatus()).isEqualTo("CLEANING");
        verify(repository).settleCheckout(eq(5L),any(),eq(new BigDecimal("1000")),eq(new BigDecimal("2000")),eq(new BigDecimal("500")),eq(new BigDecimal("500")),eq(BigDecimal.ZERO),eq(1L));
    }

    @Test void checkoutRejectsFinalMeterLowerThanCheckinReading(){
        var principal=new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);
        Map<String,Object> checkout=Map.of("id",5L,"contract_id",11L,"property_id",3L,
                "initial_electricity_reading",new BigDecimal("120"));
        Map<String,Object> contract=Map.of("id",11L,"property_id",3L,"status","ACTIVE");
        when(repository.checkout(5L)).thenReturn(java.util.Optional.of(checkout));
        when(repository.contract(11L)).thenReturn(java.util.Optional.of(contract));
        when(repository.propertyAccess(1L,RoleCode.OWNER,3L)).thenReturn(true);

        assertThatThrownBy(()->service.completeCheckout(principal,5L,
                new CompleteCheckout(LocalDate.now(),new BigDecimal("119"),null,List.of(),null,0L)))
                .isInstanceOf(AuthException.class)
                .extracting(e->((AuthException)e).code()).isEqualTo("METER_READING_INVALID");
        verify(repository,never()).settleCheckout(anyLong(),any(),any(),any(),any(),any(),any(),anyLong());
    }
}
