package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.MonthlyBillingService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class MonthlyBillingControllerTest {
 final MonthlyBillingService service=mock(MonthlyBillingService.class);
 final org.springframework.test.web.servlet.MockMvc mvc=MockMvcBuilders.standaloneSetup(new MonthlyBillingController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
 @Test void negativeReadingRejected() throws Exception {mvc.perform(post("/api/admin/monthly-billing/1/readings").contentType(MediaType.APPLICATION_JSON).content("{\"period\":\"2026-10-01\",\"version\":0,\"electricity\":-1,\"reference\":\"photo\",\"reason\":\"actual\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void replacementNeedsRemovalEvidence() throws Exception {mvc.perform(post("/api/admin/monthly-billing/1/meter-replacements").contentType(MediaType.APPLICATION_JSON).content("{\"period\":\"2026-10-01\",\"version\":0,\"type\":\"ELECTRICITY\",\"code\":\"new\",\"installedReading\":0,\"reference\":\"photo\",\"reason\":\"actual\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void rateNeedsAgreementReference() throws Exception {mvc.perform(post("/api/admin/monthly-billing/1/rates").contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"ELECTRICITY\",\"effectiveDate\":\"2026-10-01\",\"unitPrice\":3500,\"reference\":\"\",\"reason\":\"actual\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void automationDayBoundsValidated() throws Exception {mvc.perform(post("/api/admin/monthly-billing/1/automation").contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":true,\"generationDay\":32,\"issueDay\":1,\"cutoffDay\":28,\"dueDay\":5,\"periodOffset\":-1,\"reason\":\"policy\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
}
