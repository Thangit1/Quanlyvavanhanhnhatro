package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.Valid;import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequestMapping("/api/owner/access/properties")
public class OwnerAccessController {
 private final PropertyAuthorization access;public OwnerAccessController(PropertyAuthorization access){this.access=access;}
 public record Reason(@NotBlank @Size(max=500) String reason){}
 @GetMapping("/{id}") public ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id){return ApiResponse.success("Phân công và quyền được cấp",access.detail(p,id));}
 @PutMapping("/{id}/managers") public ApiResponse<Void> assign(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody PropertyAuthorization.ManagerAssignment r){access.assignManager(p,id,r);return ApiResponse.success("Đã cập nhật phân công và lưu lịch sử",null);}
 @PostMapping("/{id}/managers/{manager}/revoke") public ApiResponse<Void> revoke(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@PathVariable long manager,@Valid @RequestBody Reason r){access.revokeManager(p,id,manager,r.reason());return ApiResponse.success("Đã thu hồi phân công",null);}
}
