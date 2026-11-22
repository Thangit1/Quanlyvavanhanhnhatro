package com.thangit.boardinghouse.config;
import com.thangit.boardinghouse.service.CommunicationJobs;
import com.thangit.boardinghouse.service.CommunicationService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
@ConditionalOnProperty(name="app.scheduling.enabled",havingValue="true",matchIfMissing=true)
public class CommunicationScheduler {
 private static final org.slf4j.Logger LOG=org.slf4j.LoggerFactory.getLogger(CommunicationScheduler.class);
 private final CommunicationJobs jobs;
 private com.thangit.boardinghouse.service.integration.IntegrationRuleInstaller ruleInstaller;
 @org.springframework.beans.factory.annotation.Autowired public void ruleInstaller(com.thangit.boardinghouse.service.integration.IntegrationRuleInstaller installer){this.ruleInstaller=installer;}
 private com.thangit.boardinghouse.service.ExternalCommunicationWorker externalWorker;
 @org.springframework.beans.factory.annotation.Autowired public void externalWorker(com.thangit.boardinghouse.service.ExternalCommunicationWorker worker){this.externalWorker=worker;}
 public CommunicationScheduler(CommunicationJobs jobs){this.jobs=jobs;}
 @Scheduled(fixedDelayString="${app.communications.delay-ms:60000}") public void run(){try{if(ruleInstaller!=null)ruleInstaller.scan();jobs.scan(CommunicationService.now());int delivered=jobs.deliver(CommunicationService.now());if(externalWorker!=null)delivered+=externalWorker.runBatch(CommunicationService.now());if(delivered>0)LOG.info("Communication queue processed={}",delivered);}catch(Exception e){LOG.warn("Communication scheduler failed; database jobs retained; errorType={}",e.getClass().getSimpleName());}}
}
