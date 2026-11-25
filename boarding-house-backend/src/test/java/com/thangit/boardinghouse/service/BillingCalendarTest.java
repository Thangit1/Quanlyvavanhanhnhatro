package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import org.junit.jupiter.api.Test;

class BillingCalendarTest {
    @Test void missingDaysUseLastDayIncludingLeapYears(){
        for(int day=29;day<=31;day++){
            assertEquals(LocalDate.of(2026,2,28),BillingCalendar.day(YearMonth.of(2026,2),day));
            assertEquals(LocalDate.of(2028,2,29),BillingCalendar.day(YearMonth.of(2028,2),day));
        }
        assertEquals(LocalDate.of(2026,4,30),BillingCalendar.day(YearMonth.of(2026,4),31));
    }
    @Test void octoberCollectionEndsOnFifthOfNovember(){
        assertEquals(LocalDate.of(2026,11,5),BillingCalendar.nextDueDate(LocalDate.of(2026,10,28),5));
    }
    @Test void fifthIsStillPayableOnFifth(){
        assertEquals(LocalDate.of(2026,11,5),BillingCalendar.nextDueDate(LocalDate.of(2026,11,5),5));
    }
    @Test void nextMonthKeepsConfiguredDayInsteadOfClampedDay(){
        assertEquals(LocalDate.of(2026,3,30),BillingCalendar.nextDueDate(LocalDate.of(2026,3,1),30));
        assertEquals(LocalDate.of(2026,2,28),BillingCalendar.nextDueDate(LocalDate.of(2026,2,27),31));
        assertEquals(LocalDate.of(2026,3,1),BillingCalendar.nextDueDate(LocalDate.of(2026,2,28),1));
    }
    @Test void invalidPolicyDaysAreRejected(){
        assertThrows(IllegalArgumentException.class,()->BillingCalendar.day(YearMonth.of(2026,1),0));
        assertThrows(IllegalArgumentException.class,()->BillingCalendar.day(YearMonth.of(2026,1),32));
    }
}
