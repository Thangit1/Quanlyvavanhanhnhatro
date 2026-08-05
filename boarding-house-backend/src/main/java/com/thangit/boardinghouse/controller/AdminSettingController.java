package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.*;
import com.thangit.boardinghouse.dto.response.setting.AdminSettingResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminSettingService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/settings")
public class AdminSettingController {
    private final AdminSettingService service;

    public AdminSettingController(AdminSettingService service) { this.service = service; }

    @GetMapping("/overview")
    public ApiResponse<Overview> overview(@AuthenticationPrincipal AuthenticatedUser principal) {
        return ApiResponse.success("Lấy tổng quan cài đặt thành công.", service.overview(principal));
    }
    @GetMapping("/general")
    public ApiResponse<General> general(@AuthenticationPrincipal AuthenticatedUser principal) {
        return ApiResponse.success("Lấy cài đặt chung thành công.", service.general(principal));
    }
    @PutMapping("/general")
    public ApiResponse<General> updateGeneral(@AuthenticationPrincipal AuthenticatedUser principal,
                                               @Valid @RequestBody UpdateGeneral request) {
        return ApiResponse.success("Cài đặt đã được lưu thành công.", service.updateGeneral(principal, request));
    }
    @GetMapping("/properties/{propertyId}")
    public ApiResponse<PropertySetting> property(@AuthenticationPrincipal AuthenticatedUser principal,
                                                  @PathVariable long propertyId) {
        return ApiResponse.success("Lấy cấu hình khu trọ thành công.", service.property(principal, propertyId));
    }
    @PutMapping("/properties/{propertyId}")
    public ApiResponse<PropertySetting> updateProperty(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long propertyId, @Valid @RequestBody UpdateProperty request) {
        return ApiResponse.success("Cài đặt khu trọ đã được lưu.", service.updateProperty(principal, propertyId, request));
    }
    @GetMapping("/billing")
    public ApiResponse<Billing> billing(@AuthenticationPrincipal AuthenticatedUser principal) {
        return ApiResponse.success("Lấy cài đặt hóa đơn thành công.", service.billing(principal));
    }
    @PutMapping("/billing")
    public ApiResponse<Billing> updateBilling(@AuthenticationPrincipal AuthenticatedUser principal,
                                               @Valid @RequestBody UpdateBilling request) {
        return ApiResponse.success("Cài đặt hóa đơn đã được lưu.", service.updateBilling(principal, request));
    }
    @GetMapping("/ai")
    public ApiResponse<Ai> ai(@AuthenticationPrincipal AuthenticatedUser principal) {
        return ApiResponse.success("Lấy cấu hình AI thành công.", service.ai(principal));
    }
    @PutMapping("/ai")
    public ApiResponse<Ai> updateAi(@AuthenticationPrincipal AuthenticatedUser principal,
                                     @Valid @RequestBody UpdateAi request) {
        return ApiResponse.success("Cấu hình AI đã được lưu.", service.updateAi(principal, request));
    }
    @PostMapping("/ai/test-connection")
    public ApiResponse<ConnectionTest> testAi(@AuthenticationPrincipal AuthenticatedUser principal) {
        return ApiResponse.success("Đã kiểm tra cấu hình AI.", service.testAi(principal));
    }
    @GetMapping("/audit-logs")
    public ApiResponse<AuditPage> auditLogs(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) String group, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success("Lấy nhật ký thay đổi thành công.", service.auditLogs(principal, group, page, size));
    }
    @GetMapping("/{group}")
    public ApiResponse<GroupSettings> group(@AuthenticationPrincipal AuthenticatedUser principal,
                                             @PathVariable String group) {
        return ApiResponse.success("Lấy nhóm cài đặt thành công.", service.group(principal, group));
    }
    @PutMapping("/{group}")
    public ApiResponse<GroupSettings> updateGroup(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable String group, @RequestBody UpdateGroup request) {
        return ApiResponse.success("Cài đặt đã được lưu thành công.", service.updateGroup(principal, group, request));
    }
}
