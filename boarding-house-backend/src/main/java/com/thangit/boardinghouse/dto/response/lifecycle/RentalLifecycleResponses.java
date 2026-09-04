package com.thangit.boardinghouse.dto.response.lifecycle;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class RentalLifecycleResponses {
    private RentalLifecycleResponses() {}

    public record Option(Long id, String code, String name, Long parentId, String status) {}
    public record Summary(long reserved, long awaitingCheckin, long staying, long checkoutRequested,
                          long settlementPending, long cleaningOrMaintenance) {}
    public record BookingRow(Long id, String code, Long tenantProfileId, String tenantName,
                             Long propertyId, String propertyName, Long roomId, String roomCode,
                             LocalDate reservationStart, LocalDate reservationEnd, BigDecimal depositAmount,
                             String depositStatus, String status, Long contractId, long version,
                             LocalDateTime updatedAt) {}
    public record CheckinRow(Long id, Long contractId, String contractCode, String tenantName,
                             String propertyName, Long roomId, String roomCode, LocalDate scheduledDate,
                             LocalDateTime actualCheckinAt, String status, boolean identityVerified,
                             boolean contractVerified, boolean depositVerified, BigDecimal electricityReading,
                             BigDecimal waterReading, int keysCardsCount, long version) {}
    public record CheckoutRow(Long id, Long contractId, String contractCode, String tenantName,
                              String propertyName, Long roomId, String roomCode, LocalDate requestedDate,
                              LocalDate confirmedDate, LocalDateTime actualCheckoutAt, String status,
                              BigDecimal depositHeld, BigDecimal outstandingDebt, BigDecimal additionalCharges,
                              BigDecimal refundAmount, BigDecimal balanceDue, String reason, long version) {}
    public record LifecycleBoard(Summary summary, List<Option> properties, List<Option> rooms,
                                 List<Option> tenants, List<Option> contracts,
                                 List<BookingRow> bookings, List<CheckinRow> checkins,
                                 List<CheckoutRow> checkouts) {}
    public record Created(Long id, String code, String status) {}
    public record Settlement(Long checkoutId, BigDecimal depositHeld, BigDecimal outstandingDebt,
                             BigDecimal additionalCharges, BigDecimal refundAmount,
                             BigDecimal balanceDue, String roomStatus) {}
}
