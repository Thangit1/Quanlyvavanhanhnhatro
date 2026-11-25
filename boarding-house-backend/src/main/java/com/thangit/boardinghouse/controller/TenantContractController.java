package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.contract.ExtensionRequest;
import com.thangit.boardinghouse.dto.request.contract.TerminationRequest;
import com.thangit.boardinghouse.dto.response.contract.TenantContractResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantContractService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/tenant/contracts")
public class TenantContractController {
    private final TenantContractService service;

    public TenantContractController(TenantContractService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<ContractPage> contracts(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "endDate,desc") String sort) {
        return ApiResponse.success("Lấy danh sách hợp đồng thành công.",
                service.getContracts(principal, status, page, size, sort));
    }

    @GetMapping("/{contractId}")
    public ApiResponse<ContractDetail> contract(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long contractId) {
        return ApiResponse.success("Lấy thông tin hợp đồng thành công.",
                service.getContract(principal, contractId));
    }

    @PostMapping("/{contractId}/extension-requests")
    public ResponseEntity<ApiResponse<RequestCreated>> requestExtension(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long contractId,
            @Valid @RequestBody ExtensionRequest request) {
        RequestCreated created = service.requestExtension(principal, contractId, request);
        return ResponseEntity.status(201).body(ApiResponse.success(created.message(), created));
    }

    @PostMapping("/{contractId}/termination-requests")
    public ResponseEntity<ApiResponse<RequestCreated>> requestTermination(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long contractId,
            @Valid @RequestBody TerminationRequest request) {
        RequestCreated created = service.requestTermination(principal, contractId, request);
        return ResponseEntity.status(201).body(ApiResponse.success(created.message(), created));
    }

    @GetMapping("/{contractId}/document")
    public ResponseEntity<byte[]> document(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long contractId) {
        var file = service.downloadDocument(principal, contractId);
        MediaType contentType;
        try { contentType = MediaType.parseMediaType(file.contentType()); }
        catch (Exception ignored) { contentType = MediaType.APPLICATION_OCTET_STREAM; }
        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName(), StandardCharsets.UTF_8).build().toString())
                .contentLength(file.content().length)
                .body(file.content());
    }
}
