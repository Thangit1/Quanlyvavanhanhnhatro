package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.report.AdminReportResponses.PropertyOption;
import com.thangit.boardinghouse.repository.AdminReportRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AdminReportServiceImpl;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminReportServiceImplTest {
    @Mock AdminReportRepository repository;
    private AdminReportServiceImpl service;
    private final AuthenticatedUser owner=new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);

    @BeforeEach void setUp(){service=new AdminReportServiceImpl(repository);}

    @Test void tenantCannotReadAdminReports(){
        AuthException error=assertThrows(AuthException.class,()->service.overview(new AuthenticatedUser(9L,"tenant@example.com",RoleCode.TENANT),List.of(),LocalDate.now(),LocalDate.now(),null,null));
        assertEquals("REPORT_ACCESS_DENIED",error.code());
    }

    @Test void propertyOutsideScopeIsRejected(){
        when(repository.properties(1L,RoleCode.OWNER)).thenReturn(List.of(new PropertyOption(2L,"Khu A")));
        AuthException error=assertThrows(AuthException.class,()->service.report(owner,"revenue",List.of(999L),LocalDate.of(2026,8,1),LocalDate.of(2026,8,31)));
        assertEquals("REPORT_PROPERTY_DENIED",error.code());
    }

    @Test void overviewCalculatesOccupancyProfitAndMarginOnBackend(){
        LocalDate start=LocalDate.of(2026,8,1),end=LocalDate.of(2026,8,31);
        when(repository.properties(1L,RoleCode.OWNER)).thenReturn(List.of(new PropertyOption(2L,"Khu A")));
        when(repository.roomSummary(1L,RoleCode.OWNER,List.of(2L))).thenReturn(Map.of("totalRooms",10L,"availableRooms",8L,"occupiedRooms",6L));
        when(repository.periodSummary(eq(1L),eq(RoleCode.OWNER),eq(List.of(2L)),any(LocalDate.class),any(LocalDate.class))).thenReturn(Map.of("confirmedRevenue",new BigDecimal("8000000"),"confirmedExpense",new BigDecimal("2000000"),"outstandingDebt",BigDecimal.ZERO));
        when(repository.periodSummary(1L,RoleCode.OWNER,List.of(2L),start,end)).thenReturn(Map.of("confirmedRevenue",new BigDecimal("10000000"),"confirmedExpense",new BigDecimal("2500000"),"outstandingDebt",BigDecimal.ZERO,"expiringContracts",0L,"openMaintenance",0L,"activeTenants",0L));
        when(repository.roomStatuses(1L,RoleCode.OWNER,List.of(2L))).thenReturn(List.of());
        when(repository.financeTrend(1L,RoleCode.OWNER,List.of(2L),start,end)).thenReturn(List.of());
        var result=service.overview(owner,List.of(2L),start,end,null,null);
        assertEquals(new BigDecimal("75.00"),result.summary().get("occupancyRate"));
        assertEquals(new BigDecimal("7500000"),result.summary().get("profit"));
        assertEquals(new BigDecimal("75.00"),result.summary().get("profitMargin"));
    }

    @Test void invalidDateRangeIsRejected(){
        AuthException error=assertThrows(AuthException.class,()->service.report(owner,"revenue",List.of(),LocalDate.of(2026,9,1),LocalDate.of(2026,8,1)));
        assertEquals("REPORT_DATE_RANGE_INVALID",error.code());
    }
}
