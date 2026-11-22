package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.OperationsWorkspaceService;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class OperationsWorkspaceControllerTest {
 final OperationsWorkspaceService service=mock(OperationsWorkspaceService.class);MockMvc mvc;
 @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(new OperationsWorkspaceController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();}
 @Test void stockRequiresPositiveQuantityAndIdempotencyKey()throws Exception{mvc.perform(post("/api/admin/operations/materials/1/receive").contentType(MediaType.APPLICATION_JSON).content("{\"quantity\":0,\"reason\":\"Receipt\",\"key\":\"\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void costReviewRequiresReasonAndNonnegativeVersion()throws Exception{mvc.perform(post("/api/admin/operations/costs/1/review").contentType(MediaType.APPLICATION_JSON).content("{\"version\":-1,\"approve\":true,\"reason\":\"\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void assetRequiresValidRoomAndQuantity()throws Exception{mvc.perform(post("/api/admin/operations/assets").contentType(MediaType.APPLICATION_JSON).content("{\"roomId\":-1,\"code\":\"A\",\"name\":\"Fan\",\"category\":\"OTHER\",\"quantity\":0,\"condition\":\"GOOD\",\"status\":\"IN_USE\",\"version\":0,\"reason\":\"Inventory\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
}
