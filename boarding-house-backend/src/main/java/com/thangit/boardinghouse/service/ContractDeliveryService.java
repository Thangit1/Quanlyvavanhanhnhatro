package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.net.URI;
import java.util.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Uses the existing communication outbox/lease worker. No email or raw token is stored in a transaction. */
@Service
public class ContractDeliveryService {
    private final JdbcClient db;private final RoomLifecycleGuard rooms;private final InitialPasswordService setup;
    private final ObjectProvider<EmailService> mail;private final boolean enabled;private final String base;
    public ContractDeliveryService(JdbcClient db,RoomLifecycleGuard rooms,InitialPasswordService setup,ObjectProvider<EmailService> mail,
            @Value("${app.mail.business-delivery-enabled:false}") boolean enabled,@Value("${app.frontend-url:http://localhost:3000}") String base){
        this.db=db;this.rooms=rooms;this.setup=setup;this.mail=mail;this.enabled=enabled;this.base=base.replaceAll("/+$","");
        var uri=URI.create(this.base);if(!Set.of("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null)throw new IllegalArgumentException("app.frontend-url must be a web origin/base path");
    }
    Map<String,Object> contract(long id){return db.sql("SELECT c.id,c.code,c.status,c.tenant_id,c.onboarding_version,r.property_id,r.code room_code,p.owner_id FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE c.id=:id").param("id",id).query().singleRow();}
    void access(AuthenticatedUser actor,long id){if(actor==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(actor.activeRole()))throw denied();var c=contract(id);long property=n(c,"property_id");rooms.access(actor,property);if(actor.activeRole()==RoleCode.MANAGER)rooms.capability(actor,property,com.thangit.boardinghouse.security.PropertyAuthorization.Capability.CONTRACT_APPROVE);}
    static long n(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    static String hash(String text){return InitialPasswordService.tokenHash(text);}
    private static AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"CONTRACT_DELIVERY_DENIED","Không có quyền gửi hợp đồng này.");}

    @Transactional
    public void submitted(long id){
        var c=contract(id);long user=n(c,"tenant_id");
        if(db.sql("SELECT COUNT(*) FROM account_password_setups WHERE user_id=:user AND consumed_at IS NULL").param("user",user).query(Long.class).single()>0)enqueue(id,"ACTIVATE","initial");
        enqueue(id,"SENT","initial");
    }
    @Transactional
    public void enqueue(long id,String kind,String request){
        var c=contract(id);if(c.get("tenant_id")==null||Set.of("DRAFT","CANCELLED","TERMINATED").contains(c.get("status")))return;
        long version=n(c,"onboarding_version");
        if(kind.equals("SIGNED")&&db.sql("SELECT COUNT(DISTINCT rc.party) FROM rental_confirmations rc JOIN contract_versions cv ON cv.id=rc.contract_version_id WHERE cv.contract_id=:id AND cv.version=:v").param("id",id).param("v",version).query(Long.class).single()!=2)return;
        var recipients=new LinkedHashSet<Long>();recipients.add(n(c,"tenant_id"));if(kind.equals("SIGNED")||kind.startsWith("DEPOSIT-")||kind.startsWith("REVIEW"))recipients.add(n(c,"owner_id"));
        String title=kind.equals("ACTIVATE")?"[SmartHome AI] Kích hoạt tài khoản người thuê":kind.equals("SENT")?"[SmartHome AI] Hợp đồng thuê phòng đang chờ bạn xác nhận":kind.equals("SIGNED")?"[SmartHome AI] Hai bên đã xác nhận hợp đồng":kind.startsWith("REVIEW")?"[SmartHome AI] Cập nhật yêu cầu xem lại hợp đồng":"[SmartHome AI] Đã ghi nhận tiền cọc";
        for(long recipient:recipients)for(String channel:kind.equals("ACTIVATE")?List.of("EMAIL"):kind.startsWith("REVIEW")?List.of("IN_APP"):List.of("IN_APP","EMAIL")){
            String source="ONBOARD:"+kind+":"+version;
            String key=hash(source+"|"+id+"|"+recipient+"|"+channel+"|"+request);
            db.sql("INSERT INTO communication_deliveries(property_id,recipient_id,channel,category,title,body,source_type,source_id,source_key,business_key,status,scheduled_at,next_attempt_at) VALUES(:property,:recipient,:channel,'CONTRACT',:title,:body,'CONTRACT',:id,:source,:key,'QUEUED',:at,:at) ON DUPLICATE KEY UPDATE id=id")
                .param("property",c.get("property_id")).param("recipient",recipient).param("channel",channel).param("title",title).param("body",title+" · "+c.get("code")+". Xem tiến trình và điều kiện nhận phòng trong hợp đồng.").param("id",id).param("source",source).param("key",key).param("at",BusinessTime.now()).update();
        }
    }
    @Transactional(readOnly=true)
    public Map<String,Object> status(AuthenticatedUser actor,long id){access(actor,id);var c=contract(id);return Map.of("businessEmailEnabled",enabled,"contractStatus",c.get("status"),"contractCode",c.get("code"),"contractUrl",base+"/tenant/contracts/"+id,"submissionErrors",db.sql("SELECT description,created_at FROM communication_audit WHERE entity_type='CONTRACT' AND entity_id=:id AND action='SUBMISSION_FAILED' ORDER BY id DESC LIMIT 1").param("id",id).query().listOfRows(),"deliveries",db.sql("SELECT id,channel,status,result_code,attempt_count,created_at,finished_at,source_key FROM communication_deliveries WHERE source_type='CONTRACT' AND source_id=:id AND source_key LIKE 'ONBOARD:%' ORDER BY id DESC LIMIT 50").param("id",id).query().listOfRows());}
    @Transactional
    public void failedSubmission(AuthenticatedUser actor,long id,AuthException failure){access(actor,id);var c=contract(id);String message=failure.code()+" · "+failure.getMessage();db.sql("INSERT INTO communication_audit(property_id,actor_id,entity_type,entity_id,action,description) VALUES(:p,:actor,'CONTRACT',:id,'SUBMISSION_FAILED',:message)").param("p",c.get("property_id")).param("actor",actor.id()).param("id",id).param("message",message.substring(0,Math.min(900,message.length()))).update();}
    @Transactional
    public Map<String,Object> resend(AuthenticatedUser actor,long id,String key){
        access(actor,id);if(key==null||!key.matches("[a-zA-Z0-9:_-]{8,100}"))throw new AuthException(HttpStatus.BAD_REQUEST,"IDEMPOTENCY_REQUIRED","Thiếu mã yêu cầu gửi lại.");
        db.sql("SELECT id FROM contracts WHERE id=:id FOR UPDATE").param("id",id).query(Long.class).single();
        // Exact request replay is a no-op; a new resend is bounded to one per minute.
        if(db.sql("SELECT COUNT(*) FROM communication_audit WHERE entity_type='CONTRACT' AND entity_id=:id AND action='ONBOARDING_RESEND' AND description=:key").param("id",id).param("key",hash(key)).query(Long.class).single()>0)return status(actor,id);
        if(db.sql("SELECT COUNT(*) FROM communication_deliveries WHERE source_type='CONTRACT' AND source_id=:id AND source_key LIKE 'ONBOARD:%' AND channel='EMAIL' AND status IN ('QUEUED','SCHEDULED','DISPATCHING')").param("id",id).query(Long.class).single()>0)return status(actor,id);
        if(db.sql("SELECT COUNT(*) FROM communication_audit WHERE entity_type='CONTRACT' AND entity_id=:id AND action='ONBOARDING_RESEND' AND created_at>DATE_SUB(CURRENT_TIMESTAMP(6),INTERVAL 1 MINUTE)").param("id",id).query(Long.class).single()>0)throw new AuthException(HttpStatus.TOO_MANY_REQUESTS,"CONTRACT_RESEND_LIMIT","Vui lòng đợi một phút trước khi gửi lại.");
        var c=contract(id);if(!"PENDING_CONFIRMATION".equals(c.get("status")))throw new AuthException(HttpStatus.CONFLICT,"CONTRACT_NOT_PENDING","Hợp đồng không còn chờ xác nhận.");
        long user=n(c,"tenant_id");if(db.sql("SELECT COUNT(*) FROM account_password_setups WHERE user_id=:id AND consumed_at IS NULL").param("id",user).query(Long.class).single()>0)enqueue(id,"ACTIVATE",key);
        enqueue(id,"SENT",key);
        db.sql("INSERT INTO communication_audit(property_id,actor_id,entity_type,entity_id,action,description) VALUES(:p,:actor,'CONTRACT',:id,'ONBOARDING_RESEND',:key)").param("p",c.get("property_id")).param("actor",actor.id()).param("id",id).param("key",hash(key)).update();return status(actor,id);
    }
    public static boolean current(JdbcClient db,Map<String,Object> d){
        String[] source=d.get("source_key").toString().split(":");if(source.length!=3)return false;
        var rows=db.sql("SELECT c.tenant_id,p.owner_id,c.onboarding_version,c.status FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE c.id=:id AND p.id=:property").param("id",d.get("source_id")).param("property",d.get("property_id")).query().listOfRows();if(rows.isEmpty())return false;var c=rows.getFirst();
        if(c.get("tenant_id")==null||Set.of("DRAFT","CANCELLED","TERMINATED").contains(c.get("status"))||!source[2].equals(c.get("onboarding_version").toString()))return false;
        long recipient=n(d,"recipient_id");if(recipient!=n(c,"tenant_id")&&recipient!=n(c,"owner_id"))return false;
        if(source[1].equals("ACTIVATE"))return recipient==n(c,"tenant_id")&&db.sql("SELECT COUNT(*) FROM account_password_setups WHERE user_id=:id AND consumed_at IS NULL").param("id",recipient).query(Long.class).single()==1;
        return true;
    }
    /** Called by the existing external worker AFTER its claim transaction committed. */
    public CommunicationSender.Result send(Map<String,Object> delivery){
        if(!enabled)return new CommunicationSender.Result("FAILED","BUSINESS_EMAIL_DISABLED",null,false);
        var sender=mail.getIfAvailable();if(sender==null)return new CommunicationSender.Result("FAILED","SMTP_NOT_CONFIGURED",null,false);
        if(!current(db,delivery))return new CommunicationSender.Result("FAILED","SOURCE_OR_SCOPE_CHANGED",null,false);
        long user=n(delivery,"recipient_id"),id=n(delivery,"source_id");
        var account=db.sql("SELECT full_name,email FROM users WHERE id=:id AND status='ACTIVE'").param("id",user).query().singleRow();String email=Objects.toString(account.get("email"),"");
        if(email.isBlank())return new CommunicationSender.Result("FAILED","RECIPIENT_EMAIL_MISSING",null,false);
        String kind=delivery.get("source_key").toString().split(":")[1];var c=contract(id);
        String body="Xin chào "+account.get("full_name")+",\n\n"+delivery.get("title")+".\nHợp đồng: "+c.get("code")+" · Phòng "+c.get("room_code")+"\n";
        if(kind.equals("ACTIVATE")){
            String raw=setup.issueSetupToken(user);
            body+="Chủ nhà đã tạo tài khoản SmartHome AI cho bạn.\nTên đăng nhập: "+email+"\nĐặt mật khẩu lần đầu (dùng một lần, hết hạn sau 24 giờ):\n"+base+"/activate-account#token="+raw+"\nNếu không nhận ra yêu cầu này, vui lòng liên hệ đơn vị quản lý.\n";
        }
        if(kind.equals("SIGNED")||kind.startsWith("DEPOSIT-")){
            var deposits=db.sql("SELECT required_amount,balance_amount,GREATEST(required_amount-balance_amount,0) remaining FROM tenant_deposits WHERE contract_id=:id").param("id",id).query().listOfRows();
            if(!deposits.isEmpty()){var deposit=deposits.getFirst();body+="Tiền cọc thỏa thuận: "+deposit.get("required_amount")+" VND; đã nhận: "+deposit.get("balance_amount")+" VND; còn thiếu: "+deposit.get("remaining")+" VND.\n";}
            body+="Cần hoàn tất định danh, khoản thu theo thỏa thuận và biên bản bàn giao trước khi nhận phòng.\n";
        }
        body+="Đăng nhập để xem hợp đồng và tiến trình: "+base+(user==n(c,"owner_id")?"/admin/contracts/":"/tenant/contracts/")+id+"\nĐây là email tự động. Chưa xác nhận hoàn tất nhận phòng.";
        var result=sender.sendEmail(email,delivery.get("title").toString(),body);
        return new CommunicationSender.Result(result.accepted()?"SENT":result.status().equals("UNKNOWN")?"UNKNOWN":"FAILED",result.code(),result.reference(),result.retryable());
    }
}
