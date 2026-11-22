package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.CheckoutEvidenceService;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RestController
@RequestMapping({"/api/admin/checkout-evidence","/api/tenant/checkout-evidence","/api/accountant/checkout-evidence"})
public class CheckoutEvidenceController {
 private final CheckoutEvidenceService service;
 public CheckoutEvidenceController(CheckoutEvidenceService service){this.service=service;}
 @GetMapping("/{id}") public ApiResponse<List<Map<String,Object>>> list(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Bằng chứng trả phòng",service.list(p,id));}
 @PostMapping(value="/{id}",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public ApiResponse<Long> upload(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@RequestHeader("Idempotency-Key") String key,@RequestParam String type,@RequestParam(required=false) Long disputeId,@RequestPart MultipartFile file)throws java.io.IOException{return ApiResponse.success("Đã lưu bằng chứng",service.upload(p,id,key,type,disputeId,file.getOriginalFilename(),file.getContentType(),file.getBytes()));}
 @GetMapping("/{id}/{file}") public ResponseEntity<byte[]> file(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long file){var f=service.file(p,id,file);return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(f.mime())).header("X-Content-Type-Options","nosniff").header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(f.name(),java.nio.charset.StandardCharsets.UTF_8).build().toString()).body(f.bytes());}
}
