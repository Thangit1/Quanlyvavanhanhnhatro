package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.dto.request.auth.ResetPasswordRequest;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class PasswordRecoveryService {
    public static final String REQUEST_MESSAGE = "Nếu tài khoản hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email của bạn.";
    private final JdbcClient db;
    private final TransactionTemplate tx;
    private final ObjectProvider<EmailService> email;
    private final boolean enabled;
    private final String frontend;
    private final int emailLimit, ipLimit;
    private final SecureRandom random = new SecureRandom();
    private final org.springframework.security.crypto.password.PasswordEncoder passwords;

    public PasswordRecoveryService(JdbcClient db, org.springframework.transaction.PlatformTransactionManager manager,
            ObjectProvider<EmailService> email, org.springframework.security.crypto.password.PasswordEncoder passwords,
            @Value("${app.security.recovery.enabled:false}") boolean enabled,
            @Value("${app.frontend-url}") String frontend,
            @Value("${app.security.recovery.email-limit:3}") int emailLimit,
            @Value("${app.security.recovery.ip-limit:20}") int ipLimit) {
        this.db = db; this.tx = new TransactionTemplate(manager); this.email = email; this.passwords = passwords;
        this.enabled = enabled; this.frontend = frontend.replaceAll("/+$", "");
        this.emailLimit = emailLimit; this.ipLimit = ipLimit;
    }

    private EmailService transport() {
        EmailService sender = email.getIfAvailable();
        boolean validUrl;
        try {
            URI uri = URI.create(frontend);
            validUrl = uri.getHost() != null && uri.getRawUserInfo() == null && uri.getRawQuery() == null
                    && uri.getRawFragment() == null && ("https".equals(uri.getScheme())
                    || ("http".equals(uri.getScheme()) && Set.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost())));
        } catch (IllegalArgumentException invalid) { validUrl = false; }
        if (!enabled || sender == null || !sender.canSendRecovery() || !validUrl)
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "PASSWORD_RECOVERY_UNAVAILABLE",
                    "Dịch vụ khôi phục mật khẩu hiện chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị viên.");
        return sender;
    }

    public void request(String address, String ip) {
        // Check global configuration before account lookup: identical availability for every email.
        transport();
        String normalized = address.trim().toLowerCase(Locale.ROOT);
        limit("request-ip:" + ip, ipLimit);
        limit("request-email:" + normalized, emailLimit);
        tx.executeWithoutResult(status -> {
            // users.email has the schema's case-insensitive unique index.
            var user = db.sql("SELECT id FROM users WHERE email=:email AND status='ACTIVE' FOR UPDATE")
                    .param("email", normalized).query(Long.class).optional();
            user.ifPresent(id -> db.sql("INSERT INTO password_recovery_mail(user_id) VALUES(:id)").param("id", id).update());
        });
    }

    private void limit(String key, int maximum) {
        // A separate committed transaction prevents rolling back failed attempts. Shared across instances.
        Boolean allowed = tx.execute(status -> {
            long window = System.currentTimeMillis() / 900_000;
            String hash = hash(key);
            db.sql("INSERT IGNORE INTO password_recovery_limits(bucket_hash,window_start,attempts) VALUES(:hash,:window,0)")
                    .param("hash", hash).param("window", window).update();
            return db.sql("UPDATE password_recovery_limits SET attempts=attempts+1 WHERE bucket_hash=:hash AND window_start=:window AND attempts<:maximum")
                    .param("hash", hash).param("window", window).param("maximum", maximum).update() == 1;
        });
        if (!Boolean.TRUE.equals(allowed)) throw new AuthException(HttpStatus.TOO_MANY_REQUESTS,
                "PASSWORD_RECOVERY_RATE_LIMITED", "Có quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.");
    }

    public void reset(ResetPasswordRequest request, String ip) {
        limit("reset-ip:" + ip, ipLimit * 3);
        if (!request.newPassword().equals(request.confirmPassword())
                || request.newPassword().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new AuthException(HttpStatus.BAD_REQUEST, "PASSWORD_INVALID", "Mật khẩu xác nhận không khớp hoặc vượt quá 72 byte.");
        // Calculate bcrypt before taking database locks.
        String encoded = passwords.encode(request.newPassword());
        tx.executeWithoutResult(status -> {
            String digest = hash(request.token());
            Long user = db.sql("SELECT user_id FROM password_reset_tokens WHERE token_hash=:hash")
                    .param("hash", digest).query(Long.class).optional().orElseThrow(this::invalidToken);
            String state = db.sql("SELECT status FROM users WHERE id=:id FOR UPDATE").param("id", user).query(String.class).single();
            if (!"ACTIVE".equals(state)) throw invalidToken();
            int consumed = db.sql("UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE token_hash=:hash AND used_at IS NULL AND expires_at>UTC_TIMESTAMP(6)")
                    .param("hash", digest).update();
            if (consumed != 1) throw invalidToken();
            db.sql("UPDATE users SET password_hash=:password,password_changed_at=UTC_TIMESTAMP(6),security_version=security_version+1,failed_login_attempts=0,locked_until=NULL,must_change_password=FALSE,initial_password_expires_at=NULL WHERE id=:id")
                    .param("password", encoded).param("id", user).update();
            db.sql("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=:id AND revoked_at IS NULL").param("id", user).update();
            db.sql("UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE user_id=:id AND used_at IS NULL").param("id", user).update();
            db.sql("UPDATE password_recovery_mail SET status='CANCELLED',finished_at=UTC_TIMESTAMP(6) WHERE user_id=:id AND status='PENDING'").param("id", user).update();
        });
    }

    private AuthException invalidToken() {
        return new AuthException(HttpStatus.BAD_REQUEST, "PASSWORD_RESET_TOKEN_INVALID",
                "Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.");
    }

    private record Dispatch(long id, String address, String token, String digest) {}

    /** Claimed once across workers. SMTP runs AFTER commit; no automatic retry of uncertain delivery. */
    public boolean dispatchOne() {
        EmailService sender = transport();
        Dispatch message = tx.execute(status -> {
            var candidates = db.sql("SELECT id,user_id FROM password_recovery_mail WHERE status='PENDING' AND created_at>UTC_TIMESTAMP(6)-INTERVAL 15 MINUTE ORDER BY id LIMIT 1").query().listOfRows();
            if (candidates.isEmpty()) return null;
            var row = candidates.getFirst(); long id = ((Number) row.get("id")).longValue();
            long user = ((Number) row.get("user_id")).longValue();
            var account = db.sql("SELECT email,status FROM users WHERE id=:id FOR UPDATE").param("id", user).query().singleRow();
            // All recovery transactions lock the user before mail/token rows.
            if (db.sql("UPDATE password_recovery_mail SET status='PROCESSING' WHERE id=:id AND status='PENDING'").param("id", id).update() != 1) return null;
            if (!"ACTIVE".equals(account.get("status"))) {
                db.sql("UPDATE password_recovery_mail SET status='CANCELLED',finished_at=UTC_TIMESTAMP(6) WHERE id=:id").param("id", id).update();
                return null;
            }
            byte[] bytes = new byte[32]; random.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes), digest = hash(token);
            db.sql("UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE user_id=:id AND used_at IS NULL").param("id", user).update();
            db.sql("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(:user,:hash,UTC_TIMESTAMP(6)+INTERVAL 15 MINUTE)").param("user", user).param("hash", digest).update();
            db.sql("UPDATE password_recovery_mail SET status='PROCESSING' WHERE id=:id").param("id", id).update();
            return new Dispatch(id, account.get("email").toString(), token, digest);
        });
        if (message == null) return false;
        // Fragment prevents reset tokens from entering HTTP access logs and Referer headers.
        EmailService.Result result;
        try {
            result = sender.sendRecoveryEmail(message.address(), "SmartHome AI - Đặt lại mật khẩu",
                    "Bạn đã yêu cầu đặt lại mật khẩu SmartHome AI. Liên kết chỉ dùng một lần và hết hạn sau 15 phút:\n"
                    + frontend + "/reset-password#token=" + message.token()
                    + "\nNếu bạn không yêu cầu, hãy bỏ qua email này.");
        } catch (RuntimeException failure) {
            result = new EmailService.Result("UNKNOWN", "SMTP_OUTCOME_UNCONFIRMED", null, false);
        }
        EmailService.Result outcome = result;
        tx.executeWithoutResult(status -> {
            db.sql("UPDATE password_recovery_mail SET status=:status,result_code=:code,finished_at=UTC_TIMESTAMP(6) WHERE id=:id")
                    .param("status", outcome.accepted() ? "SENT" : "FAILED").param("code", outcome.code()).param("id", message.id()).update();
            if (!outcome.accepted()) db.sql("UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP(6) WHERE token_hash=:hash").param("hash", message.digest()).update();
        });
        return true;
    }

    public void cleanup() {
        db.sql("DELETE FROM password_recovery_limits WHERE window_start<:window").param("window", System.currentTimeMillis()/900_000 - 2).update();
        db.sql("UPDATE password_recovery_mail SET status='EXPIRED',finished_at=UTC_TIMESTAMP(6) WHERE status IN ('PENDING','PROCESSING') AND created_at<UTC_TIMESTAMP(6)-INTERVAL 15 MINUTE").update();
        db.sql("DELETE FROM password_reset_tokens WHERE expires_at<UTC_TIMESTAMP(6)-INTERVAL 1 DAY").update();
        db.sql("DELETE FROM password_recovery_mail WHERE finished_at<UTC_TIMESTAMP(6)-INTERVAL 7 DAY").update();
    }

    static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
}
