package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.FinanceWorkspaceService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class FinanceWorkspaceControllerTest {
 final FinanceWorkspaceService service=mock(FinanceWorkspaceService.class);
 final org.springframework.test.web.servlet.MockMvc mvc=MockMvcBuilders.standaloneSetup(new FinanceWorkspaceController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
 @Test void recordFilterBindsDatesAndCompanyWithoutDroppingFilters()throws Exception{when(service.workspace(isNull(),any())).thenReturn(java.util.Map.of("rows",java.util.List.of()));mvc.perform(get("/api/admin/finance/workspace").param("tab","cashbook").param("startDate","2026-11-01").param("endDate","2026-11-30").param("organizationId","30").param("areaId","40").param("propertyId","10").param("page","0").param("size","20")).andExpect(status().isOk());verify(service).workspace(isNull(),argThat(f->f.organizationId()==30L&&f.areaId()==40L&&f.propertyId()==10L&&f.size()==20&&f.startDate().equals(java.time.LocalDate.of(2026,11,1))));}
 @Test void voucherRequiresRequestKey()throws Exception{mvc.perform(post("/api/accountant/finance/workspace/vouchers").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void negativeIncomeIsRejectedBeforeService()throws Exception{mvc.perform(post("/api/admin/finance/workspace/income").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content("""
 {"propertyId":1,"category":"OTHER_INCOME","amount":-1,"incomeDate":"2026-11-01","description":"Actual source","paymentMethod":"CASH"}
 """)).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void excessiveMoneyPrecisionCannotBeSilentlyRoundedByDatabase()throws Exception{mvc.perform(post("/api/admin/finance/workspace/income").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content("""
 {"propertyId":1,"category":"OTHER_INCOME","amount":1.234,"incomeDate":"2026-11-01","description":"Actual source","paymentMethod":"CASH"}
 """)).andExpect(status().isBadRequest());verifyNoInteractions(service);}
}
