package com.thangit.boardinghouse.controller;

import static com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.*;
import static com.thangit.boardinghouse.dto.response.maintenance.TechnicianResponses.*;
import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.Checklist;
import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.Diagnosis;
import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.WorkLog;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TechnicianPortalService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/technician")
public class TechnicianPortalController {
    private final TechnicianPortalService service;
    public TechnicianPortalController(TechnicianPortalService service){this.service=service;}

    @GetMapping("/dashboard") public ApiResponse<Dashboard> dashboard(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy tổng quan kỹ thuật thành công.",service.dashboard(p));}
    @GetMapping("/tasks") public ApiResponse<Page<TaskRow>> tasks(@AuthenticationPrincipal AuthenticatedUser p,
        @RequestParam(required=false)String keyword,@RequestParam(required=false)String status,
        @RequestParam(required=false)String priority,@RequestParam(required=false)String category,
        @RequestParam(required=false)Long propertyId,
        @RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate scheduledFrom,
        @RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate scheduledTo,
        @RequestParam(required=false)Boolean overdue,@RequestParam(required=false)String taskType,
        @RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size,
        @RequestParam(defaultValue="schedule")String sort){return ok("Lấy danh sách công việc thành công.",service.tasks(p,keyword,status,priority,category,propertyId,scheduledFrom,scheduledTo,overdue,taskType,page,size,sort));}
    @GetMapping("/tasks/{id}") public ApiResponse<TaskDetail> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok("Lấy chi tiết công việc thành công.",service.detail(p,id));}
    @PostMapping("/tasks/{id}/accept") public ApiResponse<ActionResult> accept(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Versioned r){return ok("Đã tiếp nhận công việc.",service.accept(p,id,r));}
    @PostMapping("/tasks/{id}/decline") public ApiResponse<ActionResult> decline(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reason r){return ok("Đã gửi lý do từ chối.",service.decline(p,id,r));}
    @PostMapping("/tasks/{id}/start-travel") public ApiResponse<ActionResult> travel(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Versioned r){return ok("Đã bắt đầu di chuyển.",service.startTravel(p,id,r));}
    @PostMapping("/tasks/{id}/check-in") public ApiResponse<ActionResult> checkIn(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody CheckIn r){return ok("Đã xác nhận có mặt.",service.checkIn(p,id,r));}
    @PostMapping("/tasks/{id}/start") public ApiResponse<ActionResult> start(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Versioned r){return ok("Đã bắt đầu xử lý.",service.start(p,id,r));}
    @PostMapping("/tasks/{id}/pause") public ApiResponse<ActionResult> pause(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reason r){return ok("Đã tạm dừng công việc.",service.pause(p,id,r));}
    @PostMapping("/tasks/{id}/resume") public ApiResponse<ActionResult> resume(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Versioned r){return ok("Đã tiếp tục công việc.",service.resume(p,id,r));}
    @PostMapping("/tasks/{id}/work-logs") public ApiResponse<ActionResult> log(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody WorkLog r){return ok("Đã lưu nhật ký công việc.",service.workLog(p,id,r));}
    @PostMapping("/tasks/{id}/diagnosis") public ApiResponse<ActionResult> diagnosis(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Diagnosis r){return ok("Đã lưu chẩn đoán.",service.diagnosis(p,id,r));}
    @PutMapping("/tasks/{id}/checklist") public ApiResponse<ActionResult> checklist(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Checklist r){return ok("Đã cập nhật checklist.",service.checklist(p,id,r));}
    @PostMapping("/tasks/{id}/material-requests") public ApiResponse<ActionResult> materialRequest(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody MaterialRequest r){return ok("Đã gửi yêu cầu vật tư.",service.materialRequest(p,id,r));}
    @PostMapping("/tasks/{id}/material-usages") public ApiResponse<ActionResult> materialUsage(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody MaterialUsage r){return ok("Đã ghi nhận vật tư sử dụng.",service.materialUsage(p,id,r));}
    @PostMapping("/tasks/{id}/cost-proposals") public ApiResponse<ActionResult> cost(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody CostProposal r){return ok("Đã gửi đề xuất chi phí.",service.cost(p,id,r));}
    @PostMapping("/tasks/{id}/complete") public ApiResponse<ActionResult> complete(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Complete r){return ok("Đã báo hoàn thành và chờ nghiệm thu.",service.complete(p,id,r));}
    @PostMapping("/tasks/{id}/reschedule-requests") public ApiResponse<ActionResult> reschedule(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reschedule r){return ok("Đã gửi yêu cầu đổi lịch.",service.reschedule(p,id,r));}
    @PostMapping("/tasks/{id}/transfer-requests") public ApiResponse<ActionResult> transfer(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reason r){return ok("Đã gửi yêu cầu chuyển công việc.",service.transfer(p,id,r));}
    @PostMapping("/tasks/{id}/messages") public ApiResponse<ActionResult> message(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Message r){return ok("Đã gửi tin nhắn.",service.message(p,id,r));}
    @PostMapping(value="/tasks/{id}/attachments",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Attachment>> upload(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,
        @RequestParam long version,@RequestParam String type,@RequestParam(required=false)String caption,
        @RequestPart("file") MultipartFile file)throws Exception{return ResponseEntity.status(HttpStatus.CREATED).body(ok("Đã tải tệp lên.",service.upload(p,id,version,type,caption,file.getOriginalFilename(),file.getContentType(),file.getBytes())));}
    @GetMapping("/tasks/{id}/attachments/{attachmentId}") public ResponseEntity<byte[]> attachment(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long attachmentId){FileData f=service.attachment(p,id,attachmentId);return ResponseEntity.ok().contentType(MediaType.parseMediaType(f.mimeType())).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.inline().filename(f.name()).build().toString()).body(f.content());}

    @GetMapping("/calendar") public ApiResponse<List<CalendarItem>> calendar(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate from,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate to){return ok("Lấy lịch công việc thành công.",service.calendar(p,from,to));}
    @GetMapping("/emergency") public ApiResponse<List<TaskRow>> emergency(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy công việc khẩn cấp thành công.",service.tasks(p,null,null,"URGENT",null,null,null,null,null,null,0,100,"priority").content());}
    @GetMapping("/preventive-maintenance") public ApiResponse<List<PreventivePlan>> preventive(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy kế hoạch bảo trì định kỳ thành công.",service.plans(p));}
    @GetMapping("/assets") public ApiResponse<List<Asset>> assets(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy thiết bị trong phạm vi được giao thành công.",service.assets(p));}
    @GetMapping("/assets/{id}") public ApiResponse<Asset> asset(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ok("Lấy chi tiết thiết bị thành công.",service.asset(p,id));}
    @GetMapping("/materials") public ApiResponse<List<MaterialCatalog>> materials(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy danh mục vật tư thành công.",service.materials(p));}
    @GetMapping("/material-requests") public ApiResponse<List<MaterialRequestRow>> materialRequests(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy yêu cầu vật tư thành công.",service.materialRequests(p));}
    @PostMapping("/material-requests/{id}/receive") public ApiResponse<Void> receive(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestParam long version){service.receiveMaterial(p,id,version);return ok("Đã xác nhận nhận vật tư.",null);}
    @GetMapping("/notifications") public ApiResponse<List<Notification>> notifications(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy thông báo thành công.",service.notifications(p));}
    @PostMapping("/notifications/{id}/read") public ApiResponse<Void> read(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){service.markRead(p,id);return ok("Đã đánh dấu đã đọc.",null);}
    @GetMapping("/performance") public ApiResponse<Performance> performance(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy báo cáo hiệu suất thành công.",service.performance(p));}
    @GetMapping("/account") public ApiResponse<Account> account(@AuthenticationPrincipal AuthenticatedUser p){return ok("Lấy tài khoản kỹ thuật viên thành công.",service.account(p));}
    @PutMapping("/account/profile") public ApiResponse<Account> profile(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody ProfileUpdate r){return ok("Đã cập nhật thông tin liên hệ.",service.profile(p,r));}
    @PutMapping("/account/preferences") public ApiResponse<Account> preferences(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody PreferenceUpdate r){return ok("Đã cập nhật cấu hình thông báo.",service.preferences(p,r));}
    @PostMapping("/account/password") public ApiResponse<Void> password(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody PasswordChange r){service.password(p,r);return ok("Đã đổi mật khẩu.",null);}
    @DeleteMapping("/account/sessions/{id}") public ApiResponse<Void> revoke(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){service.revokeSession(p,id);return ok("Đã thu hồi phiên đăng nhập.",null);}
    private static <T> ApiResponse<T> ok(String message,T data){return ApiResponse.success(message,data);}
}
