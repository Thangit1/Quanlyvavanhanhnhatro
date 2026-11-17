package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class InvoicePaymentRulesTest {
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
