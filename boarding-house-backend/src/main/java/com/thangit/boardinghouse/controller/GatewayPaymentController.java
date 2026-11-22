package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.integration.GatewayPayments;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
@RestController
public class GatewayPaymentController {
    @org.springframework.beans.factory.annotation.Autowired
    private com.thangit.boardinghouse.service.PaymentTransactionService transactions;
    final GatewayPayments gateway;public GatewayPaymentController(GatewayPayments gateway){this.gateway=gateway;}
    @PostMapping("/api/tenant/invoices/{id}/gateway/{provider}") public Object create(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@PathVariable String provider,@RequestHeader("Idempotency-Key") String key,HttpServletRequest request){return ApiResponse.success("Phiên thanh toán gateway",gateway.create(actor,id,provider,key,request.getRemoteAddr()));}
    @GetMapping("/api/tenant/gateway-sessions/{id}") public Object get(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id){return ApiResponse.success("Kết quả gateway (return URL không xác nhận tiền)",transactions.own(actor,id));}
    @GetMapping("/api/tenant/invoices/{id}/gateways") public Object available(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id){var options=gateway.available(actor,id);if(transactions.simulationEnabled())options.add(Map.of("provider","SIMULATED","environment","TEST"));return ApiResponse.success("Gateway đã cấu hình cho hóa đơn",options);}
    @GetMapping("/api/gateways/vnpay/ipn") public Object vnp(@RequestParam Map<String,String> fields){return gateway.vnpIpn(fields);}
    @GetMapping("/api/gateways/vnpay/return") public Object returned(@RequestParam Map<String,String> fields){return ApiResponse.success("Return URL không ghi nhận thu tiền",gateway.vnpReturn(fields));}
    @PostMapping("/api/gateways/momo/ipn") public Object momo(@RequestBody Map<String,String> fields){gateway.momoIpn(fields);return ResponseEntity.noContent().build();}
}
