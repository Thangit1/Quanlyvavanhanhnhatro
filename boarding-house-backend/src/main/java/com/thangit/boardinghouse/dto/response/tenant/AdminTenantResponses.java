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
                          long movedOut, long temporaryRegistered, long temporaryPending, long noAccount) {}
    public record TenantRow(Long id, String tenantCode, String fullName, String phone, String email,
                            String avatarUrl, String propertyName, String roomCode, String buildingName,
                            String residenceRole, String status, String contractCode, LocalDate contractEndDate,
                            BigDecimal outstandingDebt, String temporaryResidenceStatus,
                            boolean hasAccount, String accountStatus) {}
    public record Page<T>(List<T> items, int page, int size, long totalElements, int totalPages) {}
    public record TenantList(List<PropertyOption> properties, List<RoomOption> rooms,
                             Summary summary, Page<TenantRow> page) {}
    public record Residence(Long id, Long propertyId, String propertyName, Long roomId, String roomCode,
                            String buildingName, Long contractId, String contractCode, String residenceRole,
                            String status, LocalDate moveInDate, LocalDate moveOutDate, String note) {}
    public record ContractItem(Long id, String code, String status, LocalDate startDate, LocalDate endDate,
                               BigDecimal depositAmount, BigDecimal outstandingDebt) {}
    public record InvoiceItem(Long id, String code, LocalDate billingPeriod, BigDecimal totalAmount,
                              BigDecimal paidAmount, LocalDate dueDate, String status) {}
    public record TemporaryResidenceItem(Long propertyId, String propertyName, String registrationCode,
                                         LocalDate registeredAt, LocalDate expiresAt, String status, String note) {}
    public record DocumentItem(Long id, String documentType, String originalName, String contentType,
                               long fileSize, LocalDateTime uploadedAt) {}
    public record ActivityItem(Long id, String action, String description, String actorName,
                               LocalDateTime createdAt) {}
    public record TenantDetail(Long id, String tenantCode, Long userId, String fullName, LocalDate dateOfBirth,
                               String gender, String phone, String email, String avatarUrl,
                               String permanentAddress, String occupation, String workplace,
                               String emergencyContactName, String emergencyContactPhone,
                               String identityType, String maskedIdentityNumber, LocalDate identityIssuedDate,
                               String identityIssuedPlace, String note, String status,
                               boolean hasAccount, String accountStatus, List<Residence> residences,
                               List<ContractItem> contracts, List<InvoiceItem> invoices,
                               List<TemporaryResidenceItem> temporaryResidences,
                               List<DocumentItem> documents, List<ActivityItem> activities) {}
    public record CreatedTenant(Long id, String tenantCode) {}
}
