package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.InitialPasswordService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
public class InitialPasswordController {
    private final InitialPasswordService service;
    public InitialPasswordController(InitialPasswordService service){this.service=service;}
    @PostMapping("/api/auth/password-setup")
    public ApiResponse<Void> setup(@Valid @RequestBody InitialPasswordService.Setup request){service.completeSetup(request);return ApiResponse.success("Đã thiết lập mật khẩu. Vui lòng đăng nhập để xem hợp đồng.",null);}
    @PostMapping("/api/auth/change-initial-password")
    public ApiResponse<Void> change(@AuthenticationPrincipal AuthenticatedUser actor,@Valid @RequestBody InitialPasswordService.Change request){service.change(actor,request);return ApiResponse.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.",null);}
}
