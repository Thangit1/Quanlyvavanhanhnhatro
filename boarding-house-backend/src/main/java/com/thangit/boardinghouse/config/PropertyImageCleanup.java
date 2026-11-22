package com.thangit.boardinghouse.config;
import com.thangit.boardinghouse.service.PropertyImageService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
@ConditionalOnProperty(name="app.scheduling.enabled",havingValue="true",matchIfMissing=true)
public class PropertyImageCleanup {
    private final PropertyImageService images;
    public PropertyImageCleanup(PropertyImageService images){this.images=images;}
    @Scheduled(initialDelayString="${app.media.cleanup-initial-delay-ms:3600000}",fixedDelayString="${app.media.cleanup-delay-ms:86400000}")
    public void clean(){try{images.cleanUnreferenced();}catch(Exception e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Property image cleanup deferred; errorType={}",e.getClass().getSimpleName());}}
}
