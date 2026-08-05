package com.thangit.boardinghouse.dto.request.occupant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public final class TenantCoOccupantRequests {
    private TenantCoOccupantRequests() {}

    public record EmergencyContact(
            @NotBlank @Size(max = 150) String fullName,
            @NotBlank @Pattern(regexp = "^(?:\\+84|0)(?:3|5|7|8|9)\\d{8}$") String phone,
            @NotBlank @Size(max = 100) String relationship) {}

    public record IdentityDocument(
            @NotBlank String type,
            @NotBlank @Size(max = 50) String number,
            LocalDate issuedDate,
            LocalDate expiresDate,
            @Size(max = 255) String issuedPlace) {}

    public record CreateRequest(
            @NotBlank @Size(max = 150) String fullName,
            @NotNull LocalDate dateOfBirth,
            @Size(max = 20) String gender,
            @NotBlank @Pattern(regexp = "^(?:\\+84|0)(?:3|5|7|8|9)\\d{8}$") String phone,
            @Email @Size(max = 255) String email,
            @NotBlank @Size(max = 500) String permanentAddress,
            @Size(max = 255) String hometown,
            @Size(max = 100) String nationality,
            @Size(max = 150) String occupation,
            @Size(max = 255) String workplace,
            @NotBlank @Size(max = 100) String relationship,
            @Valid EmergencyContact emergencyContact,
            @NotNull @Valid IdentityDocument identityDocument,
            @NotNull @FutureOrPresent LocalDate expectedMoveInDate,
            LocalDate expectedMoveOutDate,
            @Size(max = 500) String previousAddress,
            @NotBlank @Size(min = 10, max = 1000) String reason,
            @Size(max = 1000) String note,
            boolean requestAccount) {}

    public record AdditionalInformation(
            @NotBlank @Size(min = 3, max = 2000) String content,
            @NotNull Long version) {}

    public record CancelRequest(
            @NotBlank @Size(min = 3, max = 300) String reason,
            @Size(max = 1000) String note,
            @NotNull Long version) {}

    public record MoveOutRequest(
            @NotNull @FutureOrPresent LocalDate expectedMoveOutDate,
            @NotBlank @Size(min = 3, max = 1000) String reason,
            @Size(max = 1000) String note,
            @NotBlank @Pattern(regexp = "^(?:\\+84|0)(?:3|5|7|8|9)\\d{8}$") String contactPhone) {}
}
