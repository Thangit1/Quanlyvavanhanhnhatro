package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.RentalLifecycleService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/rental-lifecycle")
public class RentalLifecycleController {
    private final RentalLifecycleService service;
    public RentalLifecycleController(RentalLifecycleService service){this.service=service;}

    @GetMapping public ApiResponse<LifecycleBoard> board(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId){return ApiResponse.success("Lấy dữ liệu vòng đời thuê thành công.",service.board(p,propertyId));}
    @PostMapping("/bookings") public ResponseEntity<ApiResponse<Created>> booking(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody CreateBooking r){return ResponseEntity.status(201).body(ApiResponse.success("Giữ phòng thành công.",service.createBooking(p,r)));}
    @PatchMapping("/bookings/{id}/status") public ApiResponse<Void> bookingStatus(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody ChangeBookingStatus r){service.changeBookingStatus(p,id,r);return ApiResponse.success("Cập nhật booking thành công.",null);}
    @PostMapping("/bookings/{id}/contract") public ResponseEntity<ApiResponse<Created>> contract(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody CreateContract r){return ResponseEntity.status(201).body(ApiResponse.success("Tạo hợp đồng từ booking thành công.",service.createContract(p,id,r)));}
    @PostMapping("/checkins") public ResponseEntity<ApiResponse<Created>> prepareCheckin(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody PrepareCheckin r){return ResponseEntity.status(201).body(ApiResponse.success("Tạo phiếu check-in thành công.",service.prepareCheckin(p,r)));}
    @PostMapping("/checkins/{id}/complete") public ApiResponse<Void> completeCheckin(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody CompleteCheckin r){service.completeCheckin(p,id,r);return ApiResponse.success("Check-in thành công.",null);}
    @PostMapping("/checkouts") public ResponseEntity<ApiResponse<Created>> requestCheckout(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody RequestCheckout r){return ResponseEntity.status(201).body(ApiResponse.success("Tạo yêu cầu check-out thành công.",service.requestCheckout(p,r)));}
    @PostMapping("/checkouts/{id}/complete") public ApiResponse<Settlement> completeCheckout(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody CompleteCheckout r){return ApiResponse.success("Hoàn tất check-out và đối trừ cọc thành công.",service.completeCheckout(p,id,r));}
}
