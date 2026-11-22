package com.thangit.boardinghouse.config;
import com.thangit.boardinghouse.service.PaymentTransactionService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
@ConditionalOnProperty(name="app.scheduling.enabled",havingValue="true",matchIfMissing=true)
public class PaymentExpiryScheduler {
    private final PaymentTransactionService transactions;
    public PaymentExpiryScheduler(PaymentTransactionService transactions){this.transactions=transactions;}
    @Scheduled(fixedDelayString="${app.payments.expiry-delay-ms:60000}")
    public void expire(){transactions.expirePending();}
}
