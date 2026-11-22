package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.ContractDeliveryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
public class ContractDeliveryController {
    private final ContractDeliveryService delivery;
    public ContractDeliveryController(ContractDeliveryService delivery){this.delivery=delivery;}
    @GetMapping("/api/admin/contracts/{id}/delivery")
    public Object status(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id){return ApiResponse.success("Trạng thái gửi hợp đồng",delivery.status(actor,id));}
    @PostMapping("/api/admin/contracts/{id}/delivery/resend")
    public Object resend(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@RequestHeader("Idempotency-Key") String key){return ApiResponse.success("Đã ghi yêu cầu gửi lại; xem kết quả gửi thực tế trong tiến trình",delivery.resend(actor,id,key));}
}
