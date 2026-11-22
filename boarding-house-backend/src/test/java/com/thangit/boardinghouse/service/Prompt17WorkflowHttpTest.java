package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import java.math.BigDecimal;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
    "app.security.jwt.secret=prompt17-test-only-secret-abcdefghijklmnopqrstuvwxyz0123456789","app.security.login.rate-limit-max=500",
    "app.scheduling.enabled=false","app.ai.provider=none","app.cors.allowed-origins=http://127.0.0.1:13000","app.frontend-url=http://127.0.0.1:13000",
    "spring.mail.host=127.0.0.1","spring.mail.port=10317","spring.mail.username=test","spring.mail.password=test",
    "spring.mail.properties.mail.smtp.auth=false","spring.mail.properties.mail.smtp.starttls.enable=false","spring.mail.properties.mail.smtp.starttls.required=false",
    "app.mail.from=smarthome-test@test.invalid","app.mail.business-delivery-enabled=true"})
@EnabledIfSystemProperty(named="prompt17.http",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Prompt17WorkflowHttpTest {
    static final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    static final String PASSWORD="Fixture-17-Password!";
    @DynamicPropertySource static void database(DynamicPropertyRegistry r)throws Exception{
        if(Integer.getInteger("prompt03.mysql.port",3306)==3306)throw new IllegalStateException("Use isolated MySQL");
        f.setup("prompt17_http_",null);r.add("spring.datasource.url",f.dataSource::getUrl);r.add("spring.datasource.username",f.dataSource::getUsername);r.add("spring.datasource.password",f.dataSource::getPassword);r.add("spring.flyway.url",f.dataSource::getUrl);r.add("spring.flyway.user",f.dataSource::getUsername);r.add("spring.flyway.password",f.dataSource::getPassword);
    }
    @LocalServerPort int port;
    @Autowired JsonMapper json;@Autowired PasswordEncoder passwords;@Autowired ExternalCommunicationWorker worker;
    @Autowired CommunicationJobs jobs;@Autowired ContractDeliveryService deliveries;@Autowired InitialPasswordService setup;
    @Autowired ContractOnboardingService onboarding;@Autowired DepositLedgerService ledger;@Autowired RentalLifecycleService lifecycle;
    @Autowired RoomLifecycleGuard guard;@Autowired EmailService mail;
    @Autowired AccountProvisioningService provisioning;@Autowired DepositTransferService transfers;
    final HttpClient http=HttpClient.newHttpClient();final List<Map<String,Object>> evidence=Collections.synchronizedList(new ArrayList<>());
    String owner,accountant,tenant,rawSetup,email;long main,user,property,room,deposit;Map<String,Object> mainRequest;
    record Place(long property,long room){}
    String base(){return "http://127.0.0.1:"+port+"/api";}
    String key(){return UUID.randomUUID().toString();}
    @BeforeAll void accounts()throws Exception{
        for(var e:Map.of(1,"OWNER",2,"MANAGER",3,"ACCOUNTANT",4,"OWNER").entrySet())f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE code=:role").param("id",e.getKey()).param("role",e.getValue()).update();
        f.db.sql("UPDATE users SET password_hash=:hash WHERE id IN(1,2,3,4)").param("hash",passwords.encode(PASSWORD)).update();
        f.db.sql("UPDATE accountant_profiles SET can_record_payment=TRUE WHERE user_id=3").update();owner=login("p03-1@test.invalid",PASSWORD,"OWNER");accountant=login("p03-3@test.invalid",PASSWORD,"ACCOUNTANT");
    }
    Place place(){String unique=key().substring(0,12);long p=f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'"+unique+"','Prompt17 fixture','Synthetic address')");long r=f.insert("INSERT INTO rooms(property_id,code,name,monthly_rent,status,capacity) VALUES("+p+",'P17','Prompt17 room',1500000,'READY',2)");f.db.sql("INSERT INTO accountant_property_assignments(accountant_id,property_id,granted_by) VALUES(3,:p,1)").param("p",p).update();return new Place(p,r);}
    Map<String,Object> request(Place place,String email,boolean send){
        var person=new LinkedHashMap<String,Object>();person.put("fullName","Synthetic tenant "+place.room());person.put("phone","09"+String.format("%08d",place.room()+1700));if(email!=null)person.put("email",email);person.put("dateOfBirth","2000-01-01");person.put("identityNumber",String.format("%012d",900000000000L+place.room()));person.put("permanentAddress","Synthetic permanent address");
        var terms=Map.of("startDate",BusinessTime.today().toString(),"endDate",BusinessTime.today().plusYears(1).toString(),"depositAmount",1000,"paymentDueDay",5,"noticePeriodDays",30,"monthlyRent",1500000,"utilityRates",List.of(Map.of("code","ELECTRICITY","name","Electricity","calculationMethod","FIXED","unitPrice",0,"unit","month"),Map.of("code","WATER","name","Water","calculationMethod","FIXED","unitPrice",0,"unit","month")),"services",List.of(),"terms",List.of(),"initialPaymentRequired",false);
        return new LinkedHashMap<>(Map.of("roomId",place.room(),"newTenant",person,"terms",terms,"expectedCheckinDate",BusinessTime.today().toString(),"submit",send));
    }
    JsonNode call(String method,String path,String auth,Object body,String key,int expected)throws Exception{
        var b=HttpRequest.newBuilder(URI.create(base()+path)).header("Content-Type","application/json");if(auth!=null)b.header("Authorization","Bearer "+auth);if(key!=null)b.header("Idempotency-Key",key);
        var response=http.send(b.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(method+" "+path+" code="+json.readTree(response.body()).path("errorCode").asText()).isEqualTo(expected);
        evidence.add(Map.of("method",method,"path",path,"status",expected));return json.readTree(response.body());
    }
    String login(String email,String password,String role)throws Exception{return call("POST","/auth/login",null,Map.of("email",email,"password",password,"requestedRole",role),null,200).path("data").path("accessToken").asText();}
    long create(Place p,String email)throws Exception{return call("POST","/admin/contracts",owner,request(p,email,true),key(),201).path("data").path("id").asLong();}
    long tenantUser(long c){return f.db.sql("SELECT tenant_id FROM contracts WHERE id=:id").param("id",c).query(Long.class).single();}
    String status(long c){return f.db.sql("SELECT status FROM contracts WHERE id=:id").param("id",c).query(String.class).single();}
    void drain(){for(int i=0;i<10;i++){int done=worker.runBatch(BusinessTime.now().plusMinutes(10));jobs.deliver(BusinessTime.now().plusMinutes(10));if(done==0)break;}}
    String activation(String target)throws Exception{
        var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:18017/api/v1/messages")).GET().build(),HttpResponse.BodyHandlers.ofString());
        for(var message:json.readTree(response.body()).path("messages"))if(message.path("Subject").asText().contains("Kích hoạt"))for(var to:message.path("To"))if(to.path("Address").asText().equals(target)){
            var detail=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:18017/api/v1/message/"+message.path("ID").asText())).GET().build(),HttpResponse.BodyHandlers.ofString());
            String text=json.readTree(detail.body()).path("Text").asText();var matcher=java.util.regex.Pattern.compile("#token=([A-Za-z0-9_-]{43})").matcher(text);if(matcher.find())return matcher.group(1);
        }throw new AssertionError("Expected activation message in isolated Mailpit; message bodies not logged");
    }
    Map<String,Object> setupBody(String token){return Map.of("token",token,"newPassword",PASSWORD,"confirmPassword",PASSWORD);}
    @SuppressWarnings("unchecked")
    void sign(long contract){long uid=tenantUser(contract);setup.completeSetup(new InitialPasswordService.Setup(setup.issueSetupToken(uid),PASSWORD,PASSWORD));var v=(Map<String,Object>)onboarding.detail(f.owner,contract).get("contractVersion");var confirm=new ContractOnboardingService.Confirmation(((Number)v.get("version")).longValue(),v.get("content_hash").toString());onboarding.confirmContract(f.owner,contract,confirm);onboarding.confirmContract(new AuthenticatedUser(uid,"fixture",RoleCode.TENANT),contract,confirm);}
    @Test @Order(1) void newTenantIsProvisionedAndRequestReplayDoesNotDuplicate()throws Exception{
        var p=place();property=p.property();room=p.room();email="tenant17-"+key()+"@test.invalid";mainRequest=request(p,email,true);String key=key();
        var response=call("POST","/admin/contracts",owner,mainRequest,key,201).path("data");main=response.path("id").asLong();assertThat(response.path("status").asText()).isEqualTo("PENDING_CONFIRMATION");assertThat(response.toString()).doesNotContain("initialPassword","password_hash","token_hash");
        assertThat(call("POST","/admin/contracts",owner,mainRequest,key,201).path("data").path("id").asLong()).isEqualTo(main);user=tenantUser(main);
        assertThat(f.db.sql("SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=:id").param("id",user).query(String.class).list()).containsExactly("TENANT");
        assertThat(f.db.sql("SELECT COUNT(*) FROM users WHERE email=:email").param("email",email).query(Long.class).single()).isOne();assertThat(f.db.sql("SELECT status FROM rooms WHERE id=:id").param("id",room).query(String.class).single()).isEqualTo("READY");
        deposit=f.db.sql("SELECT id FROM tenant_deposits WHERE contract_id=:id").param("id",main).query(Long.class).single();assertThat(f.db.sql("SELECT balance_amount FROM tenant_deposits WHERE id=:id").param("id",deposit).query(BigDecimal.class).single()).isZero();
    }
    @Test @Order(2) void mailpitReceivesActivationAndContractAfterCommitOnly()throws Exception{
        drain();rawSetup=activation(email);String stored=f.db.sql("SELECT token_hash FROM account_password_setups WHERE user_id=:id").param("id",user).query(String.class).single();assertThat(stored).isEqualTo(InitialPasswordService.tokenHash(rawSetup)).isNotEqualTo(rawSetup);
        assertThat(f.db.sql("SELECT body FROM communication_deliveries WHERE source_id=:id AND source_type='CONTRACT'").param("id",main).query(String.class).list()).noneMatch(body->body.contains(rawSetup)||body.contains(PASSWORD));
        assertThat(f.db.sql("SELECT COUNT(*) FROM communication_deliveries WHERE source_id=:id AND channel='EMAIL' AND status='SENT'").param("id",main).query(Long.class).single()).isEqualTo(2);
    }
    @Test @Order(3) void setupIsOneTimeAndTenantCanLoginAndViewOnlyOwnContract()throws Exception{
        call("POST","/auth/password-setup",null,setupBody(rawSetup),null,200);call("POST","/auth/password-setup",null,setupBody(rawSetup),null,400);
        tenant=login(email,PASSWORD,"TENANT");call("GET","/tenant/contracts/"+main,tenant,null,null,200);call("GET","/tenant/contracts/"+f.legacyContract,tenant,null,null,403);
        assertThat(f.db.sql("SELECT must_change_password FROM users WHERE id=:id").param("id",user).query(Boolean.class).single()).isFalse();
    }
    @Test @Order(4) void bothPartiesConfirmSameVersionWithoutActivatingRoom()throws Exception{
        var detail=call("GET","/tenant/contract-onboarding/"+main,tenant,null,null,200).path("data");var v=detail.path("contractVersion");var confirmation=Map.of("version",v.path("version").asLong(),"contentHash",v.path("content_hash").asText());
        call("POST","/tenant/contract-onboarding/"+main+"/confirmations",tenant,confirmation,null,200);call("POST","/admin/contract-onboarding/"+main+"/confirmations",owner,confirmation,null,200);
        assertThat(onboarding.detail(f.owner,main).get("contractConfirmed")).isEqualTo(true);assertThat(status(main)).isEqualTo("PENDING_CONFIRMATION");drain();
    }
    @Test @Order(5) void unverifiedTransferCannotPostAndConfirmedCashIsIdempotentAndNotRentRevenue()throws Exception{
        var cash=new LinkedHashMap<String,Object>(Map.of("amount",1000,"method","BANK_TRANSFER","occurredAt",BusinessTime.now().minusSeconds(3).toString(),"reference","P17-TRANSFER-"+main,"evidence","Synthetic receipt","reason","Verified actual receipt fixture","reconciled",false));
        call("POST","/accountant/deposit-ledger/"+deposit+"/collections",accountant,cash,key(),409);assertThat(f.db.sql("SELECT balance_amount FROM tenant_deposits WHERE id=:id").param("id",deposit).query(BigDecimal.class).single()).isZero();
        cash.put("method","CASH");String key=key();call("POST","/accountant/deposit-ledger/"+deposit+"/collections",accountant,cash,key,200);call("POST","/accountant/deposit-ledger/"+deposit+"/collections",accountant,cash,key,200);
        assertThat(f.db.sql("SELECT balance_amount FROM tenant_deposits WHERE id=:id").param("id",deposit).query(BigDecimal.class).single()).isEqualByComparingTo("1000");assertThat(f.db.sql("SELECT COUNT(*) FROM deposit_transactions WHERE deposit_id=:id AND transaction_type='COLLECT'").param("id",deposit).query(Long.class).single()).isOne();
        assertThat(f.db.sql("SELECT COUNT(*) FROM payments py JOIN invoices i ON i.id=py.invoice_id WHERE i.property_id=:p").param("p",property).query(Long.class).single()).isZero();call("GET","/tenant/deposit-ledger/"+deposit,tenant,null,null,200);drain();
    }
    @Test @Order(6) @SuppressWarnings("unchecked") void checkinRequiresIdentityAndHandoverThenSynchronizesResidence()throws Exception{
        long ci=lifecycle.prepareCheckin(f.owner,new PrepareCheckin(main,null,BusinessTime.today(),null,null)).id();
        var completion=new CompleteCheckin(true,true,true,BigDecimal.ZERO,BigDecimal.ZERO,1,"Synthetic handover",1L);
        assertThatThrownBy(()->lifecycle.completeCheckin(f.owner,ci,completion)).isInstanceOf(RuntimeException.class);
        var identity=(Map<String,Object>)onboarding.detail(f.owner,main).get("identityProfile");onboarding.verifyIdentityReviewed(f.owner,main,new ContractOnboardingService.IdentityReview("QA17 reviewed synthetic identity",true,identity.get("dataHash").toString()));
        onboarding.saveHandover(f.owner,main,new ContractOnboardingService.Handover(0L,BusinessTime.today(),BigDecimal.ZERO,BigDecimal.ZERO,1,"QA17 handover"));
        var hv=(Map<String,Object>)onboarding.detail(f.owner,main).get("handoverVersion");onboarding.confirmHandover(new AuthenticatedUser(user,email,RoleCode.TENANT),main,new ContractOnboardingService.Confirmation(((Number)hv.get("version")).longValue(),hv.get("content_hash").toString()));
        lifecycle.completeCheckin(f.owner,ci,completion);assertThat(status(main)).isEqualTo("ACTIVE");assertThat(f.db.sql("SELECT status FROM rooms WHERE id=:id").param("id",room).query(String.class).single()).isEqualTo("OCCUPIED");assertThat(f.db.sql("SELECT COUNT(*) FROM tenant_residences WHERE contract_id=:id AND status='ACTIVE'").param("id",main).query(Long.class).single()).isOne();
    }
    @Test @Order(7) void missingEmailAndConflictingExistingIdentityKeepDraftWithoutCreatingAccount()throws Exception{
        var p=place();var draft=call("POST","/admin/contracts",owner,request(p,null,true),key(),201).path("data");assertThat(draft.path("status").asText()).isEqualTo("DRAFT");assertThat(draft.path("continuationCode").asText()).isEqualTo("ACCOUNT_PROVISIONING_CONFLICT");
        String collision="collision-"+key()+"@test.invalid";f.insert("INSERT INTO users(email,password_hash,full_name) VALUES('"+collision+"','unmodified-existing-hash','Existing unrelated identity')");
        var other=call("POST","/admin/contracts",owner,request(place(),collision,true),key(),201).path("data");assertThat(other.path("status").asText()).isEqualTo("DRAFT");assertThat(f.db.sql("SELECT COUNT(*) FROM users WHERE email=:email").param("email",collision).query(Long.class).single()).isOne();
        assertThat(f.db.sql("SELECT password_hash FROM users WHERE email=:email").param("email",collision).query(String.class).single()).isEqualTo("unmodified-existing-hash");
    }
    @Test @Order(8) void expiredSetupCannotBeUsed()throws Exception{
        String address="expire-"+key()+"@test.invalid";long c=create(place(),address),u=tenantUser(c);String token=setup.issueSetupToken(u);
        f.db.sql("UPDATE account_password_setups SET expires_at=DATE_SUB(UTC_TIMESTAMP(6),INTERVAL 1 SECOND) WHERE user_id=:id").param("id",u).update();call("POST","/auth/password-setup",null,setupBody(token),null,400);
    }
    @Test @Order(9) void concurrentSameRequestCreatesOneContractAndOneAccount()throws Exception{
        var request=request(place(),"concurrent-"+key()+"@test.invalid",true);String key=key();
        try(var pool=Executors.newFixedThreadPool(2)){
            Callable<Long> create=()->call("POST","/admin/contracts",owner,request,key,201).path("data").path("id").asLong();var a=pool.submit(create);var b=pool.submit(create);assertThat(a.get(40,TimeUnit.SECONDS)).isEqualTo(b.get(40,TimeUnit.SECONDS));
        }
    }
    @Test @Order(10) void missingSmtpCanBeRetriedWithoutNewContractOrAccount()throws Exception{
        drain();String address="retry-"+key()+"@test.invalid";long c=create(place(),address),u=tenantUser(c);
        var missing=new ContractDeliveryService(f.db,guard,setup,new StaticListableBeanFactory().getBeanProvider(EmailService.class),true,"http://127.0.0.1:13000");
        worker.contractDelivery(missing);try{drain();}finally{worker.contractDelivery(deliveries);}
        assertThat(status(c)).isEqualTo("PENDING_CONFIRMATION");assertThat(f.db.sql("SELECT COUNT(*) FROM communication_deliveries WHERE source_id=:id AND channel='EMAIL' AND status='FAILED' AND result_code='SMTP_NOT_CONFIGURED'").param("id",c).query(Long.class).single()).isEqualTo(2);
        String key=key();call("POST","/admin/contracts/"+c+"/delivery/resend",owner,Map.of(),key,200);call("POST","/admin/contracts/"+c+"/delivery/resend",owner,Map.of(),key,200);drain();activation(address);
        assertThat(tenantUser(c)).isEqualTo(u);assertThat(f.db.sql("SELECT COUNT(*) FROM users WHERE email=:email").param("email",address).query(Long.class).single()).isOne();
    }
    @Test @Order(11) void existingProfileWithoutAccountCanContinueDraftAndLinkedAccountPasswordIsPreserved()throws Exception{
        var p=place();String address="profile-"+key()+"@test.invalid";var draft=call("POST","/admin/contracts",owner,request(p,address,false),key(),201).path("data");long c=draft.path("id").asLong();
        call("POST","/admin/contracts/"+c+"/submit",owner,Map.of(),null,200);long uid=tenantUser(c);String before=f.db.sql("SELECT password_hash FROM users WHERE id=:id").param("id",uid).query(String.class).single();
        var original=request(p,address,true);original.remove("newTenant");original.put("tenantProfileId",f.db.sql("SELECT tenant_profile_id FROM contracts WHERE id=:id").param("id",c).query(Long.class).single());
        // Retry an existing submitted contract reuses its account and credential, never resets it.
        call("POST","/admin/contracts/"+c+"/submit",owner,Map.of(),null,200);assertThat(f.db.sql("SELECT password_hash FROM users WHERE id=:id").param("id",uid).query(String.class).single()).isEqualTo(before);
        assertThat(f.db.sql("SELECT COUNT(*) FROM tenant_profiles WHERE user_id=:id").param("id",uid).query(Long.class).single()).isOne();
    }
    @Test @Order(12) @SuppressWarnings("unchecked") void changedContentRequiresBothPartiesToReconfirmAndRejectsOldVersion()throws Exception{
        long c=create(place(),"revision-"+key()+"@test.invalid");sign(c);var old=(Map<String,Object>)onboarding.detail(f.owner,c).get("contractVersion");
        var draft=call("GET","/admin/contracts/"+c+"/agreement",owner,null,null,200).path("data");var terms=new LinkedHashMap<String,Object>(json.convertValue(draft.path("request").path("terms"),Map.class));terms.put("monthlyRent",1600000);var revision=Map.of("terms",terms,"reason","Revised agreed rent fixture","version",old.get("version"),"contentHash",old.get("content_hash"));call("PUT","/admin/contract-onboarding/"+c+"/terms",owner,revision,null,200);call("PUT","/admin/contract-onboarding/"+c+"/terms",owner,revision,null,409);
        assertThat(onboarding.detail(f.owner,c).get("contractConfirmed")).isEqualTo(false);var confirmation=new ContractOnboardingService.Confirmation(((Number)old.get("version")).longValue(),old.get("content_hash").toString());
        assertThatThrownBy(()->onboarding.confirmContract(f.owner,c,confirmation)).hasMessageContaining("Nội dung đã thay đổi");
        var current=(Map<String,Object>)onboarding.detail(f.owner,c).get("contractVersion");assertThat(((Number)current.get("version")).longValue()).isGreaterThan(((Number)old.get("version")).longValue());
        assertThat(f.db.sql("SELECT COUNT(*) FROM rental_confirmations rc JOIN contract_versions cv ON cv.id=rc.contract_version_id WHERE cv.contract_id=:id").param("id",c).query(Long.class).single()).isEqualTo(2);
    }
    @Test @Order(13) @SuppressWarnings("unchecked") void lockedTenantCannotConfirmAndUnsignedDirectContractCannotCollectDeposit()throws Exception{
        String address="locked-"+key()+"@test.invalid";long c=create(place(),address),uid=tenantUser(c);setup.completeSetup(new InitialPasswordService.Setup(setup.issueSetupToken(uid),PASSWORD,PASSWORD));var v=(Map<String,Object>)onboarding.detail(f.owner,c).get("contractVersion");
        long d=f.db.sql("SELECT id FROM tenant_deposits WHERE contract_id=:id").param("id",c).query(Long.class).single();
        assertThatThrownBy(()->ledger.collect(f.owner,d,key(),new DepositLedgerService.Cash(new BigDecimal("1000"),"CASH",BusinessTime.now().minusSeconds(3),null,"Synthetic","Receipt",false))).hasMessageContaining("Hai bên");
        f.db.sql("UPDATE users SET status='LOCKED' WHERE id=:id").param("id",uid).update();
        assertThatThrownBy(()->onboarding.confirmContract(new AuthenticatedUser(uid,address,RoleCode.TENANT),c,new ContractOnboardingService.Confirmation(((Number)v.get("version")).longValue(),v.get("content_hash").toString()))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
        assertThat(f.db.sql("SELECT balance_amount FROM tenant_deposits WHERE id=:id").param("id",d).query(BigDecimal.class).single()).isZero();
    }
    @Test @Order(14) void bankTransferStaysPendingUntilAuthorizedReviewAndReplayDoesNotDoublePost()throws Exception{
        String address="bank-"+key()+"@test.invalid";long c=create(place(),address);sign(c);String auth=login(address,PASSWORD,"TENANT");long d=f.db.sql("SELECT id FROM tenant_deposits WHERE contract_id=:id").param("id",c).query(Long.class).single();
        var proof=Map.of("bankReference","P17-BANK-"+c,"evidence","Synthetic bank evidence","amount",1);String key=key();
        var pending=call("POST","/tenant/deposit-ledger/"+d+"/transfer-requests",auth,proof,key,200).path("data");assertThat(pending.path("status").asText()).isEqualTo("PENDING");assertThat(pending.path("amount").decimalValue()).isEqualByComparingTo("1000");long request=pending.path("id").asLong();
        assertThat(call("POST","/tenant/deposit-ledger/"+d+"/transfer-requests",auth,proof,key,200).path("data").path("id").asLong()).isEqualTo(request);
        assertThat(f.db.sql("SELECT balance_amount FROM tenant_deposits WHERE id=:id").param("id",d).query(BigDecimal.class).single()).isZero();call("GET","/tenant/deposit-ledger/"+d+"/transfer-requests",tenant,null,null,403);
        try(var pool=Executors.newFixedThreadPool(2)){
            Callable<Long> approve=()->call("POST","/accountant/deposit-ledger/"+d+"/transfer-requests/"+request+"/review",accountant,Map.of("approve",true,"reason","Reviewed synthetic bank receipt"),null,200).path("data").path("ledger_transaction_id").asLong();
            var a=pool.submit(approve);var b=pool.submit(approve);assertThat(a.get(30,TimeUnit.SECONDS)).isEqualTo(b.get(30,TimeUnit.SECONDS));
        }
        assertThat(f.db.sql("SELECT balance_amount FROM tenant_deposits WHERE id=:id").param("id",d).query(BigDecimal.class).single()).isEqualByComparingTo("1000");assertThat(f.db.sql("SELECT COUNT(*) FROM deposit_transactions WHERE deposit_id=:id AND transaction_type='COLLECT'").param("id",d).query(Long.class).single()).isOne();
    }
    @Test @Order(15) void businessMailOffDoesNotIssueTokenOrLoseContract()throws Exception{
        long c=create(place(),"disabled-"+key()+"@test.invalid");var delivery=f.db.sql("SELECT * FROM communication_deliveries WHERE source_id=:id AND source_key LIKE 'ONBOARD:ACTIVATE:%' AND channel='EMAIL'").param("id",c).query().singleRow();
        var disabled=new ContractDeliveryService(f.db,guard,setup,new StaticListableBeanFactory(Map.of("email",mail)).getBeanProvider(EmailService.class),false,"http://127.0.0.1:13000");
        assertThat(disabled.send(delivery).code()).isEqualTo("BUSINESS_EMAIL_DISABLED");assertThat(f.db.sql("SELECT token_hash FROM account_password_setups WHERE user_id=:id").param("id",tenantUser(c)).query(String.class).optional()).isEmpty();assertThat(status(c)).isEqualTo("PENDING_CONFIRMATION");
    }
    @Test @Order(16) void preexistingLinkedTenantIsReusedWithoutPasswordResetOrActivation()throws Exception{
        var p=place();String address="existing-"+key()+"@test.invalid",hash=passwords.encode(PASSWORD);long uid=f.insert("INSERT INTO users(email,password_hash,full_name) VALUES('"+address+"','"+hash+"','Existing linked tenant')");
        f.db.sql("INSERT INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE code='TENANT'").param("id",uid).update();
        long profile=f.insert("INSERT INTO tenant_profiles(user_id,tenant_code,full_name,phone,email,management_property_id,created_by) VALUES("+uid+",'EX-"+uid+"','Existing linked tenant','09"+String.format("%08d",p.room()+1700)+"','"+address+"',"+p.property()+",1)");
        var request=request(p,address,true);request.remove("newTenant");request.put("tenantProfileId",profile);long c=call("POST","/admin/contracts",owner,request,key(),201).path("data").path("id").asLong();
        assertThat(tenantUser(c)).isEqualTo(uid);assertThat(f.db.sql("SELECT password_hash FROM users WHERE id=:id").param("id",uid).query(String.class).single()).isEqualTo(hash);
        assertThat(f.db.sql("SELECT COUNT(*) FROM account_password_setups WHERE user_id=:id").param("id",uid).query(Long.class).single()).isZero();assertThat(f.db.sql("SELECT COUNT(*) FROM communication_deliveries WHERE source_id=:id AND source_key LIKE 'ONBOARD:ACTIVATE:%'").param("id",c).query(Long.class).single()).isZero();
    }
    @Test @Order(17) @SuppressWarnings("unchecked") void tenantReviewPausesConfirmationUntilLandlordRespondsAndReplaysDoNotDuplicate()throws Exception{
        String address="review-"+key()+"@test.invalid";long c=create(place(),address),uid=tenantUser(c);setup.completeSetup(new InitialPasswordService.Setup(setup.issueSetupToken(uid),PASSWORD,PASSWORD));String auth=login(address,PASSWORD,"TENANT");
        var v=(Map<String,Object>)onboarding.detail(f.owner,c).get("contractVersion");var confirm=Map.of("version",v.get("version"),"contentHash",v.get("content_hash"));
        call("POST","/admin/contract-onboarding/"+c+"/confirmations",owner,confirm,null,200);
        var review=Map.of("decision","REQUEST_CHANGES","reason","Please clarify the synthetic service clause","version",v.get("version"),"contentHash",v.get("content_hash"));String key=key();
        var rows=call("POST","/tenant/contract-onboarding/"+c+"/reviews",auth,review,key,200).path("data");long request=rows.get(0).path("id").asLong();call("POST","/tenant/contract-onboarding/"+c+"/reviews",auth,review,key,200);
        call("POST","/tenant/contract-onboarding/"+c+"/confirmations",auth,confirm,null,409);call("POST","/tenant/contract-onboarding/"+c+"/reviews",tenant,review,key(),403);
        call("POST","/admin/contract-onboarding/"+c+"/reviews/"+request+"/response",owner,Map.of("reason","Synthetic clarification: no additional charge"),null,200);
        call("POST","/tenant/contract-onboarding/"+c+"/confirmations",auth,confirm,null,200);assertThat(onboarding.detail(f.owner,c).get("contractConfirmed")).isEqualTo(true);
        assertThat(f.db.sql("SELECT COUNT(*) FROM contract_review_requests WHERE contract_id=:id").param("id",c).query(Long.class).single()).isOne();
    }
    @Test @Order(18) @SuppressWarnings("unchecked") void revisedContentSupersedesDeclinedVersionWithoutSigningOrCancellingForTenant()throws Exception{
        String address="decline-"+key()+"@test.invalid";long c=create(place(),address),uid=tenantUser(c);setup.completeSetup(new InitialPasswordService.Setup(setup.issueSetupToken(uid),PASSWORD,PASSWORD));String auth=login(address,PASSWORD,"TENANT");
        var v=(Map<String,Object>)onboarding.detail(f.owner,c).get("contractVersion");var request=Map.of("decision","DECLINE","reason","Synthetic rent requires correction","version",v.get("version"),"contentHash",v.get("content_hash"));String key=key();call("POST","/tenant/contract-onboarding/"+c+"/reviews",auth,request,key,200);
        var draft=call("GET","/admin/contracts/"+c+"/agreement",owner,null,null,200).path("data");var terms=new LinkedHashMap<String,Object>(json.convertValue(draft.path("request").path("terms"),Map.class));terms.put("monthlyRent",1400000);
        call("PUT","/admin/contract-onboarding/"+c+"/terms",owner,Map.of("terms",terms,"reason","Correct agreed rent fixture","version",v.get("version"),"contentHash",v.get("content_hash")),null,200);
        var history=call("GET","/tenant/contract-onboarding/"+c+"/reviews",auth,null,null,200).path("data");assertThat(history.get(0).path("status").asText()).isEqualTo("SUPERSEDED");
        call("POST","/tenant/contract-onboarding/"+c+"/reviews",auth,request,key,200);var detail=onboarding.detail(new AuthenticatedUser(uid,address,RoleCode.TENANT),c);assertThat(((Map<?,?>)detail.get("progress")).get("canConfirm")).isEqualTo(true);assertThat(detail.get("contractConfirmed")).isEqualTo(false);assertThat(status(c)).isEqualTo("PENDING_CONFIRMATION");
    }
    @Test @Order(19) @SuppressWarnings("unchecked") void revisionBeforeFirstActivationStillSendsOneCurrentSetupLink()throws Exception{
        drain();String address="early-revision-"+key()+"@test.invalid";long c=create(place(),address);
        var draft=call("GET","/admin/contracts/"+c+"/agreement",owner,null,null,200).path("data");var terms=new LinkedHashMap<String,Object>(json.convertValue(draft.path("request").path("terms"),Map.class));terms.put("monthlyRent",1450000);
        call("PUT","/admin/contract-onboarding/"+c+"/terms",owner,Map.of("terms",terms,"reason","Early corrected agreement","version",draft.path("version").asLong(),"contentHash",draft.path("contentHash").asText()),null,200);
        drain();String raw=activation(address);call("POST","/auth/password-setup",null,setupBody(raw),null,200);
        assertThat(f.db.sql("SELECT COUNT(*) FROM communication_deliveries WHERE source_id=:id AND source_key LIKE 'ONBOARD:ACTIVATE:%' AND status='SENT'").param("id",c).query(Long.class).single()).isOne();
    }
    @AfterAll void evidence()throws Exception{
        var dir=Path.of("../docs/qa/prompt17");Files.createDirectories(dir);Files.writeString(dir.resolve("http.json"),json.writeValueAsString(Map.of("cases",evidence,"smtp","isolated Mailpit only","productionDataTouched",false)));
        if(!Boolean.getBoolean("prompt17.browser"))return;
        var p=place();String run=key();Files.writeString(Path.of("D:/DATN/prompt17-browser-ready.json"),json.writeValueAsString(Map.of("runId",run,"api",base(),"propertyId",p.property(),"roomId",p.room(),"email","p03-1@test.invalid","password",PASSWORD,"tenantEmail","browser17-"+run+"@test.invalid","tenantPhone","09"+String.format("%08d",p.room()+1700),"mailpit","http://127.0.0.1:18017")));
        Path done=Path.of("D:/DATN/prompt17-browser-complete.json");long end=System.nanoTime()+Duration.ofMinutes(15).toNanos();while(System.nanoTime()<end){drain();if(Files.exists(done)){var r=json.readTree(Files.readString(done));if(run.equals(r.path("runId").asText())){assertThat(r.path("status").asText()).isEqualTo("PASS");return;}}Thread.sleep(250);}throw new AssertionError("Prompt17 browser timed out");
    }
}
