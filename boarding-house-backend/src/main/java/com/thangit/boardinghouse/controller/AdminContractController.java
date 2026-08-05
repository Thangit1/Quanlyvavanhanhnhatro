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
    private final AdminContractService service;

    public AdminContractController(AdminContractService service) {
        this.service = service;
    }

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
