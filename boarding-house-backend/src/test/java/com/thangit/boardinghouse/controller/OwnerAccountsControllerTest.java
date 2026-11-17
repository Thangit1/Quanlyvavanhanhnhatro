package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.OwnerAccountsService;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class OwnerAccountsControllerTest {
 final OwnerAccountsService service=mock(OwnerAccountsService.class);MockMvc mvc;
 @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(new OwnerAccountsController(service),new AccountInvitationController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();}
 @Test void ownerCannotInviteOwnerRole()throws Exception{mvc.perform(post("/api/owner/accounts/invitations").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"test@example.invalid\",\"fullName\":\"Test\",\"role\":\"OWNER\",\"reason\":\"Test\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void emptyReasonAndNegativePropertyAreRejected()throws Exception{mvc.perform(put("/api/owner/accounts/2/assignments").contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"MANAGER\",\"propertyIds\":[-1],\"capabilities\":[],\"reason\":\"\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void invitationPasswordMustHaveLettersAndDigits()throws Exception{mvc.perform(post("/api/auth/invitations/accept").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"test\",\"password\":\"12345678\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void invitationCollectionDoesNotRouteToUserDetail()throws Exception{when(service.invitations(any())).thenReturn(List.of());mvc.perform(get("/api/owner/accounts/invitations")).andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());verify(service).invitations(any());}
}
