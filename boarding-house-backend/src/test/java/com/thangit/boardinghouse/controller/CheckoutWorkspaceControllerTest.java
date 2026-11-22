package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.CheckoutWorkspaceService;
import com.thangit.boardinghouse.service.CheckoutEvidenceService;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class CheckoutWorkspaceControllerTest {
 final CheckoutWorkspaceService service=mock(CheckoutWorkspaceService.class);
 final CheckoutEvidenceService evidence=mock(CheckoutEvidenceService.class);MockMvc mvc;
 @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(new CheckoutWorkspaceController(service),new CheckoutEvidenceController(evidence)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();}
 @Test void assignmentRequiresPersonDateReasonAndVersion()throws Exception{mvc.perform(post("/api/admin/checkout-workspace/1/assignment").contentType(MediaType.APPLICATION_JSON).content("{\"userId\":0,\"version\":-1,\"reason\":\"\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void accountantAliasKeepsSameValidation()throws Exception{mvc.perform(post("/api/accountant/checkout-workspace/1/assignment").contentType(MediaType.APPLICATION_JSON).content("{\"userId\":1,\"version\":0,\"inspectionAt\":null,\"reason\":\"Review\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void invalidDateNeverReachesProjection()throws Exception{mvc.perform(get("/api/admin/checkout-workspace").param("from","not-a-date")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void evidenceRequiresIdempotencyHeader()throws Exception{mvc.perform(multipart("/api/admin/checkout-evidence/1").file("file",new byte[]{1}).param("type","INSPECTION")).andExpect(status().isBadRequest());verifyNoInteractions(evidence);}
 @Test void evidenceDownloadIsPrivateAndAttachment()throws Exception{when(evidence.file(null,1,2)).thenReturn(new CheckoutEvidenceService.File("photo.png","image/png",new byte[]{1,2}));mvc.perform(get("/api/tenant/checkout-evidence/1/2")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(header().string("X-Content-Type-Options","nosniff")).andExpect(header().string("Content-Disposition",org.hamcrest.Matchers.startsWith("attachment;")));}
}
