package com.thangit.boardinghouse.service.integration;

import static com.thangit.boardinghouse.service.integration.IntegrationCenter.*;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminInvoiceService;
import com.thangit.boardinghouse.service.BusinessTime;
import com.thangit.boardinghouse.service.InvoicePaymentRules;
import com.thangit.boardinghouse.service.PaymentTransactionService;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.RecordPayment;
import java.math.BigDecimal;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Gateway callbacks are the only settlement input. Sandbox evidence never posts to payments. */
@Service
public class GatewayPayments {
    final JdbcClient db;final IntegrationCenter center;final IntegrationVault vault;final AdminInvoiceService invoices;final JsonMapper json;final TransactionTemplate tx;
    final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    public GatewayPayments(JdbcClient db,IntegrationCenter center,IntegrationVault vault,AdminInvoiceService invoices,JsonMapper json,org.springframework.transaction.PlatformTransactionManager manager){this.db=db;this.center=center;this.vault=vault;this.invoices=invoices;this.json=json;tx=new TransactionTemplate(manager);}
    public static String hmac(String algorithm,String secret,String input){try{var mac=Mac.getInstance(algorithm);mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),algorithm));return HexFormat.of().formatHex(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw invalid("GATEWAY_SIGNING_FAILED");}}
    public static boolean equal(String actual,String expected){return actual!=null&&expected!=null&&MessageDigest.isEqual(actual.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII),expected.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));}
    public static String encode(String value){return URLEncoder.encode(value,StandardCharsets.UTF_8);}
    public List<Map<String,String>> available(AuthenticatedUser actor,long invoice){if(actor==null||actor.activeRole()!=RoleCode.TENANT)throw invalid("GATEWAY_TENANT_REQUIRED");var owners=db.sql("SELECT p.owner_id FROM invoices i JOIN properties p ON p.id=i.property_id WHERE i.id=:id AND i.tenant_id=:tenant").param("id",invoice).param("tenant",actor.id()).query(Long.class).list();if(owners.isEmpty())throw invalid("GATEWAY_INVOICE_NOT_FOUND");var c=center.config(owners.getFirst(),"PAYMENT");var result=new ArrayList<Map<String,String>>();if(c.enabled()&&Set.of("TEST","PRODUCTION").contains(c.environment())){if(c.bool("vnpayEnabled")&&!c.text("vnpayReturnUrl").isBlank()&&!c.text("tmnCode").isBlank()&&!vault.read(c.owner(),"PAYMENT","VNPAY_HASH_KEY").isBlank())result.add(Map.of("provider","VNPAY","environment",c.environment()));if(c.bool("momoEnabled")&&!c.text("momoIpnUrl").isBlank()&&!c.text("momoRedirectUrl").isBlank()&&!c.text("partnerCode").isBlank()&&!vault.read(c.owner(),"PAYMENT","MOMO_SECRET_KEY").isBlank()&&!vault.read(c.owner(),"PAYMENT","MOMO_ACCESS_KEY").isBlank())result.add(Map.of("provider","MOMO","environment",c.environment()));}return result;}
    public static String vnpCanonical(Map<String,String> fields){return new TreeMap<>(fields).entrySet().stream().filter(e->e.getKey().startsWith("vnp_")&&!Set.of("vnp_SecureHash","vnp_SecureHashType").contains(e.getKey())&&e.getValue()!=null&&!e.getValue().isBlank()).map(e->encode(e.getKey())+"="+encode(e.getValue())).collect(java.util.stream.Collectors.joining("&"));}
    public Map<String,Object> create(AuthenticatedUser actor,long invoice,String provider,String key,String ip){if(actor==null||actor.activeRole()!=RoleCode.TENANT)throw invalid("GATEWAY_TENANT_REQUIRED");if(!Set.of("VNPAY","MOMO").contains(provider)||key==null||!key.matches("[a-zA-Z0-9:_-]{8,100}"))throw invalid("GATEWAY_REQUEST_INVALID");
        var session=tx.execute(status->{var rows=db.sql("SELECT i.*,p.owner_id FROM invoices i JOIN properties p ON p.id=i.property_id WHERE i.id=:id AND i.tenant_id=:tenant FOR UPDATE").param("id",invoice).param("tenant",actor.id()).query().listOfRows();if(rows.isEmpty())throw invalid("GATEWAY_INVOICE_NOT_FOUND");var bill=rows.getFirst();long owner=((Number)bill.get("owner_id")).longValue();var previous=db.sql("SELECT * FROM gateway_sessions WHERE tenant_id=:tenant AND request_key=:key").param("tenant",actor.id()).param("key",key).query().listOfRows();if(!previous.isEmpty()){var old=previous.getFirst();if(((Number)old.get("invoice_id")).longValue()!=invoice||!old.get("provider").equals(provider))throw invalid("GATEWAY_IDEMPOTENCY_CONFLICT");return old;}
            InvoicePaymentRules.requireOpen(bill,BusinessTime.today());BigDecimal amount=(BigDecimal)bill.get("remaining_amount");if(amount.signum()<=0||Set.of("DRAFT","PENDING_REVIEW","CANCELLED","PAID").contains(bill.get("status")))throw invalid("GATEWAY_INVOICE_NOT_PAYABLE");var config=center.config(owner,"PAYMENT");if(!config.enabled()||!Set.of("TEST","PRODUCTION").contains(config.environment())||!config.settings().getOrDefault(provider.equals("VNPAY")?"vnpayEnabled":"momoEnabled",false).equals(true))throw invalid("GATEWAY_NOT_ENABLED");if(provider.equals("VNPAY")&&(config.text("tmnCode").isBlank()||vault.read(owner,"PAYMENT","VNPAY_HASH_KEY").isBlank()||config.text("vnpayReturnUrl").isBlank())||provider.equals("MOMO")&&(config.text("partnerCode").isBlank()||vault.read(owner,"PAYMENT","MOMO_ACCESS_KEY").isBlank()||vault.read(owner,"PAYMENT","MOMO_SECRET_KEY").isBlank()||config.text("momoIpnUrl").isBlank()||config.text("momoRedirectUrl").isBlank()))throw invalid("GATEWAY_CREDENTIAL_MISSING");
            if(db.sql("SELECT COUNT(*) FROM gateway_sessions WHERE invoice_id=:invoice AND provider<>'SIMULATED' AND ((status IN ('CREATED','REQUESTING','PENDING') AND expires_at>:businessNow) OR (status='REVIEW_REQUIRED' AND environment='PRODUCTION'))").param("invoice",invoice).param("businessNow",BusinessTime.now()).query(Long.class).single()>0)throw invalid("GATEWAY_PAYMENT_ALREADY_PENDING");String reference="SH"+UUID.randomUUID().toString().replace("-","");db.sql("INSERT INTO gateway_sessions(invoice_id,owner_id,tenant_id,provider,environment,request_key,merchant_reference,amount,expires_at) VALUES(:invoice,:owner,:tenant,:provider,:environment,:key,:reference,:amount,:expires)").param("invoice",invoice).param("owner",owner).param("tenant",actor.id()).param("provider",provider).param("environment",config.environment()).param("key",key).param("reference",reference).param("amount",amount).param("expires",BusinessTime.now().plusMinutes(15)).update();return db.sql("SELECT * FROM gateway_sessions WHERE merchant_reference=:reference").param("reference",reference).query().singleRow();});
        if(session.get("checkout_url")!=null||!session.get("status").equals("CREATED"))return publicSession(session);
        if(!stage(session,"CREATED","REQUESTING","GATEWAY_REQUESTING",null))return publicSession(db.sql("SELECT * FROM gateway_sessions WHERE id=:id").param("id",session.get("id")).query().singleRow());
        try{var config=center.config(((Number)session.get("owner_id")).longValue(),"PAYMENT");String url=provider.equals("VNPAY")?vnpUrl(config,session,ip):momoUrl(config,session);stage(session,"REQUESTING","PENDING","GATEWAY_CHECKOUT_READY",url);}catch(Exception rejected){stage(session,"REQUESTING","FAILED","GATEWAY_CREATE_FAILED",null);}
        return publicSession(db.sql("SELECT * FROM gateway_sessions WHERE id=:id").param("id",session.get("id")).query().singleRow());
    }
    boolean stage(Map<String,Object> initial,String expected,String state,String code,String url){
        return tx.execute(status->{
            db.sql("SELECT id FROM invoices WHERE id=:id FOR UPDATE").param("id",initial.get("invoice_id")).query(Long.class).single();
            var current=db.sql("SELECT * FROM gateway_sessions WHERE id=:id FOR UPDATE").param("id",initial.get("id")).query().singleRow();
            if(!expected.equals(current.get("status")))return false;
            db.sql("UPDATE gateway_sessions SET status=:state,result_code=:code,checkout_url=:url,completed_at=CASE WHEN :state='FAILED' THEN CURRENT_TIMESTAMP(6) ELSE completed_at END WHERE id=:id")
                    .param("state",state).param("code",code).param("url",url).param("id",current.get("id")).update();
            PaymentTransactionService.event(db,current,state,code,null);return true;
        });
    }
    String vnpUrl(Config config,Map<String,Object> session,String ip){var fields=new TreeMap<String,String>();fields.put("vnp_Version","2.1.0");fields.put("vnp_Command","pay");fields.put("vnp_TmnCode",config.text("tmnCode"));fields.put("vnp_Amount",((BigDecimal)session.get("amount")).multiply(BigDecimal.valueOf(100)).toBigIntegerExact().toString());fields.put("vnp_CurrCode","VND");fields.put("vnp_TxnRef",session.get("merchant_reference").toString());fields.put("vnp_OrderInfo","SmartHome invoice "+session.get("invoice_id"));fields.put("vnp_OrderType","other");fields.put("vnp_Locale","vn");fields.put("vnp_ReturnUrl",config.text("vnpayReturnUrl"));fields.put("vnp_IpAddr",ip);var format=DateTimeFormatter.ofPattern("yyyyMMddHHmmss");var expires=PaymentTransactionService.datetime(session.get("expires_at"));if(!expires.isAfter(BusinessTime.now()))throw invalid("GATEWAY_SESSION_EXPIRED");fields.put("vnp_CreateDate",expires.minusMinutes(15).format(format));fields.put("vnp_ExpireDate",expires.format(format));String query=vnpCanonical(fields);return (config.environment().equals("PRODUCTION")?"https://pay.vnpay.vn/vpcpay.html":"https://sandbox.vnpayment.vn/paymentv2/vpcpay.html")+"?"+query+"&vnp_SecureHash="+hmac("HmacSHA512",vault.read(config.owner(),"PAYMENT","VNPAY_HASH_KEY"),query);}
    String momoUrl(Config config,Map<String,Object> session)throws Exception{String reference=session.get("merchant_reference").toString(),access=vault.read(config.owner(),"PAYMENT","MOMO_ACCESS_KEY");var fields=new LinkedHashMap<String,Object>();fields.put("partnerCode",config.text("partnerCode"));fields.put("requestId",reference);fields.put("orderId",reference);fields.put("amount",((BigDecimal)session.get("amount")).longValueExact());fields.put("orderInfo","SmartHome invoice "+session.get("invoice_id"));fields.put("redirectUrl",config.text("momoRedirectUrl"));fields.put("ipnUrl",config.text("momoIpnUrl"));fields.put("requestType","captureWallet");fields.put("extraData","");fields.put("lang","vi");String canonical="accessKey="+access+"&amount="+fields.get("amount")+"&extraData=&ipnUrl="+fields.get("ipnUrl")+"&orderId="+reference+"&orderInfo="+fields.get("orderInfo")+"&partnerCode="+config.text("partnerCode")+"&redirectUrl="+fields.get("redirectUrl")+"&requestId="+reference+"&requestType=captureWallet";fields.put("signature",hmac("HmacSHA256",vault.read(config.owner(),"PAYMENT","MOMO_SECRET_KEY"),canonical));String endpoint=config.environment().equals("PRODUCTION")?"https://payment.momo.vn/v2/gateway/api/create":"https://test-payment.momo.vn/v2/gateway/api/create";var response=http.send(HttpRequest.newBuilder(URI.create(endpoint)).timeout(Duration.ofSeconds(10)).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(fields))).build(),HttpResponse.BodyHandlers.ofString());var data=json.readTree(response.body());if(response.statusCode()!=200||data.path("resultCode").asInt(-1)!=0||!data.path("orderId").asText().equals(reference)||!data.path("requestId").asText().equals(reference))throw invalid("MOMO_CREATE_REJECTED");String url=data.path("payUrl").asText();URI parsed=URI.create(url);if(!"https".equals(parsed.getScheme())||!Set.of("payment.momo.vn","test-payment.momo.vn").contains(parsed.getHost()))throw invalid("MOMO_CHECKOUT_URL_INVALID");return url;}
    public Map<String,Object> own(AuthenticatedUser actor,long id){if(actor==null)throw invalid("GATEWAY_AUTH_REQUIRED");return publicSession(db.sql("SELECT * FROM gateway_sessions WHERE id=:id AND tenant_id=:tenant").param("id",id).param("tenant",actor.id()).query(new org.springframework.jdbc.core.ColumnMapRowMapper()).optional().orElseThrow(()->invalid("GATEWAY_SESSION_NOT_FOUND")));}
    Map<String,Object> publicSession(Map<String,Object> row){var result=new LinkedHashMap<String,Object>();for(String key:List.of("id","invoice_id","provider","environment","status","checkout_url","created_at","expires_at","completed_at"))result.put(key,row.get(key));return result;}
    Map<String,Object> find(String reference,String provider){return db.sql("SELECT * FROM gateway_sessions WHERE merchant_reference=:ref AND provider=:provider").param("ref",reference).param("provider",provider).query(new org.springframework.jdbc.core.ColumnMapRowMapper()).optional().orElseThrow(()->invalid("GATEWAY_REFERENCE_NOT_FOUND"));}
    public Object vnpIpn(Map<String,String> fields){try{var session=find(fields.getOrDefault("vnp_TxnRef",""),"VNPAY");long owner=((Number)session.get("owner_id")).longValue();var config=center.config(owner,"PAYMENT");String secret=vault.read(owner,"PAYMENT","VNPAY_HASH_KEY");if(secret.isBlank()||!equal(fields.get("vnp_SecureHash"),hmac("HmacSHA512",secret,vnpCanonical(fields)))||!config.text("tmnCode").equals(fields.get("vnp_TmnCode")))return Map.of("RspCode","97","Message","Invalid signature");BigDecimal amount=new BigDecimal(fields.getOrDefault("vnp_Amount","0")).divide(BigDecimal.valueOf(100));if(amount.compareTo((BigDecimal)session.get("amount"))!=0)return Map.of("RspCode","04","Message","Invalid amount");String result=settle(session,fields.get("vnp_TransactionNo"),PaymentProviderAdapter.vnpay(fields.get("vnp_ResponseCode"),fields.get("vnp_TransactionStatus")));return Map.of("RspCode",result.equals("DUPLICATE")?"02":"00","Message",result);}catch(Exception rejected){return Map.of("RspCode","01","Message","Rejected or review required");}}
    public static String momoCanonical(String access,Map<String,String> fields){var names=List.of("amount","extraData","message","orderId","orderInfo","orderType","partnerCode","payType","requestId","responseTime","resultCode","transId");StringBuilder value=new StringBuilder("accessKey="+access);for(String name:names)value.append('&').append(name).append('=').append(fields.getOrDefault(name,""));return value.toString();}
    public String momoIpn(Map<String,String> fields){var session=find(fields.getOrDefault("orderId",""),"MOMO");long owner=((Number)session.get("owner_id")).longValue();var config=center.config(owner,"PAYMENT");String access=vault.read(owner,"PAYMENT","MOMO_ACCESS_KEY"),secret=vault.read(owner,"PAYMENT","MOMO_SECRET_KEY");if(secret.isBlank()||access.isBlank()||!equal(fields.get("signature"),hmac("HmacSHA256",secret,momoCanonical(access,fields)))||!config.text("partnerCode").equals(fields.get("partnerCode"))||!session.get("merchant_reference").equals(fields.get("requestId")))throw invalid("MOMO_SIGNATURE_REJECTED");if(new BigDecimal(fields.getOrDefault("amount","0")).compareTo((BigDecimal)session.get("amount"))!=0)throw invalid("MOMO_AMOUNT_REJECTED");return settle(session,fields.get("transId"),PaymentProviderAdapter.momo(fields.get("resultCode")));}
    public Object vnpReturn(Map<String,String> fields){
        try{
            var session=find(fields.getOrDefault("vnp_TxnRef",""),"VNPAY");
            var config=center.config(((Number)session.get("owner_id")).longValue(),"PAYMENT");
            String secret=vault.read(config.owner(),"PAYMENT","VNPAY_HASH_KEY");
            boolean verified=!secret.isBlank()&&equal(fields.get("vnp_SecureHash"),hmac("HmacSHA512",secret,vnpCanonical(fields)))
                    &&config.text("tmnCode").equals(fields.get("vnp_TmnCode"))
                    &&new BigDecimal(fields.getOrDefault("vnp_Amount","0")).compareTo(((BigDecimal)session.get("amount")).multiply(BigDecimal.valueOf(100)))==0;
            return Map.of("verified",verified,"settledByReturn",false,"ipnRequired",true);
        }catch(Exception rejected){return Map.of("verified",false,"settledByReturn",false,"ipnRequired",true);}
    }
    String settle(Map<String,Object> initial,String reference,PaymentProviderAdapter.Result outcome){
        if("PENDING".equals(outcome.status()))return "PENDING";
        boolean success="SUCCESS".equals(outcome.status());
        if(!success&&(reference==null||reference.isBlank()||"0".equals(reference)))reference="UNSET-"+initial.get("id");
        if(success&&"0".equals(reference))throw invalid("GATEWAY_TRANSACTION_REFERENCE_INVALID");
        if(reference==null||!reference.matches("[a-zA-Z0-9_-]{1,100}"))throw invalid("GATEWAY_TRANSACTION_REFERENCE_INVALID");
        final String providerReference=reference;
        return tx.execute(status->{
            long invoice=((Number)initial.get("invoice_id")).longValue(),id=((Number)initial.get("id")).longValue(),owner=((Number)initial.get("owner_id")).longValue();
            var bill=db.sql("SELECT * FROM invoices WHERE id=:id FOR UPDATE").param("id",invoice).query().singleRow();
            var session=db.sql("SELECT * FROM gateway_sessions WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();
            if("MANUAL_REVIEW_NO_COLLECTION".equals(session.get("result_code")))return "DUPLICATE";
            String prior=Objects.toString(session.get("provider_reference"),"");
            if(!prior.isBlank()&&!prior.startsWith("UNSET-")&&!prior.equals(providerReference))throw invalid("GATEWAY_TRANSACTION_CONFLICT");
            if(Set.of("SUCCEEDED","TEST_SUCCEEDED","REVIEW_REQUIRED").contains(session.get("status")))return "DUPLICATE";
            if(outcome.status().equals(session.get("status"))&&!prior.isBlank())return "DUPLICATE";
            String state=success?"TEST_SUCCEEDED":outcome.status();Long payment=null;
            boolean terminal=Set.of("CANCELLED","EXPIRED").contains(session.get("status"))
                    ||!PaymentTransactionService.datetime(session.get("expires_at")).isAfter(BusinessTime.now());
            if(success&&terminal)state="REVIEW_REQUIRED";
            else if(success&&session.get("environment").equals("PRODUCTION")){
                BigDecimal amount=(BigDecimal)session.get("amount");
                if(amount.compareTo((BigDecimal)bill.get("remaining_amount"))!=0||Set.of("DRAFT","PENDING_REVIEW","PAID","CANCELLED").contains(bill.get("status")))state="REVIEW_REQUIRED";
                else{
                    if(db.sql("SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=:owner AND u.status='ACTIVE' AND r.code='OWNER'").param("owner",owner).query(Long.class).single()!=1)throw invalid("GATEWAY_OWNER_NOT_ACTIVE");
                    String key="GATEWAY-"+session.get("provider")+"-"+id;
                    invoices.payment(new AuthenticatedUser(owner,"verified-gateway",RoleCode.OWNER),invoice,key,new RecordPayment(amount,"CARD",BusinessTime.now(),providerReference,"Verified "+session.get("provider")+" production IPN",((Number)bill.get("version")).longValue()));
                    payment=db.sql("SELECT id FROM payments WHERE idempotency_key=:key").param("key",key).query(Long.class).single();state="SUCCEEDED";
                }
            }
            db.sql("UPDATE gateway_sessions SET status=:state,provider_reference=:reference,payment_id=:payment,result_code=:code,completed_at=CURRENT_TIMESTAMP(6) WHERE id=:id")
                    .param("state",state).param("reference",providerReference).param("payment",payment).param("code",outcome.code()).param("id",id).update();
            PaymentTransactionService.event(db,session,state,outcome.code(),null);
            return state;
        });
    }
}
