package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.report.AdminReportRequests.ExportRequest;
import com.thangit.boardinghouse.dto.response.report.AdminReportResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminReportService;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/reports")
public class AdminReportController {
    private final AdminReportService service;
    public AdminReportController(AdminReportService service){this.service=service;}

    @GetMapping("/overview")
    public ApiResponse<Overview> overview(@AuthenticationPrincipal AuthenticatedUser p,
            @RequestParam(required=false) List<Long> propertyIds,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate comparisonStartDate,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate comparisonEndDate){
        return ApiResponse.success("Lấy báo cáo tổng quan thành công.",service.overview(p,propertyIds,startDate,endDate,comparisonStartDate,comparisonEndDate));
    }

    @GetMapping("/{type:occupancy|operations|revenue|expenses|profit|debt|invoices|payments|contracts|tenants|utilities|maintenance|assets}")
    public ApiResponse<ReportData> report(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable String type,
            @RequestParam(required=false) List<Long> propertyIds,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate endDate){
        return ApiResponse.success("Lấy dữ liệu báo cáo thành công.",service.report(p,type,propertyIds,startDate,endDate));
    }

    @PostMapping("/exports")
    public ResponseEntity<ApiResponse<ExportJob>> createExport(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody ExportRequest request){
        return ResponseEntity.status(201).body(ApiResponse.success("Tạo báo cáo thành công.",service.createExport(p,request)));
    }
    @GetMapping("/exports") public ApiResponse<List<ExportJob>> exports(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy lịch sử xuất báo cáo thành công.",service.exports(p));}
    @GetMapping("/exports/{id}") public ApiResponse<ExportJob> export(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Lấy trạng thái xuất báo cáo thành công.",service.export(p,id));}
    @GetMapping("/exports/{id}/download") public ResponseEntity<byte[]> download(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){ExportJob job=service.export(p,id);return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename*=UTF-8''"+java.net.URLEncoder.encode(job.fileName(),StandardCharsets.UTF_8).replace("+","%20")).body(service.download(p,id));}
}
