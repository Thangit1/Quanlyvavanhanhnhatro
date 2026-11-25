package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.BoardingHouseBackendApplication;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.*;
import com.thangit.boardinghouse.service.integration.IntegrationCenter;
import com.thangit.boardinghouse.service.integration.ZaloNotificationProvider;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.jdbc.datasource.DelegatingDataSource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Opt-in, persistent manual demo. This class is absent from production artifacts. */
public final class DemoRuntime {
    static final ZoneId ZONE=BusinessTime.ZONE;
    static final AtomicReference<Instant> instant=new AtomicReference<>();
    static final Clock CLOCK=new Clock(){public ZoneId getZone(){return ZONE;} public Clock withZone(ZoneId zone){return Clock.fixed(instant(),zone);} public Instant instant(){return instant.get();}};
    static Path directory;
    static String password;
    final JdbcClient db;
    final JsonMapper json;
    final org.springframework.context.ConfigurableApplicationContext context;
    final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    final Map<String,String> tokens=new HashMap<>();
    final List<Map<String,Object>> fixtures=new ArrayList<>();
    final AuthenticatedUser owner=new AuthenticatedUser(1L,"owner@test.invalid",RoleCode.OWNER);
    final AuthenticatedUser accountant=new AuthenticatedUser(3L,"accountant@test.invalid",RoleCode.ACCOUNTANT);
    long property,building,floor;
    DemoRuntime(org.springframework.context.ConfigurableApplicationContext c){context=c;db=c.getBean(JdbcClient.class);json=c.getBean(JsonMapper.class);}

    public static void main(String[] args)throws Exception {
        if(!"LOCAL_TEST_ONLY".equals(System.getenv("DEMO_CONFIRM")))throw new IllegalStateException("Set DEMO_CONFIRM=LOCAL_TEST_ONLY explicitly.");
        password=Objects.requireNonNull(System.getenv("DEMO_PASSWORD"),"DEMO_PASSWORD required");
        if(password.length()<14)throw new IllegalArgumentException("Use a generated password of at least 14 characters.");
        directory=Path.of(required("DEMO_DIRECTORY")).toAbsolutePath().normalize();Files.createDirectories(directory);
        String schema=System.getenv().getOrDefault("DEMO_DB_NAME","boarding_house_e2e_test");
        if(!schema.matches("boarding_house_e2e_test(?:_[a-z0-9_]{1,35})?"))throw new IllegalArgumentException("Demo schema name rejected");
        int mysql=Integer.parseInt(System.getenv().getOrDefault("DEMO_MYSQL_PORT","3317"));
        if(mysql==3306)throw new IllegalArgumentException("Default application MySQL port is prohibited");
        String user=System.getenv().getOrDefault("DEMO_MYSQL_USER","root"),secret=System.getenv().getOrDefault("DEMO_MYSQL_PASSWORD","");
        String server="jdbc:mysql://127.0.0.1:"+mysql+"/",options="?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Ho_Chi_Minh";
        boolean fresh;
        try(var connection=DriverManager.getConnection(server+options,user,secret);var query=connection.prepareStatement("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name=?")){
            query.setString(1,schema);try(var result=query.executeQuery()){result.next();fresh=result.getInt(1)==0;}
            if(fresh)try(var statement=connection.createStatement()){statement.execute("CREATE DATABASE `"+schema+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");}
        }
        String url=server+schema+options;
        if(!fresh)try(var connection=DriverManager.getConnection(url,user,secret);var statement=connection.createStatement();var result=statement.executeQuery("SELECT state FROM demo_run WHERE id=1")){
            if(!result.next()||!"COMPLETE".equals(result.getString(1)))throw new IllegalStateException("Incomplete or unmarked schema. Preserve it and select a NEW DEMO_DB_NAME.");
        }
        Flyway.configure().dataSource(url,user,secret).load().migrate();
        if(fresh)try(var connection=DriverManager.getConnection(url,user,secret);var statement=connection.createStatement()){
            statement.execute("CREATE TABLE demo_run(id INT PRIMARY KEY,state VARCHAR(20) NOT NULL)");statement.execute("INSERT INTO demo_run VALUES(1,'INITIALIZING')");
            String hash=new BCryptPasswordEncoder().encode(password);
            for(var entry:Map.of(1,"OWNER",2,"MANAGER",3,"ACCOUNTANT",6,"TECHNICIAN").entrySet()){
                try(var insert=connection.prepareStatement("INSERT INTO users(id,email,password_hash,full_name) VALUES(?,?,?,?)")){
                    insert.setInt(1,entry.getKey());insert.setString(2,entry.getValue().toLowerCase()+"@test.invalid");insert.setString(3,hash);insert.setString(4,"TEST "+entry.getValue());insert.executeUpdate();
                }
                statement.executeUpdate("INSERT INTO user_roles(user_id,role_id) SELECT "+entry.getKey()+",id FROM roles WHERE code='"+entry.getValue()+"'");
            }
            statement.executeUpdate("INSERT INTO accountant_profiles(user_id,employee_code) VALUES(3,'TEST-ACCOUNTANT')");
            statement.executeUpdate("INSERT INTO technician_profiles(user_id,employee_code) VALUES(6,'TEST-TECHNICIAN')");
        }
        Path clockFile=directory.resolve("clock.txt");
        if(fresh||!Files.exists(clockFile))Files.writeString(clockFile,"2026-10-01");
        changeDate(Files.readString(clockFile).trim());
        ReflectionTestUtils.setField(BusinessTime.class,"clock",CLOCK);
        String jwt=required("DEMO_JWT_SECRET");if(jwt.length()<40)throw new IllegalArgumentException("DEMO_JWT_SECRET must have 40+ characters");
        var application=new SpringApplication(BoardingHouseBackendApplication.class,DemoConfiguration.class);
        var c=application.run("--spring.profiles.active=dev,e2e-demo","--server.address=127.0.0.1","--server.port=18083",
            "--spring.datasource.url="+url,"--spring.datasource.username="+user,"--spring.datasource.password="+secret,
            "--spring.flyway.url="+url,"--spring.flyway.user="+user,"--spring.flyway.password="+secret,
            "--app.security.jwt.secret="+jwt,"--app.scheduling.enabled=false","--app.ai.provider=none","--app.communications.reminder-email.enabled=true",
            "--app.cors.allowed-origins=http://127.0.0.1:13000","--app.media.property-root="+directory.resolve("property-images"),
            "--app.security.cookie.name=demo_refresh_token","--app.security.cookie.secure=false","--app.security.login.rate-limit-max=10000",
            "--app.payments.simulation-enabled=true","--app.payments.vietqr-template=compact2",
            "--INTEGRATION_1_PAYMENT_VNPAY_HASH_KEY=","--INTEGRATION_1_PAYMENT_MOMO_ACCESS_KEY=","--INTEGRATION_1_PAYMENT_MOMO_SECRET_KEY=",
            "--app.mail.business-delivery-enabled=true","--app.frontend-url=http://127.0.0.1:13000",
            "--spring.mail.host=127.0.0.1","--spring.mail.port=11025","--spring.mail.username=demo","--spring.mail.password=test-only",
            "--spring.mail.properties.mail.smtp.auth=false","--spring.mail.properties.mail.smtp.starttls.enable=false",
            "--spring.mail.properties.mail.smtp.starttls.required=false","--spring.mail.properties.mail.smtp.timeout=5000",
            "--spring.mail.properties.mail.smtp.connectiontimeout=3000","--app.mail.from=smarthome@test.invalid",
            "--INTEGRATION_MASTER_KEY=","--INTEGRATION_SMTP_HOSTS=127.0.0.1","--INTEGRATION_ALLOW_LOCAL_SMTP=true",
            "--INTEGRATION_TEST_RECIPIENTS="+DemoSmtpSandbox.RECIPIENTS,"--MAIL_TEST_RECIPIENT=",
            "--INTEGRATION_1_ZALO_ACCESS_TOKEN=local-demo-only","--INTEGRATION_ZALO_TEST_UIDS=42424242",
            "--INTEGRATION_ZALO_LIVE_TEST=false","--logging.level.com.thangit.boardinghouse=INFO");
        try(c;var sandbox=new DemoSmtpSandbox(directory)){
            DemoRuntime demo=new DemoRuntime(c);
            demo.configureIntegrationFixtures();
            if(fresh){demo.seed();demo.db.sql("UPDATE demo_run SET state='COMPLETE' WHERE id=1").update();}
            else if(!Files.exists(directory.resolve("manifest.json")))throw new IllegalStateException("Manifest missing; do not reseed an existing schema");
            long demoProperty=demo.json.readTree(Files.readString(directory.resolve("manifest.json"))).path("propertyId").asLong();
            demo.ensureCatalog(demoProperty);
            demo.refreshDemoZaloTemplates();
            if(demo.db.sql("SELECT COUNT(*) FROM communication_rules WHERE property_id=:id AND event_type='INVOICE_OVERDUE' AND offset_days=5").param("id",demoProperty).query(Long.class).single()==0)c.getBean(CommunicationService.class).saveRule(demo.owner,null,new CommunicationService.Rule(demoProperty,"INVOICE_OVERDUE","TENANT",5,9,5,true,0));
            Files.deleteIfExists(directory.resolve("stop"));Files.writeString(directory.resolve("ready"),schema);Files.writeString(directory.resolve("clock-status.txt"),BusinessTime.now().toString());
            System.out.println("DEMO READY: API http://127.0.0.1:18083/api | SMTP inbox http://127.0.0.1:18025 | private manifest "+directory.resolve("manifest.json"));
            String previous=Files.readString(clockFile).trim();
            while(!Files.exists(directory.resolve("stop"))){
                Thread.sleep(1000);String value=Files.readString(clockFile).trim();
                if(!value.equals(previous)){try{changeDate(value);previous=value;demo.refreshDemoZaloTemplates();Files.writeString(directory.resolve("clock-status.txt"),BusinessTime.now().toString());}catch(RuntimeException e){Files.writeString(directory.resolve("clock-status.txt"),"REJECTED: "+value);}}
                demo.runCommunicationJobs();
                if(Files.deleteIfExists(directory.resolve("verify"))){
                    try {new DemoVerification(demo).run();previous=Files.readString(clockFile).trim();Files.writeString(directory.resolve("clock-status.txt"),BusinessTime.now().toString());}
                    catch(Exception failure){Files.writeString(directory.resolve("verification-error.txt"),failure.toString());}
                }
            }
        } finally {Files.deleteIfExists(directory.resolve("ready"));}
    }
    static String required(String name){return Objects.requireNonNull(System.getenv(name),name+" required");}
    static void changeDate(String date){LocalDate day=LocalDate.parse(date);if(day.isBefore(LocalDate.of(2026,10,1))||day.isAfter(LocalDate.of(2027,12,31)))throw new IllegalArgumentException("Demo date outside allowlist range");instant.set(day.atTime(12,0).atZone(ZONE).toInstant());}

    @TestConfiguration(proxyBeanMethods=false)
    static class DemoConfiguration {
        @Bean static BeanPostProcessor demoSessionTime(){return new BeanPostProcessor(){@Override public Object postProcessAfterInitialization(Object bean,String name){
            if(bean instanceof DataSource dataSource && !(bean instanceof DelegatingDataSource))return new DelegatingDataSource(dataSource){
                @Override public Connection getConnection()throws SQLException{return initialize(super.getConnection());}
                @Override public Connection getConnection(String u,String p)throws SQLException{return initialize(super.getConnection(u,p));}
                Connection initialize(Connection connection)throws SQLException{try(var statement=connection.createStatement()){statement.execute("SET time_zone='+07:00'");statement.execute("SET timestamp="+instant.get().getEpochSecond());return connection;}catch(SQLException e){connection.close();throw e;}}
            };return bean;
        }};}
    }

    void runCommunicationJobs() {
        var now=BusinessTime.now();
        var jobs=context.getBean(CommunicationJobs.class);
        jobs.scan(now);
        jobs.deliver(now);
        context.getBean(ExternalCommunicationWorker.class).runBatch(now);
    }

    @SuppressWarnings("unchecked")
    void configureIntegrationFixtures() throws Exception {
        var zalo=context.getBean(ZaloNotificationProvider.class);
        var transport=org.mockito.Mockito.mock(HttpClient.class);
        org.mockito.Mockito.doAnswer(invocation->{
            HttpRequest request=invocation.getArgument(0);
            String responseBody=switch(request.uri().getPath()) {
                case "/v3.0/oa/getoa" -> "{\"error\":0,\"data\":{\"oa_id\":\"1111\"}}";
                case "/template/all" -> "{\"error\":0,\"data\":[{\"template_id\":\"9091\",\"template_name\":\"TEST - Nhac han hoa don\",\"status\":\"ENABLE\"}]}";
                default -> throw new IllegalStateException("The demo Zalo transport supports local fixtures only");
            };
            var response=org.mockito.Mockito.mock(HttpResponse.class);
            org.mockito.Mockito.when(response.statusCode()).thenReturn(200);
            org.mockito.Mockito.when(response.body()).thenReturn(responseBody);
            return response;
        }).when(transport).send(org.mockito.ArgumentMatchers.any(HttpRequest.class),org.mockito.ArgumentMatchers.any(HttpResponse.BodyHandler.class));
        ReflectionTestUtils.setField(zalo,"http",transport);

        var center=context.getBean(IntegrationCenter.class);
        if(center.config(1,"EMAIL").version()==0){
            center.save(owner,"EMAIL",new IntegrationCenter.Save("SMTP","TEST",true,Map.of(
                "host","127.0.0.1","port",11025,"tlsMode","NONE","authentication",false,
                "fromEmail","smarthome@test.invalid","fromName","SmartHome AI TEST"),Map.of(),0));
        }
        if(center.config(1,"ZALO").version()==0){
            center.save(owner,"ZALO",new IntegrationCenter.Save("ZBS","TEST",true,Map.of(
                "oaId","1111","appId","2222","oaName","TEST - Zalo OA mô phỏng",
                "templateMappings",Map.of("INVOICE_BEFORE_DUE","9091"),
                "templateParameters",Map.of("INVOICE_BEFORE_DUE",Map.of("invoice_code","invoice_code","amount","remaining_amount"))),Map.of(),0));
        }
    }

    void refreshDemoZaloTemplates() {
        var center=context.getBean(IntegrationCenter.class);
        center.execute(owner,"ZALO","SYNC_TEMPLATES",UUID.randomUUID().toString(),null);
        center.execute(owner,"ZALO","TEST_SEND",UUID.randomUUID().toString(),new IntegrationCenter.TestRequest(
            "42424242","9091",Map.of("invoice_code","DEMO-001","amount","4200000")));
    }

    JsonNode call(String role,String method,String path,Object body,int expected)throws Exception{
        if(!tokens.containsKey(role)){
            var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:18083/api/auth/login")).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("email",role.toLowerCase()+"@test.invalid","password",password,"requestedRole",role)))).build(),HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200)throw new IllegalStateException("Demo login failed: "+role+" "+response.statusCode());
            tokens.put(role,json.readTree(response.body()).path("data").path("accessToken").asText());
        }
        var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:18083/api"+path)).timeout(Duration.ofSeconds(30)).header("Authorization","Bearer "+tokens.get(role)).header("Content-Type","application/json").header("Idempotency-Key",UUID.randomUUID().toString()).method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
        if(response.statusCode()!=expected)throw new IllegalStateException(method+" "+path+" returned "+response.statusCode()+": "+response.body());
        return json.readTree(response.body()).path("data");
    }
    long version(String table,long id){return db.sql("SELECT version FROM "+table+" WHERE id=:id").param("id",id).query(Long.class).single();}
    static BigDecimal money(String value){return new BigDecimal(value);}
    void seed()throws Exception{
        property=call("OWNER","POST","/admin/properties",Map.of("code","TEST-HOUSE-01","name","Nhà trọ kiểm thử SmartHome AI","type","BOARDING_HOUSE","address","Địa chỉ giả lập TEST, không dùng giao dịch thật"),201).path("id").asLong();
        var organizations=context.getBean(OrganizationManagementService.class);
        long company=organizations.create(owner,new OrganizationManagementService.SaveOrganization("DEMO-COMPANY","SmartHome AI Demo Company","TEST ONLY"));
        organizations.link(owner,company,new OrganizationManagementService.LinkProperty(property,null,"TEST-AGREEMENT",BusinessTime.today(),"Synthetic demo environment"));
        building=call("OWNER","POST","/admin/properties/"+property+"/buildings",Map.of("code","TEST-A","name","Tòa TEST","displayOrder",0),201).path("id").asLong();
        floor=call("OWNER","POST","/admin/buildings/"+building+"/floors",Map.of("code","TEST-F1","name","Tầng TEST 1","floorNumber",1,"displayOrder",0),201).path("id").asLong();
        call("OWNER","PUT","/owner/access/properties/"+property+"/managers",Map.of("userId",2,"capabilities",List.of("CONTRACT_APPROVE","FINANCE_READ","FINANCE_WRITE","DEPOSIT_APPROVE","EXPORT"),"reason","TEST assignment"),200);
        var settings=context.getBean(AdminSettingService.class);
        settings.updateBilling(owner,new com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.UpdateBilling(false,28,5,false,false,false,"FIXED",BigDecimal.ZERO,List.of(2),List.of(1,5),true));
        settings.updateGroup(owner,"payments",new com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.UpdateGroup(Map.of("cashEnabled",true,"bankTransferEnabled",true,"bankName","TEST SANDBOX - DO NOT TRANSFER","bankBin","970436","accountName","TEST ONLY","accountNumber","0000000000","qrEnabled",true,"transferContent","TEST {invoiceCode}")));
        db.sql("INSERT INTO accountant_property_assignments(accountant_id,property_id,granted_by) VALUES(3,:p,1)").param("p",property).update();
        db.sql("INSERT INTO technician_property_assignments(technician_id,property_id,granted_by) VALUES(6,:p,1)").param("p",property).update();
        ensureCatalog(property);
        fixture("MANUAL",101,false);
        for(int i=0;i<6;i++)fixture(String.valueOf((char)('A'+i)),201+i,true);
        changeDate("2026-10-28");Files.writeString(directory.resolve("clock.txt"),"2026-10-28");
        context.getBean(com.thangit.boardinghouse.service.integration.IntegrationRuleInstaller.class).owner(owner.id());
        long activationContract=seedActivationExample();
        var manifest=new LinkedHashMap<String,Object>();manifest.put("companyId",company);manifest.put("propertyId",property);manifest.put("fixtures",fixtures);manifest.put("frontend","http://127.0.0.1:13000");manifest.put("api","http://127.0.0.1:18083/api");manifest.put("smtpInbox","http://127.0.0.1:18025");manifest.put("accounts",List.of("owner@test.invalid","manager@test.invalid","accountant@test.invalid","technician@test.invalid"));
        manifest.put("activationContractId",activationContract);
        Files.writeString(directory.resolve("manifest.json"),json.writeValueAsString(manifest));
    }

    long seedActivationExample() throws Exception {
        long room=call("OWNER","POST","/admin/rooms",Map.of("propertyId",property,"buildingId",building,"floorId",floor,
            "code","TEST-P102","name","Phòng kích hoạt mẫu","monthlyRent",3500000,"depositAmount",3500000,"capacity",2),201).path("id").asLong();
        call("OWNER","PATCH","/admin/rooms/"+room+"/status",Map.of("status","READY","reason","TEST readiness inspection",
            "version",version("rooms",room),"readinessConfirmed",true),200);
        var person=Map.of("fullName","Nguyễn Văn Test Kích Hoạt","phone","0900000102","email","tenant-activation@test.invalid",
            "dateOfBirth","2000-05-15","identityNumber","000000000102","permanentAddress","Địa chỉ giả lập TEST");
        var terms=Map.of("startDate",BusinessTime.today().toString(),"endDate",BusinessTime.today().plusYears(1).toString(),
            "depositAmount",3500000,"paymentDueDay",5,"noticePeriodDays",30,"monthlyRent",3500000,
            "utilityRates",List.of(new AgreedRate("ELECTRICITY","Điện TEST","METER",money("3500"),"kWh"),
                new AgreedRate("WATER","Nước TEST","METER",money("25000"),"m3")),
            "services",List.of(),"terms",List.of(),"initialPaymentRequired",false);
        return call("OWNER","POST","/admin/contracts",Map.of("roomId",room,"newTenant",person,"terms",terms,
            "expectedCheckinDate",BusinessTime.today().toString(),"submit",true),201).path("id").asLong();
    }
    void fixture(String scenario,int number,boolean active)throws Exception{
        long room=call("OWNER","POST","/admin/rooms",Map.of("propertyId",property,"buildingId",building,"floorId",floor,"code","TEST-P"+number,"name","Phòng kiểm thử "+number,"monthlyRent",3500000,"depositAmount",3500000,"capacity",2,"assets",List.of(Map.of("name","TEST bàn","quantity",1,"conditionStatus","GOOD"))),201).path("id").asLong();
        call("OWNER","PATCH","/admin/rooms/"+room+"/status",Map.of("status","READY","reason","TEST readiness inspection","version",version("rooms",room),"readinessConfirmed",true),200);
        for(String type:List.of("ELECTRICITY","WATER"))call("OWNER","POST","/admin/rooms/"+room+"/meters",new RoomMeterService.Install(type,"TEST-"+number+"-"+type,money(type.equals("ELECTRICITY")?"1200":"80"),"TEST-INSTALL","Synthetic fixture hardware"),200);
        String email="tenant-"+scenario.toLowerCase()+"@test.invalid";
        var person=new LinkedHashMap<String,Object>();person.put("fullName","Nguyễn Văn Test "+scenario);person.put("phone","0900000"+number);person.put("dateOfBirth","2000-05-15");person.put("identityType","CCCD");person.put("identityNumber","000000000"+number);person.put("permanentAddress","TEST synthetic identity fixture, no real identity verification");person.put("propertyId",property);person.put("residenceRole","REPRESENTATIVE");
        long profile=call("OWNER","POST","/admin/tenants",person,201).path("id").asLong();
        call("OWNER","POST","/admin/tenants/"+profile+"/account",Map.of("email",email,"temporaryPassword",password+"-Initial"),200);
        long tenant=db.sql("SELECT user_id FROM tenant_profiles WHERE id=:id").param("id",profile).query(Long.class).single();
        db.sql("INSERT INTO notification_preferences(user_id,email_enabled,zalo_enabled) VALUES(:id,TRUE,TRUE) ON DUPLICATE KEY UPDATE email_enabled=TRUE,zalo_enabled=TRUE")
            .param("id",tenant).update();
        var fixture=new LinkedHashMap<String,Object>();fixture.put("scenario",scenario);fixture.put("roomId",room);fixture.put("roomCode","TEST-P"+number);fixture.put("tenantProfileId",profile);fixture.put("tenantEmail",email);fixture.put("initialPasswordRequired",true);fixture.put("initialPasswordSuffix","-Initial");
        fixtures.add(fixture);if(!active)return;
        long booking=call("OWNER","POST","/admin/rental-lifecycle/bookings",new CreateBooking(profile,room,BusinessTime.today(),BusinessTime.today().plusDays(7),BigDecimal.ZERO,"TENANT_REQUEST","TEST fixture tenant request"),201).path("id").asLong();
        var terms=new CreateContract(LocalDate.of(2026,10,1),LocalDate.of(2027,9,30),money("3500000"),5,30,null,money("3500000"),List.of(new AgreedRate("ELECTRICITY","Điện TEST","METER",money("3500"),"kWh"),new AgreedRate("WATER","Nước TEST","METER",money("25000"),"m3")),List.of(agreed("INTERNET","Internet TEST","100000",property),agreed("CLEANING","Vệ sinh TEST","50000",property)),null,false);
        long contract=call("OWNER","POST","/admin/rental-lifecycle/bookings/"+booking+"/contract",terms,201).path("id").asLong();fixture.put("contractId",contract);
        long deposit=db.sql("SELECT id FROM tenant_deposits WHERE contract_id=:id").param("id",contract).query(Long.class).single();
        var onboarding=context.getBean(ContractOnboardingService.class);var actor=new AuthenticatedUser(tenant,email,RoleCode.TENANT);
        var identity=(Map<?,?>)onboarding.detail(owner,contract).get("identityProfile");onboarding.verifyIdentityReviewed(owner,contract,new ContractOnboardingService.IdentityReview("TEST-ONLY synthetic fixture evidence, not a real identity check",true,identity.get("dataHash").toString()));
        var cv=(Map<?,?>)onboarding.detail(owner,contract).get("contractVersion");var confirmation=new ContractOnboardingService.Confirmation(((Number)cv.get("version")).longValue(),cv.get("content_hash").toString());onboarding.confirmContract(owner,contract,confirmation);onboarding.confirmContract(actor,contract,confirmation);
        context.getBean(DepositLedgerService.class).collect(accountant,deposit,"TEST-DEPOSIT-"+contract,new DepositLedgerService.Cash(money("3500000"),"CASH",BusinessTime.now().minusSeconds(1),null,"TEST-DEPOSIT","TEST ONLY: synthetic receipt",false));
        long checkin=call("OWNER","POST","/admin/rental-lifecycle/checkins",new PrepareCheckin(contract,booking,BusinessTime.today(),null,"TEST synthetic signed handover"),201).path("id").asLong();
        onboarding.saveHandover(owner,contract,new ContractOnboardingService.Handover(version("rental_checkins",checkin),BusinessTime.today(),money("1200"),money("80"),1,"TEST-HANDOVER"));
        var hv=(Map<?,?>)onboarding.detail(owner,contract).get("handoverVersion");onboarding.confirmHandover(actor,contract,new ContractOnboardingService.Confirmation(((Number)hv.get("version")).longValue(),hv.get("content_hash").toString()));
        call("OWNER","POST","/admin/rental-lifecycle/checkins/"+checkin+"/complete",new CompleteCheckin(true,true,true,money("1200"),money("80"),1,"TEST checkin",version("rental_checkins",checkin)),200);
        changeDate("2026-10-28");
        call("OWNER","POST","/admin/monthly-billing/"+contract+"/readings",new MonthlyBillingService.Reading(LocalDate.of(2026,10,1),0L,money("1300"),money("88"),"TEST-READING","TEST verified meter fixture",true),200);
        var request=new SaveInvoice(room,contract,"2026-10",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),LocalDate.of(2026,10,28),LocalDate.of(2026,11,5),List.of(),BigDecimal.ZERO,false,"TEST ONLY scenario "+scenario,"SAVE_DRAFT",null,LocalDate.of(2026,10,28));
        var preview=call("OWNER","POST","/admin/invoices/preview",request,200);
        long invoice=call("OWNER","POST","/admin/invoices",request,201).path("id").asLong();
        Files.writeString(directory.resolve("preview-"+scenario+".json"),json.writeValueAsString(preview));
        BigDecimal total=db.sql("SELECT total_amount FROM invoices WHERE id=:id").param("id",invoice).query(BigDecimal.class).single();
        if(total.compareTo(money("4200000"))!=0)throw new IllegalStateException("Backend calculated "+total+" instead of 4200000; fixture retained for investigation, no SQL correction.");
        call("OWNER","POST","/admin/invoices/"+invoice+"/issue?version="+version("invoices",invoice),null,200);fixture.put("invoiceId",invoice);fixture.put("total",total);fixture.put("depositId",deposit);
        fixture.put("fixtureId",scenario.equals("A")?"TEST-CONTRACT-001":"TEST-CONTRACT-"+scenario);
        fixture.put("contractCode",db.sql("SELECT code FROM contracts WHERE id=:id").param("id",contract).query(String.class).single());
        tenantLogin(email,password+"-Initial");
        call("TENANT","POST","/auth/change-initial-password",Map.of("currentPassword",password+"-Initial","newPassword",password,"confirmPassword",password),200);
        tenantLogin(email,password);fixture.put("initialPasswordRequired",false);
        call("TENANT","GET","/tenant/invoices/"+invoice,null,200);
        if(scenario.equals("B"))call("ACCOUNTANT","POST","/accountant/payments",new com.thangit.boardinghouse.dto.request.accountant.AccountantRequests.PaymentCreate(invoice,total,"CASH",BusinessTime.now().minusSeconds(1),null,"TEST ONLY synthetic cash receipt",true),201);
        if(Set.of("C","D").contains(scenario)){
            byte[] png=Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=");
            var proof=context.getBean(com.thangit.boardinghouse.service.impl.TenantInvoiceServiceImpl.class).submitProof(actor,invoice,null,total,BusinessTime.now().minusSeconds(1),"TEST SANDBOX","TEST-PROOF-"+scenario,"TEST ONLY - no real transfer",new org.springframework.mock.web.MockMultipartFile("file","TEST-proof.png","image/png",png));
            fixture.put("proofId",proof.id());
            if(scenario.equals("D"))call("ACCOUNTANT","POST","/accountant/payment-proofs/"+proof.id()+"/approve",Map.of("version",0,"note","TEST ONLY synthetic transfer reviewed","issueReceipt",true),200);
        }
        if(Set.of("E","F").contains(scenario)){
            var transactions=context.getBean(PaymentTransactionService.class);
            long session=((Number)transactions.simulate(actor,invoice,"TEST-GATEWAY-"+invoice).get("id")).longValue();
            fixture.put("gatewayStatus",transactions.outcome(actor,session,scenario.equals("E")?"FAILED":"SUCCESS").get("status"));
        }
        changeDate("2026-10-01");
    }
    void tenantLogin(String email,String pass)throws Exception{
        var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:18083/api/auth/login")).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("email",email,"password",pass,"requestedRole","TENANT")))).build(),HttpResponse.BodyHandlers.ofString());
        if(response.statusCode()!=200)throw new IllegalStateException("Demo tenant login failed: "+response.statusCode());
        tokens.put("TENANT",json.readTree(response.body()).path("data").path("accessToken").asText());
    }
    void ensureCatalog(long property){
        var catalog=context.getBean(PropertyServiceCatalogService.class);
        for(var entry:Map.of("INTERNET","100000","CLEANING","50000").entrySet()){
            if(db.sql("SELECT COUNT(*) FROM property_service_catalog WHERE property_id=:id AND code=:code").param("id",property).param("code",entry.getKey()).query(Long.class).single()==0){
                var service=new AgreedService(entry.getKey(),entry.getKey()+" TEST","FIXED",money(entry.getValue()),null,"TEST ONLY","tháng",BigDecimal.ONE,"MONTHLY",LocalDate.of(2026,10,1),null,"ACTIVE","TEST catalog fixture",false);
                catalog.save(owner,property,null,new PropertyServiceCatalogService.Save(service,entry.getKey().equals("CLEANING")?"CLEANING":"OTHER",true,false,0L,"TEST catalog preset"));
            }
        }
    }
    AgreedService agreed(String code,String label,String price,long property){
        long source=db.sql("SELECT id FROM property_service_catalog WHERE property_id=:id AND code=:code").param("id",property).param("code",code).query(Long.class).single();
        return new AgreedService(code,label,"FIXED",money(price),source,"TEST ONLY","tháng",BigDecimal.ONE,"MONTHLY",LocalDate.of(2026,10,1),null,"ACTIVE","TEST contract agreement",false);
    }
}
