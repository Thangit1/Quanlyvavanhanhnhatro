package com.thangit.boardinghouse.controller;
import static com.thangit.boardinghouse.dto.response.invoice.TenantInvoiceResponses.*;
import com.thangit.boardinghouse.common.base.ApiResponse;import com.thangit.boardinghouse.security.AuthenticatedUser;import com.thangit.boardinghouse.service.TenantInvoiceService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;import org.springframework.web.bind.annotation.*;import org.springframework.http.ResponseEntity;
@RestController @RequestMapping("/api/tenant/payments") public class TenantPaymentController{
 private final TenantInvoiceService service;public TenantPaymentController(TenantInvoiceService service){this.service=service;}
 @GetMapping public ApiResponse<Page<Payment>> list(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="10")int size){return ApiResponse.success("Lấy lịch sử thanh toán thành công.",service.payments(p,page,size));}
 @GetMapping("/{id}") public ApiResponse<PaymentDetail> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Lấy giao dịch thành công.",service.payment(p,id));}
 @GetMapping("/{id}/receipt") public ResponseEntity<byte[]> receipt(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return TenantInvoiceController.file(service.receiptDocument(p,id),false);}
}
