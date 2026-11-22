package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import jakarta.mail.Session;
import jakarta.mail.Message;
import jakarta.mail.internet.MimeMessage;
import java.net.SocketTimeoutException;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class EmailServiceUnitTest {
    JavaMailSender sender;
    MimeMessage message;
    EmailService service;

    @BeforeEach void setup() {
        sender = mock(JavaMailSender.class);
        message = new MimeMessage(Session.getInstance(new Properties()));
        when(sender.createMimeMessage()).thenReturn(message);
        service = new EmailService(sender, "sender@test.invalid", "SmartHome AI", "test@test.invalid", false);
    }

    @Test void vietnameseHtmlIsUtf8AndMultipleRecipientsArePrivate() throws Exception {
        var enabled = new EmailService(sender, "sender@test.invalid", "Nhà trọ", "", true);
        var result = enabled.sendHtmlEmail(List.of("a@test.invalid", "b@test.invalid"),
                "Hóa đơn tiền phòng", "<p>Thanh toán thành công</p>");
        message.saveChanges();
        assertThat(result.accepted()).isTrue();
        assertThat(message.getSubject()).isEqualTo("Hóa đơn tiền phòng");
        assertThat(message.getContentType()).containsIgnoringCase("text/html").containsIgnoringCase("UTF-8");
        assertThat(message.getContent()).isEqualTo("<p>Thanh toán thành công</p>");
        assertThat(message.getRecipients(Message.RecipientType.BCC)).hasSize(2);
        assertThat(message.getRecipients(Message.RecipientType.TO)).isNull();
        verify(sender).send(message);
    }

    @Test void plainTextUsesConfiguredSenderAndRecipient() throws Exception {
        assertThat(service.sendEmail("test@test.invalid", "Kiểm tra", "Nội dung").accepted()).isTrue();
        message.saveChanges();
        assertThat(message.getContentType()).containsIgnoringCase("text/plain");
        assertThat(message.getContent()).isEqualTo("Nội dung");
        assertThat(message.getFrom()[0].toString()).contains("sender@test.invalid");
        verify(sender, times(1)).send(message);
    }

    @Test void unconfiguredOrDifferentTestRecipientCannotSend() {
        assertThat(service.sendEmail("tenant@test.invalid", "Test", "Body").code()).isEqualTo("TEST_RECIPIENT_NOT_ALLOWED");
        var unconfigured = new EmailService(sender, "sender@test.invalid", "SmartHome", "", false);
        assertThat(unconfigured.sendEmail("test@test.invalid", "Test", "Body").code()).isEqualTo("TEST_RECIPIENT_NOT_ALLOWED");
        verify(sender, never()).send(any(MimeMessage.class));
    }

    @Test void missingCredentialsReturnNotConfigured() {
        var smtp = new JavaMailSenderImpl();
        var missing = new EmailService(smtp, "sender@test.invalid", "SmartHome", "test@test.invalid", false);
        assertThat(missing.checkConnection().status()).isEqualTo("NOT_CONFIGURED");
        assertThat(missing.sendEmail("test@test.invalid", "Test", "Body").code()).isEqualTo("SMTP_CREDENTIALS_MISSING");
    }

    @Test void authFailureIsSafeAndNotRetryable() {
        doThrow(new MailAuthenticationException("secret-provider-response")).when(sender).send(any(MimeMessage.class));
        var result = service.sendEmail("test@test.invalid", "Test", "Body");
        assertThat(result.code()).isEqualTo("SMTP_AUTH_FAILED");
        assertThat(result.retryable()).isFalse();
        assertThat(result.toString()).doesNotContain("secret-provider-response");
    }

    @Test void timeoutAfterSendingIsUnknownAndNeverAutomaticallyRetried() {
        doThrow(new MailSendException("timeout", new SocketTimeoutException())).when(sender).send(any(MimeMessage.class));
        var result = service.sendEmail("test@test.invalid", "Test", "Body");
        assertThat(result.status()).isEqualTo("UNKNOWN");
        assertThat(result.code()).isEqualTo("SMTP_TIMEOUT");
        assertThat(result.retryable()).isFalse();
        verify(sender, times(1)).send(message);
    }
    @Test void connectionRefusedBeforeSendingCanUseTheWorkersBoundedRetry(){
        doThrow(new MailSendException("connection refused",new java.net.ConnectException())).when(sender).send(any(MimeMessage.class));
        var result=service.sendEmail("test@test.invalid","Test","Body");
        assertThat(result.code()).isEqualTo("SMTP_CONNECTION_FAILED");
        assertThat(result.retryable()).isTrue();
        verify(sender,times(1)).send(message);
    }

    @Test void partialOrUnknownMailSendFailureIsNotAutomaticallyRetried() {
        doThrow(new MailSendException("partial recipient failure")).when(sender).send(any(MimeMessage.class));
        var result = service.sendEmail("test@test.invalid", "Test", "Body");
        assertThat(result.status()).isEqualTo("UNKNOWN");
        assertThat(result.retryable()).isFalse();
    }

    @Test void headerInjectionAndInvalidMailboxAreRejectedBeforeSending() {
        assertThat(service.sendEmail("test@test.invalid", "Test\r\nBcc: stranger@test.invalid", "Body").code())
                .isEqualTo("EMAIL_MESSAGE_INVALID");
        assertThat(EmailService.sendConfigured(sender, "sender@test.invalid", "SmartHome", List.of("invalid"),
                "Test", "Body", false, null).code()).isEqualTo("EMAIL_ADDRESS_INVALID");
        verify(sender, never()).send(any(MimeMessage.class));
    }

    @Test void businessTransactionCannotPerformSmtpIo() {
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            assertThat(service.sendEmail("test@test.invalid", "Test", "Body").code())
                    .isEqualTo("SMTP_REQUIRES_COMMITTED_TRANSACTION");
        } finally { TransactionSynchronizationManager.setActualTransactionActive(false); }
        verify(sender, never()).send(any(MimeMessage.class));
    }

    @Test void checkConnectionDoesNotSendEmail() throws Exception {
        var smtp = mock(JavaMailSenderImpl.class);
        assertThat(EmailService.checkConfigured(smtp).status()).isEqualTo("CONNECTED");
        verify(smtp).testConnection();
        verify(smtp, never()).send(any(MimeMessage.class));
        doThrow(new jakarta.mail.AuthenticationFailedException("535 rejected")).when(smtp).testConnection();
        assertThat(EmailService.checkConfigured(smtp).code()).isEqualTo("SMTP_AUTH_FAILED");
    }
}
