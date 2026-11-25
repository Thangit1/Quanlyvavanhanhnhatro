package com.thangit.boardinghouse.controller;

import static com.thangit.boardinghouse.dto.request.notification.TenantNotificationRequests.*;
import static com.thangit.boardinghouse.dto.response.notification.TenantNotificationResponses.*;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantNotificationService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tenant/notifications")
public class TenantNotificationController {
    private final TenantNotificationService service;
    public TenantNotificationController(TenantNotificationService service){this.service=service;}
    @GetMapping("/summary") public ApiResponse<Summary> summary(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy thống kê thông báo thành công.",service.summary(p));}
    @GetMapping("/unread-count") public ApiResponse<UnreadCount> unread(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy số thông báo chưa đọc thành công.",service.unread(p));}
    @GetMapping("/recent") public ApiResponse<List<NotificationRow>> recent(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(defaultValue="8")int limit){return ApiResponse.success("Lấy thông báo gần đây thành công.",service.recent(p,limit));}
    @GetMapping public ApiResponse<Page<NotificationRow>> list(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)String keyword,@RequestParam(required=false)String category,@RequestParam(required=false)String severity,@RequestParam(required=false)String readStatus,@RequestParam(required=false)Boolean requiresAction,@RequestParam(defaultValue="false")boolean archived,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate startDate,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate endDate,@RequestParam(defaultValue="newest")String sort,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ApiResponse.success("Lấy danh sách thông báo thành công.",service.list(p,keyword,category,severity,readStatus,requiresAction,archived,startDate,endDate,sort,page,size));}
    @GetMapping("/{id}") public ApiResponse<NotificationDetail> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Lấy chi tiết thông báo thành công.",service.detail(p,id));}
    @PatchMapping("/{id}/read") public ApiResponse<ActionResult> read(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Đã đánh dấu thông báo là đã đọc.",service.read(p,id));}
    @PatchMapping("/{id}/unread") public ApiResponse<ActionResult> unread(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Đã đánh dấu thông báo là chưa đọc.",service.unread(p,id));}
    @PostMapping("/mark-all-read") public ApiResponse<BulkResult> allRead(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Đã đánh dấu tất cả thông báo là đã đọc.",service.markAllRead(p));}
    @PatchMapping("/{id}/archive") public ApiResponse<ActionResult> archive(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Thông báo đã được lưu trữ.",service.archive(p,id));}
    @PatchMapping("/{id}/restore") public ApiResponse<ActionResult> restore(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Thông báo đã được khôi phục.",service.restore(p,id));}
    @PostMapping("/{id}/acknowledge") public ApiResponse<ActionResult> acknowledge(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Đã xác nhận thông báo.",service.acknowledge(p,id));}
    @PostMapping("/bulk-actions") public ApiResponse<BulkResult> bulk(@AuthenticationPrincipal AuthenticatedUser p,@Valid@RequestBody BulkAction request){return ApiResponse.success("Thao tác hàng loạt đã hoàn tất.",service.bulk(p,request));}
}
