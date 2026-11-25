package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.ManagementReportService;
import org.junit.jupiter.api.Test;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class ManagementReportControllerTest {
 final ManagementReportService service=mock(ManagementReportService.class);
 final org.springframework.test.web.servlet.MockMvc mvc=MockMvcBuilders.standaloneSetup(new ManagementReportController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
 @Test void bindsWholeFilterToOneReportRequest()throws Exception{when(service.read(isNull(),any())).thenReturn(java.util.Map.of("rows",java.util.List.of()));mvc.perform(get("/api/admin/reports/workspace").param("type","debt").param("propertyId","10").param("organizationId","30").param("areaId","40").param("startDate","2028-02-01").param("endDate","2028-02-29").param("roomId","101").param("contractId","501").param("page","2").param("size","20")).andExpect(status().isOk());verify(service).read(isNull(),argThat(f->f.type().equals("debt")&&f.propertyId()==10L&&f.organizationId()==30L&&f.areaId()==40L&&f.roomId()==101L&&f.contractId()==501L&&f.page()==2&&f.endDate().equals(java.time.LocalDate.of(2028,2,29))));}
 @Test void choicesRequireAnExplicitHouse()throws Exception{mvc.perform(get("/api/accountant/reports/workspace/choices")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void malformedDateIsRejectedBeforeService()throws Exception{mvc.perform(get("/api/admin/reports/workspace").param("startDate","not-a-date").param("size","20")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
}
