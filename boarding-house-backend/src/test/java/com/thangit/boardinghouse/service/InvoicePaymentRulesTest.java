package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class InvoicePaymentRulesTest {
    @Test void invalidMoneyIsRejectedBeforeAnyDatabaseWrite(){
        for(BigDecimal amount:java.util.List.of(BigDecimal.ZERO,new BigDecimal("-1"),new BigDecimal("1.001"),new BigDecimal("10000000000000")))
            assertThrows(com.thangit.boardinghouse.common.exception.AuthException.class,()->InvoicePaymentRules.requireAmount(amount));
        assertThrows(com.thangit.boardinghouse.common.exception.AuthException.class,()->InvoicePaymentRules.requireAmount(null));
        assertDoesNotThrow(()->InvoicePaymentRules.requireAmount(new BigDecimal("1000.000")));
    }
    @Test void bankReceiptNeedsReferenceAndCannotBeFutureDated(){
        var now=BusinessTime.now().minusMinutes(1);
        assertThrows(com.thangit.boardinghouse.common.exception.AuthException.class,()->InvoicePaymentRules.requireReceipt(BigDecimal.TEN,"BANK_TRANSFER",now," "));
        assertThrows(com.thangit.boardinghouse.common.exception.AuthException.class,()->InvoicePaymentRules.requireReceipt(BigDecimal.TEN,"CASH",now.plusDays(1),null));
        assertDoesNotThrow(()->InvoicePaymentRules.requireReceipt(BigDecimal.TEN,"BANK_TRANSFER",now,"VERIFIED-TEST-REFERENCE"));
    }
    @Test void openingDateIsIndependentOfDeadlineAndAllowsLateReceipts(){
        var invoice=java.util.Map.<String,Object>of("payment_available_from",LocalDate.of(2026,11,1));
        assertFalse(InvoicePaymentRules.paymentOpen(invoice,LocalDate.of(2026,10,31)));
        assertTrue(InvoicePaymentRules.paymentOpen(invoice,LocalDate.of(2026,11,1)));
        assertTrue(InvoicePaymentRules.paymentOpen(invoice,LocalDate.of(2026,12,20)));
        assertThrows(com.thangit.boardinghouse.common.exception.AuthException.class,()->InvoicePaymentRules.requireOpen(invoice,LocalDate.of(2026,10,31)));
    }
    @Test void legacyNullAndJdbcDatesAreSupported(){
        assertTrue(InvoicePaymentRules.paymentOpen(java.util.Map.of(),LocalDate.of(2020,1,1)));
        assertTrue(InvoicePaymentRules.paymentOpen(java.util.Map.of("payment_available_from",java.sql.Date.valueOf("2026-11-01")),LocalDate.of(2026,11,1)));
    }
    private final LocalDate due=LocalDate.of(2026,11,5);
    @Test void deadlineIsInclusiveAndLatePaymentKeepsOriginalDeadline(){
        var balance=new BigDecimal("4300000");
        assertEquals("ISSUED",InvoicePaymentRules.effectiveStatus("ISSUED",balance,due,LocalDate.of(2026,11,3)));
        assertEquals("ISSUED",InvoicePaymentRules.effectiveStatus("ISSUED",balance,due,due));
        assertEquals("OVERDUE",InvoicePaymentRules.effectiveStatus("ISSUED",balance,due,due.plusDays(1)));
        assertEquals("PAID",InvoicePaymentRules.effectiveStatus("PAID",BigDecimal.ZERO,due,due.plusDays(3)));
        assertEquals(3,InvoicePaymentRules.lateDays(due,LocalDate.of(2026,11,8)));
        assertEquals(0,InvoicePaymentRules.lateDays(due,LocalDate.of(2026,11,3)));
    }
    @Test void exceptionalShortReceiptRemainsOverdue(){
        assertEquals("OVERDUE",InvoicePaymentRules.effectiveStatus("PARTIALLY_PAID",new BigDecimal("300000"),due,due.plusDays(1)));
    }
    @Test void draftsAndCancelledInvoicesAreNeverOverdue(){
        for(String status:java.util.List.of("DRAFT","PENDING_REVIEW","CANCELLED"))
            assertEquals(status,InvoicePaymentRules.effectiveStatus(status,BigDecimal.ONE,due,due.plusDays(10)));
    }
}
