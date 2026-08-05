package com.thangit.boardinghouse.dto.request.account;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.Map;

public final class TenantAccountRequests {
    private TenantAccountRequests() {}
    public record EmergencyContact(@Size(max=150) String fullName,@Size(max=100) String relationship,
                                   @Pattern(regexp="^$|^[0-9+ .()-]{8,20}$",message="Số điện thoại không hợp lệ") String phone,
                                   @Size(max=500) String address) {}
    public record UpdateProfile(@Size(max=150) String occupation,@Size(max=255) String workplace,
                                @Pattern(regexp="^[0-9+ .()-]{8,20}$",message="Số điện thoại không hợp lệ") String phone,
                                @Email @Size(max=255) String contactEmail,@Size(max=500) String addressDetail,
                                @Valid EmergencyContact emergencyContact,@NotNull Long version) {}
    public record FieldChange(@Size(max=1000) String oldValue,@NotBlank @Size(max=1000) String newValue) {}
    public record ProfileUpdateRequest(@NotEmpty Map<String,@Valid FieldChange> fieldChanges,
                                       @NotBlank @Size(max=500) String reason,@Size(max=1000) String note) {}
    public record ChangePassword(@NotBlank String currentPassword,
                                 @NotBlank @Size(min=8,max=72) String newPassword,
                                 @NotBlank String confirmPassword,boolean logoutOtherSessions) {}
    public record RevokeAllSessions(boolean keepCurrentSession) {}
    public record Preferences(@NotBlank @Pattern(regexp="vi") String language,
                              @NotBlank @Pattern(regexp="LIGHT|DARK|SYSTEM") String theme,
                              @NotBlank @Size(max=80) String timezone,
                              @NotBlank @Pattern(regexp="dd/MM/yyyy|MM/dd/yyyy|yyyy-MM-dd") String dateFormat,
                              @NotBlank @Pattern(regexp="HH:mm|hh:mm a") String timeFormat,
                              boolean reducedMotion,@NotNull Long version) {}
}
