package com.thangit.boardinghouse.dto.response.occupant;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TenantCoOccupantResponses {
    private TenantCoOccupantResponses() {}

    public record Page<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}
    public record RoomInfo(Long id, String propertyName, String address, String buildingName,
                           String floorName, String roomCode, String roomType, BigDecimal area,
                           int currentOccupantCount, int maximumOccupants, int availableSlots,
                           String capacityStatus, String status) {}
    public record ContractInfo(Long id, String code, LocalDate endDate, String status, String representativeName) {}
    public record Summary(int activeOccupantCount, int representativeCount, int coOccupantCount,
                          int pendingRequestCount, int temporaryResidencePendingCount) {}
    public record OverviewPermissions(boolean canCreateOccupantRequest, boolean canViewHistory, String createDisabledReason) {}
    public record Overview(RoomInfo room, ContractInfo contract, Summary summary, OverviewPermissions permissions) {}
    public record OccupantPermissions(boolean canViewDetail, boolean canRequestMoveOut, boolean canAddDocuments) {}
    public record OccupantRow(Long id, String tenantCode, String fullName, String avatarUrl,
                              String residenceRole, LocalDate moveInDate, String maskedPhone,
                              String relationship, String residenceStatus,
                              String temporaryResidenceStatus, String accountStatus,
                              boolean profileCompleted, OccupantPermissions permissions) {}
    public record TemporaryResidence(String status, LocalDate registeredAt, LocalDate completedAt,
                                     LocalDate expiresAt, String publicNote) {}
    public record ResidencePeriod(Long id, String propertyName, String roomCode, String residenceRole,
                                  LocalDate moveInDate, LocalDate moveOutDate, String status, String relationship) {}
    public record OccupantDetail(Long id, String tenantCode, String fullName, String avatarUrl,
                                 LocalDate dateOfBirth, String gender, String maskedPhone, String maskedEmail,
                                 String residenceRole, String relationship, String occupation, String workplace,
                                 LocalDate moveInDate, String residenceStatus, String accountStatus,
                                 TemporaryResidence temporaryResidence, List<ResidencePeriod> history,
                                 OccupantPermissions permissions) {}
    public record RequestPermissions(boolean canCancel, boolean canUpdate,
                                     boolean canSubmitAdditionalInformation) {}
    public record RequestRow(Long id, String requestCode, String personName, String requestType,
                             String status, String informationRequest, LocalDateTime submittedAt,
                             LocalDateTime updatedAt, RequestPermissions permissions) {}
    public record PersonInfo(String fullName, LocalDate dateOfBirth, String gender, String maskedPhone,
                             String maskedEmail, String relationship, String occupation, String workplace,
                             String maskedIdentityNumber, String identityType) {}
    public record ResidenceInfo(String propertyName, String roomCode, LocalDate expectedMoveInDate,
                                LocalDate expectedMoveOutDate, String reason, String note) {}
    public record DocumentInfo(Long id, String documentType, String originalName,
                               String contentType, long fileSize, LocalDateTime uploadedAt, boolean downloadable) {}
    public record TimelineItem(Long id, String eventType, String description, String actorName,
                               LocalDateTime occurredAt) {}
    public record InformationRequest(String message, LocalDate deadline) {}
    public record RequestDetail(Long id, String requestCode, String requestType, String status, long version,
                                LocalDateTime submittedAt, LocalDateTime updatedAt, PersonInfo person,
                                ResidenceInfo residence, List<DocumentInfo> documents,
                                TemporaryResidence temporaryResidence, InformationRequest informationRequest,
                                String publicFeedback, List<TimelineItem> publicTimeline,
                                RequestPermissions permissions) {}
    public record Created(Long id, String requestCode, String status) {}
    public record ActionResult(Long id, String status, long version) {}
    public record Uploaded(List<Long> documentIds) {}
    public record FileData(String fileName, String contentType, byte[] content) {}
}
