package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest(classes = EmailServiceTest.MailTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {"spring.mail.host=smtp.test.invalid", "MAIL_USERNAME=account@test.invalid", "MAIL_PASSWORD=",
                "MAIL_FROM=onboarding@test.invalid", "MAIL_BUSINESS_DELIVERY_ENABLED=true"})
@ActiveProfiles("prod")
class ProductionEmailConfigurationTest {
    @Autowired JavaMailSenderImpl sender;
    @Autowired EmailService service;

    @Test void deploymentConfiguresAuthenticatedSmtpWithVerifiedStartTls() {
        assertThat(sender.getHost()).isEqualTo("smtp.test.invalid");
        assertThat(sender.getPort()).isEqualTo(587);
        assertThat(sender.getUsername()).isEqualTo("account@test.invalid");
        assertThat(sender.getJavaMailProperties())
                .containsEntry("mail.smtp.auth", "true")
                .containsEntry("mail.smtp.starttls.enable", "true")
                .containsEntry("mail.smtp.starttls.required", "true")
                .containsEntry("mail.smtp.ssl.checkserveridentity", "true");
        assertThat(ReflectionTestUtils.getField(service, "senderEmail")).isEqualTo("onboarding@test.invalid");
        assertThat(ReflectionTestUtils.getField(service, "businessDeliveryEnabled")).isEqualTo(true);
        assertThat(service.checkConnection().code()).isEqualTo("SMTP_CREDENTIALS_MISSING");
    }
}
