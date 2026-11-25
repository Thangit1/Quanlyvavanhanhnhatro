package com.thangit.boardinghouse.service.integration;

import static com.thangit.boardinghouse.service.integration.IntegrationCenter.*;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import com.thangit.boardinghouse.service.EmailService;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class IntegrationAdapters {
    public record Outcome(String status,String code,String reference,Map<String,Object> capabilities){}
    final IntegrationVault vault;final Environment environment;final JsonMapper json;final ZaloNotificationProvider zalo;final WebPushSender push;
    final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    public IntegrationAdapters(IntegrationVault vault,Environment environment,JsonMapper json,ZaloNotificationProvider zalo,WebPushSender push){this.vault=vault;this.environment=environment;this.json=json;this.zalo=zalo;this.push=push;}
    public String secret(Config c,String name){return vault.read(c.owner(),c.kind(),name);}
    public boolean complete(Config c){return switch(c.kind()){
        case "EMAIL"->!c.text("host").isBlank()&&!c.text("fromEmail").isBlank()&&(!c.bool("authentication")||!c.text("username").isBlank()&&!secret(c,"PASSWORD").isBlank());
        case "ZALO"->!c.text("oaId").isBlank()&&!c.text("appId").isBlank()&&!secret(c,"ACCESS_TOKEN").isBlank();
        case "WEB_PUSH"->!c.text("publicKey").isBlank()&&!c.text("subject").isBlank()&&!secret(c,"PRIVATE_KEY").isBlank();
        case "AI"->c.provider().equals("RULE_BASED")||!c.text("model").isBlank()&&!secret(c,"API_KEY").isBlank();
        case "PAYMENT"->switch(c.provider()){case "VNPAY"->!c.text("tmnCode").isBlank()&&!secret(c,"VNPAY_HASH_KEY").isBlank()&&!c.text("vnpayReturnUrl").isBlank();case "MOMO"->!c.text("partnerCode").isBlank()&&!secret(c,"MOMO_ACCESS_KEY").isBlank()&&!secret(c,"MOMO_SECRET_KEY").isBlank()&&!c.text("momoIpnUrl").isBlank();default->c.bool("cashEnabled")||c.bool("bankTransferEnabled")&&!c.text("bankName").isBlank()&&!c.text("accountName").isBlank()&&!c.text("accountNumber").isBlank();};
        default->false;};}
    public void validate(Config c){for(Object value:c.settings().values())if(value instanceof String text&&(text.contains("\r")||text.contains("\n")||text.indexOf(0)>=0))throw invalid("CONFIGURATION_CONTROL_CHARACTER");if(c.kind().equals("EMAIL")&&!c.text("host").isBlank()){
        String allowed=environment.getProperty("INTEGRATION_SMTP_HOSTS","smtp.gmail.com,smtp.office365.com,smtp.sendgrid.net");if(!Arrays.asList(allowed.toLowerCase(Locale.ROOT).split(",")).contains(c.text("host").toLowerCase(Locale.ROOT)))throw invalid("SMTP_HOST_NOT_ALLOWED_BY_SERVER");int port=port(c);if(!Set.of(25,465,587,1025,11025).contains(port))throw invalid("SMTP_PORT_NOT_ALLOWED");if(!Set.of("NONE","STARTTLS","SSL").contains(c.text("tlsMode")))throw invalid("SMTP_TLS_MODE_INVALID");if(c.environment().equals("PRODUCTION")&&c.text("tlsMode").equals("NONE"))throw invalid("SMTP_TLS_REQUIRED");if(!c.text("fromEmail").matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+"))throw invalid("SMTP_FROM_INVALID");
        try{for(InetAddress ip:InetAddress.getAllByName(c.text("host"))){if((ip.isAnyLocalAddress()||ip.isLoopbackAddress()||ip.isLinkLocalAddress()||ip.isSiteLocalAddress())&&(!environment.getProperty("INTEGRATION_ALLOW_LOCAL_SMTP",Boolean.class,false)||c.environment().equals("PRODUCTION")||!Set.of(1025,11025).contains(port)))throw invalid("SMTP_PRIVATE_ADDRESS_BLOCKED");}}catch(UnknownHostException e){throw invalid("SMTP_HOST_UNRESOLVED");}
    }if(c.kind().equals("AI")&&!c.text("model").isBlank()&&!c.text("model").matches("[A-Za-z0-9_./:-]{1,150}"))throw invalid("AI_MODEL_INVALID");}
    int port(Config c){try{return Integer.parseInt(c.text("port"));}catch(Exception e){throw invalid("SMTP_PORT_INVALID");}}
    JavaMailSenderImpl mail(Config c){validate(c);var mail=new JavaMailSenderImpl();mail.setHost(c.text("host"));mail.setPort(port(c));mail.setDefaultEncoding("UTF-8");mail.setUsername(c.text("username"));mail.setPassword(secret(c,"PASSWORD"));var properties=mail.getJavaMailProperties();properties.setProperty("mail.smtp.auth",Boolean.toString(c.bool("authentication")));properties.setProperty("mail.smtp.starttls.enable",Boolean.toString(c.text("tlsMode").equals("STARTTLS")));properties.setProperty("mail.smtp.starttls.required",Boolean.toString(c.text("tlsMode").equals("STARTTLS")));properties.setProperty("mail.smtp.ssl.enable",Boolean.toString(c.text("tlsMode").equals("SSL")));properties.setProperty("mail.smtp.ssl.checkserveridentity","true");for(String key:List.of("connectiontimeout","timeout","writetimeout"))properties.setProperty("mail.smtp."+key,"5000");return mail;}
    public boolean testRecipient(Config c,String recipient){if(recipient==null||!recipient.matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+"))return false;String allowed=environment.getProperty("INTEGRATION_TEST_RECIPIENTS","")+","+environment.getProperty("MAIL_TEST_RECIPIENT","");return Arrays.stream(allowed.split(",")).map(String::trim).anyMatch(recipient::equalsIgnoreCase);}
    public Outcome sendEmail(Config c,String recipient,String title,String body,String key,boolean test){
        if(!c.enabled()||!complete(c))return new Outcome("NOT_CONFIGURED","EMAIL_NOT_CONFIGURED",null,Map.of());
        boolean local=environment.acceptsProfiles(org.springframework.core.env.Profiles.of("local","dev"));
        if((test||local||!c.environment().equals("PRODUCTION"))&&!testRecipient(c,recipient))
            return new Outcome("ERROR","TEST_RECIPIENT_NOT_ALLOWED",null,Map.of());
        if(title==null||title.length()>200||title.contains("\r")||title.contains("\n"))throw invalid("EMAIL_TITLE_INVALID");
        var result=EmailService.sendConfigured(mail(c),c.text("fromEmail"),c.text("fromName"),
                List.of(recipient==null?"":recipient),
                (test||!c.environment().equals("PRODUCTION")?"[SmartHome AI - TEST] ":"")+title,body,false,key);
        return new Outcome(result.status(),result.code(),result.reference(),
                result.accepted()?Map.of("smtp","ACCEPTED","delivery","NOT_CONFIRMED"):Map.of("retryable",result.retryable()));
    }
    public Outcome execute(Config c,String operation,String key,TestRequest request)throws Exception{
        validate(c);
        if(c.kind().equals("EMAIL")){if(operation.equals("CHECK")){var result=EmailService.checkConfigured(mail(c));return new Outcome(result.status(),result.code(),result.reference(),Map.of("connection",result.status().equals("CONNECTED")?"CONNECTED":"FAILED","send","NOT_TESTED","delivery","NOT_CONFIRMED"));}if(operation.equals("TEST_SEND"))return sendEmail(c,request==null?null:request.recipient(),"Kiểm tra kết nối email","Đây là email thử nghiệm SmartHome AI. Không yêu cầu thanh toán tiền thật.",key,true);}
        if(c.kind().equals("ZALO"))return zalo.execute(c,operation,key,request);
        if(c.kind().equals("WEB_PUSH"))return operation.equals("TEST_SEND")?push.send(c,c.owner(),key,"/admin/settings/integrations"):WebPushSender.validateKeys(c,vault);
        if(c.kind().equals("AI")){if(c.provider().equals("RULE_BASED"))return new Outcome("CONFIGURED","RULE_BASED_NOT_A_MODEL",null,Map.of("mode","RULE_BASED","model","NOT_IMPLEMENTED"));String url=c.provider().equals("OPENAI")?"https://api.openai.com/v1/models/"+c.text("model"):"https://generativelanguage.googleapis.com/v1beta/models/"+c.text("model");var builder=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET();if(c.provider().equals("OPENAI"))builder.header("Authorization","Bearer "+secret(c,"API_KEY"));else builder.header("x-goog-api-key",secret(c,"API_KEY"));var response=http.send(builder.build(),HttpResponse.BodyHandlers.ofString());if(response.statusCode()!=200)return new Outcome("ERROR",response.statusCode()==401||response.statusCode()==403?"AI_AUTH_REJECTED":"AI_MODEL_CHECK_FAILED",null,Map.of("model","UNVERIFIED"));var body=json.readTree(response.body());if(!body.has("id")&&!body.has("name"))return new Outcome("ERROR","AI_RESPONSE_INVALID",null,Map.of());return new Outcome("CONNECTED","AI_MODEL_VERIFIED",null,Map.of("model","VERIFIED","generation","NOT_TESTED","forecast","RULE_BASED","utilityAnomaly","RULE_BASED"));}
        if(c.kind().equals("PAYMENT"))return c.provider().equals("MANUAL")?new Outcome("CONFIGURED","MANUAL_RECONCILIATION_REQUIRED",null,Map.of("cash","MANUAL","bank","ACCOUNTANT_VERIFICATION_REQUIRED")):new Outcome("DEGRADED","GATEWAY_PROVIDER_CHECK_REQUIRED",null,Map.of("configuration","PRESENT","providerAuthentication","NOT_VERIFIED","environment",c.environment()));
        throw invalid("INTEGRATION_OPERATION_UNSUPPORTED");
    }
}
