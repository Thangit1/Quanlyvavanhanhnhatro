package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.integration.AiIntegration;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
public class AiIntegrationController {
    final AiIntegration ai;public AiIntegrationController(AiIntegration ai){this.ai=ai;}
    @PostMapping("/api/owner/integrations/AI/suggest") public Object suggest(@AuthenticationPrincipal AuthenticatedUser actor,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody AiIntegration.Request request){return ApiResponse.success("Gợi ý cần người vận hành xem lại",ai.suggest(actor,key,request));}
}
