package com.thangit.boardinghouse.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Set;

/** Date-only invoice deadlines are inclusive in the company's business timezone. */
public final class InvoicePaymentRules {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> NON_COLLECTIBLE = Set.of("DRAFT", "PENDING_REVIEW", "CANCELLED", "PAID");
    private InvoicePaymentRules() {}

    public static String effectiveStatus(String status, BigDecimal balance, LocalDate due, LocalDate today) {
        return !NON_COLLECTIBLE.contains(status) && balance.signum() > 0 && due != null && today.isAfter(due)
                ? "OVERDUE" : status;
    }

    public static long lateDays(LocalDate due, LocalDate paidOrToday) {
        return due == null || paidOrToday == null ? 0 : Math.max(0, ChronoUnit.DAYS.between(due, paidOrToday));
    }
}
