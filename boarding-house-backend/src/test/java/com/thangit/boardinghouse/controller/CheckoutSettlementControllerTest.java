package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.CheckoutSettlementService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class CheckoutSettlementControllerTest {
 final CheckoutSettlementService service=mock(CheckoutSettlementService.class);
 final org.springframework.test.web.servlet.MockMvc mvc=MockMvcBuilders.standaloneSetup(new CheckoutSettlementController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
 @Test void approvalRequiresVersionAndHash()throws Exception{mvc.perform(post("/api/admin/checkout-settlement/1/approval").contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"contentHash\":\"\",\"policyReference\":\"contract\",\"reason\":\"checked\",\"creditTreatment\":\"NONE\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void compensationRequiresEvidence()throws Exception{mvc.perform(post("/api/admin/checkout-settlement/1/charges").contentType(MediaType.APPLICATION_JSON).content("{\"evidenceKey\":\"damage\",\"type\":\"DAMAGE\",\"description\":\"Repair\",\"amount\":150000,\"reference\":\"\",\"reason\":\"checked\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void negativeReturnedAssetQuantityRejected()throws Exception{mvc.perform(post("/api/admin/checkout-settlement/1/inspection").contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"actualAt\":\"2026-11-01T10:00:00\",\"keysReturned\":1,\"includeHandoverDay\":false,\"repairRequired\":false,\"reference\":\"photo\",\"assets\":[{\"checkinAssetId\":1,\"returnedQuantity\":-1,\"condition\":\"MISSING\",\"responsibility\":\"UNKNOWN\",\"reference\":\"photo\"}]}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void tenantConfirmationUsesExistingEnvelope()throws Exception{mvc.perform(post("/api/tenant/checkout-settlement/1/confirmation").contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"contentHash\":\""+"a".repeat(64)+"\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.message").exists());verify(service).confirm(isNull(),eq(1L),any());}
}
