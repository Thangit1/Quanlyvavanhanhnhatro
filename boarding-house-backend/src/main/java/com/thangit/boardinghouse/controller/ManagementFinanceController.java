package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.ManagementFinanceService;
import com.thangit.boardinghouse.service.ManagementFinanceService.*;
import com.thangit.boardinghouse.repository.FinancialReconciliation;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping({"/api/admin/finance","/api/accountant/finance"})
public class ManagementFinanceController {
 private final ManagementFinanceService service;private final FinancialReconciliation reconciliation;
 public ManagementFinanceController(ManagementFinanceService s,FinancialReconciliation r){service=s;reconciliation=r;}
 @GetMapping public ApiResponse<Map<String,Object>> report(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId,@RequestParam LocalDate startDate,@RequestParam LocalDate endDate){return ApiResponse.success("Báo cáo quản trị thu chi, không phải báo cáo kế toán pháp định.",service.report(p,propertyId,startDate,endDate));}
 @GetMapping("/vouchers") public ApiResponse<List<Map<String,Object>>> vouchers(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId){return ApiResponse.success("Phiếu chi trong phạm vi được giao.",service.vouchers(p,propertyId));}
 @PostMapping("/periods") public ApiResponse<Map<String,Object>> createPeriod(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody PeriodCreate r){return ApiResponse.success("Đã chuẩn bị kỳ kế toán; không tự mở lại kỳ đã khóa.",service.createPeriod(p,r));}
 @GetMapping("/vouchers/{id}/documents") public ApiResponse<List<Map<String,Object>>> documents(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Chứng từ riêng tư của phiếu chi.",service.documents(p,id));}
 @PostMapping("/vouchers/{id}/documents") public ApiResponse<Map<String,Object>> attach(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestParam org.springframework.web.multipart.MultipartFile file){return ApiResponse.success("Đã lưu chứng từ, không thay đổi số tiền.",service.attach(p,id,file));}
 @GetMapping("/vouchers/{id}/documents/{document}/file") public org.springframework.http.ResponseEntity<byte[]> document(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long document){var file=service.document(p,id,document);return org.springframework.http.ResponseEntity.ok().header("Cache-Control","no-store").header("Content-Disposition",org.springframework.http.ContentDisposition.attachment().filename(file.get("original_name").toString(),java.nio.charset.StandardCharsets.UTF_8).build().toString()).contentType(org.springframework.http.MediaType.parseMediaType(file.get("content_type").toString())).body((byte[])file.get("file_content"));}
 @GetMapping("/cash-events") public ApiResponse<List<Map<String,Object>>> cash(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false) Long propertyId,@RequestParam LocalDate startDate,@RequestParam LocalDate endDate){return ApiResponse.success("Giao dịch tiền thực tế từ chứng từ nguồn.",service.cash(p,propertyId,startDate,endDate));}
 @PostMapping("/reconciliation") public ApiResponse<Map<String,Object>> check(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam long propertyId,@RequestParam LocalDate startDate,@RequestParam LocalDate endDate){service.report(p,propertyId,startDate,endDate);return ApiResponse.success("Đã lưu đối soát; không tự sửa số dư.",reconciliation.run(p.id(),propertyId,startDate,endDate));}
 @PostMapping("/vouchers/{id}/approve") public ApiResponse<Map<String,Object>> approve(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Decision r){return ApiResponse.success("Đã duyệt phiếu chi.",service.approve(p,id,r,true));}
 @PostMapping("/vouchers/{id}/reject") public ApiResponse<Map<String,Object>> reject(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Decision r){return ApiResponse.success("Đã từ chối phiếu chi.",service.approve(p,id,r,false));}
 @PostMapping("/vouchers/{id}/pay") public ApiResponse<Map<String,Object>> pay(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody PayVoucher r){return ApiResponse.success("Đã xác nhận thực chi.",service.pay(p,id,key,r));}
 @PostMapping("/vouchers/{id}/reverse") public ApiResponse<Map<String,Object>> reverse(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Decision r){return ApiResponse.success("Đã đảo chứng từ; giữ lịch sử.",service.reverse(p,id,r));}
}
