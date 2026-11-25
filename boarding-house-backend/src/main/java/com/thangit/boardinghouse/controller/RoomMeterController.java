package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.RoomMeterService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/admin/rooms")
public class RoomMeterController {
 private final RoomMeterService service;
 public RoomMeterController(RoomMeterService service){this.service=service;}
 @PostMapping("/{id}/meters") public ApiResponse<Map<String,Object>> install(@AuthenticationPrincipal AuthenticatedUser p,@PathVariable long id,@Valid @RequestBody RoomMeterService.Install r){return ApiResponse.success("Đã ghi nhận lắp đồng hồ ban đầu và chứng cứ.",service.install(p,id,r));}
}
