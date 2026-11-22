package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.CommunicationService;
import com.thangit.boardinghouse.service.CommunicationJobs;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class CommunicationControllerTest {
 CommunicationService service=mock(CommunicationService.class);CommunicationJobs jobs=mock(CommunicationJobs.class);MockMvc mvc;
 @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(new CommunicationController(service,jobs)).setControllerAdvice(new com.thangit.boardinghouse.common.exception.GlobalExceptionHandler()).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();}
 @Test void allIsNotAcceptedAsNumericPropertyId()throws Exception{mvc.perform(get("/api/communications/inbox").param("propertyId","all")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void requiredCalendarRangeIsAClientError()throws Exception{mvc.perform(get("/api/communications/calendar")).andExpect(status().isBadRequest());verifyNoInteractions(jobs);}
 @Test void nestedMessageValidationRunsBeforeQueue()throws Exception{mvc.perform(post("/api/communications/campaigns").contentType(MediaType.APPLICATION_JSON).content("{\"message\":{\"propertyId\":0,\"title\":\"\",\"body\":\"\",\"category\":\"ANNOUNCEMENT\",\"audience\":\"ALL_TENANTS\",\"recipientIds\":[],\"roomIds\":[],\"channels\":[],\"scheduledAt\":\"2026-11-18T09:00:00\"},\"previewHash\":\"hash\",\"key\":\"key\",\"draft\":false}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void ruleRejectsUnboundedDailyLimit()throws Exception{mvc.perform(post("/api/communications/rules").contentType(MediaType.APPLICATION_JSON).content("{\"propertyId\":1,\"eventType\":\"INVOICE_DUE\",\"audience\":\"TENANT\",\"offsetDays\":0,\"sendHour\":9,\"dailyLimit\":1000,\"enabled\":true,\"version\":0}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void invalidCalendarDateDoesNotReachSourceQueries()throws Exception{mvc.perform(get("/api/communications/calendar").param("from","invalid").param("to","2026-11-18")).andExpect(status().isBadRequest());verifyNoInteractions(jobs);}
}
