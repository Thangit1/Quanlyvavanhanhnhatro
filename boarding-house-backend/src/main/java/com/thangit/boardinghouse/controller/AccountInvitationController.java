package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.OwnerAccountsService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class AccountInvitationController {
    private final OwnerAccountsService service;
    public AccountInvitationController(OwnerAccountsService service){this.service=service;}
    @PostMapping("/api/auth/invitations/accept")
    public ApiResponse<Void> accept(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody OwnerAccountsService.Accept r){service.accept(p,r);return ApiResponse.success("Đã kích hoạt. Vui lòng đăng nhập lại để nhận vai trò mới.",null);}
}
