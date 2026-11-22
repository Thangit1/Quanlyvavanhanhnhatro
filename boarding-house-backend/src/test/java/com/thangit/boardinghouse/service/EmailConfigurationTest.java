package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(classes = EmailServiceTest.MailTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {"MAIL_USERNAME=", "MAIL_PASSWORD=", "MAIL_TEST_RECIPIENT="})
@ActiveProfiles("local")
class EmailConfigurationTest {
    @Autowired JavaMailSenderImpl sender;
    @Autowired EmailService service;

    @Test void localProfileCreatesMailBeanWithTlsTimeoutsAndSafeMissingCredentials() {
        assertThat(sender.getHost()).isEqualTo("smtp.gmail.com");
        assertThat(sender.getPort()).isEqualTo(587);
        var settings = sender.getJavaMailProperties();
        assertThat(settings.getProperty("mail.smtp.auth")).isEqualTo("true");
        assertThat(settings.getProperty("mail.smtp.starttls.enable")).isEqualTo("true");
        assertThat(settings.getProperty("mail.smtp.starttls.required")).isEqualTo("true");
        assertThat(settings.getProperty("mail.smtp.connectiontimeout")).isEqualTo("5000");
        assertThat(settings.getProperty("mail.smtp.timeout")).isEqualTo("10000");
        assertThat(settings.getProperty("mail.smtp.writetimeout")).isEqualTo("10000");
        assertThat(service.checkConnection().code()).isEqualTo("SMTP_CREDENTIALS_MISSING");
    }
}
