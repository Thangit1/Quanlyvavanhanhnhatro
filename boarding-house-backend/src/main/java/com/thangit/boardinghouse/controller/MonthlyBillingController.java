package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.MonthlyBillingService;
import com.thangit.boardinghouse.service.MonthlyBillingService.*;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping({"/api/admin/monthly-billing","/api/accountant/monthly-billing"})
public class MonthlyBillingController {
    @PostMapping("/{id}/services/{serviceId}/stop") public ApiResponse<Void> stop(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long serviceId,@Valid @RequestBody ServiceStop r){service.stop(p,id,serviceId,r);return ApiResponse.success("Đã ngừng dịch vụ theo ngày hiệu lực",null);}
    private final MonthlyBillingService service;
    public MonthlyBillingController(MonthlyBillingService service){this.service=service;}
    @GetMapping("/{id}") public ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestParam LocalDate period){return ApiResponse.success("Dữ liệu tính tiền theo kỳ",service.detail(p,id,period));}
    @PostMapping("/{id}/readings") public ApiResponse<Map<String,Object>> readings(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reading r){return ApiResponse.success("Đã chốt chỉ số và lưu lịch sử",service.record(p,id,r));}
    @PostMapping("/{id}/meter-replacements") public ApiResponse<Void> replacement(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Replacement r){service.replace(p,id,r);return ApiResponse.success("Đã lưu các đoạn đồng hồ",null);}
    @PostMapping("/{id}/rates") public ApiResponse<Void> rate(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Rate r){service.rate(p,id,r);return ApiResponse.success("Đã lưu giá có hiệu lực và chứng từ",null);}
    @PostMapping("/{id}/services") public ApiResponse<Long> services(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody ServiceRule r){return ApiResponse.success("Đã lưu dịch vụ",service.service(p,id,r));}
    @PostMapping("/{id}/services/{serviceId}/usage") public ApiResponse<Void> usage(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long serviceId,@Valid @RequestBody Usage r){service.usage(p,id,serviceId,r);return ApiResponse.success("Đã lưu lượng sử dụng dịch vụ",null);}
    @PostMapping("/{id}/proration") public ApiResponse<Void> proration(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Proration r){service.proration(p,id,r);return ApiResponse.success("Đã chốt cách tính tiền thuê",null);}
    @PostMapping("/{id}/automation") public ApiResponse<Void> automation(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Automation r){service.automation(p,id,r);return ApiResponse.success("Đã lưu lịch lập hóa đơn",null);}
}
