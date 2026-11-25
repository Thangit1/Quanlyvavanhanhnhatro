package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.repository.AdminInvoiceRepository;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lifecycle around existing gateway_sessions. Simulation NEVER writes payments, receipts or revenue. */
@Service
public class PaymentTransactionService {
    private final JdbcClient db;
    private final Environment environment;
    public PaymentTransactionService(JdbcClient db,Environment environment){this.db=db;this.environment=environment;}

    public boolean simulationEnabled(){
        return environment.getProperty("app.payments.simulation-enabled",Boolean.class,false)
                && environment.acceptsProfiles(Profiles.of("local","dev"))
                && !environment.acceptsProfiles(Profiles.of("prod","production"));
    }
    private void simulation(){if(!simulationEnabled())throw error("PAYMENT_SIMULATION_DISABLED");}
    private void tenant(AuthenticatedUser actor){if(actor==null||actor.activeRole()!=RoleCode.TENANT)throw error("PAYMENT_TENANT_REQUIRED");}
    public static AuthException error(String code){
        HttpStatus status=code.endsWith("NOT_FOUND")?HttpStatus.NOT_FOUND:
                Set.of("PAYMENT_TENANT_REQUIRED","PAYMENT_STAFF_REQUIRED","PAYMENT_PROPERTY_FORBIDDEN","PAYMENT_CAPABILITY_REQUIRED","PAYMENT_SIMULATION_DISABLED").contains(code)?HttpStatus.FORBIDDEN:
                code.endsWith("INVALID")||code.endsWith("KEY_REQUIRED")||code.endsWith("REASON_REQUIRED")?HttpStatus.BAD_REQUEST:HttpStatus.CONFLICT;
        return new AuthException(status,code,"Không thể xử lý phiên thanh toán. Mã: "+code);
    }

    @Transactional public Map<String,Object> simulate(AuthenticatedUser actor,long invoice,String key){
        tenant(actor);simulation();
        if(key==null||!key.matches("[a-zA-Z0-9:_-]{8,100}"))throw error("PAYMENT_IDEMPOTENCY_KEY_REQUIRED");
        var bill=db.sql("SELECT * FROM invoices WHERE id=:id AND tenant_id=:tenant FOR UPDATE")
                .param("id",invoice).param("tenant",actor.id()).query(new org.springframework.jdbc.core.ColumnMapRowMapper()).optional().orElseThrow(()->error("PAYMENT_INVOICE_NOT_FOUND"));
        var old=db.sql("SELECT * FROM gateway_sessions WHERE tenant_id=:tenant AND request_key=:key")
                .param("tenant",actor.id()).param("key",key).query(new org.springframework.jdbc.core.ColumnMapRowMapper()).optional();
        if(old.isPresent()){
            if(((Number)old.get().get("invoice_id")).longValue()!=invoice||!"SIMULATED".equals(old.get().get("provider")))throw error("PAYMENT_IDEMPOTENCY_CONFLICT");
            expire(old.get());return view(reload(((Number)old.get().get("id")).longValue()));
        }
        InvoicePaymentRules.requireOpen(bill,BusinessTime.today());
        var amount=(java.math.BigDecimal)bill.get("remaining_amount");InvoicePaymentRules.requireAmount(amount);
        if(Set.of("DRAFT","PENDING_REVIEW","PAID","CANCELLED").contains(bill.get("status")))throw error("PAYMENT_INVOICE_NOT_PAYABLE");
        var existing=db.sql("SELECT * FROM gateway_sessions WHERE invoice_id=:invoice AND provider='SIMULATED' AND status='PENDING' ORDER BY id DESC LIMIT 1 FOR UPDATE")
                .param("invoice",invoice).query(new org.springframework.jdbc.core.ColumnMapRowMapper()).optional();
        if(existing.isPresent()){
            expire(existing.get());
            if("PENDING".equals(reload(((Number)existing.get().get("id")).longValue()).get("status")))return view(existing.get());
        }
        long owner=db.sql("SELECT owner_id FROM properties WHERE id=:id").param("id",bill.get("property_id")).query(Long.class).single();
        String reference="SIM"+UUID.randomUUID().toString().replace("-","");
        db.sql("INSERT INTO gateway_sessions(invoice_id,owner_id,tenant_id,provider,environment,request_key,merchant_reference,amount,status,expires_at,result_code) VALUES(:invoice,:owner,:tenant,'SIMULATED','TEST',:key,:reference,:amount,'PENDING',:expires,'SIMULATION_CREATED')")
                .param("invoice",invoice).param("owner",owner).param("tenant",actor.id()).param("key",key)
                .param("reference",reference).param("amount",amount).param("expires",BusinessTime.now().plusMinutes(15)).update();
        var session=db.sql("SELECT * FROM gateway_sessions WHERE merchant_reference=:reference").param("reference",reference).query().singleRow();
        event(db,session,"PENDING","SIMULATION_CREATED",actor.id());return view(session);
    }
    @Transactional public Map<String,Object> outcome(AuthenticatedUser actor,long id,String outcome){
        tenant(actor);simulation();
        if(outcome==null||!Set.of("SUCCESS","FAILED","CANCELLED").contains(outcome))throw error("SIMULATION_OUTCOME_INVALID");
        var session=lockOwned(actor,id);
        if(!"SIMULATED".equals(session.get("provider"))||!"TEST".equals(session.get("environment")))throw error("SIMULATION_SESSION_REQUIRED");
        expire(session);session=reload(id);
        String target="SUCCESS".equals(outcome)?"TEST_SUCCEEDED":outcome;
        if(target.equals(session.get("status")))return view(session);
        if(!"PENDING".equals(session.get("status")))throw error("PAYMENT_SESSION_TERMINAL");
        transition(session,target,"SIMULATION_"+outcome,actor.id());return view(reload(id));
    }
    @Transactional public Map<String,Object> own(AuthenticatedUser actor,long id){
        tenant(actor);var session=lockOwned(actor,id);expire(session);
        var result=view(reload(id));
        result.put("events",db.sql("SELECT from_status,to_status,result_code,created_at FROM gateway_session_events WHERE session_id=:id ORDER BY id")
                .param("id",id).query().listOfRows());return result;
    }
    @Transactional public Map<String,Object> cancel(AuthenticatedUser actor,long id){
        tenant(actor);var session=lockOwned(actor,id);expire(session);session=reload(id);
        if("CANCELLED".equals(session.get("status")))return view(session);
        if(!Set.of("CREATED","PENDING").contains(session.get("status")))throw error("PAYMENT_SESSION_CANNOT_CANCEL");
        transition(session,"CANCELLED","USER_CANCELLED_LOCALLY",actor.id());return view(reload(id));
    }
    public Map<String,Object> history(AuthenticatedUser actor,int page,int size){
        tenant(actor);return history(actor,null,page,size);
    }
    public Map<String,Object> managementHistory(AuthenticatedUser actor,Long property,int page,int size){
        if(actor==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER,RoleCode.ACCOUNTANT).contains(actor.activeRole()))throw error("PAYMENT_STAFF_REQUIRED");
        return history(actor,property,page,size);
    }
    @Transactional public int expirePending(){
        var candidates=db.sql("SELECT id,invoice_id FROM gateway_sessions WHERE status IN ('CREATED','REQUESTING','PENDING') AND expires_at<=:now ORDER BY invoice_id,id LIMIT 25")
                .param("now",BusinessTime.now()).query().listOfRows();
        for(var candidate:candidates){
            db.sql("SELECT id FROM invoices WHERE id=:id FOR UPDATE").param("id",candidate.get("invoice_id")).query(Long.class).single();
            var session=db.sql("SELECT * FROM gateway_sessions WHERE id=:id FOR UPDATE").param("id",candidate.get("id")).query().singleRow();
            expire(session);
        }
        return candidates.size();
    }
    private Map<String,Object> history(AuthenticatedUser actor,Long property,int page,int size){
        if(page<0||size<1||size>100)throw error("PAYMENT_PAGE_INVALID");
        String scope="i.tenant_id=:actor";
        if(actor.activeRole()!=RoleCode.TENANT){
            var repository=new AdminInvoiceRepository(db); if(property!=null&&!repository.canAccess(actor.id(),actor.activeRole(),property))throw error("PAYMENT_PROPERTY_FORBIDDEN"); scope="i.property_id IN (:visibleProperties)";
        }
        var query=" FROM gateway_sessions gs JOIN invoices i ON i.id=gs.invoice_id WHERE "+scope+" AND (:property IS NULL OR i.property_id=:property)";
        var params=new HashMap<String,Object>();params.put("actor",actor.id());params.put("userId",actor.id());params.put("property",property); if(actor.activeRole()!=RoleCode.TENANT){var visible=new AdminInvoiceRepository(db).properties(actor.id(),actor.activeRole()).stream().map(option->option.id()).toList(); params.put("visibleProperties",visible.isEmpty()?List.of(-1L):visible);}
        var rows=db.sql("SELECT gs.*,i.code invoice_code,i.property_id"+query+" ORDER BY gs.id DESC LIMIT :limit OFFSET :offset")
                .params(params).param("limit",size).param("offset",(long)page*size).query().listOfRows();
        long count=db.sql("SELECT COUNT(*)"+query).params(params).query(Long.class).single();
        return Map.of("content",rows.stream().map(row->{var data=view(row);boolean can=false;
            if(actor.activeRole()!=RoleCode.TENANT){var repository=new AdminInvoiceRepository(db);can=actor.activeRole()==RoleCode.OWNER||actor.activeRole()==RoleCode.MANAGER&&repository.managerCanWrite(actor.id(),((Number)row.get("property_id")).longValue())||actor.activeRole()==RoleCode.ACCOUNTANT&&repository.capability(actor.id(),"can_record_payment");}
            data.put("canReconcile",can);return data;}).toList(),"page",page,"size",size,"totalElements",count,"totalPages",(count+size-1)/size,"configured",true);
    }
    private Map<String,Object> lockOwned(AuthenticatedUser actor,long id){
        long invoice=db.sql("SELECT invoice_id FROM gateway_sessions WHERE id=:id AND tenant_id=:tenant")
                .param("id",id).param("tenant",actor.id()).query(Long.class).optional().orElseThrow(()->error("PAYMENT_SESSION_NOT_FOUND"));
        db.sql("SELECT id FROM invoices WHERE id=:id AND tenant_id=:tenant FOR UPDATE").param("id",invoice).param("tenant",actor.id()).query(Long.class).optional().orElseThrow(()->error("PAYMENT_INVOICE_NOT_FOUND"));
        return db.sql("SELECT * FROM gateway_sessions WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();
    }
    private Map<String,Object> reload(long id){return db.sql("SELECT * FROM gateway_sessions WHERE id=:id").param("id",id).query().singleRow();}
    private void expire(Map<String,Object> session){
        if(Set.of("CREATED","REQUESTING","PENDING").contains(session.get("status"))&&!datetime(session.get("expires_at")).isAfter(BusinessTime.now()))
            transition(session,"EXPIRED","CALLBACK_NOT_RECEIVED_BEFORE_EXPIRY",null);
    }
    private void transition(Map<String,Object> session,String state,String code,Long actor){
        db.sql("UPDATE gateway_sessions SET status=:state,result_code=:code,completed_at=CURRENT_TIMESTAMP(6) WHERE id=:id")
                .param("state",state).param("code",code).param("id",session.get("id")).update();event(db,session,state,code,actor);
    }
    public static void event(JdbcClient db,Map<String,Object> session,String state,String code,Long actor){
        db.sql("INSERT INTO gateway_session_events(session_id,from_status,to_status,result_code,actor_id) VALUES(:id,:from,:to,:code,:actor)")
                .param("id",session.get("id")).param("from",session.get("status")).param("to",state).param("code",code).param("actor",actor).update();
    }
    public static LocalDateTime datetime(Object value){return value instanceof LocalDateTime d?d:((java.sql.Timestamp)value).toLocalDateTime();}
    public Map<String,Object> view(Map<String,Object> row){
        var result=new LinkedHashMap<String,Object>();
        for(String key:List.of("id","invoice_id","invoice_code","provider","environment","status","amount","created_at","expires_at","completed_at","result_code","payment_id"))result.put(key,row.get(key));
        String state=String.valueOf(row.get("status"));
        if(Set.of("CREATED","REQUESTING","PENDING").contains(state)&&!datetime(row.get("expires_at")).isAfter(BusinessTime.now()))state="EXPIRED";
        result.put("checkout_url","PENDING".equals(state)?row.get("checkout_url"):null); result.put("status",state);result.put("transactionStatus",switch(state){case "SUCCEEDED","TEST_SUCCEEDED"->"SUCCESS";case "CREATED","REQUESTING"->"PENDING";default->state;});
        result.put("realMoney", "PRODUCTION".equals(row.get("environment"))&&"SUCCEEDED".equals(state)&&row.get("payment_id")!=null);
        return result;
    }
}
