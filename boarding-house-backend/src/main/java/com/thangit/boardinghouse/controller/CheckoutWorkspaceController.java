package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.CheckoutWorkspaceService;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping({"/api/admin/checkout-workspace","/api/accountant/checkout-workspace"})
public class CheckoutWorkspaceController {
 private final CheckoutWorkspaceService service;
 public CheckoutWorkspaceController(CheckoutWorkspaceService service){this.service=service;}
 @GetMapping("/options") public ApiResponse<Map<String,Object>> options(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Phạm vi trả phòng",service.options(p));}
 @PostMapping("/{id}/assignment") public ApiResponse<Void> assign(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@jakarta.validation.Valid @RequestBody CheckoutWorkspaceService.Assignment r){service.assign(p,id,r);return ApiResponse.success("Đã phân công và thông báo lịch kiểm kê",null);}
 @GetMapping public ApiResponse<Map<String,Object>> read(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId,@RequestParam(required=false) Long organizationId,@RequestParam(required=false) Long roomId,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,@RequestParam(required=false) String keyword,@RequestParam(required=false) String stage,@RequestParam(required=false) String financialStatus,@RequestParam(required=false) Long assignee,@RequestParam(required=false) Boolean disputed,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ApiResponse.success("Danh sách trả phòng",service.read(p,new CheckoutWorkspaceService.Filter(propertyId,organizationId,roomId,from,to,keyword,stage,financialStatus,assignee,disputed,page,size)));}
}
