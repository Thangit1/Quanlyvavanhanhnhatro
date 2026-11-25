package com.thangit.boardinghouse.dto.response.contract;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TenantContractResponses {
    private TenantContractResponses() {}

    public record ContractPage(List<ContractSummary> content, int page, int size,
                               long totalElements, int totalPages) {}

    public record ContractSummary(
            Long id, String contractCode, String propertyName, String propertyAddress,
            String roomCode, LocalDate startDate, LocalDate endDate, BigDecimal monthlyRent,
            BigDecimal depositAmount, long daysRemaining, String tenantRole, String status,
            boolean hasDocument, boolean canRequestExtension, boolean canRequestTermination
    ) {}

    public record ContractDetail(
            Long id, String contractCode, String contractType, String status,
            LocalDateTime createdAt, LocalDateTime signedAt, LocalDate startDate, LocalDate endDate,
            long daysRemaining, String paymentCycle, int paymentDueDay, int noticePeriodDays,
            PropertyInfo property, RoomInfo room, PartyInfo landlord, TenantPartyInfo tenant,
            FinancialInfo financial, List<RateInfo> utilityRates, List<ServiceInfo> services,
            List<OccupantInfo> occupants, List<AssetInfo> assets, List<TermInfo> terms,
            List<DocumentInfo> documents, List<HistoryInfo> history,
            RequestInfo extensionRequest, RequestInfo terminationRequest, Permissions permissions
    ) {}

    public record PropertyInfo(Long id, String name, String address, String buildingName, String floorName) {}
    public record RoomInfo(Long id, String roomCode, String roomType, BigDecimal area,
                           int maximumOccupants, int currentOccupants, String imageUrl, String status) {}
    public record PartyInfo(String fullName, String phone, String email, String address) {}
    public record TenantPartyInfo(String fullName, String phone, String email,
                                  String maskedIdentityNumber, String role) {}
    public record FinancialInfo(BigDecimal monthlyRent, BigDecimal depositAmount,
                                BigDecimal reservationAmount, BigDecimal managementFee,
                                BigDecimal fixedServiceFee, BigDecimal discountAmount) {}
    public record RateInfo(Long id, String code, String name, String calculationMethod,
                           BigDecimal unitPrice, String unit, LocalDate effectiveDate) {}
    public record ServiceInfo(Long id, String code, String name, String calculationMethod,
                              BigDecimal unitPrice, String billingCycle, LocalDate effectiveDate) {}
    public record OccupantInfo(Long id, String fullName, String relationship, LocalDate moveInDate,
                               String residenceStatus, String temporaryResidenceStatus,
                               String maskedIdentityNumber) {}
    public record AssetInfo(Long id, String name, int quantity, String handoverCondition,
                            String note, String imageUrl) {}
    public record TermInfo(Long id, String title, String content, int displayOrder) {}
    public record DocumentInfo(Long id, String originalName, String contentType, long fileSize,
                               LocalDateTime uploadedAt, String uploadedBy, boolean downloadable) {}
    public record HistoryInfo(Long id, String eventType, String description, String actorName,
                              String note, LocalDateTime occurredAt) {}
    public record RequestInfo(Long id, String status, LocalDate requestedDate,
                              String note, LocalDateTime createdAt) {}
    public record Permissions(boolean canDownload, boolean canPrint,
                              boolean canRequestExtension, boolean canRequestTermination) {}
    public record RequestCreated(Long id, String status, String message) {}
}
