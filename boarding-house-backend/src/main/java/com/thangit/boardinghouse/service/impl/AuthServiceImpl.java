package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.config.AuthProperties;
import com.thangit.boardinghouse.domain.auth.*;
import com.thangit.boardinghouse.dto.request.auth.LoginRequest;
import com.thangit.boardinghouse.dto.response.auth.*;
import com.thangit.boardinghouse.repository.UserRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.security.JwtService;
import com.thangit.boardinghouse.service.AuthService;
import com.thangit.boardinghouse.service.RefreshTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Comparator;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthServiceImpl implements AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokens;
    private final AuthProperties properties;
    private final String dummyPasswordHash;

    public AuthServiceImpl(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService,
                           RefreshTokenService refreshTokens, AuthProperties properties) {
        this.users = users; this.passwordEncoder = passwordEncoder; this.jwtService = jwtService;
        this.refreshTokens = refreshTokens; this.properties = properties;
        this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Override @Transactional(noRollbackFor = AuthException.class)
    public AuthResult login(LoginRequest request, String userAgent, String ipAddress) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        User user = users.findForAuthenticationByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            passwordEncoder.matches(request.password(), dummyPasswordHash);
            log.warn("Failed login for unknown account from ip={}", ipAddress);
            throw invalidCredentials();
        }
        Instant now = Instant.now();
        if (user.getStatus() != UserStatus.ACTIVE) {
            String code = user.isTemporarilyLocked(now) ? "ACCOUNT_LOCKED" : "ACCOUNT_INACTIVE";
            String message = code.equals("ACCOUNT_LOCKED")
                    ? "Tài khoản đã bị khóa hoặc ngừng hoạt động."
                    : "Tài khoản đã bị khóa hoặc ngừng hoạt động.";
            throw new AuthException(HttpStatus.LOCKED, code, message);
        }
        if (user.isTemporarilyLocked(now)) {
            throw new AuthException(HttpStatus.LOCKED, "ACCOUNT_LOCKED", "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            user.registerFailedLogin(properties.login().maxAttempts(),
                    now.plusMillis(properties.login().lockDuration()));
            log.warn("Failed login for userId={} from ip={}", user.getId(), ipAddress);
            throw invalidCredentials();
        }
        boolean hasRole = user.getRoles().stream().anyMatch(role -> role.getCode().equals(request.requestedRole().name()));
        if (!hasRole) {
            log.warn("Rejected requested role {} for userId={}", request.requestedRole(), user.getId());
            throw new AuthException(HttpStatus.FORBIDDEN, "ROLE_NOT_ALLOWED",
                    "Tài khoản không có quyền truy cập với vai trò đã chọn.");
        }
        user.registerSuccessfulLogin(now);
        String access = jwtService.createAccessToken(user, request.requestedRole());
        var refresh = refreshTokens.issue(user, request.requestedRole(), UUID.randomUUID().toString(), userAgent, ipAddress);
        log.info("Login succeeded for userId={} role={}", user.getId(), request.requestedRole());
        return new AuthResult(new LoginResponse(access, "Bearer", jwtService.accessExpirationSeconds(),
                mapUser(user, request.requestedRole())), null, refresh.rawToken());
    }

    @Override @Transactional(noRollbackFor = AuthException.class)
    public AuthResult refresh(String rawToken, String userAgent, String ipAddress) {
        RefreshToken old = refreshTokens.verifyAndRotateSource(rawToken);
        User user = old.getUser();
        if (user.getStatus() != UserStatus.ACTIVE || user.isTemporarilyLocked(Instant.now())) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "ACCOUNT_INACTIVE", "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        }
        boolean stillAllowed = user.getRoles().stream().anyMatch(r -> r.getCode().equals(old.getActiveRole().name()));
        if (!stillAllowed) throw new AuthException(HttpStatus.FORBIDDEN, "ROLE_NOT_ALLOWED",
                "Tài khoản không có quyền truy cập với vai trò đã chọn.");
        var next = refreshTokens.issue(user, old.getActiveRole(), old.getFamilyId(), userAgent, ipAddress);
        String access = jwtService.createAccessToken(user, old.getActiveRole());
        return new AuthResult(null, new RefreshTokenResponse(access, jwtService.accessExpirationSeconds()), next.rawToken());
    }

    @Override @Transactional(readOnly = true)
    public UserResponse me(AuthenticatedUser principal) {
        User user = users.findById(principal.id()).orElseThrow(() ->
                new AuthException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "Phiên đăng nhập đã hết hạn."));
        if (user.getStatus() != UserStatus.ACTIVE) throw new AuthException(HttpStatus.UNAUTHORIZED,
                "ACCOUNT_INACTIVE", "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
        boolean allowed = user.getRoles().stream().anyMatch(r -> r.getCode().equals(principal.activeRole().name()));
        if (!allowed) throw new AuthException(HttpStatus.FORBIDDEN, "ROLE_NOT_ALLOWED",
                "Tài khoản không có quyền truy cập với vai trò đã chọn.");
        return mapUser(user, principal.activeRole());
    }

    @Override public void logout(String refreshToken) { refreshTokens.revoke(refreshToken); }

    private UserResponse mapUser(User user, RoleCode role) {
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getAvatarUrl(),
                user.getRoles().stream().map(Role::getCode).filter(this::isSupportedRole).map(RoleCode::valueOf)
                        .sorted(Comparator.comparing(Enum::name)).toList(), role);
    }

    private boolean isSupportedRole(String code) {
        try { RoleCode.valueOf(code); return true; }
        catch (IllegalArgumentException exception) { return false; }
    }

    private AuthException invalidCredentials() {
        return new AuthException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
    }
}
