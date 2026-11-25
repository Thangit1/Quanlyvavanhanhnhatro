package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.response.tenant.TenantHomeResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantHomeService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tenant")
public class TenantHomeController {
    private final TenantHomeService service;
    public TenantHomeController(TenantHomeService service) { this.service = service; }
    @GetMapping("/home")
    public ApiResponse<TenantHomeResponse> home(@AuthenticationPrincipal AuthenticatedUser principal) {
        return ApiResponse.success("Lấy dữ liệu trang chủ thành công.", service.getHome(principal));
    }
}
