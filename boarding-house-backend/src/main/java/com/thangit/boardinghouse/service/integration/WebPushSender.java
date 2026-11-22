package com.thangit.boardinghouse.service.integration;

import static com.thangit.boardinghouse.service.integration.IntegrationCenter.*;
import com.thangit.boardinghouse.service.integration.IntegrationAdapters.Outcome;
import java.net.*;
import java.net.http.*;
import java.security.*;
import java.time.Duration;
import java.util.*;
import java.nio.charset.StandardCharsets;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class WebPushSender {
    final JdbcClient db;final IntegrationVault vault;final JsonMapper json;
    final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    public WebPushSender(JdbcClient db,IntegrationVault vault,JsonMapper json){this.db=db;this.vault=vault;this.json=json;if(Security.getProvider("BC")==null)Security.addProvider(new BouncyCastleProvider());}
    public static Outcome validateKeys(Config c,IntegrationVault vault){try{if(Security.getProvider("BC")==null)Security.addProvider(new BouncyCastleProvider());if(!c.text("subject").matches("mailto:[^\\s@]+@[^\\s@]+|https://[^\\s]+"))throw invalid("VAPID_SUBJECT_INVALID");var signature=Signature.getInstance("SHA256withECDSA","BC");var privateKey=Utils.loadPrivateKey(vault.read(c.owner(),"WEB_PUSH","PRIVATE_KEY"));var publicKey=Utils.loadPublicKey(c.text("publicKey"));byte[] challenge="SmartHome VAPID key validation".getBytes(StandardCharsets.UTF_8);signature.initSign(privateKey);signature.update(challenge);byte[] signed=signature.sign();signature.initVerify(publicKey);signature.update(challenge);if(!signature.verify(signed))throw invalid("VAPID_KEY_PAIR_MISMATCH");return new Outcome("CONFIGURED","VAPID_VALID_NO_DELIVERY_EVIDENCE",null,Map.of("keys","VERIFIED","delivery","NOT_TESTED"));}catch(Exception e){return new Outcome("ERROR","VAPID_KEYS_INVALID",null,Map.of("keys","INVALID"));}}
    public static void endpoint(String endpoint){URI uri;try{uri=URI.create(endpoint);}catch(Exception e){throw invalid("PUSH_ENDPOINT_INVALID");}if(!"https".equals(uri.getScheme())||uri.getUserInfo()!=null||uri.getFragment()!=null||uri.getPort()!=-1&&uri.getPort()!=443||!Set.of("fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com").contains(uri.getHost()))throw invalid("PUSH_ENDPOINT_NOT_ALLOWED");}
    public Outcome send(Config c,long recipient,String key,String link){if(!c.enabled())return new Outcome("DISABLED","WEB_PUSH_DISABLED",null,Map.of());var valid=validateKeys(c,vault);if(valid.status().equals("ERROR"))return valid;var subscriptions=db.sql("SELECT * FROM web_push_subscriptions WHERE owner_id=:owner AND user_id=:user AND enabled=TRUE ORDER BY id LIMIT 10").param("owner",c.owner()).param("user",recipient).query().listOfRows();if(subscriptions.isEmpty())return new Outcome("DEGRADED","PUSH_NO_SUBSCRIPTION",null,Map.of("subscription","MISSING"));int sent=0;boolean unknown=false;
        for(var row:subscriptions){long id=((Number)row.get("id")).longValue();try{String endpoint=row.get("endpoint").toString();endpoint(endpoint);String hash=row.get("endpoint_hash").toString();String auth=vault.decrypt("PUSH:"+recipient+":"+hash,row.get("auth_ciphertext").toString());String safeLink=link!=null&&link.startsWith("/")&&!link.startsWith("//")?link:"/login";String payload=json.writeValueAsString(Map.of("title","SmartHome AI","body","Có cập nhật mới. Đăng nhập để xem chi tiết.","url",safeLink,"tag",hash(key).substring(0,24)));var service=new PreparedPush(c.text("publicKey"),vault.read(c.owner(),"WEB_PUSH","PRIVATE_KEY"),c.text("subject"));var notification=new Notification(endpoint,row.get("p256dh").toString(),auth,payload.getBytes(StandardCharsets.UTF_8),60);var prepared=service.prepare(notification);var builder=HttpRequest.newBuilder(URI.create(prepared.getUrl())).timeout(Duration.ofSeconds(8));for(var header:prepared.getHeaders().entrySet())if(!Set.of("content-length","host").contains(header.getKey().toLowerCase(Locale.ROOT)))builder.header(header.getKey(),header.getValue());var response=http.send(builder.POST(HttpRequest.BodyPublishers.ofByteArray(prepared.getBody())).build(),HttpResponse.BodyHandlers.discarding());if(response.statusCode()==201||response.statusCode()==202)sent++;else if(response.statusCode()==404||response.statusCode()==410)db.sql("UPDATE web_push_subscriptions SET enabled=FALSE,disabled_at=CURRENT_TIMESTAMP(6) WHERE id=:id").param("id",id).update();else unknown=true;}catch(Exception failure){unknown=true;}}
        return new Outcome(sent>0?"SENT":unknown?"UNKNOWN":"DEGRADED",sent>0?"PUSH_SERVICE_ACCEPTED":unknown?"PUSH_OUTCOME_UNCONFIRMED":"PUSH_SUBSCRIPTIONS_EXPIRED",null,Map.of("accepted",sent,"delivery","NOT_CONFIRMED"));
    }
    static final class PreparedPush extends nl.martijndwars.webpush.AbstractPushService<PreparedPush>{
        PreparedPush(String publicKey,String privateKey,String subject)throws java.security.GeneralSecurityException{super(publicKey,privateKey,subject);}
        nl.martijndwars.webpush.HttpRequest prepare(Notification notification)throws Exception{return prepareRequest(notification,Encoding.AES128GCM);}
    }
    public static String hash(String input){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
