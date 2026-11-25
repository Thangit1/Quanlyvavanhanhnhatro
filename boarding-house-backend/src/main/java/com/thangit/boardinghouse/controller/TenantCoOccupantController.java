package com.thangit.boardinghouse.controller;

import static com.thangit.boardinghouse.dto.request.occupant.TenantCoOccupantRequests.*;
import static com.thangit.boardinghouse.dto.response.occupant.TenantCoOccupantResponses.*;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantCoOccupantService;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/tenant/co-occupants")
public class TenantCoOccupantController {
    private final TenantCoOccupantService service;
    public TenantCoOccupantController(TenantCoOccupantService service){this.service=service;}

    @GetMapping("/overview") public ApiResponse<Overview> overview(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Lấy thông tin người ở cùng thành công.",service.overview(p));}
    @GetMapping public ApiResponse<Page<OccupantRow>> occupants(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="10")int size){return ApiResponse.success("Lấy danh sách người đang cư trú thành công.",service.occupants(p,page,size));}
    @GetMapping("/{occupantId}") public ApiResponse<OccupantDetail> occupant(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long occupantId){return ApiResponse.success("Lấy thông tin người ở cùng thành công.",service.occupant(p,occupantId));}
    @GetMapping("/requests") public ApiResponse<Page<RequestRow>> requests(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(required=false)String status,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="10")int size){return ApiResponse.success("Lấy danh sách yêu cầu thành công.",service.requests(p,status,page,size));}
    @GetMapping("/history") public ApiResponse<Page<ResidencePeriod>> history(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="10")int size){return ApiResponse.success("Lấy lịch sử cư trú thành công.",service.history(p,page,size));}
    @PostMapping("/requests") public ResponseEntity<ApiResponse<Created>> create(@AuthenticationPrincipal AuthenticatedUser p,@RequestHeader("Idempotency-Key")String key,@Valid@RequestBody CreateRequest request){return ResponseEntity.status(201).body(ApiResponse.success("Yêu cầu đăng ký người ở cùng đã được gửi.",service.create(p,key,request)));}
    @GetMapping("/requests/{requestId}") public ApiResponse<RequestDetail> request(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long requestId){return ApiResponse.success("Lấy chi tiết yêu cầu thành công.",service.request(p,requestId));}
    @PostMapping(value="/requests/{requestId}/documents",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ResponseEntity<ApiResponse<Uploaded>> upload(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long requestId,@RequestParam(defaultValue="OTHER")String documentType,@RequestPart("files")List<MultipartFile> files){return ResponseEntity.status(201).body(ApiResponse.success("Hồ sơ đã được tải lên.",service.upload(p,requestId,documentType,files)));}
    @GetMapping("/documents/{documentId}") public ResponseEntity<byte[]> document(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long documentId){FileData f=service.file(p,documentId);return ResponseEntity.ok().contentType(MediaType.parseMediaType(f.contentType())).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(f.fileName(),StandardCharsets.UTF_8).build().toString()).contentLength(f.content().length).body(f.content());}
    @PostMapping("/requests/{requestId}/additional-information") public ApiResponse<ActionResult> additional(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long requestId,@Valid@RequestBody AdditionalInformation request){return ApiResponse.success("Thông tin bổ sung đã được gửi.",service.additional(p,requestId,request));}
    @PostMapping("/requests/{requestId}/cancel") public ApiResponse<ActionResult> cancel(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long requestId,@Valid@RequestBody CancelRequest request){return ApiResponse.success("Yêu cầu đã được hủy.",service.cancel(p,requestId,request));}
    @PostMapping("/{occupantId}/move-out-requests") public ResponseEntity<ApiResponse<Created>> moveOut(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long occupantId,@RequestHeader("Idempotency-Key")String key,@Valid@RequestBody MoveOutRequest request){return ResponseEntity.status(201).body(ApiResponse.success("Yêu cầu chuyển đi đã được gửi.",service.moveOut(p,occupantId,key,request)));}
}
