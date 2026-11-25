package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.CheckoutSettlementService;
import com.thangit.boardinghouse.service.CheckoutSettlementService.*;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.RequestCheckout;
import com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.Created;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping({"/api/admin/checkout-settlement","/api/tenant/checkout-settlement","/api/accountant/checkout-settlement"})
public class CheckoutSettlementController {
    @PostMapping("/{id}/inspection-confirmation") public ApiResponse<Void> confirmInspection(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Confirmation r){service.confirmInspection(p,id,r);return ApiResponse.success("Đã xác nhận biên bản kiểm kê, chưa mặc định chấp nhận quyết toán",null);}
    @PostMapping("/{id}/handover") public ApiResponse<Void> handover(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody VersionedReason r){service.handover(p,id,r);return ApiResponse.success("Đã ghi nhận bàn giao thực tế; tài chính tiếp tục được theo dõi",null);}
    @GetMapping(value="/contracts/{id}/document",produces="text/plain;charset=UTF-8") public String document(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return service.document(p,id);}
    private final CheckoutSettlementService service;
    public CheckoutSettlementController(CheckoutSettlementService service){this.service=service;}
    @GetMapping("/contracts/{id}") public ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Hồ sơ trả phòng và quyết toán",service.detail(p,id));}
    @PostMapping public ApiResponse<Created> request(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody RequestCheckout r){return ApiResponse.success("Đã ghi nhận yêu cầu trả phòng",service.request(p,r));}
    @PostMapping("/{id}/schedule") public ApiResponse<Void> schedule(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Schedule r){service.schedule(p,id,r);return ApiResponse.success("Đã cập nhật lịch và lưu lịch sử",null);}
    @PostMapping("/{id}/schedule-approval") public ApiResponse<Void> plan(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Schedule r){service.approveSchedule(p,id,r);return ApiResponse.success("Đã xác nhận kế hoạch trả phòng",null);}
    @PostMapping("/{id}/cancel") public ApiResponse<Void> cancel(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody VersionedReason r){service.cancel(p,id,r);return ApiResponse.success("Đã rút yêu cầu",null);}
    @PostMapping("/{id}/inspection") public ApiResponse<Void> inspect(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Inspection r){service.inspect(p,id,r);return ApiResponse.success("Đã lưu biên bản kiểm kê",null);}
    @PostMapping("/{id}/charges") public ApiResponse<Long> charge(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody ChargeRequest r){return ApiResponse.success("Đã lưu khoản đề xuất; chưa tính tiền",service.proposeCharge(p,id,r));}
    @PostMapping("/{id}/charges/{charge}/decision") public ApiResponse<Void> decide(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long charge,@Valid @RequestBody ChargeDecision r){service.decideCharge(p,id,charge,r);return ApiResponse.success("Đã kiểm tra khoản phát sinh",null);}
    @PostMapping("/{id}/approval") public ApiResponse<Void> approve(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Approval r){service.approve(p,id,r);return ApiResponse.success("Đã phê duyệt phiên bản quyết toán",null);}
    @PostMapping("/{id}/confirmation") public ApiResponse<Void> confirm(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Confirmation r){service.confirm(p,id,r);return ApiResponse.success("Đã xác nhận nội bộ quyết toán và bàn giao",null);}
    @PostMapping("/{id}/disputes") public ApiResponse<Long> dispute(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Dispute r){return ApiResponse.success("Đã ghi nhận phản hồi",service.dispute(p,id,r));}
    @PostMapping("/{id}/disputes/{dispute}/resolve") public ApiResponse<Void> resolve(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long dispute,@Valid @RequestBody Resolution r){service.resolve(p,id,dispute,r);return ApiResponse.success("Đã ghi nhận kết quả xử lý",null);}
}
