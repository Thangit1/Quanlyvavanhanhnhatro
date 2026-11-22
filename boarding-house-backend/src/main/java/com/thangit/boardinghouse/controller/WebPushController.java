package com.thangit.boardinghouse.controller;

import static com.thangit.boardinghouse.service.integration.IntegrationCenter.*;
import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.integration.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/push")
public class WebPushController {
    public record Subscribe(@Positive long ownerId,@NotBlank @Size(max=3000) String endpoint,@NotBlank @Size(max=150) String p256dh,@NotBlank @Size(max=100) String auth){}
    final JdbcClient db;final IntegrationCenter center;final IntegrationVault vault;final WebPushSender sender;
    public WebPushController(JdbcClient db,IntegrationCenter center,IntegrationVault vault,WebPushSender sender){this.db=db;this.center=center;this.vault=vault;this.sender=sender;}
    List<Long> owners(AuthenticatedUser actor){if(actor==null)throw invalid("PUSH_AUTHENTICATION_REQUIRED");return db.sql("""
        SELECT DISTINCT p.owner_id FROM properties p WHERE (:role='OWNER' AND p.owner_id=:user)
        OR :role='MANAGER' AND EXISTS(SELECT 1 FROM property_managers a WHERE a.property_id=p.id AND a.manager_id=:user)
        OR :role='ACCOUNTANT' AND EXISTS(SELECT 1 FROM accountant_property_assignments a WHERE a.property_id=p.id AND a.accountant_id=:user)
        OR :role='TECHNICIAN' AND EXISTS(SELECT 1 FROM technician_property_assignments a WHERE a.property_id=p.id AND a.technician_id=:user)
        OR :role='TENANT' AND EXISTS(SELECT 1 FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE r.property_id=p.id AND c.tenant_id=:user AND c.operational_ended_at IS NULL AND c.status IN ('ACTIVE','EXPIRING','EXPIRED','TERMINATION_REQUESTED','SETTLING'))
        """).param("user",actor.id()).param("role",actor.activeRole().name()).query(Long.class).list();}
    @GetMapping("/options") public Object options(@AuthenticationPrincipal AuthenticatedUser actor){var rows=new ArrayList<Map<String,Object>>();for(long owner:owners(actor)){var config=center.config(owner,"WEB_PUSH");if(config.enabled()&&!config.text("publicKey").isBlank())rows.add(Map.of("ownerId",owner,"publicKey",config.text("publicKey"),"name",db.sql("SELECT full_name FROM users WHERE id=:id").param("id",owner).query(String.class).single()));}return ApiResponse.success("Cấu hình Web Push công khai",rows);}
    @PostMapping("/subscriptions") @Transactional public Object subscribe(@AuthenticationPrincipal AuthenticatedUser actor,@Valid @RequestBody Subscribe request){if(!owners(actor).contains(request.ownerId()))throw new com.thangit.boardinghouse.common.exception.AuthException(org.springframework.http.HttpStatus.FORBIDDEN,"PUSH_SCOPE_DENIED","Không có quyền đăng ký cho chủ nhà này.");WebPushSender.endpoint(request.endpoint());var config=center.config(request.ownerId(),"WEB_PUSH");if(!config.enabled()||WebPushSender.validateKeys(config,vault).status().equals("ERROR"))throw invalid("PUSH_PROVIDER_NOT_READY");byte[] publicKey,auth;try{publicKey=Base64.getUrlDecoder().decode(request.p256dh());auth=Base64.getUrlDecoder().decode(request.auth());}catch(IllegalArgumentException e){throw invalid("PUSH_KEYS_INVALID");}if(publicKey.length!=65||publicKey[0]!=4||auth.length!=16)throw invalid("PUSH_KEYS_INVALID");String hash=WebPushSender.hash(request.endpoint());db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",actor.id()).query(Long.class).single();if(db.sql("SELECT COUNT(*) FROM web_push_subscriptions WHERE endpoint_hash=:hash AND user_id<>:user AND enabled=TRUE").param("hash",hash).param("user",actor.id()).query(Long.class).single()>0)throw invalid("PUSH_ENDPOINT_OWNED_BY_ANOTHER_USER");String ciphertext=vault.encrypt("PUSH:"+actor.id()+":"+hash,request.auth());db.sql("INSERT INTO web_push_subscriptions(owner_id,user_id,endpoint,endpoint_hash,p256dh,auth_ciphertext) VALUES(:owner,:user,:endpoint,:hash,:public,:cipher) ON DUPLICATE KEY UPDATE user_id=:user,p256dh=:public,auth_ciphertext=:cipher,enabled=TRUE,disabled_at=NULL").param("owner",request.ownerId()).param("user",actor.id()).param("endpoint",request.endpoint()).param("hash",hash).param("public",request.p256dh()).param("cipher",ciphertext).update();long id=db.sql("SELECT id FROM web_push_subscriptions WHERE owner_id=:owner AND endpoint_hash=:hash AND user_id=:user").param("owner",request.ownerId()).param("hash",hash).param("user",actor.id()).query(Long.class).single();return ApiResponse.success("Đã đăng ký Web Push",Map.of("id",id,"enabled",true));}
    @DeleteMapping("/subscriptions/{id}") public Object unsubscribe(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable long id){if(actor==null)throw invalid("PUSH_AUTHENTICATION_REQUIRED");db.sql("UPDATE web_push_subscriptions SET enabled=FALSE,disabled_at=CURRENT_TIMESTAMP(6) WHERE id=:id AND user_id=:user").param("id",id).param("user",actor.id()).update();return ApiResponse.success("Đã tắt subscription của bạn",null);}
    @GetMapping("/subscriptions") public Object subscriptions(@AuthenticationPrincipal AuthenticatedUser actor){if(actor==null)throw invalid("PUSH_AUTHENTICATION_REQUIRED");return ApiResponse.success("Subscription của bạn",db.sql("SELECT id,owner_id,enabled,created_at FROM web_push_subscriptions WHERE user_id=:user AND enabled=TRUE ORDER BY id").param("user",actor.id()).query().listOfRows());}
}
