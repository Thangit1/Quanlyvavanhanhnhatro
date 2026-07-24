package com.thangit.boardinghouse.security;

import com.thangit.boardinghouse.config.AuthProperties;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.domain.auth.User;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {
    @Test
    void createsAndParsesRoleBoundAccessToken() {
        AuthProperties properties = new AuthProperties(
                new AuthProperties.Jwt("a-secure-test-secret-that-is-at-least-32-bytes", 900_000, 604_800_000),
                new AuthProperties.Cookie("refresh_token", false, "Lax", "/api/auth"),
                new AuthProperties.Login(5, 900_000));
        JwtService service = new JwtService(properties);
        User user = new User();
        ReflectionTestUtils.setField(user, "id", 12L);
        ReflectionTestUtils.setField(user, "email", "manager@smarthome.ai");

        AuthenticatedUser parsed = service.parseAccessToken(service.createAccessToken(user, RoleCode.MANAGER));

        assertThat(parsed.id()).isEqualTo(12L);
        assertThat(parsed.email()).isEqualTo("manager@smarthome.ai");
        assertThat(parsed.activeRole()).isEqualTo(RoleCode.MANAGER);
    }
}
