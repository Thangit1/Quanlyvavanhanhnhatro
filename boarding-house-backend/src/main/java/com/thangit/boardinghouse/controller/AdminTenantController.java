package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.*;
import com.thangit.boardinghouse.dto.response.tenant.AdminTenantResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminTenantService;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/tenants")
public class AdminTenantController {
    private final AdminTenantService service;
    public AdminTenantController(AdminTenantService service) { this.service = service; }

    @GetMapping
    public ApiResponse<TenantList> list(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) Long propertyId, @RequestParam(required = false) Long roomId,
            @RequestParam(required = false) String status, @RequestParam(required = false) String temporaryStatus,
            @RequestParam(required = false) String accountStatus, @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String debtStatus, @RequestParam(required = false) String contractStatus,
            @RequestParam(defaultValue = "fullName") String sort, @RequestParam(defaultValue = "asc") String direction,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success("Lấy danh sách người thuê thành công.",
                service.list(principal, propertyId, roomId, status, temporaryStatus, accountStatus,
                        keyword, debtStatus, contractStatus, sort, direction, page, size));
    }

    @GetMapping("/{tenantId}")
    public ApiResponse<TenantDetail> detail(@AuthenticationPrincipal AuthenticatedUser principal,
                                            @PathVariable long tenantId) {
        return ApiResponse.success("Lấy hồ sơ người thuê thành công.", service.detail(principal, tenantId));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CreatedTenant>> create(@AuthenticationPrincipal AuthenticatedUser principal,
                                                              @Valid @RequestBody SaveTenant request) {
        return ResponseEntity.status(201).body(ApiResponse.success("Tạo người thuê thành công.",
                service.create(principal, request)));
    }

    @PutMapping("/{tenantId}")
    public ApiResponse<TenantDetail> update(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long tenantId, @Valid @RequestBody SaveTenant request) {
        return ApiResponse.success("Cập nhật người thuê thành công.", service.update(principal, tenantId, request));
    }

    @PostMapping("/{tenantId}/room-transfers")
    public ApiResponse<Void> transfer(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long tenantId, @Valid @RequestBody TransferRoom request) {
        service.transfer(principal, tenantId, request);
        return ApiResponse.success("Chuyển phòng thành công.", null);
    }

    @PostMapping("/{tenantId}/move-out")
    public ApiResponse<Void> moveOut(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long tenantId, @Valid @RequestBody MoveOut request) {
        service.moveOut(principal, tenantId, request);
        return ApiResponse.success("Xác nhận rời phòng thành công.", null);
    }

    @PutMapping("/{tenantId}/temporary-residence")
    public ApiResponse<Void> temporaryResidence(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long tenantId, @Valid @RequestBody TemporaryResidence request) {
        service.saveTemporaryResidence(principal, tenantId, request);
        return ApiResponse.success("Cập nhật tạm trú thành công.", null);
    }

    @PostMapping("/{tenantId}/account")
    public ApiResponse<Void> createAccount(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long tenantId, @Valid @RequestBody CreateAccount request) {
        service.createAccount(principal, tenantId, request);
        return ApiResponse.success("Tạo tài khoản thành công.", null);
    }

    @PatchMapping("/{tenantId}/account/status")
    public ApiResponse<Void> accountStatus(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long tenantId, @Valid @RequestBody AccountStatus request) {
        service.updateAccountStatus(principal, tenantId, request);
        return ApiResponse.success("Cập nhật trạng thái tài khoản thành công.", null);
    }

    @PostMapping(path = "/{tenantId}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Void> upload(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long tenantId, @RequestParam(defaultValue = "OTHER") String documentType,
            @RequestPart MultipartFile file) {
        service.uploadDocument(principal, tenantId, documentType, file);
        return ApiResponse.success("Tải giấy tờ thành công.", null);
    }

    @GetMapping("/{tenantId}/documents/{documentId}")
    public ResponseEntity<byte[]> download(@AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable long tenantId, @PathVariable long documentId) {
        Map<String, Object> document = service.downloadDocument(principal, tenantId, documentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(document.get("content_type").toString()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(document.get("original_name").toString(), StandardCharsets.UTF_8).build().toString())
                .body((byte[]) document.get("file_content"));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) Long propertyId, @RequestParam(required = false) String keyword) {
        String name = URLEncoder.encode("danh-sach-nguoi-thue.csv", StandardCharsets.UTF_8);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + name)
                .body(service.exportCsv(principal, propertyId, keyword));
    }
}
