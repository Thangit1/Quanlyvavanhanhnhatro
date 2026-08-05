package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.accountant.AccountantRequests.*;
import com.thangit.boardinghouse.repository.AccountantPortalRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AccountantPortalServiceImpl;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AccountantPortalServiceImplTest {
    @Mock AccountantPortalRepository repository;
    private AccountantPortalServiceImpl service;
    private final AuthenticatedUser accountant=new AuthenticatedUser(5L,"accountant@example.com",RoleCode.ACCOUNTANT);

    @BeforeEach void setUp(){service=new AccountantPortalServiceImpl(repository);lenient().when(repository.profileExists(5L)).thenReturn(true);}

    @Test void ownerCannotUseDedicatedAccountantPortal(){
        AuthException error=assertThrows(AuthException.class,()->service.dashboard(new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER),null,"2026-08"));
        assertEquals("ACCOUNTANT_ACCESS_DENIED",error.code());
    }

    @Test void propertyOutsideAssignmentIsRejected(){
        when(repository.canAccess(5L,91L)).thenReturn(false);
        AuthException error=assertThrows(AuthException.class,()->service.invoices(accountant,91L,"2026-08",null,null,0,20));
        assertEquals("ACCOUNTANT_PROPERTY_DENIED",error.code());
    }

    @Test void paymentCannotExceedCurrentInvoiceDebt(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey("pay-1")).thenReturn(Optional.empty());
        when(repository.invoice(5L,8L,true)).thenReturn(Optional.of(invoice("ISSUED",new BigDecimal("500000"))));
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("600000"),"BANK_TRANSFER",LocalDateTime.now(),"BANK-1",null,true);
        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-1",request));
        assertEquals("PAYMENT_EXCEEDS_DEBT",error.code());
        verify(repository,never()).createPayment(anyMap(),any(),anyLong(),anyString());
    }

    @Test void closedPeriodBlocksNewPayment(){
        when(repository.permission(5L,"can_record_payment")).thenReturn(true);
        when(repository.paymentByKey("pay-2")).thenReturn(Optional.empty());
        when(repository.invoice(5L,8L,true)).thenReturn(Optional.of(invoice("ISSUED",new BigDecimal("500000"))));
        when(repository.locked(eq(3L),any(LocalDate.class))).thenReturn(true);
        PaymentCreate request=new PaymentCreate(8L,new BigDecimal("100000"),"CASH",LocalDateTime.now(),null,null,false);
        AuthException error=assertThrows(AuthException.class,()->service.createPayment(accountant,"pay-2",request));
        assertEquals("ACCOUNTING_PERIOD_CLOSED",error.code());
    }

    private Map<String,Object> invoice(String status,BigDecimal remaining){Map<String,Object> m=new HashMap<>();m.put("id",8L);m.put("property_id",3L);m.put("tenant_id",12L);m.put("code","HD-8");m.put("status",status);m.put("remaining_amount",remaining);m.put("version",2L);return m;}
}
