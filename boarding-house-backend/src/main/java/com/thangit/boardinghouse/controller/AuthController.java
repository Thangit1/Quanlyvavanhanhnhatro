package com.thangit.boardinghouse.controller;

import com.thangit.boardinghouse.common.base.ApiResponse;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.config.AuthProperties;
import com.thangit.boardinghouse.dto.request.auth.LoginRequest;
import com.thangit.boardinghouse.dto.request.auth.ForgotPasswordRequest;
import com.thangit.boardinghouse.dto.request.auth.RegisterRequest;
import com.thangit.boardinghouse.dto.response.auth.LoginResponse;
import com.thangit.boardinghouse.dto.response.auth.RegisterResponse;
import com.thangit.boardinghouse.dto.response.auth.RefreshTokenResponse;
import com.thangit.boardinghouse.dto.response.auth.UserResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AuthService;
import com.thangit.boardinghouse.service.RegistrationService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.Duration;
import java.util.Arrays;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final RegistrationService registrationService;
    private final AuthProperties properties;

    public AuthController(AuthService authService, RegistrationService registrationService, AuthProperties properties) {
        this.authService = authService; this.registrationService = registrationService; this.properties = properties;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<RegisterResponse>> register(@Valid @RequestBody RegisterRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đăng ký tài khoản khách thuê thành công.",
                        registrationService.registerTenant(body)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest body,
                                                             HttpServletRequest request) {
        var result = authService.login(body, request.getHeader("User-Agent"), clientIp(request));
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie(result.refreshToken(),
                        Duration.ofMillis(properties.jwt().refreshExpiration())).toString())
                .body(ApiResponse.success("Đăng nhập thành công.", result.login()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<RefreshTokenResponse>> refresh(HttpServletRequest request) {
        var result = authService.refresh(requiredRefreshCookie(request), request.getHeader("User-Agent"), clientIp(request));
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie(result.refreshToken(),
                        Duration.ofMillis(properties.jwt().refreshExpiration())).toString())
                .body(ApiResponse.success("Làm mới phiên đăng nhập thành công.", result.refresh()));
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me(@AuthenticationPrincipal AuthenticatedUser principal) {
        return ApiResponse.success("Lấy thông tin tài khoản thành công.", authService.me(principal));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(HttpServletRequest request) {
        authService.logout(optionalRefreshCookie(request));
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString())
                .body(ApiResponse.success("Đăng xuất thành công.", null));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest body) {
        // Response is deliberately identical for existing and unknown accounts.
        // Email delivery is not configured in this project yet; no reset token is exposed here.
        return ResponseEntity.accepted().body(ApiResponse.success(
                "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.", null));
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(properties.cookie().name(), value)
                .httpOnly(true).secure(properties.cookie().secure()).sameSite(properties.cookie().sameSite())
                .path(properties.cookie().path()).maxAge(maxAge).build();
    }

    private String requiredRefreshCookie(HttpServletRequest request) {
        String value = optionalRefreshCookie(request);
        if (value == null) throw new AuthException(HttpStatus.UNAUTHORIZED, "MISSING_REFRESH_TOKEN",
                "Phiên đăng nhập đã hết hạn.");
        return value;
    }

    private String optionalRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies()).filter(c -> properties.cookie().name().equals(c.getName()))
                .map(Cookie::getValue).findFirst().orElse(null);
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",", 2)[0].trim();
    }
}
