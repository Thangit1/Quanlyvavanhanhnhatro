package com.thangit.boardinghouse.controller;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.*;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
class AccountProvisioningControllerTest {
 final AccountProvisioningService service=mock(AccountProvisioningService.class);MockMvc mvc;
 final String body="{\"fullName\":\"New User\",\"phone\":\"0901234567\",\"email\":null,\"roles\":[\"MANAGER\"],\"initialStatus\":\"ACTIVE\",\"propertyIds\":[],\"permissions\":{},\"reason\":\"Direct create\"}";
 @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(new AccountProvisioningController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();}
 @Test void ownerAndSystemAdminRolesAreNotProvisionable()throws Exception{for(String role:new String[]{"OWNER","SYSTEM_ADMIN"})mvc.perform(post("/api/admin/account-provisioning").contentType(MediaType.APPLICATION_JSON).content(body.replace("MANAGER",role))).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void malformedPhoneIsRejected()throws Exception{mvc.perform(post("/api/admin/account-provisioning").contentType(MediaType.APPLICATION_JSON).content(body.replace("0901234567","123"))).andExpect(status().isBadRequest());verifyNoInteractions(service);}
 @Test void initialCredentialResponseIsNeverCacheable()throws Exception{when(service.create(any(),any())).thenReturn(new AccountProvisioningService.Result(1L,java.util.Set.of("MANAGER"),"0901234567","synthetic-one-time",false,true,48,null));mvc.perform(post("/api/admin/account-provisioning").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andExpect(header().string("Cache-Control","no-store"));}
}
