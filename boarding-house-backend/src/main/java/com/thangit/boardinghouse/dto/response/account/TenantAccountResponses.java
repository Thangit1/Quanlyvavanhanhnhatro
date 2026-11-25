package com.thangit.boardinghouse.dto.response.account;

import java.time.*;
import java.util.List;

public final class TenantAccountResponses {
    private TenantAccountResponses() {}
    public record Account(Long id,String username,String email,boolean emailVerified,String phone,
                          boolean phoneVerified,String status,String role,LocalDateTime createdAt,LocalDateTime lastLoginAt) {}
    public record Profile(Long id,String tenantCode,String fullName,String avatarUrl,LocalDate dateOfBirth,
                          String gender,String nationality,String occupation,String workplace,String profileStatus,
                          int completionPercent,List<String> missingFields,long version) {}
    public record Residence(Long propertyId,String propertyName,String address,String buildingName,String floorName,
                            Long roomId,String roomCode,String residenceRole,String residenceStatus,
                            LocalDate moveInDate,String temporaryResidenceStatus) {}
    public record Contract(Long id,String contractCode,LocalDate startDate,LocalDate endDate,String status) {}
    public record Security(boolean twoFactorSupported,boolean twoFactorEnabled,long activeSessionCount,
                           LocalDateTime passwordChangedAt,String currentDevice) {}
    public record PendingActions(long documentCount,long profileUpdateRequestCount,long temporaryResidenceActionCount) {}
    public record Permissions(boolean canEditProfile,boolean canChangePassword,boolean canManageSessions,
                              boolean canUploadDocuments,boolean canRequestAccountDeactivation) {}
    public record Overview(Account account,Profile profile,Residence residence,Contract contract,Security security,
                           PendingActions pendingActions,Permissions permissions) {}
    public record EmergencyContact(String fullName,String relationship,String phone,String address) {}
    public record ProfileData(Profile profile,String phone,String contactEmail,boolean emailVerified,
                              boolean phoneVerified,String permanentAddress,EmergencyContact emergencyContact,
                              String accountStatus,String residenceRole,String roomCode,String contractCode,
                              String temporaryResidenceStatus,LocalDate residenceStartDate) {}
    public record UpdateResult(ProfileData profile,boolean pendingVerification) {}
    public record UpdateRequestRow(Long id,String status,String reason,String note,String publicResponse,
                                   LocalDateTime createdAt,LocalDateTime reviewedAt) {}
    public record DocumentRow(Long id,String documentType,String maskedNumber,String originalName,String contentType,
                              long fileSize,LocalDate issueDate,LocalDate expiresAt,String verificationStatus,
                              String publicNote,String documentSide,LocalDateTime uploadedAt,long version) {}
    public record SessionRow(Long id,String deviceName,String browser,String operatingSystem,String maskedIpAddress,
                             boolean currentSession,boolean active,LocalDateTime createdAt,LocalDateTime lastActiveAt) {}
    public record PreferenceData(String language,String theme,String timezone,String dateFormat,String timeFormat,
                                 boolean reducedMotion,long version) {}
    public record ActivityRow(Long id,String action,String description,LocalDateTime createdAt,String targetUrl) {}
    public record Page<T>(List<T> content,int page,int size,long totalElements,int totalPages) {}
    public record SupportInfo(String phone,String email,String workingHours,boolean attachmentSupported) {}
    public record SupportResult(Long id,String code,String status,LocalDateTime createdAt) {}
    public record ActionResult(int affected) {}
    public record FileData(String originalName,String contentType,byte[] content) {}
}
