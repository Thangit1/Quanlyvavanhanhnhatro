package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.OperationsWorkspaceService;
import com.thangit.boardinghouse.service.OperationsWorkspaceService.*;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/admin/operations")
public class OperationsWorkspaceController {
 private final OperationsWorkspaceService service;
 public OperationsWorkspaceController(OperationsWorkspaceService service){this.service=service;}
 @GetMapping("/options") public ApiResponse<Map<String,Object>> options(@AuthenticationPrincipal AuthenticatedUser p){return ApiResponse.success("Phạm vi vận hành",service.options(p));}
 @GetMapping public ApiResponse<Map<String,Object>> read(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam(defaultValue="assets") String tab,@RequestParam(required=false) Long propertyId,@RequestParam(required=false) Long organizationId,@RequestParam(required=false) Long roomId,@RequestParam(required=false) String keyword,@RequestParam(required=false) String status,@RequestParam(required=false) String category,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return ApiResponse.success("Dữ liệu vận hành",service.read(p,tab,propertyId,organizationId,roomId,keyword,status,category,page,size));}
 @PostMapping("/assets") public ApiResponse<Long> create(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody Asset r){return ApiResponse.success("Đã lưu tài sản",service.saveAsset(p,null,r));}
 @PutMapping("/assets/{id}") public ApiResponse<Long> update(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Asset r){return ApiResponse.success("Đã lưu tài sản",service.saveAsset(p,id,r));}
 @GetMapping("/assets/{id}/history") public ApiResponse<Map<String,Object>> history(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Lịch sử tài sản",service.assetHistory(p,id));}
 @GetMapping("/tasks/{task}/attachments") public ApiResponse<java.util.List<Map<String,Object>>> attachments(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long task){return ApiResponse.success("Ảnh và bằng chứng",service.attachments(p,task));}
 @GetMapping("/tasks/{task}/attachments/{file}") public org.springframework.http.ResponseEntity<byte[]> attachment(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long task,@PathVariable long file){var evidence=service.attachment(p,task,file);return org.springframework.http.ResponseEntity.ok().contentType(org.springframework.http.MediaType.parseMediaType(evidence.mime())).header("Cache-Control","private, no-store").header("X-Content-Type-Options","nosniff").header("Content-Disposition",org.springframework.http.ContentDisposition.attachment().filename(evidence.name(),java.nio.charset.StandardCharsets.UTF_8).build().toString()).body(evidence.content());}
 @PostMapping("/materials/{id}/receive") public ApiResponse<Void> receive(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Stock r){service.stock(p,id,r);return ApiResponse.success("Đã nhập kho",null);}
 @PostMapping("/material-requests/{id}/review") public ApiResponse<Void> material(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Decision r){service.reviewMaterial(p,id,r);return ApiResponse.success("Đã xét duyệt vật tư",null);}
 @PostMapping("/costs/{id}/review") public ApiResponse<Void> cost(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody Decision r){service.reviewCost(p,id,r);return ApiResponse.success("Đã xét duyệt chi phí; chưa thực chi",null);}
}
