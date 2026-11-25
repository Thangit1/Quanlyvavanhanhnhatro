package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.DepositTransferService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
public class DepositTransferController {
    private final DepositTransferService service;
    public DepositTransferController(DepositTransferService service){this.service=service;}
    @GetMapping({"/api/tenant/deposit-ledger/{id}/transfer-info","/api/admin/deposit-ledger/{id}/transfer-info","/api/accountant/deposit-ledger/{id}/transfer-info"})
    public Object instructions(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id){return ApiResponse.success("Hướng dẫn nộp cọc, chưa xác nhận thu tiền",service.instructions(actor,id));}
    @GetMapping({"/api/tenant/deposit-ledger/{id}/transfer-requests","/api/admin/deposit-ledger/{id}/transfer-requests","/api/accountant/deposit-ledger/{id}/transfer-requests"})
    public Object list(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id){return ApiResponse.success("Lịch sử đối soát chuyển khoản cọc",service.requests(actor,id));}
    @PostMapping("/api/tenant/deposit-ledger/{id}/transfer-requests")
    public Object declare(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody DepositTransferService.Proof proof){return ApiResponse.success("Đang chờ đối soát; chưa ghi nhận tiền cọc",service.declare(actor,id,key,proof));}
    @PostMapping({"/api/admin/deposit-ledger/{id}/transfer-requests/{request}/review","/api/accountant/deposit-ledger/{id}/transfer-requests/{request}/review"})
    public Object review(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@PathVariable long request,@Valid @RequestBody DepositTransferService.Review review){return ApiResponse.success("Đã lưu quyết định đối soát",service.review(actor,id,request,review));}
}
