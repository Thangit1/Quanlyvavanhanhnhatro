package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.DepositLedgerService;
import com.thangit.boardinghouse.service.DepositLedgerService.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/admin/deposit-ledger","/api/accountant/deposit-ledger","/api/tenant/deposit-ledger"})
public class DepositLedgerController {
    private final DepositLedgerService service;
    public DepositLedgerController(DepositLedgerService service){this.service=service;}
    @GetMapping public ApiResponse<List<Map<String,Object>>> list(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Sổ cọc",service.accounts(p));}
    @GetMapping("/{id}") public ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Chi tiết sổ cọc",service.detail(p,id));}
    @PostMapping("/{id}/collections") public ApiResponse<Map<String,Object>> collect(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Cash r){return ApiResponse.success("Đã ghi nhận thực thu",service.collect(p,id,key,r));}
    @PostMapping("/{id}/refunds") public ApiResponse<Long> refund(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Refund r){return ApiResponse.success("Đã tạo đề nghị hoàn",service.requestRefund(p,id,r));}
    @PostMapping("/{id}/refunds/{requestId}/approve") public ApiResponse<Void> approve(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long requestId){service.approveRefund(p,id,requestId);return ApiResponse.success("Đã duyệt",null);}
    @PostMapping("/{id}/refunds/{requestId}/payments") public ApiResponse<Map<String,Object>> pay(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long requestId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Cash r){return ApiResponse.success("Đã ghi nhận thực chi",service.payRefund(p,id,requestId,key,r));}
    @PostMapping("/{id}/requirement") public ApiResponse<Void> requirement(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Requirement r){service.requirement(p,id,r);return ApiResponse.success("Đã cập nhật cọc theo phụ lục",null);}
    @PostMapping("/{id}/close-checkout") public ApiResponse<Void> close(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){service.closeCheckout(p,id);return ApiResponse.success("Đã đóng hồ sơ sau khi hoàn tất tài chính",null);}
    @PostMapping("/{id}/transfers") public ApiResponse<Map<String,Object>> transfer(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Transfer r){return ApiResponse.success("Đã điều chuyển cọc theo phụ lục",service.transferContract(p,id,key,r));}
}
