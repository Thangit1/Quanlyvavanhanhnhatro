package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.config.AuthProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;

class PasswordRecoveryConfigurationTest {
    @Test void disabledOrMissingSmtpFailsIdenticallyBeforeAccountLookup() {
        JdbcClient db=mock(JdbcClient.class);
        @SuppressWarnings("unchecked") ObjectProvider<EmailService> provider=mock(ObjectProvider.class);
        var recovery=new PasswordRecoveryService(db,mock(PlatformTransactionManager.class),provider,new BCryptPasswordEncoder(),true,"https://frontend.test.invalid",3,20);
        for(String email:new String[]{"owner@test.invalid","unknown@test.invalid"})
            assertThatThrownBy(()->recovery.request(email,"127.0.0.1")).isInstanceOfSatisfying(AuthException.class,
                    error->assertThat(error.code()).isEqualTo("PASSWORD_RECOVERY_UNAVAILABLE"));
        verifyNoInteractions(db);
    }
    @Test void insecureCrossSiteCookieConfigurationIsRejected() {
        assertThatThrownBy(()->new AuthProperties.Cookie("refresh_token",false,"None","/api/auth")).isInstanceOf(IllegalArgumentException.class);
        assertThatCode(()->new AuthProperties.Cookie("refresh_token",true,"None","/api/auth")).doesNotThrowAnyException();
    }
    @Test void clientIpHeadersAreTrustedOnlyFromExplicitCloudflaredPeers() {
        var request=mock(jakarta.servlet.http.HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("CF-Connecting-IP")).thenReturn("203.0.113.10");
        assertThat(new com.thangit.boardinghouse.security.ClientAddress(java.util.List.of()).of(request)).isEqualTo("127.0.0.1");
        assertThat(new com.thangit.boardinghouse.security.ClientAddress(java.util.List.of("127.0.0.1")).of(request)).isEqualTo("203.0.113.10");
    }
}
