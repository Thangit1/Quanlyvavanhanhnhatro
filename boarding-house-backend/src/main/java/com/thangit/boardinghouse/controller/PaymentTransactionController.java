package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.PaymentTransactionService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class PaymentTransactionController {
    @org.springframework.beans.factory.annotation.Autowired private com.thangit.boardinghouse.service.BankTransferService bank;
    @org.springframework.beans.factory.annotation.Autowired private com.thangit.boardinghouse.service.PaymentReconciliationService reconciliation;
    private final PaymentTransactionService transactions;
    public PaymentTransactionController(PaymentTransactionService transactions){this.transactions=transactions;}
    public record Outcome(String outcome){}
    @PostMapping("/api/payments/transactions/{id}/reconcile")
    public Object reconcile(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@RequestBody com.thangit.boardinghouse.service.PaymentReconciliationService.Decision decision){
        return ApiResponse.success("Đã lưu quyết định đối soát",reconciliation.resolve(actor,id,decision));
    }
    @GetMapping("/api/tenant/invoices/{invoice}/bank-transfer/{session}/qr")
    public Object qr(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long invoice,@PathVariable long session){
        return ApiResponse.success("Hướng dẫn VietQR, chưa xác nhận thu tiền",bank.qr(actor,invoice,session));
    }
    @PostMapping("/api/tenant/invoices/{invoice}/simulation")
    public Object simulate(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long invoice,@RequestHeader("Idempotency-Key") String key){
        return ApiResponse.success("Phiên mô phỏng, không thu tiền thật",transactions.simulate(actor,invoice,key));
    }
    @PostMapping("/api/tenant/gateway-sessions/{id}/simulation-outcome")
    public Object outcome(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@RequestBody Outcome request){
        return ApiResponse.success("Kết quả mô phỏng, công nợ thật không thay đổi",transactions.outcome(actor,id,request.outcome()));
    }
    @PostMapping("/api/tenant/gateway-sessions/{id}/cancel")
    public Object cancel(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id){
        return ApiResponse.success("Đã ngừng phiên tại hệ thống; kết quả cổng thanh toán vẫn cần đối soát",transactions.cancel(actor,id));
    }
    @GetMapping("/api/tenant/gateway-sessions")
    public Object history(@AuthenticationPrincipal AuthenticatedUser actor,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
        return ApiResponse.success("Lịch sử giao dịch gateway và mô phỏng",transactions.history(actor,page,size));
    }
    @GetMapping("/api/payments/transactions")
    public Object management(@AuthenticationPrincipal AuthenticatedUser actor,@RequestParam(required=false) Long propertyId,
            @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){
        return ApiResponse.success("Giao dịch trong phạm vi được cấp quyền",transactions.managementHistory(actor,propertyId,page,size));
    }
}
