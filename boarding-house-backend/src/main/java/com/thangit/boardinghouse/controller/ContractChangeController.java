package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.ContractChangeService;
import com.thangit.boardinghouse.service.ContractChangeService.*;
import com.thangit.boardinghouse.service.ResidentApprovalService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController
@RequestMapping({"/api/admin/contract-changes","/api/tenant/contract-changes"})
public class ContractChangeController {
    @GetMapping("/invitations") public ApiResponse<List<Map<String,Object>>> invitations(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lời mời xác nhận",changes.invitations(p));}
    private final ContractChangeService changes;private final ResidentApprovalService residents;
    public ContractChangeController(ContractChangeService changes,ResidentApprovalService residents){this.changes=changes;this.residents=residents;}
    @GetMapping("/contracts/{id}") public ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Hồ sơ thay đổi hợp đồng",changes.detail(p,id));}
    @GetMapping("/{id}") public ApiResponse<Map<String,Object>> requestDetail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Thỏa thuận",changes.requestDetail(p,id));}
    @PostMapping("/contracts/{id}") public ApiResponse<Long> request(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Request r){return ApiResponse.success("Đã ghi nhận yêu cầu",changes.request(p,id,r));}
    @PostMapping("/{id}/offer") public ApiResponse<Void> offer(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Action r){changes.offer(p,id,r);return ApiResponse.success("Đã duyệt nội dung, chờ các bên xác nhận",null);}
    @PostMapping("/{id}/confirm") public ApiResponse<Void> confirm(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Confirm r){changes.confirm(p,id,r);return ApiResponse.success("Đã xác nhận nội dung",null);}
    @PostMapping("/{id}/extension") public ApiResponse<Void> extension(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Action r){changes.applyExtension(p,id,r);return ApiResponse.success("Đã áp dụng phụ lục",null);}
    @PostMapping("/{id}/prepare") public ApiResponse<Void> prepare(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Action r){changes.prepareMove(p,id,r);return ApiResponse.success("Đã ghi nhận bước chuyển; tiếp tục bàn giao theo hồ sơ",null);}
    @PostMapping("/{id}/deposit-transfer") public ApiResponse<Void> deposit(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody MoveDeposit r){changes.transferDeposit(p,id,r);return ApiResponse.success("Đã điều chuyển cọc thực có",null);}
    @PostMapping("/{id}/complete") public ApiResponse<Void> complete(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Action r){changes.completeMove(p,id,r);return ApiResponse.success("Đã hoàn tất chuyển đổi",null);}
    @PostMapping("/{id}/cancel") public ApiResponse<Void> cancel(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Action r){changes.cancel(p,id,r);return ApiResponse.success("Đã hủy yêu cầu",null);}
    @GetMapping("/contracts/{id}/resident-requests") public ApiResponse<List<Map<String,Object>>> residents(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Yêu cầu cư trú",residents.list(p,id));}
    @PostMapping("/resident-requests/{id}/review") public ApiResponse<Void> review(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody ResidentApprovalService.Review r){residents.review(p,id,r);return ApiResponse.success("Đã xử lý hồ sơ cư trú",null);}
}
