package com.thangit.boardinghouse.dto.response.tenant;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminTenantResponses {
    private AdminTenantResponses() {}

    public record PropertyOption(Long id, String name) {}
    public record RoomOption(Long id, Long propertyId, String code, String buildingName, String floorName,
                             BigDecimal monthlyRent, int capacity, String status) {}
    public record Summary(long total, long active, long expiringContracts, long overdueDebt,
                          long movedOut, long temporaryRegistered, long temporaryPending, long noAccount,
                          long customersWithDebt, long pendingCheckin) {}
    public record TenantRow(Long id, String tenantCode, String fullName, String phone, String email,
                            String avatarUrl, String propertyName, String roomCode, String buildingName,
                            String residenceRole, String status, String contractCode, LocalDate contractEndDate,
                            LocalDate moveInDate, BigDecimal outstandingDebt, String financialStatus,
                            String temporaryResidenceStatus,
                            boolean hasAccount, String accountStatus) {}
    public record Page<T>(List<T> items, int page, int size, long totalElements, int totalPages) {}
    public record TenantList(List<PropertyOption> properties, List<RoomOption> rooms,
                             Summary summary, Page<TenantRow> page) {}
    public record Residence(Long id, Long propertyId, String propertyName, Long roomId, String roomCode,
                            String buildingName, Long contractId, String contractCode, String residenceRole,
                            String status, LocalDate moveInDate, LocalDate moveOutDate, String note) {}
    public record ContractItem(Long id, String code, String propertyName, String roomCode, String status,
                               LocalDate startDate, LocalDate endDate, BigDecimal monthlyRent,
                               BigDecimal depositAmount, String paymentCycle, BigDecimal outstandingDebt,
                               long daysToExpiry) {}
    public record InvoiceItem(Long id, String code, LocalDate billingPeriod, BigDecimal totalAmount,
                              BigDecimal paidAmount, BigDecimal roomAmount, BigDecimal serviceAmount,
                              LocalDate dueDate, String status) {}
    public record FinancialSummary(BigDecimal totalInvoiced, BigDecimal totalPaid,
                                   BigDecimal outstandingDebt, BigDecimal overdueDebt,
                                   BigDecimal depositHeld) {}
    public record PaymentItem(Long id, String receiptCode, String invoiceCode, BigDecimal amount,
                              String paymentMethod, String referenceCode, String status,
                              LocalDateTime paidAt) {}
    public record UtilityItem(Long id, LocalDate billingPeriod, BigDecimal electricityPrevious,
                              BigDecimal electricityCurrent, BigDecimal electricityConsumption,
                              BigDecimal electricityAmount, BigDecimal waterPrevious,
                              BigDecimal waterCurrent, BigDecimal waterConsumption,
                              BigDecimal waterAmount) {}
    public record CoResidentItem(Long id, String tenantCode, String fullName, String phone,
                                 String relationship, String residenceRole, LocalDate moveInDate,
                                 String status) {}
    public record MaintenanceItem(Long id, String code, String title, String issueType,
                                  String priority, String status, LocalDateTime createdAt) {}
    public record TemporaryResidenceItem(Long propertyId, String propertyName, String registrationCode,
                                         LocalDate registeredAt, LocalDate expiresAt, String status, String note) {}
    public record DocumentItem(Long id, String documentType, String originalName, String contentType,
                               long fileSize, LocalDateTime uploadedAt) {}
    public record ActivityItem(Long id, String action, String description, String actorName,
                               LocalDateTime createdAt) {}
    public record TenantDetail(Long id, String tenantCode, Long userId, String fullName, LocalDate dateOfBirth,
                               String gender, String phone, String email, String avatarUrl,
                               String permanentAddress, String hometown, String occupation, String workplace,
                               String emergencyContactName, String emergencyContactPhone,
                               String identityType, String maskedIdentityNumber, LocalDate identityIssuedDate,
                               String identityIssuedPlace, String note, String status,
                               boolean hasAccount, String accountStatus, List<Residence> residences,
                               List<ContractItem> contracts, List<InvoiceItem> invoices,
                               FinancialSummary financial, List<PaymentItem> payments,
                               List<UtilityItem> utilityReadings, List<CoResidentItem> coResidents,
                               List<MaintenanceItem> maintenanceRequests,
                               List<TemporaryResidenceItem> temporaryResidences,
                               List<DocumentItem> documents, List<ActivityItem> activities) {}
    public record CreatedTenant(Long id, String tenantCode) {}
}
