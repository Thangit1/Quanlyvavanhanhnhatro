package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AccountProvisioningService;
import com.thangit.boardinghouse.service.AccountProvisioningService.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/admin/account-provisioning")
public class AccountProvisioningController {
    private final AccountProvisioningService service;
    public AccountProvisioningController(AccountProvisioningService service){this.service=service;}
    @GetMapping("/options") public ApiResponse<Map<String,Object>> options(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Thông tin tạo tài khoản",service.options(p));}
    @PostMapping public ResponseEntity<ApiResponse<Result>> create(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Create r){return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(ApiResponse.success("Đã tạo hoặc liên kết tài khoản",service.create(p,r)));}
    @PostMapping("/{user}/reset-password") public ResponseEntity<ApiResponse<Result>> reset(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long user,@Valid @RequestBody Reason r){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.success("Mật khẩu khởi tạo mới chỉ hiển thị một lần",service.reset(p,user,r)));}
    @PutMapping("/{user}") public ApiResponse<Void> edit(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long user,@Valid @RequestBody Edit r){service.edit(p,user,r);return ApiResponse.success("Đã cập nhật thông tin tài khoản",null);}
    @PutMapping("/{user}/status") public ApiResponse<Void> status(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long user,@Valid @RequestBody Status r){service.status(p,user,r);return ApiResponse.success("Đã cập nhật trạng thái",null);}
}
