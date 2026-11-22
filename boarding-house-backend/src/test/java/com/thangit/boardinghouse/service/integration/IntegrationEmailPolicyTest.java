package com.thangit.boardinghouse.service.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mock.env.MockEnvironment;
import tools.jackson.databind.json.JsonMapper;

class IntegrationEmailPolicyTest {
    MockEnvironment environment;
    IntegrationAdapters adapters;
    JavaMailSenderImpl sender;
    IntegrationCenter.Config config;

    @BeforeEach void setup() {
        environment = new MockEnvironment().withProperty("MAIL_TEST_RECIPIENT", "test@test.invalid");
        environment.setActiveProfiles("local");
        var vault = mock(IntegrationVault.class);
        when(vault.read(1L,"EMAIL","PASSWORD")).thenReturn("test-only-placeholder");
        adapters = spy(new IntegrationAdapters(vault,environment,new JsonMapper(),
                mock(ZaloNotificationProvider.class),mock(WebPushSender.class)));
        sender = mock(JavaMailSenderImpl.class);
        when(sender.createMimeMessage()).thenAnswer(call -> new MimeMessage(Session.getInstance(new Properties())));
        config = new IntegrationCenter.Config(1L,"EMAIL","SMTP","PRODUCTION",true,
                Map.of("host","smtp.gmail.com","port",587,"fromEmail","sender@test.invalid",
                        "fromName","SmartHome AI","username","sender@test.invalid","authentication",true,
                        "tlsMode","STARTTLS"),"CONFIGURED",0);
        doReturn(sender).when(adapters).mail(config);
    }

    @Test void productionMetadataCannotBypassLocalRecipientLimit() {
        var result = adapters.sendEmail(config,"tenant@test.invalid","Test","Body","key",false);
        assertThat(result.code()).isEqualTo("TEST_RECIPIENT_NOT_ALLOWED");
        verify(sender,never()).send(any(MimeMessage.class));
    }

    @Test void businessEmailSwitchStopsWorkerBeforeAnyDatabaseOrProviderIo() {
        var database = mock(org.springframework.jdbc.core.simple.JdbcClient.class);
        var router = new IntegrationChannelRouter(database,null,adapters,null,null);
        var result = router.send(1L,"EMAIL","test-key",2L,"Title","Body");
        assertThat(result.code()).isEqualTo("BUSINESS_EMAIL_DISABLED");
        verifyNoInteractions(database);
        verify(sender,never()).send(any(MimeMessage.class));
    }

    @Test void configuredTestRecipientUsesSharedTransport() {
        var result = adapters.sendEmail(config,"test@test.invalid","Kiểm tra","Nội dung","key",true);
        assertThat(result.status()).isEqualTo("SENT");
        assertThat(result.code()).isEqualTo("SMTP_ACCEPTED");
        verify(sender,times(1)).send(any(MimeMessage.class));
    }
    @Test void preSendConnectionRefusalCarriesRetryPolicyWithoutSensitiveDetail(){
        doThrow(new org.springframework.mail.MailSendException("provider internals",new java.net.ConnectException())).when(sender).send(any(MimeMessage.class));
        var outcome=adapters.sendEmail(config,"test@test.invalid","Test","Body","key",true);
        assertThat(outcome.code()).isEqualTo("SMTP_CONNECTION_FAILED");
        assertThat(outcome.capabilities()).containsEntry("retryable",true);
        assertThat(outcome.toString()).doesNotContain("provider internals");
    }

    @Test void authenticationCheckReturnsSafeFailureWithoutSending() throws Exception {
        doThrow(new jakarta.mail.AuthenticationFailedException("sensitive server response"))
                .when(sender).testConnection();
        // Skip DNS validation in this unit test; no network is used.
        doNothing().when(adapters).validate(config);
        var result = adapters.execute(config,"CHECK","key",null);
        assertThat(result.code()).isEqualTo("SMTP_AUTH_FAILED");
        assertThat(result.toString()).doesNotContain("sensitive server response");
        verify(sender,never()).send(any(MimeMessage.class));
    }
}
