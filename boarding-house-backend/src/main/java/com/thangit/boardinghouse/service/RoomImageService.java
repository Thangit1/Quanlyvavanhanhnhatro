package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.SaveRoom;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.json.JsonMapper;

/** Atomic room/gallery saves using the same persistent, sanitizing storage as property images. */
@Service
public class RoomImageService {
    public static final int MAX_IMAGES=10;
    public record Gallery(@NotNull @Size(max=MAX_IMAGES) List<String> items, @Min(0) int cover) {}
    private final AdminPropertyService rooms;
    private final JdbcClient db;
    private final PropertyImageStorage storage;
    private final JsonMapper json;
    public RoomImageService(AdminPropertyService rooms,JdbcClient db,PropertyImageStorage storage,JsonMapper json){this.rooms=rooms;this.db=db;this.storage=storage;this.json=json;}

    @Transactional(readOnly=true)
    public byte[] tenantImage(AuthenticatedUser actor,long contract,String key){
        if(actor==null||actor.activeRole()!=RoleCode.TENANT)throw new AuthException(HttpStatus.FORBIDDEN,"ROOM_IMAGE_DENIED","Không có quyền xem ảnh này.");
        var row=db.sql("SELECT r.id,r.property_id,r.image_url FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE c.id=:contract AND c.tenant_id=:tenant")
            .param("contract",contract).param("tenant",actor.id()).query(new org.springframework.jdbc.core.ColumnMapRowMapper()).optional().orElseThrow(()->new AuthException(HttpStatus.NOT_FOUND,"ROOM_IMAGE_NOT_FOUND","Không tìm thấy ảnh phòng."));
        long property=((Number)row.get("property_id")).longValue();String url=PropertyImageStorage.url(property,key);
        if(!Objects.equals(url,row.get("image_url"))&&db.sql("SELECT COUNT(*) FROM room_images WHERE room_id=:room AND image_url=:url").param("room",row.get("id")).param("url",url).query(Long.class).single()==0)
            throw new AuthException(HttpStatus.NOT_FOUND,"ROOM_IMAGE_NOT_FOUND","Không tìm thấy ảnh phòng.");
        return storage.read(property,key);
    }

    @Transactional
    public Object save(AuthenticatedUser actor,Long id,SaveRoom request,Gallery gallery,List<MultipartFile> files,String key){
        if(actor==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(actor.activeRole()))throw error("ROOM_IMAGE_DENIED","Không có quyền sửa ảnh phòng.");
        if(key==null||!key.matches("[a-zA-Z0-9:_-]{8,100}"))throw error("IMAGE_IDEMPOTENCY_REQUIRED","Thiếu mã yêu cầu lưu ảnh.");
        if(files.size()>MAX_IMAGES||gallery==null||gallery.items()==null||gallery.items().size()>MAX_IMAGES)throw error("IMAGE_COUNT_INVALID","Mỗi phòng tối đa 10 ảnh.");
        // Serialize retries for this actor, including concurrent create requests.
        db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",actor.id()).query(Long.class).single();
        rooms.property(actor,request.propertyId());
        String hash=fingerprint(id,request,gallery,files);
        var previous=db.sql("SELECT room_id,request_hash FROM room_image_requests WHERE actor_id=:actor AND request_key=:key FOR UPDATE")
            .param("actor",actor.id()).param("key",key).query().listOfRows();
        if(!previous.isEmpty()){
            var old=previous.getFirst();if(!hash.equals(old.get("request_hash")))throw error("IMAGE_IDEMPOTENCY_CONFLICT","Mã yêu cầu đã dùng với nội dung khác.");
            long room=((Number)old.get("room_id")).longValue();var detail=rooms.room(actor,room);
            return id==null?new com.thangit.boardinghouse.dto.response.property.AdminPropertyResponses.Created(room,detail.room().roomCode()):detail;
        }
        var allowed=new HashSet<String>();
        if(id!=null){
            if(request.version()==null)throw error("VERSION_REQUIRED","Vui lòng tải lại phiên bản phòng trước khi lưu ảnh.");
            var current=rooms.room(actor,id);
            db.sql("SELECT id FROM rooms WHERE id=:id FOR UPDATE").param("id",id).query(Long.class).single();
            allowed.addAll(current.images());if(current.room().thumbnailUrl()!=null)allowed.add(current.room().thumbnailUrl());
        }
        validateGallery(gallery,files.size(),allowed);
        // Decode ALL files before any metadata change. An invalid image cannot cause partial updates.
        var clean=files.stream().map(storage::validate).toList();
        Object created=null;
        var safe=withoutImage(request);
        if(id==null){var result=rooms.createRoom(actor,safe);id=result.id();created=result;}else rooms.updateRoom(actor,id,safe);
        long room=id,property=request.propertyId();
        var urls=new ArrayList<String>();
        for(String item:gallery.items()){
            if(item.startsWith("upload:")){
                int index=Integer.parseInt(item.substring(7));String file=storage.write(property,clean.get(index));
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
                    @Override public void afterCompletion(int status){if(status==STATUS_ROLLED_BACK)storage.discard(property,file);}
                });
                urls.add(PropertyImageStorage.url(property,file));
            }else urls.add(item);
        }
        db.sql("DELETE FROM room_images WHERE room_id=:id").param("id",room).update();
        for(int i=0;i<urls.size();i++)db.sql("INSERT INTO room_images(room_id,image_url,display_order,is_thumbnail) VALUES(:id,:url,:position,:cover)")
            .param("id",room).param("url",urls.get(i)).param("position",i).param("cover",i==gallery.cover()).update();
        db.sql("UPDATE rooms SET image_url=:url WHERE id=:id").param("id",room).param("url",urls.isEmpty()?null:urls.get(gallery.cover())).update();
        db.sql("INSERT INTO room_image_requests(actor_id,request_key,request_hash,room_id) VALUES(:actor,:key,:hash,:room)")
            .param("actor",actor.id()).param("key",key).param("hash",hash).param("room",room).update();
        // Removed files are collected by existing reference-aware cleanup after its grace period.
        return created==null?rooms.room(actor,room):created;
    }
    public static void validateGallery(Gallery gallery,int count,Set<String> allowed){
        if(gallery==null||gallery.items()==null||gallery.items().size()>MAX_IMAGES||count>MAX_IMAGES||gallery.cover()<0||(!gallery.items().isEmpty()&&gallery.cover()>=gallery.items().size()))throw error("IMAGE_COUNT_INVALID","Tối đa 10 ảnh; hãy chọn ảnh đại diện hợp lệ.");
        var seen=new HashSet<String>();var used=new HashSet<Integer>();
        for(String item:gallery.items()){
            if(item==null||!seen.add(item))throw error("IMAGE_REFERENCE_INVALID","Danh sách ảnh không hợp lệ hoặc trùng ảnh.");
            if(item.startsWith("upload:")){
                if(!item.matches("upload:[0-9]"))throw error("IMAGE_REFERENCE_INVALID","Chỉ mục ảnh không hợp lệ.");
                int n=Integer.parseInt(item.substring(7));if(n>=count||!used.add(n))throw error("IMAGE_REFERENCE_INVALID","Không tìm thấy file ảnh.");
            }else if(!allowed.contains(item))throw error("IMAGE_REFERENCE_INVALID","Không thể liên kết ảnh của phòng khác.");
        }
        if(used.size()!=count)throw error("IMAGE_REFERENCE_INVALID","Có file ảnh chưa được liên kết.");
    }
    private String fingerprint(Long id,SaveRoom room,Gallery gallery,List<MultipartFile> files){
        try{var digest=MessageDigest.getInstance("SHA-256");digest.update(json.writeValueAsString(Arrays.asList(id,room,gallery)).getBytes(StandardCharsets.UTF_8));for(var file:files){if(file.getSize()>PropertyImageStorage.MAX_BYTES)throw error("IMAGE_TOO_LARGE","Ảnh vượt quá 5MB.");digest.update(Objects.toString(file.getContentType(),"").getBytes(StandardCharsets.UTF_8));digest.update(Objects.toString(file.getOriginalFilename(),"").getBytes(StandardCharsets.UTF_8));digest.update(file.getBytes());}return HexFormat.of().formatHex(digest.digest());}
        catch(AuthException e){throw e;}catch(Exception e){throw error("IMAGE_INVALID","Không thể đọc dữ liệu ảnh.");}
    }
    private SaveRoom withoutImage(SaveRoom r){return new SaveRoom(r.propertyId(),r.buildingId(),r.floorId(),r.code(),r.name(),r.roomType(),r.description(),r.area(),r.monthlyRent(),r.depositAmount(),r.capacity(),null,r.amenityIds(),r.assets(),r.version());}
    private static AuthException error(String code,String message){return new AuthException(HttpStatus.CONFLICT,code,message);}
}
