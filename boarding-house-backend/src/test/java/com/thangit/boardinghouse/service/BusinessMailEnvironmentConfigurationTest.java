package com.thangit.boardinghouse.service;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

/** Resolves the enabled switch only; never sends or authenticates SMTP. */
@SpringBootTest(classes=EmailServiceTest.MailTestApplication.class,webEnvironment=SpringBootTest.WebEnvironment.NONE,
        properties={"MAIL_BUSINESS_DELIVERY_ENABLED=true"})
@ActiveProfiles("local")
class BusinessMailEnvironmentConfigurationTest {
    @Autowired Environment environment;
    @Autowired EmailService service;
    @Test void environmentSwitchReachesTheExistingEmailService(){
        assertTrue(environment.getProperty("app.mail.business-delivery-enabled",Boolean.class,false));
        assertTrue(Boolean.TRUE.equals(ReflectionTestUtils.getField(service,"businessDeliveryEnabled")));
    }
}
