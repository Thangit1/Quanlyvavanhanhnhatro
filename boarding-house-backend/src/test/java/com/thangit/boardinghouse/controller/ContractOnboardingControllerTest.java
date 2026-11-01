package com.thangit.boardinghouse.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.ContractOnboardingService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ContractOnboardingControllerTest {
    final ContractOnboardingService service=mock(ContractOnboardingService.class);
    final MockMvc mvc=MockMvcBuilders.standaloneSetup(new ContractOnboardingController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
    @Test void confirmationRequiresVersionAndHash() throws Exception {mvc.perform(post("/api/tenant/contract-onboarding/1/confirmations").contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"contentHash\":\"\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void identityVerificationRequiresEvidence() throws Exception {mvc.perform(post("/api/admin/contract-onboarding/1/identity-verification").contentType(MediaType.APPLICATION_JSON).content("{\"reference\":\"\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void negativeHandoverReadingRejectedBeforeService() throws Exception {mvc.perform(put("/api/admin/contract-onboarding/1/handover").contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"scheduledDate\":\"2026-01-01\",\"electricityReading\":-1,\"keysCardsCount\":1,\"reference\":\"photo\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void tenantConfirmationUsesExistingEnvelope() throws Exception {mvc.perform(post("/api/tenant/contract-onboarding/1/confirmations").contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"contentHash\":\""+"a".repeat(64)+"\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.message").exists());verify(service).confirmContract(isNull(),eq(1L),any());}
}
