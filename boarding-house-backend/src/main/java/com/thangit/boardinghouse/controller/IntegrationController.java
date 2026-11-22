package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.integration.*;
import com.thangit.boardinghouse.service.integration.IntegrationCenter.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/owner/integrations")
public class IntegrationController {
    final IntegrationCenter center;final ZaloNotificationProvider zalo;final WebPushSender push;
    public IntegrationController(IntegrationCenter center,ZaloNotificationProvider zalo,WebPushSender push){this.center=center;this.zalo=zalo;this.push=push;}
    @GetMapping public Object list(@AuthenticationPrincipal AuthenticatedUser actor){return ApiResponse.success("Trung tâm tích hợp",center.list(actor));}
    @GetMapping("/{kind}") public Object read(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable String kind){return ApiResponse.success("Cấu hình tích hợp",center.read(actor,kind));}
    @PutMapping("/{kind}") public Object save(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable String kind,@Valid @RequestBody Save request){return ApiResponse.success("Đã lưu cấu hình; cần kiểm tra kết nối",center.save(actor,kind,request));}
    @PostMapping("/{kind}/{operation}") public Object execute(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable String kind,@PathVariable String operation,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody(required=false) TestRequest request){return ApiResponse.success("Kết quả thao tác tích hợp",center.execute(actor,kind,operation,key,request));}
    @GetMapping("/{kind}/history") public Object history(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable String kind){return ApiResponse.success("Nhật ký tích hợp",center.history(actor,kind));}
    @GetMapping("/ZALO/templates") public Object templates(@AuthenticationPrincipal AuthenticatedUser actor){return ApiResponse.success("Template đồng bộ từ Zalo",zalo.templates(center.owner(actor)));}
    @PostMapping("/WEB_PUSH/keys") public Object generate(@AuthenticationPrincipal AuthenticatedUser actor){return ApiResponse.success("Đã tạo khóa VAPID; đăng ký lại các trình duyệt",center.generateVapid(actor));}
    @DeleteMapping("/ZALO/connection") public Object disconnect(@AuthenticationPrincipal AuthenticatedUser actor){return ApiResponse.success("Đã ngắt kết nối nội bộ. Thu hồi quyền ứng dụng trên Zalo nếu cần.",center.disconnectZalo(actor));}
}
