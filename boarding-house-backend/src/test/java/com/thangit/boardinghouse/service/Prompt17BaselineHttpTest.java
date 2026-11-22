package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import tools.jackson.databind.json.JsonMapper;

/** Reproduce the original failure against the previously packaged V44 backend, not a mocked service. */
@EnabledIfSystemProperty(named="prompt17.baseline",matches="true")
class Prompt17BaselineHttpTest {
    @Test void originalBackendRejectsSubmissionWithoutTenantAccount()throws Exception{
        if(Integer.getInteger("prompt03.mysql.port",3306)==3306)throw new IllegalStateException("Use isolated MySQL");
        var f=new DepositLedgerMysqlTest();f.setup("prompt17_baseline_","44");
        f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT 1,id FROM roles WHERE code='OWNER'").update();String password="Baseline-Fixture17!";
        f.db.sql("UPDATE users SET password_hash=:hash WHERE id=1").param("hash",new BCryptPasswordEncoder().encode(password)).update();
        long property=f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'BASELINE17','Baseline17','Synthetic')"),room=f.insert("INSERT INTO rooms(property_id,code,monthly_rent,status) VALUES("+property+",'BASE17',1000,'READY')");
        var log=Path.of("D:/DATN/prompt17-baseline-runtime.log");var javaBinary=Path.of(System.getProperty("java.home"),"bin","java.exe").toString();
        var child=new ProcessBuilder(javaBinary,"-Xms32m","-Xmx384m","-XX:MaxMetaspaceSize=256m","-jar","D:/DATN/prompt17-baseline-backend.jar","--server.port=0","--spring.profiles.active=dev","--app.scheduling.enabled=false","--app.ai.provider=none","--app.mail.business-delivery-enabled=false","--app.security.jwt.secret=baseline17-test-only-secret-abcdefghijklmnopqrstuvwxyz0123456789","--spring.datasource.url="+f.dataSource.getUrl(),"--spring.datasource.username=root","--spring.datasource.password=","--spring.flyway.url="+f.dataSource.getUrl(),"--spring.flyway.user=root","--spring.flyway.password=").redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try{
            String port=null;long end=System.nanoTime()+Duration.ofSeconds(90).toNanos();while(System.nanoTime()<end&&child.isAlive()){if(Files.exists(log)){var match=java.util.regex.Pattern.compile("Tomcat started on port (\\d+)").matcher(Files.readString(log));if(match.find()){port=match.group(1);break;}}Thread.sleep(200);}assertThat(port).isNotNull();
            var http=HttpClient.newHttpClient();var json=new JsonMapper();String base="http://127.0.0.1:"+port+"/api";
            var login=http.send(HttpRequest.newBuilder(URI.create(base+"/auth/login")).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("email","p03-1@test.invalid","password",password,"requestedRole","OWNER")))).build(),HttpResponse.BodyHandlers.ofString());assertThat(login.statusCode()).isEqualTo(200);String auth="Bearer "+json.readTree(login.body()).path("data").path("accessToken").asText();
            var terms=Map.of("startDate",BusinessTime.today().toString(),"endDate",BusinessTime.today().plusYears(1).toString(),"depositAmount",1000,"paymentDueDay",5,"noticePeriodDays",30,"monthlyRent",1000,"utilityRates",List.of(Map.of("code","ELECTRICITY","name","Electricity","calculationMethod","FIXED","unitPrice",0,"unit","month"),Map.of("code","WATER","name","Water","calculationMethod","FIXED","unitPrice",0,"unit","month")),"services",List.of(),"terms",List.of(),"initialPaymentRequired",false);
            var request=Map.of("roomId",room,"newTenant",Map.of("fullName","Baseline synthetic tenant","phone","0917170001","email","baseline17@test.invalid"),"terms",terms,"expectedCheckinDate",BusinessTime.today().toString(),"submit",false);
            var created=http.send(HttpRequest.newBuilder(URI.create(base+"/admin/contracts")).header("Authorization",auth).header("Content-Type","application/json").header("Idempotency-Key",UUID.randomUUID().toString()).POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(request))).build(),HttpResponse.BodyHandlers.ofString());assertThat(created.statusCode()).isEqualTo(201);long contract=json.readTree(created.body()).path("data").path("id").asLong();
            var submitted=http.send(HttpRequest.newBuilder(URI.create(base+"/admin/contracts/"+contract+"/submit")).header("Authorization",auth).POST(HttpRequest.BodyPublishers.noBody()).build(),HttpResponse.BodyHandlers.ofString());assertThat(submitted.statusCode()).isEqualTo(409);assertThat(json.readTree(submitted.body()).path("errorCode").asText()).isEqualTo("TENANT_ACCOUNT_REQUIRED");
            var dir=Path.of("../docs/qa/prompt17");Files.createDirectories(dir);Files.writeString(dir.resolve("baseline.json"),json.writeValueAsString(Map.of("originalPackagedBackend",true,"draftHttpStatus",201,"submitHttpStatus",409,"errorCode","TENANT_ACCOUNT_REQUIRED","productionDataTouched",false)));
        }finally{child.destroy();if(!child.waitFor(5,java.util.concurrent.TimeUnit.SECONDS))child.destroyForcibly();}
    }
}
