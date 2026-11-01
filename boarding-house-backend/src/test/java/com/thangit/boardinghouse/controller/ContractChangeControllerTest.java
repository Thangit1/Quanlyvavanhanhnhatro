package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.ContractChangeService;
import com.thangit.boardinghouse.service.ResidentApprovalService;
import com.thangit.boardinghouse.common.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class ContractChangeControllerTest {
 ContractChangeService changes=mock(ContractChangeService.class);ResidentApprovalService residents=mock(ResidentApprovalService.class);MockMvc mvc;
 @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(new ContractChangeController(changes,residents)).setControllerAdvice(new GlobalExceptionHandler()).build();}
 @Test void actionsRequireExplicitVersion()throws Exception{mvc.perform(post("/api/admin/contract-changes/1/offer").contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Checked\"}")).andExpect(status().isBadRequest());verifyNoInteractions(changes);}
 @Test void missingAgreementHashIsRejected()throws Exception{mvc.perform(post("/api/tenant/contract-changes/1/confirm").contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"hash\":\"\"}")).andExpect(status().isBadRequest());verifyNoInteractions(changes);}
 @Test void negativeRentIsRejected()throws Exception{mvc.perform(post("/api/tenant/contract-changes/contracts/1").contentType(MediaType.APPLICATION_JSON).content("{\"type\":\"EXTENSION\",\"effectiveDate\":\"2027-01-01\",\"newEndDate\":\"2027-06-30\",\"monthlyRent\":-1,\"depositRequired\":0,\"proration\":\"ACTUAL_DAYS\",\"reference\":\"ANNEX\",\"reason\":\"Requested\"}")).andExpect(status().isBadRequest());verifyNoInteractions(changes);}
 @Test void depositMoveNeedsPositiveAmountAndKey()throws Exception{mvc.perform(post("/api/admin/contract-changes/1/deposit-transfer").contentType(MediaType.APPLICATION_JSON).content("{\"version\":1,\"amount\":0,\"key\":\"\",\"reason\":\"Agreed\"}")).andExpect(status().isBadRequest());verifyNoInteractions(changes);}
 @Test void residentApprovalNeedsEvidence()throws Exception{mvc.perform(post("/api/admin/contract-changes/resident-requests/1/review").contentType(MediaType.APPLICATION_JSON).content("{\"version\":0,\"approved\":true,\"effectiveDate\":\"2026-11-01\",\"reference\":\"\",\"reason\":\"Checked\"}")).andExpect(status().isBadRequest());verifyNoInteractions(residents);}
}
