package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.*;
import com.thangit.boardinghouse.dto.response.invoice.AdminInvoiceResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminInvoiceService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin/invoices")
public class AdminInvoiceController {
 private final AdminInvoiceService service; public AdminInvoiceController(AdminInvoiceService service){this.service=service;}
 @GetMapping("/summary") public ApiResponse<Summary> summary(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String billingPeriod){return ApiResponse.success("Lấy thống kê hóa đơn thành công.",service.summary(p,propertyId,billingPeriod));}
 @GetMapping("/options") public ApiResponse<InvoiceOptions> options(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy dữ liệu lập hóa đơn thành công.",service.options(p));}
 @GetMapping public ApiResponse<Page<InvoiceRow>> list(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)Long buildingId,@RequestParam(required=false)Long floorId,@RequestParam(required=false)Long roomId,@RequestParam(required=false)String keyword,@RequestParam(required=false)String billingPeriod,@RequestParam(required=false)String status,@RequestParam(required=false)Boolean overdue,@RequestParam(required=false)BigDecimal minimumAmount,@RequestParam(required=false)BigDecimal maximumAmount,@RequestParam(defaultValue="newest")String sort,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="20")int size){return ApiResponse.success("Lấy danh sách hóa đơn thành công.",service.list(p,propertyId,buildingId,floorId,roomId,keyword,billingPeriod,status,overdue,minimumAmount,maximumAmount,sort,page,size));}
 @GetMapping("/{id}") public ApiResponse<InvoiceDetail> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Lấy chi tiết hóa đơn thành công.",service.detail(p,id));}
 @PostMapping public ResponseEntity<ApiResponse<CreateResult>> create(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody SaveInvoice r){return ResponseEntity.status(201).body(ApiResponse.success("Tạo hóa đơn thành công.",service.create(p,r)));}
 @PostMapping("/bulk-preview") public ApiResponse<java.util.List<BulkPreviewRow>> preview(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody BulkInvoice r){return ApiResponse.success("Xem trước hóa đơn hàng loạt thành công.",service.bulkPreview(p,r));}
 @PostMapping("/bulk-generate") public ResponseEntity<ApiResponse<BulkResult>> bulk(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody BulkInvoice r){return ResponseEntity.status(201).body(ApiResponse.success("Lập hóa đơn hàng loạt thành công.",service.bulkGenerate(p,r)));}
 @PostMapping("/{id}/issue") public ApiResponse<InvoiceDetail> issue(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestParam long version){return ApiResponse.success("Hóa đơn đã được phát hành.",service.issue(p,id,version));}
 @PostMapping("/{id}/payments") public ApiResponse<InvoiceDetail> payment(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody RecordPayment r){return ApiResponse.success("Ghi nhận thanh toán thành công.",service.payment(p,id,r));}
 @PostMapping("/{id}/adjustments") public ApiResponse<InvoiceDetail> adjustment(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Adjustment r){return ApiResponse.success("Điều chỉnh hóa đơn thành công.",service.adjust(p,id,r));}
 @PostMapping("/{id}/cancel") public ApiResponse<InvoiceDetail> cancel(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody CancelInvoice r){return ApiResponse.success("Hủy hóa đơn thành công.",service.cancel(p,id,r));}
 @PostMapping("/{id}/reminders") public ApiResponse<InvoiceDetail> reminder(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Reminder r){return ApiResponse.success("Đã gửi nhắc thanh toán.",service.reminder(p,id,r));}
 @GetMapping("/export") public ResponseEntity<byte[]> export(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)Long propertyId,@RequestParam(required=false)String billingPeriod,@RequestParam(required=false)String status){return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=invoices.csv").body(service.export(p,propertyId,billingPeriod,status));}
 @GetMapping("/{id}/pdf") public ResponseEntity<byte[]> pdf(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=invoice-"+id+".pdf").body(service.pdf(p,id));}
}
