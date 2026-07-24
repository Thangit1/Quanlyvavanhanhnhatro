package com.thangit.boardinghouse.dto.request.tenant;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public final class AdminTenantRequests {
    private AdminTenantRequests() {}

    public record SaveTenant(
            @NotBlank @Size(max = 150) String fullName,
            LocalDate dateOfBirth,
            @Size(max = 20) String gender,
            @NotBlank @Pattern(regexp = "^[0-9+ .()-]{8,20}$", message = "Số điện thoại không hợp lệ") String phone,
            @Email @Size(max = 255) String email,
            @Size(max = 500) String permanentAddress,
            @Size(max = 150) String occupation,
            @Size(max = 255) String workplace,
            @Size(max = 150) String emergencyContactName,
            @Size(max = 20) String emergencyContactPhone,
            @Size(max = 30) String identityType,
            @Size(max = 50) String identityNumber,
            LocalDate identityIssuedDate,
            @Size(max = 255) String identityIssuedPlace,
            @Size(max = 1000) String note,
            Long propertyId,
            Long roomId,
            Long contractId,
            LocalDate moveInDate,
            @Size(max = 30) String residenceRole) {}

    public record TransferRoom(
            @NotNull Long toRoomId,
            @NotNull LocalDate transferDate,
            @Size(max = 500) String reason) {}

    public record MoveOut(
            @NotNull LocalDate moveOutDate,
            @Size(max = 500) String reason,
            boolean closeContract) {}

    public record AccountStatus(@NotBlank @Pattern(regexp = "ACTIVE|LOCKED|INACTIVE") String status) {}

    public record CreateAccount(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 72) String temporaryPassword) {}

    public record TemporaryResidence(
            @NotNull Long propertyId,
            @Size(max = 100) String registrationCode,
            LocalDate registeredAt,
            LocalDate expiresAt,
            @NotBlank @Pattern(regexp = "NOT_DECLARED|PENDING|REGISTERED|EXPIRED") String status,
            @Size(max = 500) String note) {}
}
