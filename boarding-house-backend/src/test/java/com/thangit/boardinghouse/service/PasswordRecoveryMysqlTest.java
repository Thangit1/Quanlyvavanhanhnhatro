package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Only a NEW schema on an explicitly supplied, separate MySQL instance. SMTP never leaves loopback. */
@EnabledIfSystemProperty(named="auth.recovery.mysql", matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PasswordRecoveryMysqlTest {
    static final String ORIGIN = "https://frontend.test.invalid";
    static final String SCHEMA = "auth_recovery_test_" + UUID.randomUUID().toString().replace("-", "");
    static final SmtpInbox SMTP = new SmtpInbox();
    @LocalServerPort int port;
    @Autowired JdbcClient db;
    @Autowired PasswordRecoveryService recovery;
    @Autowired PasswordEncoder passwords;
    @Autowired JsonMapper json;
    final HttpClient http = HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(5)).build();
    String email; long user;

    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) throws Exception {
        int port = Integer.parseInt(System.getProperty("auth.mysql.port", "0"));
        if (port <= 0 || port == 3306) throw new IllegalArgumentException("Explicit separate test port required; 3306 prohibited");
        String username = System.getProperty("auth.mysql.user", "root");
        String password = Objects.requireNonNull(System.getenv("AUTH_TEST_MYSQL_PASSWORD"), "AUTH_TEST_MYSQL_PASSWORD required");
        String server = "jdbc:mysql://127.0.0.1:" + port + "/";
        try (var c=DriverManager.getConnection(server, username, password); var s=c.createStatement()) {
            s.execute("CREATE DATABASE `" + SCHEMA + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }
        r.add("spring.profiles.active", () -> "dev");
        r.add("spring.datasource.url", () -> server+SCHEMA+"?serverTimezone=UTC");
        r.add("spring.datasource.username", () -> username); r.add("spring.datasource.password", () -> password);
        r.add("spring.flyway.user", () -> username); r.add("spring.flyway.password", () -> password);
        r.add("app.security.jwt.secret", () -> "test-only-64-character-signing-key-for-isolated-password-recovery-123456");
        r.add("app.security.cookie.secure", () -> "true"); r.add("app.security.cookie.same-site", () -> "None");
        r.add("app.scheduling.enabled", () -> "false");
        r.add("app.security.recovery.enabled", () -> "true");
        r.add("app.security.recovery.dispatch-delay", () -> "600000");
        r.add("app.security.recovery.ip-limit", () -> "100");
        r.add("app.security.login.rate-limit-max", () -> "1000");
        r.add("app.cors.allowed-origins", () -> ORIGIN+",http://localhost:3109");
        r.add("app.frontend-url", () -> ORIGIN);
        r.add("spring.mail.host", () -> "127.0.0.1"); r.add("spring.mail.port", () -> SMTP.port());
        r.add("spring.mail.username", () -> "test-only"); r.add("spring.mail.password", () -> "test-only");
        r.add("spring.mail.properties.mail.smtp.auth", () -> "false");
        r.add("spring.mail.properties.mail.smtp.starttls.enable", () -> "false");
        r.add("spring.mail.properties.mail.smtp.starttls.required", () -> "false");
        r.add("app.mail.from", () -> "recovery@test.invalid");
        r.add("MAIL_TEST_RECIPIENT", () -> "");
        r.add("app.security.trusted-cloudflare-proxies", () -> "");
        System.out.println("Isolated recovery schema retained: " + SCHEMA);
    }

    @BeforeEach void seed() {
        db.sql("UPDATE password_recovery_mail SET status='CANCELLED' WHERE status='PENDING'").update();
        db.sql("DELETE FROM password_recovery_limits").update();
        email="owner-"+UUID.randomUUID()+"@test.invalid";
        db.sql("INSERT INTO users(email,password_hash,full_name) VALUES(:email,:hash,'Recovery Test')")
                .param("email",email).param("hash",passwords.encode("Before-12345")).update();
        user=db.sql("SELECT id FROM users WHERE email=:email").param("email",email).query(Long.class).single();
        db.sql("INSERT INTO user_roles(user_id,role_id) SELECT :user,id FROM roles WHERE code='OWNER'").param("user",user).update();
    }
    HttpResponse<String> post(String path, Map<String,?> body, String cookie, String token) throws Exception {
        var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api"+path))
                .header("Content-Type","application/json").header("Origin",ORIGIN).header("X-Auth-Request","1");
        if(cookie!=null)request.header("Cookie",cookie); if(token!=null)request.header("Authorization","Bearer "+token);
        return http.send(request.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
    }
    JsonNode body(HttpResponse<String> response) { return json.readTree(response.body()); }
    HttpResponse<String> login(String password) throws Exception {
        var result=post("/auth/login",Map.of("email",email,"password",password,"requestedRole","OWNER"),null,null);
        assertThat(result.statusCode()).as(result.body()).isEqualTo(200); return result;
    }
    String cookie(HttpResponse<String> result) { return result.headers().firstValue("set-cookie").orElseThrow().split(";",2)[0]; }
    String access(HttpResponse<String> result) { return body(result).path("data").path("accessToken").asText(); }
    int me(String token) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/me"))
                .header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofString()).statusCode();
    }
    String requestToken() throws Exception {
        int before=SMTP.messages.size();
        assertThat(post("/auth/forgot-password",Map.of("email",email),null,null).statusCode()).isEqualTo(202);
        assertThat(recovery.dispatchOne()).isTrue();
        assertThat(SMTP.messages).hasSize(before+1);
        String text=SMTP.messages.getLast();
        assertThat(text).contains(ORIGIN+"/reset-password#token=");
        var matcher=Pattern.compile("#token=([A-Za-z0-9_-]{43})").matcher(text);
        assertThat(matcher.find()).isTrue(); return matcher.group(1);
    }
    Map<String,String> reset(String token) { return Map.of("token",token,"newPassword","After-98765","confirmPassword","After-98765"); }

    @Test void recoveryEmailResetAndSessionRevocationEndToEnd() throws Exception {
        var old=login("Before-12345"); String access=access(old), refresh=cookie(old);
        assertThat(me(access)).isEqualTo(200);
        String raw=requestToken();
        assertThat(db.sql("SELECT token_hash FROM password_reset_tokens WHERE user_id=:id").param("id",user).query(String.class).single())
                .isEqualTo(PasswordRecoveryService.hash(raw)).doesNotContain(raw);
        assertThat(post("/auth/reset-password",Map.of("token",raw,"newPassword","After-98765","confirmPassword","Different-123"),null,null).statusCode()).isEqualTo(400);
        String unicode="Mật123"+"界".repeat(24);
        assertThat(post("/auth/reset-password",Map.of("token",raw,"newPassword",unicode,"confirmPassword",unicode),null,null).statusCode()).isEqualTo(400);
        assertThat(post("/auth/reset-password",reset(raw),null,null).statusCode()).isEqualTo(200);
        assertThat(me(access)).isEqualTo(401);
        assertThat(post("/auth/refresh",Map.of(),refresh,null).statusCode()).isEqualTo(401);
        assertThat(post("/auth/login",Map.of("email",email,"password","Before-12345","requestedRole","OWNER"),null,null).statusCode()).isEqualTo(401);
        assertThat(body(login("After-98765")).path("data").path("user").path("activeRole").asText()).isEqualTo("OWNER");
        assertThat(post("/auth/reset-password",reset(raw),null,null).statusCode()).isEqualTo(400);
        assertThat(db.sql("SELECT COUNT(*) FROM user_roles WHERE user_id=:id").param("id",user).query(Long.class).single()).isEqualTo(1);
    }
    @Test void expiredAndSupersededTokensCannotResetPassword() throws Exception {
        String old=requestToken(), latest=requestToken();
        assertThat(post("/auth/reset-password",reset(old),null,null).statusCode()).isEqualTo(400);
        db.sql("UPDATE password_reset_tokens SET expires_at=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE token_hash=:hash").param("hash",PasswordRecoveryService.hash(latest)).update();
        var expired=post("/auth/reset-password",reset(latest),null,null);
        assertThat(expired.statusCode()).isEqualTo(400);
        assertThat(body(expired).path("errorCode").asText()).isEqualTo("PASSWORD_RESET_TOKEN_INVALID");
        login("Before-12345");
    }
    @Test void simultaneousResetHasExactlyOneWinner() throws Exception {
        String token=requestToken(); var executor=Executors.newFixedThreadPool(2); var barrier=new CyclicBarrier(2);
        try {
            Callable<Integer> task=()->{barrier.await();return post("/auth/reset-password",reset(token),null,null).statusCode();};
            var first=executor.submit(task);var second=executor.submit(task);
            assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,400);
        } finally {executor.shutdownNow();}
        login("After-98765");
    }
    @Test void unknownInactiveAndKnownAccountsHaveSameResponseAndEmailLimits() throws Exception {
        String unknown="unknown-"+UUID.randomUUID()+"@test.invalid";
        for(int i=0;i<3;i++){
            var known=post("/auth/forgot-password",Map.of("email",email.toUpperCase(Locale.ROOT)),null,null);
            var missing=post("/auth/forgot-password",Map.of("email",unknown),null,null);
            assertThat(known.statusCode()).isEqualTo(202); assertThat(missing.statusCode()).isEqualTo(202);
            assertThat(body(known).path("message").asText()).isEqualTo(body(missing).path("message").asText());
            assertThat(body(known).path("data").isNull()).isTrue();
        }
        assertThat(post("/auth/forgot-password",Map.of("email",email),null,null).statusCode()).isEqualTo(429);
        assertThat(post("/auth/forgot-password",Map.of("email",unknown),null,null).statusCode()).isEqualTo(429);
        assertThat(db.sql("SELECT COUNT(*) FROM password_recovery_mail WHERE user_id=:id").param("id",user).query(Long.class).single()).isEqualTo(3);
        db.sql("UPDATE users SET status='LOCKED' WHERE id=:id").param("id",user).update();
        db.sql("DELETE FROM password_recovery_limits").update();
        assertThat(post("/auth/forgot-password",Map.of("email",email),null,null).statusCode()).isEqualTo(202);
        assertThat(recovery.dispatchOne()).isFalse();
    }
    @Test void ipLimitAlsoAppliesAcrossDifferentUnknownEmails() throws Exception {
        for(int i=0;i<100;i++)assertThat(post("/auth/forgot-password",Map.of("email","unknown-"+i+"@test.invalid"),null,null).statusCode()).isEqualTo(202);
        assertThat(post("/auth/forgot-password",Map.of("email",email),null,null).statusCode()).isEqualTo(429);
    }
    @Test void refreshRotationCookiePolicyLogoutCorsAndCsrf() throws Exception {
        var first=login("Before-12345");
        assertThat(first.headers().firstValue("set-cookie").orElseThrow()).contains("HttpOnly","Secure","SameSite=None","Path=/api/auth");
        var rotated=post("/auth/refresh",Map.of(),cookie(first),null);
        assertThat(rotated.statusCode()).isEqualTo(200);assertThat(cookie(rotated)).isNotEqualTo(cookie(first));
        assertThat(me(access(rotated))).isEqualTo(200);
        var noHeader=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/refresh"))
                .header("Cookie",cookie(rotated)).POST(HttpRequest.BodyPublishers.noBody()).build();
        assertThat(http.send(noHeader,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
        var untrusted=HttpRequest.newBuilder(noHeader.uri()).header("Origin","https://evil.test.invalid").header("X-Auth-Request","1")
                .header("Cookie",cookie(rotated)).POST(HttpRequest.BodyPublishers.noBody()).build();
        assertThat(http.send(untrusted,HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
        var preflight=HttpRequest.newBuilder(noHeader.uri()).header("Origin",ORIGIN).header("Access-Control-Request-Method","POST")
                .header("Access-Control-Request-Headers","content-type,x-auth-request").method("OPTIONS",HttpRequest.BodyPublishers.noBody()).build();
        var cors=http.send(preflight,HttpResponse.BodyHandlers.ofString());assertThat(cors.statusCode()).isEqualTo(200);
        assertThat(cors.headers().firstValue("Access-Control-Allow-Origin")).contains(ORIGIN);
        assertThat(cors.headers().firstValue("Access-Control-Allow-Credentials")).contains("true");
        assertThat(post("/auth/logout",Map.of(),cookie(rotated),access(rotated)).statusCode()).isEqualTo(200);
        assertThat(me(access(rotated))).isEqualTo(401);
        assertThat(post("/auth/refresh",Map.of(),cookie(rotated),null).statusCode()).isEqualTo(401);
        assertThat(post("/auth/refresh",Map.of(),null,null).statusCode()).isEqualTo(401);
    }
    @Test void reusedRefreshRevokesEntireFamily() throws Exception {
        var first=login("Before-12345"); var rotated=post("/auth/refresh",Map.of(),cookie(first),null);
        assertThat(rotated.statusCode()).isEqualTo(200);
        assertThat(post("/auth/refresh",Map.of(),cookie(first),null).statusCode()).isEqualTo(401);
        assertThat(post("/auth/refresh",Map.of(),cookie(rotated),null).statusCode()).isEqualTo(401);
    }
    @Test void smtpFailureIsRecordedAndIssuedTokenIsInvalidated() throws Exception {
        SMTP.reject = true;
        try {
            assertThat(post("/auth/forgot-password",Map.of("email",email),null,null).statusCode()).isEqualTo(202);
            assertThat(recovery.dispatchOne()).isTrue();
            assertThat(db.sql("SELECT status FROM password_recovery_mail WHERE user_id=:id").param("id",user).query(String.class).single()).isEqualTo("FAILED");
            assertThat(db.sql("SELECT COUNT(*) FROM password_reset_tokens WHERE user_id=:id AND used_at IS NULL").param("id",user).query(Long.class).single()).isZero();
            login("Before-12345");
        } finally {SMTP.reject=false;}
    }
    @Test @EnabledIfSystemProperty(named="auth.recovery.browser",matches="true")
    void chromiumProductionFrontendAndLiveBackend() throws Exception {
        String token=requestToken();
        var process=new ProcessBuilder("node","scripts/auth-browser.cjs")
                .directory(new File("../boarding-house-frontend"));
        process.environment().put("AUTH_BROWSER_BACKEND", "http://127.0.0.1:"+port+"/api");
        process.environment().put("AUTH_BROWSER_EMAIL",email);
        process.environment().put("AUTH_BROWSER_RESET_TOKEN",token);
        process.redirectErrorStream(true);
        File log=new File("target/auth-browser.log");process.redirectOutput(log);
        var running=process.start();
        try {
            assertThat(running.waitFor(150,TimeUnit.SECONDS)).as("Browser timeout; see target/auth-browser.log").isTrue();
            assertThat(running.exitValue()).as("Browser results: "+java.nio.file.Files.readString(log.toPath())).isZero();
        } finally {running.destroyForcibly();}
    }
    @AfterAll void close() throws Exception {SMTP.close();}

    static final class SmtpInbox implements AutoCloseable {
        final ServerSocket server; final List<String> messages=new CopyOnWriteArrayList<>();
        volatile boolean reject;
        SmtpInbox() {
            try {server=new ServerSocket(0,10,InetAddress.getLoopbackAddress());}
            catch(IOException error){throw new UncheckedIOException(error);}
            Thread.ofPlatform().daemon().start(()->{
                while(!server.isClosed())try(var socket=server.accept()){
                    socket.setSoTimeout(10000);var reader=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.UTF_8));
                    var writer=new PrintWriter(new OutputStreamWriter(socket.getOutputStream(),StandardCharsets.UTF_8),true);
                    send(writer,"220 local-test ESMTP");String line;
                    while((line=reader.readLine())!=null){
                        String command=line.toUpperCase(Locale.ROOT);
                        if(command.startsWith("EHLO")||command.startsWith("HELO"))send(writer,"250 local-test");
                        else if(command.startsWith("MAIL FROM") && reject)send(writer,"550 synthetic test rejection");
                        else if(command.startsWith("DATA")){
                            send(writer,"354 End with dot");var data=new StringBuilder();
                            while((line=reader.readLine())!=null&&!line.equals("."))data.append(line.startsWith("..")?line.substring(1):line).append("\r\n");
                            var mime=new MimeMessage(Session.getInstance(new Properties()),new ByteArrayInputStream(data.toString().getBytes(StandardCharsets.UTF_8)));
                            messages.add(mime.getContent().toString()); send(writer,"250 accepted locally");
                        } else if(command.startsWith("QUIT")){send(writer,"221 bye");break;}
                        else send(writer,"250 OK");
                    }
                } catch(Exception error){if(!server.isClosed())throw new RuntimeException(error);}
            });
        }
        static void send(PrintWriter writer,String text){writer.print(text+"\r\n");writer.flush();}
        int port(){return server.getLocalPort();}
        public void close() throws IOException{server.close();}
    }
}
