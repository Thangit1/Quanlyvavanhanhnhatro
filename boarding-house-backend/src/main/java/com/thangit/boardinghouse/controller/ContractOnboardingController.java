package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.ContractOnboardingService;
import com.thangit.boardinghouse.service.ContractOnboardingService.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/admin/contract-onboarding","/api/tenant/contract-onboarding","/api/accountant/contract-onboarding"})
public class ContractOnboardingController {
    private final ContractOnboardingService service;
    public ContractOnboardingController(ContractOnboardingService service){this.service=service;}
    @GetMapping("/{id}") public ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Điều kiện nhận phòng",service.detail(p,id));}
    @PostMapping("/{id}/identity-verification") public ApiResponse<Void> identity(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Evidence r){service.verifyIdentity(p,id,r);return ApiResponse.success("Đã xác minh hồ sơ",null);}
    @PostMapping("/{id}/confirmations") public ApiResponse<Void> confirm(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Confirmation r){service.confirmContract(p,id,r);return ApiResponse.success("Đã xác nhận nội bộ phiên bản hợp đồng",null);}
    @PostMapping("/{id}/versions") public ApiResponse<Void> revise(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Revision r){service.revise(p,id,r);return ApiResponse.success("Đã chốt phiên bản nội dung",null);}
    @PutMapping("/{id}/terms") public ApiResponse<Void> terms(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody TermsChange r){service.changeTerms(p,id,r);return ApiResponse.success("Đã lưu điều khoản và phiên bản mới để hai bên xác nhận lại",null);}
    @PostMapping("/{id}/initial-invoice") public ApiResponse<Void> invoice(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody InitialInvoice r){service.linkInvoice(p,id,r);return ApiResponse.success("Đã liên kết hóa đơn đầu kỳ",null);}
    @PutMapping("/{id}/handover") public ApiResponse<Void> handover(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Handover r){service.saveHandover(p,id,r);return ApiResponse.success("Đã chốt biên bản để người thuê xác nhận",null);}
    @PostMapping("/{id}/handover-confirmations") public ApiResponse<Void> confirmHandover(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Confirmation r){service.confirmHandover(p,id,r);return ApiResponse.success("Đã xác nhận biên bản bàn giao",null);}
    @PostMapping("/{id}/meter-events") public ApiResponse<Void> meter(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody MeterReplacement r){service.replaceMeter(p,id,r);return ApiResponse.success("Đã lưu sự kiện đồng hồ",null);}
}
