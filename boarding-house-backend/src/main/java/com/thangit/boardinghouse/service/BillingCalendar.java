package com.thangit.boardinghouse.service;

import java.time.LocalDate;
import java.time.YearMonth;

/** Monthly policy: a day absent from a month means that month's last day. */
public final class BillingCalendar {
    private BillingCalendar() {}
    public static LocalDate day(YearMonth month, int configuredDay) {
        if(configuredDay<1||configuredDay>31)throw new IllegalArgumentException("Billing day must be between 1 and 31");
        return month.atDay(Math.min(configuredDay,month.lengthOfMonth()));
    }
    public static LocalDate nextDueDate(LocalDate issueDate,int configuredDay) {
        YearMonth month=YearMonth.from(issueDate);
        LocalDate due=day(month,configuredDay);
        return due.isBefore(issueDate)?day(month.plusMonths(1),configuredDay):due;
    }
}
