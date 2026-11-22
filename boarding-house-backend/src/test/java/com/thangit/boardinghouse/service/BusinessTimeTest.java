package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class BusinessTimeTest {
    @Test void deadlineIsInclusiveAndAllBusinessReadersUseTheFixedClock(){
        Object original=ReflectionTestUtils.getField(BusinessTime.class,"clock");
        try{
            for(String date:new String[]{"2026-10-28","2026-11-03","2026-11-05","2026-11-06","2026-11-10"}){
                LocalDate today=LocalDate.parse(date);
                ReflectionTestUtils.setField(BusinessTime.class,"clock",Clock.fixed(today.atTime(12,0).atZone(BusinessTime.ZONE).toInstant(),BusinessTime.ZONE));
                assertThat(BusinessTime.today()).isEqualTo(today);
                assertThat(CommunicationService.now()).isEqualTo(today.atTime(12,0));
                assertThat(InvoicePaymentRules.effectiveStatus("UNPAID",new BigDecimal("4200000"),LocalDate.of(2026,11,5),BusinessTime.today())).isEqualTo(today.isAfter(LocalDate.of(2026,11,5))?"OVERDUE":"UNPAID");
                assertThat(InvoicePaymentRules.effectiveStatus("PAID",BigDecimal.ZERO,LocalDate.of(2026,11,5),BusinessTime.today())).isEqualTo("PAID");
            }
        }finally{ReflectionTestUtils.setField(BusinessTime.class,"clock",original);}
    }
    @Test void smtpSandboxAllowlistRejectsRealAndExampleRecipients(){
        assertThat(DemoSmtpSandbox.allowed("tenant-a@test.invalid")).isTrue();
        assertThat(DemoSmtpSandbox.allowed("tenant-test@example.com")).isFalse();
        assertThat(DemoSmtpSandbox.allowed("customer@gmail.com")).isFalse();
        assertThat(DemoSmtpSandbox.allowed("tenant-a@test.invalid.evil.com")).isFalse();
        assertThat(DemoSmtpSandbox.allowed("tenant-a@test.invalid\r\nRCPT TO:<evil@example.com>")).isFalse();
    }
}
