package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.UtilityWorkspaceService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.format.annotation.DateTimeFormat;
@RestController
@RequestMapping({"/api/admin/monthly-billing/workspace","/api/accountant/monthly-billing/workspace"})
public class UtilityWorkspaceController {
    private final UtilityWorkspaceService service;
    public UtilityWorkspaceController(UtilityWorkspaceService service){this.service=service;}
    @PostMapping("/warning-policy") public ApiResponse<Void> warningPolicy(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody UtilityWorkspaceService.WarningPolicy request){service.warningPolicy(p,request);return ApiResponse.success("Đã lưu ngưỡng rà soát theo nhà trọ",null);}
    @GetMapping public ApiResponse<Map<String,Object>> workspace(@AuthenticationPrincipal AuthenticatedUser p,@RequestParam long propertyId,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate period){return ApiResponse.success("Điện nước theo kỳ",service.workspace(p,propertyId,period));}
    @PostMapping("/readings") public ApiResponse<List<Map<String,Object>>> bulk(@AuthenticationPrincipal AuthenticatedUser p,@Valid @RequestBody UtilityWorkspaceService.Bulk request){return ApiResponse.success("Kết quả chốt từng dòng; kiểm tra success của mỗi hợp đồng",service.bulk(p,request));}
}
