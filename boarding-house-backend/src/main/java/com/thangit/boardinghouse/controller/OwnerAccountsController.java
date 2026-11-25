package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.OwnerAccountsService;
import com.thangit.boardinghouse.service.OwnerAccountsService.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/owner/accounts")
public class OwnerAccountsController {
    private final OwnerAccountsService service;
    public OwnerAccountsController(OwnerAccountsService service){this.service=service;}
    @GetMapping public ApiResponse<Map<String,Object>> list(@AuthenticationPrincipal AuthenticatedUser p,
            @RequestParam(required=false) Long propertyId,@RequestParam(required=false) Long areaId,
            @RequestParam(required=false) String role,@RequestParam(required=false) String keyword,
            @RequestParam(required=false) String status,@RequestParam(defaultValue="0") int page,
            @RequestParam(defaultValue="20") int size,@RequestParam(required=false) Long organizationId){return ApiResponse.success("Tài khoản & Nhân sự",service.list(p,propertyId,areaId,role,keyword,status,page,size,organizationId));}
    @GetMapping("/options") public ApiResponse<Map<String,Object>> options(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Phạm vi quản lý",service.options(p));}
    @GetMapping("/{user}") public ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long user,@RequestParam String role){return ApiResponse.success("Chi tiết nhân sự",service.detail(p,user,role));}
    @PutMapping("/{user}/assignments") public ApiResponse<Void> assign(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long user,@Valid @RequestBody Assignment r){service.assign(p,user,r);return ApiResponse.success("Đã cập nhật phân công",null);}
    @PostMapping("/{user}/assignments/{property}/revoke") public ApiResponse<Void> revoke(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long user,@PathVariable long property,@RequestParam String role,@Valid @RequestBody Reason r){service.revoke(p,user,role,property,r);return ApiResponse.success("Đã thu hồi phân công",null);}
    @PutMapping("/{user}/status") public ApiResponse<Void> status(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long user,@Valid @RequestBody ChangeStatus r){service.status(p,user,r);return ApiResponse.success("Đã cập nhật trạng thái",null);}
    @GetMapping("/invitations") public ApiResponse<List<Map<String,Object>>> invitations(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lời mời",service.invitations(p));}
    @PostMapping("/invitations") public ApiResponse<Map<String,Object>> invite(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Invite r){return ApiResponse.success("Đã tạo liên kết kích hoạt",service.invite(p,r));}
    @PostMapping("/invitations/{id}/resend") public ApiResponse<Map<String,Object>> resend(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reason r){return ApiResponse.success("Đã tạo lại lời mời",service.resend(p,id,r));}
    @PostMapping("/invitations/{id}/revoke") public ApiResponse<Void> revokeInvitation(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reason r){service.revokeInvitation(p,id,r);return ApiResponse.success("Đã thu hồi lời mời",null);}
    @GetMapping("/history") public ApiResponse<List<Map<String,Object>>> history(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(defaultValue="0") int page){return ApiResponse.success("Nhật ký quản trị",service.history(p,page));}
}
