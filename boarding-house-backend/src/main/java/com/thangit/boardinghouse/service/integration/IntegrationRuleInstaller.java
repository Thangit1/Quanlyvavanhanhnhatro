package com.thangit.boardinghouse.service.integration;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.CommunicationService;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class IntegrationRuleInstaller {
    final JdbcClient db;final CommunicationService communications;final org.springframework.transaction.support.TransactionTemplate tx;
    public IntegrationRuleInstaller(JdbcClient db,CommunicationService communications,org.springframework.transaction.PlatformTransactionManager manager){this.db=db;this.communications=communications;this.tx=new org.springframework.transaction.support.TransactionTemplate(manager);}
    @Transactional public void owner(long owner){if(db.sql("SELECT COUNT(*) FROM integration_configs WHERE owner_id=:owner AND kind IN ('EMAIL','ZALO','WEB_PUSH') AND enabled=TRUE").param("owner",owner).query(Long.class).single()==0)return;db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",owner).query(Long.class).single();var actor=new AuthenticatedUser(owner,"integration-rule-installer",RoleCode.OWNER);for(long property:db.sql("SELECT id FROM properties WHERE owner_id=:owner AND status='ACTIVE' ORDER BY id LIMIT 1000").param("owner",owner).query(Long.class).list())for(String event:List.of("CONTRACT_CREATED","CONTRACT_CONFIRMED","INVOICE_ISSUED","INVOICE_BEFORE_DUE","INVOICE_DUE","INVOICE_OVERDUE","PAYMENT_CONFIRMED","CONTRACT_EXPIRY","CHECKIN","CHECKOUT","DEPOSIT_REFUNDED","MAINTENANCE_CREATED","MAINTENANCE_COMPLETED")){int offset=event.equals("INVOICE_BEFORE_DUE")?2:event.equals("INVOICE_OVERDUE")?1:event.equals("CONTRACT_EXPIRY")?30:0;if(db.sql("SELECT COUNT(*) FROM communication_rules WHERE property_id=:property AND event_type=:event AND audience='TENANT' AND offset_days=:offset").param("property",property).param("event",event).param("offset",offset).query(Long.class).single()==0)communications.saveRule(actor,null,new CommunicationService.Rule(property,event,"TENANT",offset,9,5,true,0));}}
    public void scan(){for(long owner:db.sql("SELECT DISTINCT c.owner_id FROM integration_configs c JOIN users u ON u.id=c.owner_id WHERE c.enabled=TRUE AND c.kind IN ('EMAIL','ZALO','WEB_PUSH') AND u.status='ACTIVE' LIMIT 100").query(Long.class).list())tx.executeWithoutResult(status->owner(owner));}
}
