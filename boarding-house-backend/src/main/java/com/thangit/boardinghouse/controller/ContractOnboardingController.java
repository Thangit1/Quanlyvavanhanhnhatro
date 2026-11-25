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
    @PostMapping("/{id}/identity-verification") public ApiResponse<Void> identity(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody IdentityReview r){service.verifyIdentityReviewed(p,id,r);return ApiResponse.success("Đã xác minh hồ sơ",null);}
    @PutMapping("/{id}/identity-profile") public ApiResponse<Void> profile(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody IdentityProfile r){service.updateIdentityProfile(p,id,r);return ApiResponse.success("Đã cập nhật hồ sơ người thuê",null);}
    @PostMapping("/{id}/confirmations") public ApiResponse<Void> confirm(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Confirmation r){service.confirmContract(p,id,r);return ApiResponse.success("Đã xác nhận nội bộ phiên bản hợp đồng",null);}
    @PostMapping("/{id}/versions") public ApiResponse<Void> revise(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Revision r){service.revise(p,id,r);return ApiResponse.success("Đã chốt phiên bản nội dung",null);}
    @GetMapping("/{id}/reviews") public Object reviews(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Yêu cầu xem lại hợp đồng",service.reviews(p,id));}
    @PostMapping("/{id}/reviews") public Object review(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ReviewRequest r){return ApiResponse.success("Đã gửi yêu cầu, chưa hủy hợp đồng hoặc xác nhận thay bất kỳ bên nào",service.requestReview(p,id,key,r));}
    @PostMapping("/{id}/reviews/{request}/response") public Object respond(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long request,@Valid @RequestBody Revision r){return ApiResponse.success("Đã lưu phản hồi; người thuê tự quyết định xác nhận",service.respondReview(p,id,request,r));}
    @PutMapping("/{id}/terms") public ApiResponse<Void> terms(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody VersionedTermsChange r){service.changeTermsVersioned(p,id,r);return ApiResponse.success("Đã lưu điều khoản và phiên bản mới để hai bên xác nhận lại",null);}
    @PostMapping("/{id}/initial-invoice") public ApiResponse<Void> invoice(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody InitialInvoice r){service.linkInvoice(p,id,r);return ApiResponse.success("Đã liên kết hóa đơn đầu kỳ",null);}
    @PostMapping("/{id}/initial-invoice/draft") public ApiResponse<Map<String,Object>> invoiceDraft(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Đã chuẩn bị hóa đơn nháp đầu kỳ",service.createInitialDraft(p,id));}
    @PutMapping("/{id}/handover") public ApiResponse<Void> handover(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Handover r){service.saveHandover(p,id,r);return ApiResponse.success("Đã chốt biên bản để người thuê xác nhận",null);}
    @PostMapping("/{id}/inventory") public ApiResponse<Void> inventory(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){service.refreshInventory(p,id);return ApiResponse.success("Đã nạp danh mục để kiểm kê lại",null);}
    @PostMapping("/{id}/handover-confirmations") public ApiResponse<Void> confirmHandover(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Confirmation r){service.confirmHandover(p,id,r);return ApiResponse.success("Đã xác nhận biên bản bàn giao",null);}
    @GetMapping("/{id}/handover-versions") public ApiResponse<java.util.List<Map<String,Object>>> history(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Lịch sử phiên bản bàn giao",service.handoverHistory(p,id));}
    @GetMapping("/{id}/handover-versions/{version}") public ApiResponse<Map<String,Object>> document(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long version){return ApiResponse.success("Biên bản bàn giao theo phiên bản",service.handoverDocument(p,id,version));}
    @PostMapping("/{id}/meter-events") public ApiResponse<Void> meter(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody MeterReplacement r){service.replaceMeter(p,id,r);return ApiResponse.success("Đã lưu sự kiện đồng hồ",null);}
}
