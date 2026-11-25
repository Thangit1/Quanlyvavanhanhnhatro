package com.thangit.boardinghouse.service.integration;

import com.thangit.boardinghouse.service.CommunicationSender;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Owner comes from the authorized delivery's property, never from recipient's other residences. */
@Component
public class IntegrationChannelRouter implements CommunicationSender {
    @org.springframework.beans.factory.annotation.Value("${app.mail.business-delivery-enabled:false}")
    boolean businessEmailEnabled;
    final JdbcClient db;final IntegrationCenter center;final IntegrationAdapters adapters;final WebPushSender push;final ZaloNotificationProvider zalo;
    public IntegrationChannelRouter(JdbcClient db,IntegrationCenter center,IntegrationAdapters adapters,WebPushSender push,ZaloNotificationProvider zalo){this.db=db;this.center=center;this.adapters=adapters;this.push=push;this.zalo=zalo;}
    @Override public Result unavailableOrSend(String channel,String key,long recipient,String title,String body){return new Result("FAILED","DELIVERY_OWNER_CONTEXT_REQUIRED",null,false);}
    @Override public boolean independentWorker(){return true;}
    @Override public Result send(long property,String channel,String key,long recipient,String title,String body){
        if(channel.equals("EMAIL")&&!businessEmailEnabled)return new Result("FAILED","BUSINESS_EMAIL_DISABLED",null,false);
        long owner=db.sql("SELECT owner_id FROM properties WHERE id=:id").param("id",property).query(Long.class).single();
        String kind=channel.equals("EMAIL")?"EMAIL":channel.equals("ZALO")?"ZALO":channel.equals("WEB_PUSH")?"WEB_PUSH":"";
        if(kind.isBlank())return new Result("FAILED","CHANNEL_NOT_CONFIGURED",null,false);
        var config=center.config(owner,kind);if(!config.enabled()||!adapters.complete(config))return new Result("FAILED","CHANNEL_NOT_CONFIGURED",null,false);
        if((channel.equals("EMAIL")||channel.equals("ZALO"))&&!db.sql("SELECT "+(channel.equals("EMAIL")?"email_enabled":"zalo_enabled")+" FROM notification_preferences WHERE user_id=:id").param("id",recipient).query(Boolean.class).optional().orElse(false))return new Result("FAILED","RECIPIENT_CHANNEL_DISABLED",null,false);
        db.sql("UPDATE communication_deliveries SET provider=:provider,environment=:environment WHERE business_key=:key AND property_id=:property AND recipient_id=:user").param("provider",config.provider()).param("environment",config.environment()).param("key",key).param("property",property).param("user",recipient).update();
        IntegrationAdapters.Outcome result;
        if(channel.equals("EMAIL")){String email=db.sql("SELECT email FROM users WHERE id=:id AND status='ACTIVE'").param("id",recipient).query(String.class).single();result=adapters.sendEmail(config,email,title,body,key,false);}
        else if(channel.equals("WEB_PUSH")){var sources=db.sql("SELECT source_type,source_id FROM communication_deliveries WHERE business_key=:key AND property_id=:property AND recipient_id=:user").param("key",key).param("property",property).param("user",recipient).query().listOfRows();String link="/login";if(!sources.isEmpty()){var source=sources.getFirst();String role=db.sql("SELECT CASE WHEN EXISTS(SELECT 1 FROM contracts WHERE tenant_id=:id) THEN 'TENANT' WHEN EXISTS(SELECT 1 FROM accountant_profiles WHERE user_id=:id) THEN 'ACCOUNTANT' WHEN EXISTS(SELECT 1 FROM technician_profiles WHERE user_id=:id) THEN 'TECHNICIAN' WHEN :id=:owner THEN 'OWNER' ELSE 'MANAGER' END").param("id",recipient).param("owner",owner).query(String.class).single();link=com.thangit.boardinghouse.service.CommunicationService.link(com.thangit.boardinghouse.domain.auth.RoleCode.valueOf(role),String.valueOf(source.get("source_type")),source.get("source_id"));}result=push.send(config,recipient,key,link);}
        else result=zalo.sendBusiness(config,property,recipient,key);
        String status=switch(result.status()){case "SENT","DELIVERED","UNKNOWN","SIMULATED"->result.status();default->"FAILED";};return new Result(status,result.code(),result.reference(),"FAILED".equals(status)&&Boolean.TRUE.equals(result.capabilities().get("retryable")));
    }
}
