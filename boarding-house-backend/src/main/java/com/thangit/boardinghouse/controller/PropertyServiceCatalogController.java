package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.PropertyServiceCatalogService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/admin/properties/{property}/services")
public class PropertyServiceCatalogController {
    private final PropertyServiceCatalogService service;
    public PropertyServiceCatalogController(PropertyServiceCatalogService service){this.service=service;}
    @GetMapping public ApiResponse<Map<String,Object>> list(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long property){return ApiResponse.success("Danh mục dịch vụ nhà trọ",service.list(p,property));}
    @PostMapping public ApiResponse<Map<String,Long>> create(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long property,@Valid @RequestBody PropertyServiceCatalogService.Save r){return ApiResponse.success("Đã lưu cấu hình dịch vụ",Map.of("id",service.save(p,property,null,r)));}
    @PutMapping("/{id}") public ApiResponse<Map<String,Long>> update(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long property,@PathVariable long id,@Valid @RequestBody PropertyServiceCatalogService.Save r){return ApiResponse.success("Đã cập nhật cấu hình dịch vụ",Map.of("id",service.save(p,property,id,r)));}
}
