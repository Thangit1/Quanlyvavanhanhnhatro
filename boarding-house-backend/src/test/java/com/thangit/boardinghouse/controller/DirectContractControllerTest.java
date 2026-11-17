package com.thangit.boardinghouse.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.AdminContractService;
import com.thangit.boardinghouse.service.DirectContractService;
import com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.Created;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class DirectContractControllerTest {
    final DirectContractService service=mock(DirectContractService.class);
    MockMvc mvc;
    final String body="""
        {"roomId":1,"tenantProfileId":2,"expectedCheckinDate":"2026-11-02","submit":false,
         "terms":{"startDate":"2026-11-02","endDate":"2027-11-02","depositAmount":0,
         "monthlyRent":1000,"paymentDueDay":5,"noticePeriodDays":30,"initialPaymentRequired":false,"utilityRates":[]}}
        """;
    @BeforeEach void setup(){var controller=new AdminContractController(mock(AdminContractService.class));controller.setDirectContracts(service);mvc=MockMvcBuilders.standaloneSetup(controller).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();}
    @Test void keyIsRequired()throws Exception {mvc.perform(post("/api/admin/contracts").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void negativeAgreementPriceIsRejectedBeforeService()throws Exception {mvc.perform(post("/api/admin/contracts").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content(body.replace("\"monthlyRent\":1000","\"monthlyRent\":-1"))).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void nullRateIsRejectedBeforeService()throws Exception {mvc.perform(post("/api/admin/contracts").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content(body.replace("\"utilityRates\":[]","\"utilityRates\":[null]"))).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void malformedNewTenantPhoneIsRejected()throws Exception {mvc.perform(post("/api/admin/contracts").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content(body.replace("\"tenantProfileId\":2","\"newTenant\":{\"fullName\":\"Arrival\",\"phone\":\"123\"}"))).andExpect(status().isBadRequest());verifyNoInteractions(service);}
    @Test void validDraftUsesExistingContractCollectionRoute()throws Exception {when(service.create(any(),eq("test"),any())).thenReturn(new Created(10L,"HD-test","DRAFT"));mvc.perform(post("/api/admin/contracts").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("DRAFT"));verify(service).create(any(),eq("test"),argThat(r->!r.submit()));}
}
