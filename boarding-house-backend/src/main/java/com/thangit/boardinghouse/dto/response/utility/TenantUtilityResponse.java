package com.thangit.boardinghouse.dto.response.utility;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TenantUtilityResponse(
        List<RoomOption> rooms,
        Long selectedContractId,
        LocalDate selectedPeriod,
        LocalDate periodStart,
        LocalDate periodEnd,
        RoomInfo room,
        Reading reading,
        List<HistoryItem> history
) {
    public record RoomOption(Long contractId, Long roomId, String roomCode, String propertyName) {}

    public record RoomInfo(Long roomId, String roomCode, String propertyName, String propertyAddress) {}

    public record Reading(
            Long id,
            String status,
            Utility electricity,
            Utility water,
            BigDecimal totalAmount,
            InvoiceLink invoice
    ) {}

    public record Utility(
            BigDecimal previousIndex,
            BigDecimal currentIndex,
            BigDecimal usage,
            BigDecimal unitPrice,
            BigDecimal amount,
            boolean complete,
            boolean valid
    ) {}

    public record InvoiceLink(Long id, String code, String status) {}

    public record HistoryItem(
            LocalDate period,
            BigDecimal electricityUsage,
            BigDecimal electricityAmount,
            BigDecimal waterUsage,
            BigDecimal waterAmount,
            boolean electricityValid,
            boolean waterValid,
            Long invoiceId
    ) {}
}
