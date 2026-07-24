package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.config.AuthProperties;
import com.thangit.boardinghouse.domain.auth.*;
import com.thangit.boardinghouse.dto.request.auth.LoginRequest;
import com.thangit.boardinghouse.repository.UserRepository;
import com.thangit.boardinghouse.security.JwtService;
import com.thangit.boardinghouse.service.impl.AuthServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.LinkedHashSet;
import java.util.Optional;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AuthServiceImplTest {
    @Test
    void rejectsRoleSelectedInUiWhenAccountDoesNotOwnIt() {
        UserRepository users = mock(UserRepository.class);
        RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
        AuthProperties properties = new AuthProperties(
                new AuthProperties.Jwt("a-secure-test-secret-that-is-at-least-32-bytes", 900_000, 604_800_000),
                new AuthProperties.Cookie("refresh_token", false, "Lax", "/api/auth"),
                new AuthProperties.Login(5, 900_000));
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 7L);
        ReflectionTestUtils.setField(user, "email", "tenant@example.com");
        ReflectionTestUtils.setField(user, "passwordHash", encoder.encode("correct-password"));
        ReflectionTestUtils.setField(user, "status", UserStatus.ACTIVE);
        Role tenant = new Role();
        ReflectionTestUtils.setField(tenant, "code", RoleCode.TENANT.name());
        ReflectionTestUtils.setField(user, "roles", new LinkedHashSet<>(java.util.Set.of(tenant)));
        when(users.findForAuthenticationByEmailIgnoreCase("tenant@example.com")).thenReturn(Optional.of(user));
        AuthService service = new AuthServiceImpl(users, encoder, new JwtService(properties), refreshTokens, properties);

        assertThatThrownBy(() -> service.login(
                new LoginRequest("tenant@example.com", "correct-password", RoleCode.MANAGER), "test", "127.0.0.1"))
                .isInstanceOf(AuthException.class).hasMessage("Tài khoản không có quyền truy cập với vai trò đã chọn.");
        verifyNoInteractions(refreshTokens);
    }
}
