package com.thangit.boardinghouse.dto.request.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public final class TenantNotificationRequests {
    private TenantNotificationRequests() {}
    public record BulkAction(@NotEmpty @Size(max=100) List<Long> notificationIds,@NotBlank String action) {}
    public record QuietHours(boolean enabled,LocalTime start,LocalTime end) {}
    public record Preferences(@NotNull Boolean inApp,@NotNull Boolean email,
                              @NotNull Map<String,Boolean> categories,@NotBlank String digestMode,
                              @NotNull QuietHours quietHours,Long version) {}
}
