package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.notification.TenantNotificationRequests.Preferences;
import com.thangit.boardinghouse.dto.response.notification.TenantNotificationResponses.PreferenceData;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantNotificationService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tenant/notification-preferences")
public class TenantNotificationPreferenceController {
    private final TenantNotificationService service;
    public TenantNotificationPreferenceController(TenantNotificationService service){this.service=service;}
    @GetMapping public ApiResponse<PreferenceData> get(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy cài đặt thông báo thành công.",service.preferences(p));}
    @PutMapping public ApiResponse<PreferenceData> update(@AuthenticationPrincipal AuthenticatedUser p,@Valid@RequestBody Preferences request){return ApiResponse.success("Cài đặt thông báo đã được cập nhật.",service.preferences(p,request));}
}
