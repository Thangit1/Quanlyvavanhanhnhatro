package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.accountant.AccountantRequests.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.FinanceWorkspaceService;
import com.thangit.boardinghouse.service.FinanceWorkspaceService.Filter;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;

@RestController
@RequestMapping({"/api/admin/finance/workspace","/api/accountant/finance/workspace"})
public class FinanceWorkspaceController {
 private final FinanceWorkspaceService service;
 public FinanceWorkspaceController(FinanceWorkspaceService service){this.service=service;}
 @GetMapping public ApiResponse<Map<String,Object>> get(@AuthenticationPrincipal AuthenticatedUser a,@ModelAttribute Filter f){return ApiResponse.success("Nguồn tài chính nội bộ đã phân quyền.",service.workspace(a,f));}
 @GetMapping("/export") public ResponseEntity<byte[]> export(@AuthenticationPrincipal AuthenticatedUser a,@ModelAttribute Filter f){return ResponseEntity.ok().header("Content-Disposition","attachment; filename=finance.xlsx").header("Cache-Control","no-store").contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).body(service.export(a,f));}
 @PostMapping("/vouchers") public ApiResponse<Map<String,Object>> create(@AuthenticationPrincipal AuthenticatedUser a,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody VoucherCreate r){return ApiResponse.success("Đã lập nháp, chưa ghi thực chi.",service.createVoucher(a,key,r));}
 @PostMapping("/vouchers/{id}/submit") public ApiResponse<Void> submit(@AuthenticationPrincipal AuthenticatedUser a,@PathVariable long id,@Valid @RequestBody Versioned r){service.submit(a,id,r.version());return ApiResponse.success("Đã gửi duyệt.",null);}
 @PostMapping("/income") public ApiResponse<Map<String,Object>> income(@AuthenticationPrincipal AuthenticatedUser a,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody OtherIncomeCreate r){return ApiResponse.success("Đã ghi nhận khoản thu thực tế.",service.income(a,key,r));}
 @PostMapping("/income/{id}/reverse") public ApiResponse<Void> reverse(@AuthenticationPrincipal AuthenticatedUser a,@PathVariable long id,@Valid @RequestBody Reason r){service.reverseIncome(a,id,r.reason());return ApiResponse.success("Đã đảo, giữ chứng từ nguồn và lịch sử.",null);}
}
