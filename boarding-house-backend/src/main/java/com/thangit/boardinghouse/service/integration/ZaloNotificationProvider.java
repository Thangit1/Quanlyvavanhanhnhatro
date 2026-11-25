package com.thangit.boardinghouse.service.integration;

import static com.thangit.boardinghouse.service.integration.IntegrationCenter.*;
import com.thangit.boardinghouse.service.integration.IntegrationAdapters.Outcome;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Official OA v3 + ZBS phone/UID transport. Unknown approval states always fail closed. */
@Service
public class ZaloNotificationProvider {
    private record TemplateApproval(boolean enabled, boolean fresh) {
        boolean canSend() { return enabled && fresh; }
    }

    final JdbcClient db;final IntegrationVault vault;final Environment environment;final JsonMapper json;final TransactionTemplate tx;
    final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    public ZaloNotificationProvider(JdbcClient db,IntegrationVault vault,Environment environment,JsonMapper json,org.springframework.transaction.PlatformTransactionManager manager){this.db=db;this.vault=vault;this.environment=environment;this.json=json;tx=new TransactionTemplate(manager);}
    JsonNode request(String url,String token,Object body)throws Exception{var builder=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).header("access_token",token);if(body==null)builder.GET();else builder.header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));var response=http.send(builder.build(),HttpResponse.BodyHandlers.ofString());if(response.statusCode()!=200)throw invalid("ZALO_HTTP_"+response.statusCode());if(response.body().length()>1000000)throw invalid("ZALO_RESPONSE_TOO_LARGE");var result=json.readTree(response.body());if(result.path("error").asInt(-999)!=0)throw invalid("ZALO_PROVIDER_REJECTED_"+Math.abs(result.path("error").asInt(-999)));return result.path("data");}
    void identity(Config config,String token)throws Exception{var oa=request("https://openapi.zalo.me/v3.0/oa/getoa",token,null);if(!config.text("oaId").equals(oa.path("oa_id").asText()))throw invalid("ZALO_OA_SCOPE_MISMATCH");}
    public Object templates(long owner){return db.sql("SELECT template_id,name,status,synced_at FROM integration_templates WHERE owner_id=:owner ORDER BY template_id").param("owner",owner).query().listOfRows();}
    public Outcome execute(Config c,String operation,String key,TestRequest test)throws Exception{
        String token=vault.read(c.owner(),"ZALO","ACCESS_TOKEN");
        if(operation.equals("REFRESH_TOKEN"))return refresh(c);
        identity(c,token);
        if(operation.equals("CHECK")||operation.equals("SYNC_TEMPLATES")) return syncTemplates(c, token);
        if(operation.equals("TEST_SEND")){if(test==null||test.templateId()==null)throw invalid("ZBS_TEMPLATE_REQUIRED");if(!templateApproval(c,test.templateId()).canSend())return templateBlocked();
            String uid=test.recipient();if(uid==null||!uid.matches("[0-9]{1,40}"))throw invalid("ZALO_UID_INVALID");if(!Arrays.asList(environment.getProperty("INTEGRATION_ZALO_TEST_UIDS","").split(",")).contains(uid))throw invalid("ZALO_TEST_RECIPIENT_NOT_ALLOWED");if(!environment.getProperty("INTEGRATION_ZALO_LIVE_TEST",Boolean.class,false))return new Outcome("SIMULATED","ZBS_RENDER_ONLY_NO_PROVIDER_SEND",null,Map.of("send","SIMULATED","templateId",test.templateId()));
            var data=request("https://openapi.zalo.me/v3.0/oa/message/template",token,Map.of("user_id",uid,"template_id",test.templateId(),"template_data",test.parameters()==null?Map.of():test.parameters()));return new Outcome("SENT","ZBS_PROVIDER_ACCEPTED",safeReference(data.path("message_id").asText()),Map.of("acceptance","PROVIDER_ACCEPTED","delivery","NOT_CONFIRMED"));
        }throw invalid("ZALO_OPERATION_UNSUPPORTED");
    }

    private Outcome syncTemplates(Config config, String token) throws Exception {
        var data = request("https://business.openapi.zalo.me/template/all?offset=0&limit=100", token, null);
        var items = data.isArray() ? data : data.path("templates");
        if (!items.isArray()) {
            return new Outcome("DEGRADED", "ZBS_TEMPLATE_CAPABILITY_UNVERIFIED", null,
                    Map.of("oaAuthentication", "VERIFIED", "templates", "UNVERIFIED", "webhook", "NOT_VERIFIED"));
        }

        int active = tx.execute(status -> {
            db.sql("SELECT id FROM users WHERE id=:owner FOR UPDATE")
                    .param("owner", config.owner()).query(Long.class).single();
            long current = db.sql("""
                    SELECT COUNT(*) FROM integration_configs
                    WHERE owner_id=:owner AND kind='ZALO' AND enabled=TRUE AND version=:version
                    """).param("owner", config.owner()).param("version", config.version()).query(Long.class).single();
            if (current != 1) throw invalid("ZALO_CONFIGURATION_CHANGED");

            db.sql("DELETE FROM integration_templates WHERE owner_id=:owner")
                    .param("owner", config.owner()).update();
            int enabled = 0;
            for (JsonNode item : items) {
                String id = item.path("template_id").asText();
                if (!id.matches("[0-9]{1,60}")) continue;
                String state = item.path("status").asText("UNKNOWN");
                String name = item.path("template_name").asText("ZBS template");
                db.sql("""
                        INSERT INTO integration_templates(owner_id,template_id,oa_id,name,status,details)
                        VALUES(:owner,:id,:oa,:name,:status,'{}')
                        """).param("owner", config.owner()).param("id", id).param("oa", config.text("oaId"))
                        .param("name", name.substring(0, Math.min(name.length(), 200)))
                        .param("status", state.length() > 40 ? "UNKNOWN" : state).update();
                if (state.equals("ENABLE")) enabled++;
            }
            return enabled;
        });

        return new Outcome(active > 0 ? "CONNECTED" : "DEGRADED",
                active > 0 ? "ZBS_APPROVED_TEMPLATES_AVAILABLE" : "ZBS_NO_ENABLED_TEMPLATE", null,
                Map.of("oaAuthentication", "VERIFIED", "templates", active, "webhook", "NOT_VERIFIED",
                        "quota", "CHECKED_BY_PROVIDER_ON_SEND"));
    }

    private TemplateApproval templateApproval(Config config, String templateId) {
        return db.sql("""
                SELECT status, synced_at>=CURRENT_TIMESTAMP-INTERVAL 1 DAY AS fresh
                FROM integration_templates WHERE owner_id=:owner AND oa_id=:oa AND template_id=:id
                """).param("owner", config.owner()).param("oa", config.text("oaId")).param("id", templateId)
                .query((rs, row) -> new TemplateApproval("ENABLE".equals(rs.getString("status")), rs.getBoolean("fresh")))
                .optional().orElse(new TemplateApproval(false, false));
    }

    private Outcome templateBlocked() {
        return new Outcome("DEGRADED", "ZBS_TEMPLATE_NOT_APPROVED_OR_STALE", null, Map.of("send", "BLOCKED"));
    }
    public Outcome refresh(Config c){if(!vault.writable())throw invalid("SECRET_STORE_REQUIRED_FOR_TOKEN_ROTATION");return tx.execute(status->{
        db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",c.owner()).query(Long.class).single();String refresh=vault.read(c.owner(),"ZALO","REFRESH_TOKEN"),appSecret=vault.read(c.owner(),"ZALO","APP_SECRET");if(refresh.isBlank()||appSecret.isBlank())throw invalid("ZALO_REFRESH_CREDENTIAL_MISSING");
        try{var builder=HttpRequest.newBuilder(URI.create("https://oauth.zaloapp.com/v4/oa/access_token")).timeout(Duration.ofSeconds(8)).header("secret_key",appSecret).header("Content-Type","application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString("app_id="+encode(c.text("appId"))+"&grant_type=refresh_token&refresh_token="+encode(refresh)));var response=http.send(builder.build(),HttpResponse.BodyHandlers.ofString());var data=json.readTree(response.body());if(response.statusCode()!=200||data.path("access_token").asText().isBlank()||data.path("refresh_token").asText().isBlank())return new Outcome("ERROR","ZALO_REFRESH_REJECTED",null,Map.of("token","REAUTHORIZATION_REQUIRED"));identity(c,data.path("access_token").asText());vault.write(c.owner(),"ZALO","ACCESS_TOKEN",data.path("access_token").asText());vault.write(c.owner(),"ZALO","REFRESH_TOKEN",data.path("refresh_token").asText());return new Outcome("CONFIGURED","ZALO_TOKEN_ROTATED",null,Map.of("token","ROTATED","expiresInSeconds",data.path("expires_in").asLong()));}catch(Exception uncertain){return new Outcome("ERROR","ZALO_REFRESH_OUTCOME_UNKNOWN",null,Map.of("token","REAUTHORIZATION_REQUIRED"));}
    });}
    public Outcome sendBusiness(Config c,long property,long recipient,String key){
        var rows=db.sql("SELECT d.source_type,d.source_id,r.event_type FROM communication_deliveries d JOIN communication_rules r ON r.id=d.rule_id WHERE d.business_key=:key AND d.property_id=:property AND d.recipient_id=:recipient AND d.channel='ZALO'").param("key",key).param("property",property).param("recipient",recipient).query().listOfRows();
        if(rows.isEmpty())return new Outcome("DEGRADED","ZBS_BUSINESS_EVENT_MAPPING_REQUIRED",null,Map.of());
        var row=rows.getFirst();Object mappings=c.settings().get("templateMappings");String template=mappings instanceof Map<?,?> map?Objects.toString(map.get(row.get("event_type")),""):"";
        if(template.isBlank())return new Outcome("DEGRADED","ZBS_EVENT_TEMPLATE_NOT_MAPPED",null,Map.of());
        var approval = templateApproval(c, template);
        if (!approval.enabled()) return templateBlocked();
        if (!c.environment().equals("PRODUCTION")) {
            return approval.canSend() ? new Outcome("SIMULATED", "ZBS_BUSINESS_TEST_NO_REAL_SEND", null, Map.of())
                    : templateBlocked();
        }
        String phone=db.sql("SELECT phone FROM tenant_profiles WHERE user_id=:id ORDER BY id LIMIT 1").param("id",recipient).query(String.class).optional().orElse("");if(phone.startsWith("+"))phone=phone.substring(1);if(phone.startsWith("0"))phone="84"+phone.substring(1);if(!phone.matches("84[0-9]{9}"))return new Outcome("DEGRADED","ZBS_RECIPIENT_PHONE_INVALID",null,Map.of());
        var data=new LinkedHashMap<String,String>();
        var allowed=businessFields(property,recipient,String.valueOf(row.get("source_type")),((Number)row.get("source_id")).longValue());
        Object configuration=c.settings().get("templateParameters");Object event=configuration instanceof Map<?,?> parameters?parameters.get(row.get("event_type")):null;if(event instanceof Map<?,?> parameters)for(var entry:parameters.entrySet()){String name=entry.getKey().toString(),field=entry.getValue().toString();if(!name.matches("[a-zA-Z0-9_]{1,60}")||!allowed.containsKey(field)||allowed.get(field).isBlank())return new Outcome("DEGRADED","ZBS_TEMPLATE_PARAMETER_MAPPING_INVALID",null,Map.of());data.put(name,allowed.get(field));}
        if(data.isEmpty())return new Outcome("DEGRADED","ZBS_TEMPLATE_PARAMETERS_REQUIRED",null,Map.of());
        String token = vault.read(c.owner(), "ZALO", "ACCESS_TOKEN");
        try {
            identity(c, token);
            if (!approval.fresh()) {
                syncTemplates(c, token);
                if (!templateApproval(c, template).canSend()) return templateBlocked();
            }
        } catch (Exception unavailable) {
            return new Outcome("ERROR", "ZBS_PREFLIGHT_FAILED", null, Map.of("send", "BLOCKED"));
        }

        try {
            var dataSent = request("https://business.openapi.zalo.me/message/template", token,
                    Map.of("phone", phone, "template_id", template, "template_data", data, "tracking_id", key));
            String reference = safeReference(dataSent.path("msg_id").asText());
            if (reference != null) {
                return new Outcome("SENT", "ZBS_PROVIDER_ACCEPTED", reference, Map.of("delivery", "NOT_CONFIRMED"));
            }
        } catch (com.thangit.boardinghouse.common.exception.AuthException failure) {
            if (failure.code().startsWith("ZALO_PROVIDER_REJECTED_")) {
                return new Outcome("ERROR", "ZBS_PROVIDER_REJECTED", null, Map.of());
            }
        } catch (Exception unknown) {
            // A message can have been accepted before the response became unavailable.
        }
        return new Outcome("UNKNOWN", "ZBS_OUTCOME_UNCONFIRMED", null, Map.of());
    }
    /** Scoped, explicit transactional fields only; never identity documents or free-text tenant records. */
    public Map<String,String> businessFields(long property,long recipient,String type,long source){
        String query=switch(type){
            case "INVOICE"->"SELECT i.code invoice_code,r.code room_code,i.billing_period,i.due_date,i.remaining_amount FROM invoices i JOIN rooms r ON r.id=i.room_id WHERE i.id=:id AND i.property_id=:property AND i.tenant_id=:tenant";
            case "CONTRACT","CHECKIN","CHECKOUT"->"SELECT c.code contract_code,r.code room_code,c.start_date,c.end_date,c.status contract_status,ci.scheduled_date checkin_date,(SELECT COALESCE(co.confirmed_date,co.requested_date) FROM rental_checkouts co WHERE co.contract_id=c.id AND co.status<>'CANCELLED' ORDER BY co.id DESC LIMIT 1) checkout_date FROM contracts c JOIN rooms r ON r.id=c.room_id LEFT JOIN rental_checkins ci ON ci.contract_id=c.id WHERE c.id=:id AND r.property_id=:property AND c.tenant_id=:tenant";
            case "MAINTENANCE"->"SELECT m.code maintenance_code,r.code room_code,m.status maintenance_status,m.preferred_service_time,m.sla_due_at,m.completed_at FROM maintenance_requests m LEFT JOIN rooms r ON r.id=m.room_id WHERE m.id=:id AND m.property_id=:property AND m.tenant_id=:tenant";
            default->throw invalid("ZBS_SOURCE_TYPE_UNSUPPORTED");
        };var rows=db.sql(query).param("id",source).param("property",property).param("tenant",recipient).query().listOfRows();if(rows.isEmpty())throw invalid("ZBS_SOURCE_SCOPE_MISMATCH");var result=new LinkedHashMap<String,String>();rows.getFirst().forEach((name,value)->result.put(name,Objects.toString(value,"")));return Map.copyOf(result);
    }
    public static String safeReference(String value){return value!=null&&value.matches("[a-zA-Z0-9_:-]{1,180}")?value:null;}
    public static String encode(String value){return java.net.URLEncoder.encode(value,StandardCharsets.UTF_8);}
}
