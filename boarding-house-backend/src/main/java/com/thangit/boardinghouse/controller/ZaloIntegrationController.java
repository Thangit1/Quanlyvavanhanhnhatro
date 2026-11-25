package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.integration.ZaloOAuth;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
public class ZaloIntegrationController {
    final ZaloOAuth oauth;public ZaloIntegrationController(ZaloOAuth oauth){this.oauth=oauth;}
    @PostMapping("/api/owner/integrations/ZALO/oauth") public Object start(@AuthenticationPrincipal AuthenticatedUser actor){return ApiResponse.success("Ủy quyền OA bằng OAuth",oauth.start(actor));}
    @GetMapping("/api/integrations/zalo/oauth/callback") public Object callback(@RequestParam String state,@RequestParam String code){return ApiResponse.success("Đã nhận kết quả ủy quyền; mở lại cấu hình để kiểm tra",oauth.callback(state,code));}
    @PostMapping("/api/integrations/zalo/webhook/{owner}") public Object webhook(@PathVariable long owner,@RequestBody String body,@RequestHeader(value="X-ZEvent-Signature",required=false) String signature){return oauth.webhook(owner,body,signature);}
}
