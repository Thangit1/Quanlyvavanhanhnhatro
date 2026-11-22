package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.ManagementReportService;
import com.thangit.boardinghouse.service.ManagementReportService.Filter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
@RequestMapping({"/api/admin/reports/workspace","/api/accountant/reports/workspace"})
public class ManagementReportController {
 private final ManagementReportService service;
 public ManagementReportController(ManagementReportService service){this.service=service;}
 @GetMapping("/choices") public ApiResponse<Map<String,Object>> choices(@AuthenticationPrincipal AuthenticatedUser a,@RequestParam long propertyId){return ApiResponse.success("Phòng và hợp đồng trong phạm vi.",service.choices(a,propertyId));}
 @GetMapping("/options") public ApiResponse<java.util.List<Map<String,Object>>> options(@AuthenticationPrincipal AuthenticatedUser a){return ApiResponse.success("Phạm vi báo cáo được cấp.",service.options(a));}
 @GetMapping public ApiResponse<Map<String,Object>> read(@AuthenticationPrincipal AuthenticatedUser a,@ModelAttribute Filter f){return ApiResponse.success("Báo cáo quản trị theo nguồn và phạm vi quyền.",service.read(a,f));}
 @PostMapping("/exports") public ApiResponse<com.thangit.boardinghouse.dto.response.report.AdminReportResponses.ExportJob> export(@AuthenticationPrincipal AuthenticatedUser a,@ModelAttribute Filter f,@RequestParam(defaultValue="XLSX") String format){return ApiResponse.success("Đã xuất toàn bộ dữ liệu theo bộ lọc và lưu lịch sử riêng tư.",service.createExport(a,f,format));}
}
