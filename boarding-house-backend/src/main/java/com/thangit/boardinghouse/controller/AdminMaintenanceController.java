package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.maintenance.AdminMaintenanceRequests.*;
import com.thangit.boardinghouse.dto.response.maintenance.AdminMaintenanceResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminMaintenanceService;
import jakarta.validation.Valid;
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
@RequestMapping("/api/admin/maintenance")
public class AdminMaintenanceController {
    private final AdminMaintenanceService service;
    public AdminMaintenanceController(AdminMaintenanceService service) { this.service = service; }

    @GetMapping("/summary")
    public ApiResponse<Summary> summary(@AuthenticationPrincipal AuthenticatedUser p,
                                        @RequestParam(required=false) Long propertyId) {
        return ApiResponse.success("Lấy thống kê bảo trì thành công.", service.summary(p,propertyId));
    }

    @GetMapping("/options")
    public ApiResponse<Options> options(@AuthenticationPrincipal AuthenticatedUser p) {
        return ApiResponse.success("Lấy dữ liệu bảo trì thành công.", service.options(p));
    }

    @GetMapping
    public ApiResponse<Page<RequestRow>> list(@AuthenticationPrincipal AuthenticatedUser p,
            @RequestParam(required=false) Long propertyId, @RequestParam(required=false) Long roomId,
            @RequestParam(required=false) String keyword, @RequestParam(required=false) String category,
            @RequestParam(required=false) String priority, @RequestParam(required=false) String status,
            @RequestParam(required=false) Boolean overdue, @RequestParam(defaultValue="newest") String sort,
            @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="20") int size) {
        return ApiResponse.success("Lấy danh sách bảo trì thành công.", service.list(p,propertyId,roomId,keyword,category,priority,status,overdue,sort,page,size));
    }

    @GetMapping("/{id}") public ApiResponse<Detail> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Lấy chi tiết bảo trì thành công.",service.detail(p,id));}
    @PostMapping public ResponseEntity<ApiResponse<Created>> create(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody CreateRequest r){return ResponseEntity.status(201).body(ApiResponse.success("Tạo yêu cầu bảo trì thành công.",service.create(p,r)));}
    @PostMapping("/{id}/triage") public ApiResponse<Detail> triage(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody TriageRequest r){return ApiResponse.success("Phân loại yêu cầu thành công.",service.triage(p,id,r));}
    @PostMapping("/{id}/assign") public ApiResponse<Detail> assign(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody AssignRequest r){return ApiResponse.success("Phân công nhân viên thành công.",service.assign(p,id,r));}
    @PostMapping("/{id}/schedule") public ApiResponse<Detail> schedule(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody ScheduleRequest r){return ApiResponse.success("Lịch xử lý đã được cập nhật.",service.schedule(p,id,r));}
    @PostMapping("/{id}/start") public ApiResponse<Detail> start(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestParam long version){return ApiResponse.success("Đã bắt đầu xử lý.",service.start(p,id,version));}
    @PostMapping("/{id}/work-logs") public ApiResponse<Detail> workLog(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody WorkLogRequest r){return ApiResponse.success("Tiến độ công việc đã được ghi nhận.",service.workLog(p,id,r));}
    @PostMapping("/{id}/materials") public ApiResponse<Detail> addMaterial(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody MaterialUsageRequest r){return ApiResponse.success("Vật tư đã được ghi nhận.",service.addMaterial(p,id,r));}
    @PostMapping("/{id}/costs") public ApiResponse<Detail> cost(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody CostRequest r){return ApiResponse.success("Chi phí đã được gửi phê duyệt.",service.submitCost(p,id,r));}
    @PostMapping("/{id}/complete") public ApiResponse<Detail> complete(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody CompleteRequest r){return ApiResponse.success("Yêu cầu đã hoàn thành và đang chờ nghiệm thu.",service.complete(p,id,r));}
    @PostMapping("/{id}/inspect") public ApiResponse<Detail> inspect(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody InspectionRequest r){return ApiResponse.success("Đã ghi nhận kết quả nghiệm thu.",service.inspect(p,id,r));}
    @PostMapping("/{id}/reopen") public ApiResponse<Detail> reopen(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody ReasonRequest r){return ApiResponse.success("Yêu cầu đã được mở lại.",service.reopen(p,id,r));}
    @PostMapping("/{id}/cancel") public ApiResponse<Detail> cancel(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody ReasonRequest r){return ApiResponse.success("Yêu cầu đã được hủy.",service.cancel(p,id,r));}

    @GetMapping("/calendar")
    public ApiResponse<List<CalendarItem>> calendar(@AuthenticationPrincipal AuthenticatedUser p,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to){return ApiResponse.success("Lấy lịch bảo trì thành công.",service.calendar(p,from,to));}
    @GetMapping("/plans") public ApiResponse<List<Plan>> plans(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy kế hoạch định kỳ thành công.",service.plans(p));}
    @PostMapping("/plans") public ResponseEntity<ApiResponse<Plan>> plan(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody PlanRequest r){return ResponseEntity.status(201).body(ApiResponse.success("Tạo kế hoạch định kỳ thành công.",service.createPlan(p,r)));}
    @GetMapping("/materials") public ApiResponse<List<Material>> materials(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy danh mục vật tư thành công.",service.materials(p));}
    @PostMapping("/materials") public ResponseEntity<ApiResponse<Material>> material(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody MaterialRequest r){return ResponseEntity.status(201).body(ApiResponse.success("Tạo vật tư thành công.",service.createMaterial(p,r)));}
    @GetMapping("/reports") public ApiResponse<Report> report(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy báo cáo bảo trì thành công.",service.report(p));}
    @GetMapping("/export") public ResponseEntity<byte[]> export(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String status){return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=maintenance.csv").body(service.export(p,propertyId,status));}
}
