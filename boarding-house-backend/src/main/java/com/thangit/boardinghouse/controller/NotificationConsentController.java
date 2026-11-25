package com.thangit.boardinghouse.controller;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/integrations/notification-consent/ZALO")
public class NotificationConsentController {
    record Consent(boolean enabled){}
    final JdbcClient db;public NotificationConsentController(JdbcClient db){this.db=db;}
    @GetMapping public Object get(@AuthenticationPrincipal AuthenticatedUser actor){return ApiResponse.success("Quyền nhận tin Zalo của bạn",java.util.Map.of("enabled",db.sql("SELECT zalo_enabled FROM notification_preferences WHERE user_id=:id").param("id",actor.id()).query(Boolean.class).optional().orElse(false)));}
    @PutMapping public Object set(@AuthenticationPrincipal AuthenticatedUser actor,@RequestBody Consent consent){db.sql("INSERT INTO notification_preferences(user_id,zalo_enabled) VALUES(:id,:enabled) ON DUPLICATE KEY UPDATE zalo_enabled=:enabled,version=version+1").param("id",actor.id()).param("enabled",consent.enabled()).update();return get(actor);}
}
