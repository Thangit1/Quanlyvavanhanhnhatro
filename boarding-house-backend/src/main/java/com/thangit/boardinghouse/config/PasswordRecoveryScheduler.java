package com.thangit.boardinghouse.config;

import com.thangit.boardinghouse.service.PasswordRecoveryService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name="app.security.recovery.enabled", havingValue="true")
public class PasswordRecoveryScheduler {
    private final PasswordRecoveryService recovery;
    public PasswordRecoveryScheduler(PasswordRecoveryService recovery) { this.recovery = recovery; }
    @Scheduled(fixedDelayString="${app.security.recovery.dispatch-delay:2000}", initialDelayString="${app.security.recovery.dispatch-delay:2000}")
    public void dispatch() {
        try { for (int i=0; i<10 && recovery.dispatchOne(); i++) { /* bounded batch */ } }
        catch (RuntimeException failure) {
            // Never log exception messages: a transport exception can include the email body.
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Password recovery dispatch unavailable; type={}", failure.getClass().getSimpleName());
        }
    }
    @Scheduled(fixedDelay=3_600_000)
    public void cleanup() { recovery.cleanup(); }
}
