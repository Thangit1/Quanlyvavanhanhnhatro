package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.InvoicePaymentPolicyService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/admin/invoices/payment-policy")
public class InvoicePaymentPolicyController {
    private final InvoicePaymentPolicyService service;
    public InvoicePaymentPolicyController(InvoicePaymentPolicyService service){this.service=service;}
    @GetMapping public ApiResponse<Map<String,Object>> get(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam long propertyId,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate period){return ApiResponse.success("Chính sách cho hóa đơn mới",service.get(p,propertyId,period));}
    @PutMapping public ApiResponse<Void> save(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody InvoicePaymentPolicyService.Save request){service.save(p,request);return ApiResponse.success("Đã lưu, không hồi tố hóa đơn đã có",null);}
}
