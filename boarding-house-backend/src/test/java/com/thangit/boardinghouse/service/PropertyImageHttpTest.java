package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"app.security.jwt.secret=property-image-qa-secret-abcdefghijklmnopqrstuvwxyz0123456789","app.scheduling.enabled=false","app.ai.provider=none","app.cors.allowed-origins=http://127.0.0.1:13000"})
@EnabledIfSystemProperty(named="propertyImages.http",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PropertyImageHttpTest {
 static final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
 static final Path root=Path.of(System.getProperty("java.io.tmpdir"),"property-image-http-"+UUID.randomUUID());
 @DynamicPropertySource static void database(DynamicPropertyRegistry r)throws Exception{f.setup("property_image_http_",null);r.add("spring.datasource.url",f.dataSource::getUrl);r.add("spring.datasource.username",f.dataSource::getUsername);r.add("spring.datasource.password",f.dataSource::getPassword);r.add("spring.flyway.url",f.dataSource::getUrl);r.add("spring.flyway.user",f.dataSource::getUsername);r.add("spring.flyway.password",f.dataSource::getPassword);r.add("app.media.property-root",root::toString);}
 @LocalServerPort int port;@Autowired JsonMapper json;@Autowired PasswordEncoder encoder;
 final HttpClient http=HttpClient.newHttpClient();String owner,manager,accountant;long property;String current;final List<Map<String,Object>> evidence=new ArrayList<>();
 String base(){return "http://127.0.0.1:"+port+"/api";}
 @BeforeAll void login()throws Exception{
  for(var e:Map.of(1,"OWNER",2,"MANAGER",3,"ACCOUNTANT").entrySet())f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE code=:role").param("id",e.getKey()).param("role",e.getValue()).update();
  f.db.sql("UPDATE users SET password_hash=:hash WHERE id IN(1,2,3)").param("hash",encoder.encode("Property-QA-2026!")).update();owner=token(1,"OWNER");manager=token(2,"MANAGER");accountant=token(3,"ACCOUNTANT");
 }
 String token(long id,String role)throws Exception{var body=json.writeValueAsString(Map.of("email","p03-"+id+"@test.invalid","password","Property-QA-2026!","requestedRole",role));var response=http.send(HttpRequest.newBuilder(URI.create(base()+"/auth/login")).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());assertThat(response.statusCode()).isEqualTo(200);return json.readTree(response.body()).path("data").path("accessToken").asText();}
 HttpResponse<byte[]> get(String path,String token,int status)throws Exception{var b=HttpRequest.newBuilder(URI.create(base()+path));if(token!=null)b.header("Authorization","Bearer "+token);var response=http.send(b.GET().build(),HttpResponse.BodyHandlers.ofByteArray());assertThat(response.statusCode()).as(path).isEqualTo(status);evidence.add(Map.of("method","GET","path",path,"status",status));return response;}
 Map<String,Object> payload(String code,Long version,String image){var m=new LinkedHashMap<String,Object>();m.put("code",code);m.put("name","Synthetic image house");m.put("type","BOARDING_HOUSE");m.put("address","Synthetic test address");m.put("description","Keep property metadata");m.put("phone","0911111111");if(version!=null)m.put("version",version);if(image!=null)m.put("thumbnailUrl",image);return m;}
 JsonNode save(String method,String path,String token,Map<String,Object> property,byte[] bytes,String name,String mime,int count,int status)throws Exception{
  String boundary="image-qa-"+UUID.randomUUID();var out=new java.io.ByteArrayOutputStream();out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"property\"\r\nContent-Type: application/json\r\n\r\n"+json.writeValueAsString(property)+"\r\n").getBytes(StandardCharsets.UTF_8));
  if(bytes!=null)for(int i=0;i<count;i++){out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"image\"; filename=\""+name+"\"\r\nContent-Type: "+mime+"\r\n\r\n").getBytes(StandardCharsets.UTF_8));out.write(bytes);out.write("\r\n".getBytes(StandardCharsets.UTF_8));}out.write(("--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));
  var response=http.send(HttpRequest.newBuilder(URI.create(base()+path)).header("Authorization","Bearer "+token).header("Content-Type","multipart/form-data; boundary="+boundary).method(method,HttpRequest.BodyPublishers.ofByteArray(out.toByteArray())).build(),HttpResponse.BodyHandlers.ofString());assertThat(response.statusCode()).as(method+" "+path+" "+response.body()).isEqualTo(status);evidence.add(Map.of("method",method,"path",path,"status",status));return json.readTree(response.body()).path("data");
 }
 @Test @Order(1) void realUploadReloadCacheHeadersAndAccessScope()throws Exception{
  for(String format:List.of("jpeg","png","webp")){
   byte[] bytes=format.equals("webp")?Base64.getDecoder().decode("UklGRjoAAABXRUJQVlA4IC4AAADQAQCdASoMAAgAAUAmJaACdLoB+AADsAD+7gpn/q0PlofLQ/hIf+dg2JdrwAAA"):PropertyImageStorageTest.picture(format);
   var result=save("POST","/admin/properties",owner,payload("QAIMAGE_"+format,null,null),bytes,"photo."+format,"image/"+format,1,201);property=result.path("id").asLong();
   var detail=json.readTree(get("/admin/properties/"+property,owner,200).body()).path("data");current=detail.path("thumbnailUrl").asText();var image=get(current,owner,200);assertThat(image.headers().firstValue("content-type")).contains("image/png");assertThat(image.headers().firstValue("cache-control")).contains("private, no-store");get(current,null,401);get(current,manager,403);get(current,accountant,403);
  }
 }
 @Test @Order(2) void invalidFilesConflictAndMultipleFilesNeverChangeSavedImage()throws Exception{
  var detail=json.readTree(get("/admin/properties/"+property,owner,200).body()).path("data");var data=payload(detail.path("propertyCode").asText(),detail.path("version").asLong(),current);
  save("PUT","/admin/properties/"+property,owner,data,"MZ not an image".getBytes(),"fake.jpg","image/jpeg",1,400);
  save("PUT","/admin/properties/"+property,owner,data,new byte[5*1024*1024+1],"large.png","image/png",1,413);
  save("PUT","/admin/properties/"+property,owner,data,PropertyImageStorageTest.picture("png"),"photo.png","image/png",2,400);
  save("PUT","/admin/properties/"+property,manager,data,PropertyImageStorageTest.picture("png"),"photo.png","image/png",1,403);
  save("PUT","/admin/properties/"+property,accountant,data,PropertyImageStorageTest.picture("png"),"photo.png","image/png",1,403);
  assertThat(json.readTree(get("/admin/properties/"+property,owner,200).body()).path("data").path("thumbnailUrl").asText()).isEqualTo(current);
  data.put("version",9999);save("PUT","/admin/properties/"+property,owner,data,null,"","",0,409);
  f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:id,2)").param("id",property).update();data.put("version",detail.path("version").asLong());
  var changed=save("PUT","/admin/properties/"+property,manager,data,PropertyImageStorageTest.picture("png"),"managed.png","image/png",1,200);
  String managed=changed.path("thumbnailUrl").asText();assertThat(managed).isNotEqualTo(current);get(managed,manager,200);get(managed,owner,200);
 }
 @AfterAll void browser()throws Exception{
  Path dir=Path.of("../docs/qa/property-images");Files.createDirectories(dir);Files.writeString(dir.resolve("http.json"),json.writeValueAsString(Map.of("cases",evidence,"storage",root.toString())));
  if(!Boolean.getBoolean("propertyImages.browser"))return;
  String run=UUID.randomUUID().toString();Files.writeString(Path.of("D:/DATN/prompt12-browser-ready.json"),json.writeValueAsString(Map.of("runId",run,"api",base(),"propertyId",property,"email","p03-1@test.invalid","password","Property-QA-2026!")));
  long until=System.nanoTime()+Duration.ofMinutes(10).toNanos();Path done=Path.of("D:/DATN/prompt12-browser-complete.json");while(System.nanoTime()<until){if(Files.exists(done)){var result=json.readTree(Files.readString(done));if(run.equals(result.path("runId").asText())){assertThat(result.path("status").asText()).isEqualTo("PASS");return;}}Thread.sleep(250);}throw new AssertionError("Property image browser timed out");
 }
}
