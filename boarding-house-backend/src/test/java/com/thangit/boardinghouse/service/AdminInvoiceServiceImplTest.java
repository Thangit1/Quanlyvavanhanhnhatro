package com.thangit.boardinghouse.service;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.SaveInvoice;
import com.thangit.boardinghouse.repository.AdminInvoiceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AdminInvoiceServiceImpl;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminInvoiceServiceImplTest {
    @Mock AdminInvoiceRepository repository;
    private AdminInvoiceServiceImpl service;
    private final AuthenticatedUser owner = new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);

    @BeforeEach void setUp(){service=new AdminInvoiceServiceImpl(repository);}

    @Test void previousDebtIsSnapshotOnlyAndDoesNotIncreaseNewInvoiceObligation(){
        LocalDate period=LocalDate.of(2026,2,1);
        Map<String,Object> contract=Map.of(
            "property_id",3L,"tenant_id",9L,"monthly_rent",new BigDecimal("2350000"),"room_code","P01");
        when(repository.contractForRoom(7L,11L)).thenReturn(Optional.of(contract));
        when(repository.canAccess(1L,RoleCode.OWNER,3L)).thenReturn(true);
        when(repository.calculate(any(),eq(contract))).thenReturn(new MonthlyBillingService.Plan(List.of(new MonthlyBillingService.Charge("ROOM_RENT","Rent","Period",BigDecimal.ONE,"month",new BigDecimal("2350000"),new BigDecimal("2350000"),"CONTRACT",11L)),"snapshot","hash"));
        when(repository.previousDebt(11L,period)).thenReturn(new BigDecimal("1300000"));
        when(repository.createInvoice(anyLong(),anyLong(),anyLong(),anyLong(),anyString(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),anyString(),nullable(String.class),anyLong(),anyBoolean())).thenReturn(20L);

        service.create(owner,new SaveInvoice(7L,11L,"2026-02",period,period.withDayOfMonth(28),period,
            LocalDate.of(2026,2,10),List.of(),BigDecimal.ZERO,true,null,"ISSUE",null));

        verify(repository).createInvoice(eq(3L),eq(7L),eq(11L),eq(9L),anyString(),eq(period),eq(period),
            eq(period.withDayOfMonth(28)),eq(period),eq(LocalDate.of(2026,2,10)),eq(new BigDecimal("2350000")),
            eq(BigDecimal.ZERO),eq(new BigDecimal("1300000")),eq(BigDecimal.ZERO),eq(new BigDecimal("2350000")),
            eq("ISSUED"),isNull(),eq(1L),eq(false));
    }
}

