package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import tools.jackson.databind.JsonNode;

/** Real HTTP, Spring Security, multipart parser, MySQL and persistent image storage. */
@EnabledIfSystemProperty(named="roomImages.http",matches="true")
class RoomImageHttpTest extends PropertyImageHttpTest {
    long room;
    Map<String,Object> roomPayload(String code,Long version){
        var p=new LinkedHashMap<String,Object>();p.put("propertyId",property);p.put("code",code);p.put("name","Gallery HTTP test");p.put("monthlyRent",1500000);p.put("capacity",2);p.put("description","Keep description");p.put("amenityIds",List.of());p.put("assets",List.of());if(version!=null)p.put("version",version);return p;
    }
    JsonNode upload(String method,String route,String token,Map<String,Object> room,List<String> items,int cover,List<byte[]> files,String key,int expected)throws Exception{
        String boundary="gallery-"+UUID.randomUUID();var out=new java.io.ByteArrayOutputStream();
        for(var part:Map.of("room",room,"gallery",Map.of("items",items,"cover",cover)).entrySet())out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\""+part.getKey()+"\"\r\nContent-Type: application/json\r\n\r\n"+json.writeValueAsString(part.getValue())+"\r\n").getBytes(StandardCharsets.UTF_8));
        for(byte[] file:files){out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"images\"; filename=\"picture.png\"\r\nContent-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));out.write(file);out.write("\r\n".getBytes(StandardCharsets.UTF_8));}
        out.write(("--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));
        var builder=HttpRequest.newBuilder(URI.create(base()+route)).header("Content-Type","multipart/form-data; boundary="+boundary).header("Idempotency-Key",key);
        if(token!=null)builder.header("Authorization","Bearer "+token);
        var response=http.send(builder.method(method,HttpRequest.BodyPublishers.ofByteArray(out.toByteArray())).build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(method+" "+route+" "+response.body()).isEqualTo(expected);
        evidence.add(Map.of("method",method,"path",route,"status",expected));return json.readTree(response.body()).path("data");
    }
    @Test @Order(3) void roomGalleryMultipartAndReload()throws Exception{
        var payload=roomPayload("HTTP-GALLERY",null);var file=PropertyImageStorageTest.picture("png");var key=UUID.randomUUID().toString();
        var a=upload("POST","/admin/rooms",owner,payload,List.of("upload:0","upload:1"),1,List.of(file,file),key,201);room=a.path("id").asLong();
        assertThat(upload("POST","/admin/rooms",owner,payload,List.of("upload:0","upload:1"),1,List.of(file,file),key,201).path("id").asLong()).isEqualTo(room);
        var d=json.readTree(get("/admin/rooms/"+room,owner,200).body()).path("data");assertThat(d.path("images").size()).isEqualTo(2);
        assertThat(d.path("room").path("thumbnailUrl").asText()).isEqualTo(d.path("images").get(1).asText());
        for(var image:d.path("images"))assertThat(get(image.asText(),owner,200).body()).isNotEmpty();
        var update=roomPayload("HTTP-GALLERY",d.path("room").path("version").asLong());
        String retained=d.path("images").get(0).asText();
        upload("PUT","/admin/rooms/"+room,owner,update,List.of(retained),0,List.of(),UUID.randomUUID().toString(),200);
        var changed=json.readTree(get("/admin/rooms/"+room,owner,200).body()).path("data");assertThat(changed.path("images").size()).isEqualTo(1);assertThat(changed.path("description").asText()).isEqualTo("Keep description");
    }
    @Test @Order(4) void httpSecurityAndFakeImageCannotChangeRoom()throws Exception{
        var d=json.readTree(get("/admin/rooms/"+room,owner,200).body()).path("data");var payload=roomPayload("HTTP-GALLERY",d.path("room").path("version").asLong());var file=PropertyImageStorageTest.picture("png");
        upload("PUT","/admin/rooms/"+room,null,payload,List.of("upload:0"),0,List.of(file),UUID.randomUUID().toString(),401);
        upload("PUT","/admin/rooms/"+room,accountant,payload,List.of("upload:0"),0,List.of(file),UUID.randomUUID().toString(),403);
        upload("PUT","/admin/rooms/"+room,owner,payload,List.of("upload:0"),0,List.of("fake".getBytes()),UUID.randomUUID().toString(),400);
        assertThat(json.readTree(get("/admin/rooms/"+room,owner,200).body()).path("data").path("images")).isEqualTo(d.path("images"));
    }
    @Test @Order(5) void tenantImageHttpIsScopedToContractAndRoom()throws Exception{
        for(int id:List.of(5,6)){
            f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE code='TENANT'").param("id",id).update();
            f.db.sql("UPDATE users SET password_hash=:hash WHERE id=:id").param("hash",encoder.encode("Property-QA-2026!")).param("id",id).update();
        }
        long contract=f.insert("INSERT INTO contracts(room_id,tenant_id,code,start_date,end_date,deposit_amount) VALUES("+room+",5,'PHOTO-HTTP',CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 1 YEAR),0)");
        String tenant=token(5,"TENANT"),other=token(6,"TENANT");
        String url=json.readTree(get("/admin/rooms/"+room,owner,200).body()).path("data").path("room").path("thumbnailUrl").asText();
        String path="/tenant/contracts/"+contract+"/room-images/"+url.substring(url.lastIndexOf('/')+1);
        assertThat(get(path,tenant,200).body()).isNotEmpty();get(path,other,404);get(path,null,401);
        get("/tenant/contracts/"+contract+"/room-images/"+current.substring(current.lastIndexOf('/')+1),tenant,404);
    }
    @Override @AfterAll void browser()throws Exception{
        var dir=Path.of("../docs/qa/room-images");Files.createDirectories(dir);Files.writeString(dir.resolve("http.json"),json.writeValueAsString(Map.of("cases",evidence)));
        if(!Boolean.getBoolean("roomImages.browser"))return;
        String run=UUID.randomUUID().toString();var ready=Path.of("D:/DATN/prompt16-browser-ready.json");
        Files.writeString(ready,json.writeValueAsString(Map.of("runId",run,"api",base(),"propertyId",property,"roomId",room,"email","p03-1@test.invalid","password","Property-QA-2026!")));
        var done=Path.of("D:/DATN/prompt16-browser-complete.json");long until=System.nanoTime()+Duration.ofMinutes(15).toNanos();
        while(System.nanoTime()<until){if(Files.exists(done)){var result=json.readTree(Files.readString(done));if(run.equals(result.path("runId").asText())){assertThat(result.path("status").asText()).isEqualTo("PASS");return;}}Thread.sleep(250);}
        throw new AssertionError("Room image browser timed out");
    }
}
