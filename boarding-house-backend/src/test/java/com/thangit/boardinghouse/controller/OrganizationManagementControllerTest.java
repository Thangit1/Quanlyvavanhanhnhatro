package com.thangit.boardinghouse.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.OrganizationManagementService;
import java.time.LocalDate;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class OrganizationManagementControllerTest {
    final OrganizationManagementService service=mock(OrganizationManagementService.class);
    MockMvc mvc;
    @BeforeEach void setup(){mvc=MockMvcBuilders.standaloneSetup(new OrganizationManagementController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();}
    @Test void blankCompanyNameIsRejected()throws Exception {
        mvc.perform(post("/api/owner/organizations").contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"A\",\"name\":\" \"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);
    }
    @Test void missingVersionAndReasonAreRejected()throws Exception {
        mvc.perform(put("/api/owner/organizations/1/relationships/2/area").contentType(MediaType.APPLICATION_JSON).content("{\"areaId\":3}")).andExpect(status().isBadRequest());verifyNoInteractions(service);
    }
    @Test void futureManagementStartIsRejected()throws Exception {
        mvc.perform(post("/api/owner/organizations/1/properties").contentType(MediaType.APPLICATION_JSON).content("{\"propertyId\":1,\"agreementReference\":\"A\",\"effectiveFrom\":\""+LocalDate.now().plusDays(1)+"\",\"reason\":\"Test\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);
    }
    @Test void invalidAreaStatusIsRejected()throws Exception {
        mvc.perform(post("/api/owner/organizations/1/areas").contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"A\",\"name\":\"Area\",\"status\":\"UNKNOWN\",\"version\":0,\"reason\":\"Test\"}")).andExpect(status().isBadRequest());verifyNoInteractions(service);
    }
}
