package com.thangit.boardinghouse.config;

import com.thangit.boardinghouse.service.BookingExpirationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.context.annotation.Configuration;

@Configuration
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="app.scheduling.enabled",havingValue="true",matchIfMissing=true)
@EnableScheduling
public class BookingExpirationScheduler {
    private static final Logger LOG=LoggerFactory.getLogger(BookingExpirationScheduler.class);
    private final BookingExpirationService service;
    public BookingExpirationScheduler(BookingExpirationService service){this.service=service;}
    @Scheduled(fixedDelayString="${app.booking.expiration-delay-ms:60000}")
    public void run(){for(long id:service.due())try{service.expire(id);}catch(RuntimeException ex){LOG.warn("Không thể hết hạn booking {}; sẽ thử lại ở lượt sau: {}",id,ex.getClass().getSimpleName());}}
}
