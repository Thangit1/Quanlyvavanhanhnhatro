package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.response.contract.AdminContractResponses.ContractDetail;
import com.thangit.boardinghouse.dto.response.contract.AdminContractResponses.ContractList;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminContractService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/contracts")
public class AdminContractController {
    private com.thangit.boardinghouse.service.DirectContractService direct;
    @org.springframework.beans.factory.annotation.Autowired
    public void setDirectContracts(com.thangit.boardinghouse.service.DirectContractService direct) {this.direct=direct;}
    @GetMapping("/creation-options")
    public ApiResponse<java.util.Map<String,Object>> creationOptions(@AuthenticationPrincipal AuthenticatedUser p,
            @RequestParam(required=false) Long propertyId,@RequestParam(required=false) String keyword) {
        return ApiResponse.success("Dữ liệu lập hợp đồng",direct.options(p,propertyId,keyword));
    }
    @PostMapping
    public ResponseEntity<ApiResponse<com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.Created>> create(
            @AuthenticationPrincipal AuthenticatedUser p,
            @RequestHeader("Idempotency-Key") @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=100) String key,
            @jakarta.validation.Valid @RequestBody com.thangit.boardinghouse.service.DirectContractService.Request r) {
        return ResponseEntity.status(201).body(ApiResponse.success("Đã tạo hợp đồng trực tiếp",direct.create(p,key,r)));
    }
    @PostMapping("/{contractId}/submit")
    public ApiResponse<com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.Created> submit(
            @AuthenticationPrincipal AuthenticatedUser p,@PathVariable long contractId) {
        return ApiResponse.success("Hợp đồng chờ xác nhận",direct.submit(p,contractId));
    }
    @GetMapping("/{contractId}/draft")
    public ApiResponse<java.util.Map<String,Object>> draft(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long contractId) {
        return ApiResponse.success("Bản nháp hợp đồng",direct.draft(p,contractId));
    }
    @PutMapping("/{contractId}/draft")
    public ApiResponse<com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.Created> updateDraft(
            @AuthenticationPrincipal AuthenticatedUser p,@PathVariable long contractId,@RequestParam long version,
            @jakarta.validation.Valid @RequestBody com.thangit.boardinghouse.service.DirectContractService.Request r) {
        return ApiResponse.success("Đã lưu bản nháp",direct.updateDraft(p,contractId,version,r));
    }
    public record ExtensionDecision(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=1000) String reason) {}
    private final AdminContractService service;

    public AdminContractController(AdminContractService service) {
        this.service = service;
    }
    @PostMapping("/{contractId}/extensions/{requestId}/approve")
    public ApiResponse<Void> approveExtension(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long contractId,@PathVariable long requestId,@jakarta.validation.Valid @RequestBody ExtensionDecision r){service.approveExtension(p,contractId,requestId,r.reason());return ApiResponse.success("Đã duyệt nội dung, chờ người thuê xác nhận phụ lục",null);}
    @GetMapping("/{contractId}/extensions")
    public ApiResponse<java.util.List<java.util.Map<String,Object>>> extensions(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long contractId){return ApiResponse.success("Danh sách yêu cầu gia hạn",service.extensions(p,contractId));}

    @GetMapping
    public ApiResponse<ContractList> list(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "endDate") String sort,
            @RequestParam(defaultValue = "asc") String direction,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success("Lấy danh sách hợp đồng thành công.",
                service.list(principal, propertyId, status, keyword, sort, direction, page, size));
    }

    @GetMapping("/{contractId}")
    public ApiResponse<ContractDetail> detail(@AuthenticationPrincipal AuthenticatedUser principal,
    @PathVariable long contractId) {
        return ApiResponse.success("Lấy thông tin hợp đồng thành công.", service.detail(principal, contractId));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "endDate") String sort,
            @RequestParam(defaultValue = "asc") String direction) {
        String filename = URLEncoder.encode("danh-sach-hop-dong.csv", StandardCharsets.UTF_8);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + filename)
                .body(service.exportCsv(principal, propertyId, status, keyword, sort, direction));
    }
}
