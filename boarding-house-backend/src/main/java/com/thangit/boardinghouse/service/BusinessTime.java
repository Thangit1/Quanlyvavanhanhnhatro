package com.thangit.boardinghouse.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** Business dates share one clock. Authentication/token expiry continues to use real time.
 * There is deliberately no configuration property or HTTP endpoint to change this clock.
 * The isolated test runtime supplies a fixed Clock using Spring's test utilities.
 */
public final class BusinessTime {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static volatile Clock clock = Clock.system(ZONE);
    private BusinessTime() {}
    public static LocalDate today() { return LocalDate.now(clock); }
    public static LocalDate today(ZoneId zone) { return LocalDate.now(clock.withZone(zone)); }
    public static LocalDateTime now() { return LocalDateTime.now(clock); }
    public static LocalDateTime now(ZoneId zone) { return LocalDateTime.now(clock.withZone(zone)); }
}
