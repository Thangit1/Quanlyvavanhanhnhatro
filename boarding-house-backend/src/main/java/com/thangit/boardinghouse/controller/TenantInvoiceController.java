package com.thangit.boardinghouse.controller;

import static com.thangit.boardinghouse.dto.response.invoice.TenantInvoiceResponses.*;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.dto.request.invoice.TenantInvoiceRequests.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantInvoiceService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/tenant/invoices")
public class TenantInvoiceController {
    private final TenantInvoiceService service;public TenantInvoiceController(TenantInvoiceService service){this.service=service;}
    @GetMapping("/summary") public ApiResponse<Summary> summary(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy tổng quan hóa đơn thành công.",service.summary(p));}
    @GetMapping public ApiResponse<Page<InvoiceRow>> list(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)String status,
        @RequestParam(required=false)String search,@RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate from,
        @RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate to,@RequestParam(defaultValue="0")int page,
        @RequestParam(defaultValue="10")int size,@RequestParam(defaultValue="createdAt,desc")String sort){return ApiResponse.success("Lấy danh sách hóa đơn thành công.",service.invoices(p,status,search,from,to,page,size,sort));}
    @GetMapping("/{id}") public ApiResponse<InvoiceDetail> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Lấy hóa đơn thành công.",service.detail(p,id));}
    @PostMapping("/{id}/payment-session") public ResponseEntity<ApiResponse<PaymentSession>> session(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,
        @RequestHeader("Idempotency-Key")String key,@Valid@RequestBody CreatePaymentSession r){return ResponseEntity.status(201).body(ApiResponse.success("Tạo phiên thanh toán thành công.",service.createPaymentSession(p,id,key,r)));}
    @PostMapping(value="/{id}/payment-proofs",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ResponseEntity<ApiResponse<Proof>> proof(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,
        @RequestParam(required=false)Long sessionId,@RequestParam BigDecimal amount,@RequestParam@DateTimeFormat(iso=DateTimeFormat.ISO.DATE_TIME)LocalDateTime transferredAt,
        @RequestParam(required=false)String bankName,@RequestParam(required=false)String transactionReference,@RequestParam(required=false)String note,@RequestPart MultipartFile file){return ResponseEntity.status(201).body(ApiResponse.success("Đã gửi minh chứng, vui lòng chờ xác nhận.",service.submitProof(p,id,sessionId,amount,transferredAt,bankName,transactionReference,note,file)));}
    @PostMapping("/{id}/review-requests") public ResponseEntity<ApiResponse<CreatedReview>> review(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid@RequestBody CreateReviewRequest r){return ResponseEntity.status(201).body(ApiResponse.success("Đã gửi yêu cầu rà soát.",service.createReview(p,id,r)));}
    @GetMapping("/{id}/document") public ResponseEntity<byte[]> document(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return file(service.invoiceDocument(p,id),false);}
    static ResponseEntity<byte[]> file(DocumentFile f,boolean attachment){return ResponseEntity.ok().contentType(MediaType.parseMediaType(f.contentType())).header(HttpHeaders.CONTENT_DISPOSITION,(attachment?ContentDisposition.attachment():ContentDisposition.inline()).filename(f.fileName(),StandardCharsets.UTF_8).build().toString()).contentLength(f.content().length).body(f.content());}
}
