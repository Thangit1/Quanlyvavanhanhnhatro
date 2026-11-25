package com.thangit.boardinghouse.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.thangit.boardinghouse.service.DepositLedgerService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** HTTP/validation contract only; role/ownership rules are exercised against MySQL in the service tests. */
class DepositLedgerControllerTest {
    final DepositLedgerService service=mock(DepositLedgerService.class);
    final MockMvc mvc=MockMvcBuilders.standaloneSetup(new DepositLedgerController(service))
            .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
    final String cash="""
        {"amount":500000,"method":"CASH","occurredAt":"2020-01-01T09:00:00","reference":null,"evidence":"PT-001","reason":"Thu cọc","reconciled":false}
        """;
    @Test void collectionRequiresIdempotencyHeader()throws Exception {
        mvc.perform(post("/api/admin/deposit-ledger/1/collections").contentType(MediaType.APPLICATION_JSON).content(cash)).andExpect(status().isBadRequest());verifyNoInteractions(service);
    }
    @Test void collectionRejectsNegativeAmountBeforeService()throws Exception {
        mvc.perform(post("/api/accountant/deposit-ledger/1/collections").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content(cash.replace("500000","-1"))).andExpect(status().isBadRequest());verifyNoInteractions(service);
    }
    @Test void amountScaleIsValidated()throws Exception {
        mvc.perform(post("/api/accountant/deposit-ledger/1/collections").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content(cash.replace("500000","0.001"))).andExpect(status().isBadRequest());verifyNoInteractions(service);
    }
    @Test void collectionReturnsExistingApiEnvelope()throws Exception {
        when(service.collect(isNull(),eq(1L),eq("test"),any())).thenReturn(java.util.Map.of("id",99,"status","CONFIRMED"));
        mvc.perform(post("/api/admin/deposit-ledger/1/collections").header("Idempotency-Key","test").contentType(MediaType.APPLICATION_JSON).content(cash)).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("CONFIRMED"));
    }
}
