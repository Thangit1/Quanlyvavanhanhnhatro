package com.thangit.boardinghouse.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

// Load only mail infrastructure: this smoke test does not require MySQL.
@SpringBootTest(classes = EmailServiceTest.MailTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("local")
@EnabledIfEnvironmentVariable(named = "MAIL_SMOKE_TEST", matches = "true")
class EmailServiceTest {
    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration(excludeName = {
        "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration",
        "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration",
        "org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration",
        "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration"
    })
    @Import(EmailService.class)
    static class MailTestApplication {}

    @Autowired private EmailService emailService;
    @Autowired private Environment environment;

    @Test
    void sendTestEmail() {
        String recipient = environment.getProperty("MAIL_TEST_RECIPIENT", "");
        // Inspect Spring's resolved properties, including imported .env. Never print their values.
        org.junit.jupiter.api.Assertions.assertTrue(
                !environment.getProperty("spring.mail.username", "").isBlank(), "MAIL_USERNAME is missing");
        org.junit.jupiter.api.Assertions.assertTrue(
                !environment.getProperty("spring.mail.password", "").isBlank(), "MAIL_PASSWORD is missing");
        org.junit.jupiter.api.Assertions.assertTrue(!recipient.isBlank(), "MAIL_TEST_RECIPIENT is missing");
        var result = emailService.sendEmail(recipient,
                "SmartHome AI - Kiem tra Gmail SMTP",
                "He thong SmartHome AI da gui email thu thanh cong.");
        org.junit.jupiter.api.Assertions.assertTrue(result.accepted(), result.code());
    }
}
