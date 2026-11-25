package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.response.dashboard.DashboardResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.DashboardService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service = service; }
    @GetMapping("/dashboard")
    public ApiResponse<DashboardResponse> dashboard(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) Long propertyId,
            @RequestParam(defaultValue = "MONTH") String period) {
        return ApiResponse.success("Lấy dữ liệu dashboard thành công.",
                service.getDashboard(principal, propertyId, period));
    }
}
