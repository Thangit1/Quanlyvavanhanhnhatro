package com.thangit.boardinghouse.config;
import com.thangit.boardinghouse.service.BillingBatchService;
import java.time.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
public class MonthlyBillingScheduler {
    private final BillingBatchService billing;
    public MonthlyBillingScheduler(BillingBatchService billing){this.billing=billing;}
    @Scheduled(cron="${app.billing.cron:0 15 2 * * *}",zone="Asia/Ho_Chi_Minh")
    public void run(){billing.scheduled(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")));}
}
