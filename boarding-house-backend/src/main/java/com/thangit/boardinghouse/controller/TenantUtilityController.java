package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.response.utility.TenantUtilityResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantUtilityService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/tenant/utilities")
public class TenantUtilityController {
    private final TenantUtilityService service;

    public TenantUtilityController(TenantUtilityService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<TenantUtilityResponse> utilities(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) Long contractId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate period) {
        return ApiResponse.success("Lấy dữ liệu điện nước thành công.",
                service.getUtilities(principal, contractId, period));
    }
}
