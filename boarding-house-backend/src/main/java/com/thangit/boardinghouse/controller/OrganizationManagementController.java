package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.OrganizationManagementService;
import com.thangit.boardinghouse.service.OrganizationManagementService.*;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/owner/organizations")
public class OrganizationManagementController {
    private final OrganizationManagementService service;
    public OrganizationManagementController(OrganizationManagementService service) { this.service=service; }
    @PostMapping("/setup")
    public ApiResponse<Long> setup(@AuthenticationPrincipal AuthenticatedUser actor) {
        return ApiResponse.success("Đã thiết lập không gian quản lý",service.setup(actor));
    }
    @GetMapping
    public ApiResponse<List<Map<String,Object>>> list(@AuthenticationPrincipal AuthenticatedUser actor) {
        return ApiResponse.success("Danh sách công ty",service.organizations(actor));
    }
    @PostMapping
    public ApiResponse<Long> create(@AuthenticationPrincipal AuthenticatedUser actor,@Valid @RequestBody SaveOrganization request) {
        return ApiResponse.success("Đã tạo công ty",service.create(actor,request));
    }
    @GetMapping("/{id}")
    public ApiResponse<Map<String,Object>> detail(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id) {
        return ApiResponse.success("Công ty và khu vực",service.detail(actor,id));
    }
    @PutMapping("/{id}")
    public ApiResponse<Void> update(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@Valid @RequestBody SaveOrganization request) {
        service.update(actor,id,request);return ApiResponse.success("Đã cập nhật tổ chức",null);
    }
    @PostMapping("/{id}/areas")
    public ApiResponse<Long> createArea(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@Valid @RequestBody SaveArea request) {
        return ApiResponse.success("Đã tạo khu vực",service.createArea(actor,id,request));
    }
    @PutMapping("/{id}/areas/{area}")
    public ApiResponse<Void> updateArea(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@PathVariable long area,@Valid @RequestBody SaveArea request) {
        service.updateArea(actor,id,area,request);return ApiResponse.success("Đã cập nhật khu vực",null);
    }
    @PostMapping("/{id}/properties")
    public ApiResponse<Long> link(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@Valid @RequestBody LinkProperty request) {
        return ApiResponse.success("Đã gán nhà trọ vào công ty",service.link(actor,id,request));
    }
    @PutMapping("/{id}/relationships/{relationship}/area")
    public ApiResponse<Void> move(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@PathVariable long relationship,@Valid @RequestBody MoveArea request) {
        service.move(actor,id,relationship,request);return ApiResponse.success("Đã chuyển khu vực",null);
    }
    @PostMapping("/{id}/relationships/{relationship}/end")
    public ApiResponse<Void> end(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@PathVariable long relationship,@Valid @RequestBody EndRelationship request) {
        service.end(actor,id,relationship,request);return ApiResponse.success("Đã kết thúc phân nhóm vận hành",null);
    }
    @GetMapping("/{id}/history")
    public ApiResponse<List<Map<String,Object>>> history(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id,@RequestParam(defaultValue="0") int page) {
        return ApiResponse.success("Nhật ký quản trị",service.history(actor,id,page));
    }
}
