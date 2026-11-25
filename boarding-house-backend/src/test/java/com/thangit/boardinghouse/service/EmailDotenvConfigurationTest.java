package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.ActiveProfiles;

/** Checks actual local config imports without authenticating or sending mail. */
@SpringBootTest(classes = EmailServiceTest.MailTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = "MAIL_BUSINESS_DELIVERY_ENABLED=false")
@ActiveProfiles("local")
class EmailDotenvConfigurationTest {
    @Autowired Environment environment;
    @Autowired JavaMailSenderImpl sender;
    @Autowired EmailService service;

    @Test void springResolvesImportedMailSettingsWithoutPrintingCredentials() {
        assertTrue(Objects.equals(environment.getProperty("MAIL_USERNAME", ""), sender.getUsername()),
                "MAIL_USERNAME was not mapped to JavaMailSender");
        assertTrue(Objects.equals(environment.getProperty("MAIL_PASSWORD", ""), sender.getPassword()),
                "MAIL_PASSWORD was not mapped to JavaMailSender");
        assertTrue("smtp.gmail.com".equals(sender.getHost()) && sender.getPort() == 587,
                "Gmail SMTP endpoint was not loaded");
        assertTrue(!environment.getProperty("app.mail.business-delivery-enabled", Boolean.class, true),
                "Local business delivery must remain disabled");
        System.out.println("SMTP local config loaded=true; JavaMailSender created=true; MAIL_USERNAME present="
                + !sender.getUsername().isBlank() + "; MAIL_PASSWORD present=" + !sender.getPassword().isBlank()
                + "; MAIL_TEST_RECIPIENT present="
                + !environment.getProperty("MAIL_TEST_RECIPIENT", "").isBlank());
    }
}
