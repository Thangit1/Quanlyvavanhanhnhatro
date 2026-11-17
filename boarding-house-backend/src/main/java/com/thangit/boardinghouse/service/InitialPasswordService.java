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
    public record Change(@NotBlank @Size(max=72) String currentPassword,
            @NotBlank @Size(min=8,max=72) @Pattern(regexp="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$") String newPassword,
            @NotBlank @Size(max=72) String confirmPassword) {}
    private final JdbcClient db;private final PasswordEncoder passwords;private final SecurityAudit audit;
    public InitialPasswordService(JdbcClient db,PasswordEncoder passwords,SecurityAudit audit){this.db=db;this.passwords=passwords;this.audit=audit;}
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
