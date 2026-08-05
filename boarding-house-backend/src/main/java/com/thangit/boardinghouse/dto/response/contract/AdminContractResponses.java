package com.thangit.boardinghouse.dto.response.contract;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminContractResponses {
    private AdminContractResponses() {}

    public record PropertyOption(Long id, String name) {}
    public record Summary(long total, long active, long expiring, long pendingConfirmation,
                          long terminationRequested, long ended) {}
    public record ContractRow(Long id, String contractCode, Long tenantId, String tenantCode,
                              String tenantName, String tenantPhone, Long propertyId, String propertyName,
                              Long roomId, String roomCode, LocalDate startDate, LocalDate endDate,
                              BigDecimal monthlyRent, BigDecimal depositAmount, long daysRemaining,
                              String status, boolean hasDocument, LocalDateTime updatedAt) {}
    public record Page<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}
    public record ContractList(Summary summary, List<PropertyOption> properties, Page<ContractRow> page) {}
    public record ContractDetail(Long id, String contractCode, Long tenantId, String tenantCode,
                                 String tenantName, String tenantPhone, Long propertyId, String propertyName,
                                 Long roomId, String roomCode, LocalDate startDate, LocalDate endDate,
                                 BigDecimal monthlyRent, BigDecimal depositAmount, long daysRemaining,
                                 String status, boolean hasDocument, LocalDateTime updatedAt,
                                 String contractType, LocalDateTime createdAt, LocalDateTime signedAt,
                                 String paymentCycle, Integer paymentDueDay, Integer noticePeriodDays,
                                 String propertyAddress, String buildingName, String floorName,
                                 String roomType, String tenantEmail, String maskedIdentityNumber,
                                 BigDecimal reservationAmount, BigDecimal managementFee,
                                 BigDecimal fixedServiceFee, BigDecimal discountAmount,
                                 int occupantCount, int documentCount, String note) {}
}
