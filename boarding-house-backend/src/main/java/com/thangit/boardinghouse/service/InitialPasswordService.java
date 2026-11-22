package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InitialPasswordService {
    public record Setup(@NotBlank @Size(max=100) String token,
            @NotBlank @Size(min=8,max=72) @Pattern(regexp="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$") String newPassword,
            @NotBlank @Size(max=72) String confirmPassword) {}
    public record Change(@NotBlank @Size(max=72) String currentPassword,
            @NotBlank @Size(min=8,max=72) @Pattern(regexp="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$") String newPassword,
            @NotBlank @Size(max=72) String confirmPassword) {}
    private final JdbcClient db;private final PasswordEncoder passwords;private final SecurityAudit audit;
    public InitialPasswordService(JdbcClient db,PasswordEncoder passwords,SecurityAudit audit){this.db=db;this.passwords=passwords;this.audit=audit;}
    /** Worker-only: caller must never serialize or log the returned token. */
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public String issueSetupToken(long user){
        db.sql("SELECT id FROM users WHERE id=:id AND status='ACTIVE' FOR UPDATE").param("id",user).query(Long.class).optional().orElseThrow(()->setupInvalid());
        if(db.sql("SELECT COUNT(*) FROM account_password_setups WHERE user_id=:id AND consumed_at IS NULL FOR UPDATE").param("id",user).query(Long.class).single()!=1)throw setupInvalid();
        byte[] bytes=new byte[32];new java.security.SecureRandom().nextBytes(bytes);String raw=java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        db.sql("UPDATE account_password_setups SET token_hash=:hash,issued_at=UTC_TIMESTAMP(6),expires_at=DATE_ADD(UTC_TIMESTAMP(6),INTERVAL 24 HOUR) WHERE user_id=:id AND consumed_at IS NULL").param("id",user).param("hash",tokenHash(raw)).update();
        return raw;
    }
    @Transactional
    public void completeSetup(Setup request){
        if(!request.token().matches("[a-zA-Z0-9_-]{43}")||!request.newPassword().matches("^(?=.{8,72}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$")||!request.newPassword().equals(request.confirmPassword())||request.newPassword().getBytes(StandardCharsets.UTF_8).length>72)throw setupInvalid();
        var ids=db.sql("SELECT user_id FROM account_password_setups WHERE token_hash=:hash").param("hash",tokenHash(request.token())).query(Long.class).list();if(ids.isEmpty())throw setupInvalid();long user=ids.getFirst();
        db.sql("SELECT id FROM users WHERE id=:id AND status='ACTIVE' AND (locked_until IS NULL OR locked_until<=UTC_TIMESTAMP(6)) FOR UPDATE").param("id",user).query(Long.class).optional().orElseThrow(()->setupInvalid());
        int consumed=db.sql("UPDATE account_password_setups SET consumed_at=UTC_TIMESTAMP(6) WHERE user_id=:id AND token_hash=:hash AND consumed_at IS NULL AND expires_at>UTC_TIMESTAMP(6)").param("id",user).param("hash",tokenHash(request.token())).update();if(consumed!=1)throw setupInvalid();
        db.sql("UPDATE users SET password_hash=:hash,must_change_password=FALSE,initial_password_expires_at=NULL,password_changed_at=UTC_TIMESTAMP(6),failed_login_attempts=0,locked_until=NULL WHERE id=:id").param("id",user).param("hash",passwords.encode(request.newPassword())).update();
        audit.record(user,"ACCOUNT_PASSWORD_SETUP_COMPLETED","USER",user,"SUCCESS","One-time setup consumed; password replaced");
    }
    static String tokenHash(String token){try{return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));}catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private static AuthException setupInvalid(){return new AuthException(HttpStatus.BAD_REQUEST,"PASSWORD_SETUP_INVALID","Liên kết không hợp lệ, đã dùng hoặc hết hạn; kiểm tra mật khẩu và yêu cầu chủ nhà gửi lại nếu cần.");}
    @Transactional
    public void change(AuthenticatedUser actor,Change request){
        if(actor==null)throw new AuthException(HttpStatus.UNAUTHORIZED,"AUTHENTICATION_REQUIRED","Vui lòng đăng nhập.");
        if(!request.newPassword().equals(request.confirmPassword())||request.newPassword().getBytes(StandardCharsets.UTF_8).length>72)
            throw new AuthException(HttpStatus.BAD_REQUEST,"PASSWORD_INVALID","Mật khẩu xác nhận không khớp hoặc mật khẩu vượt giới hạn 72 byte.");
        var user=db.sql("SELECT password_hash,must_change_password,initial_password_expires_at FROM users WHERE id=:id FOR UPDATE").param("id",actor.id()).query().singleRow();
        if(!passwords.matches(request.currentPassword(),user.get("password_hash").toString()))throw new AuthException(HttpStatus.BAD_REQUEST,"CURRENT_PASSWORD_INVALID","Mật khẩu hiện tại không đúng.");
        if(passwords.matches(request.newPassword(),user.get("password_hash").toString()))throw new AuthException(HttpStatus.BAD_REQUEST,"PASSWORD_UNCHANGED","Mật khẩu mới phải khác mật khẩu khởi tạo.");
        if(db.sql("SELECT COUNT(*) FROM users WHERE id=:id AND initial_password_expires_at<=UTC_TIMESTAMP(6)").param("id",actor.id()).query(Long.class).single()>0)
            throw new AuthException(HttpStatus.FORBIDDEN,"PASSWORD_SETUP_EXPIRED","Mật khẩu khởi tạo đã hết hạn. Liên hệ người quản trị để cấp lại.");
        db.sql("UPDATE users SET password_hash=:hash,must_change_password=FALSE,initial_password_expires_at=NULL,password_changed_at=UTC_TIMESTAMP(6) WHERE id=:id").param("hash",passwords.encode(request.newPassword())).param("id",actor.id()).update();
        audit.record(actor.id(),"INITIAL_PASSWORD_CHANGED","USER",actor.id(),"SUCCESS","Initial credential replaced; existing sessions revoked");
    }
}
