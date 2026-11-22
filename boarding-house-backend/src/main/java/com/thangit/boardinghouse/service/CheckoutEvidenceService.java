package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.security.*;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import java.util.*;
import java.security.MessageDigest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class CheckoutEvidenceService {
 public record File(String name,String mime,byte[] bytes){}
 private final JdbcClient db;private final RoomLifecycleGuard rooms;
 public CheckoutEvidenceService(JdbcClient db,RoomLifecycleGuard rooms){this.db=db;this.rooms=rooms;}
 private AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"CHECKOUT_EVIDENCE_DENIED","Không có quyền đối với bằng chứng trả phòng này.");}
 private Map<String,Object> access(AuthenticatedUser p,long id,boolean write){if(p==null)throw denied();if(write)rooms.lockCheckout(id);var co=db.sql("SELECT co.*,c.tenant_id,r.property_id FROM rental_checkouts co JOIN contracts c ON c.id=co.contract_id JOIN rooms r ON r.id=c.room_id WHERE co.id=:id").param("id",id).query().listOfRows().stream().findFirst().orElseThrow(this::denied);long property=((Number)co.get("property_id")).longValue();switch(p.activeRole()){
  case OWNER,MANAGER->{rooms.access(p,property);if(write&&p.activeRole()==RoleCode.MANAGER)rooms.capability(p,property,PropertyAuthorization.Capability.CONTRACT_APPROVE);}
  case TENANT->{if(((Number)co.get("tenant_id")).longValue()!=p.id())throw denied();}
  case ACCOUNTANT->{if(write||db.sql("SELECT COUNT(*) FROM accountant_property_assignments a JOIN accountant_profiles ap ON ap.user_id=a.accountant_id WHERE a.accountant_id=:actor AND a.property_id=:property").param("actor",p.id()).param("property",property).query(Long.class).single()!=1)throw denied();}
  default->throw denied();}
  if(write&&Set.of("COMPLETED","CANCELLED").contains(co.get("status")))throw new AuthException(HttpStatus.CONFLICT,"CHECKOUT_EVIDENCE_LOCKED","Hồ sơ đã đóng hoặc hủy; không bổ sung bằng chứng vào hồ sơ này.");return co;
 }
 @Transactional(readOnly=true) public List<Map<String,Object>> list(AuthenticatedUser p,long id){access(p,id,false);return db.sql("SELECT id,evidence_type,original_name,mime_type,file_size,dispute_id,uploaded_at FROM checkout_evidence_files WHERE checkout_id=:id ORDER BY id DESC").param("id",id).query().listOfRows();}
 @Transactional public long upload(AuthenticatedUser p,long id,String key,String type,Long dispute,String name,String mime,byte[] bytes){access(p,id,true);if(key==null||key.isBlank()||key.length()>100||!Set.of("INSPECTION","UTILITY","HANDOVER","DISPUTE").contains(type)||bytes==null||bytes.length==0||bytes.length>10*1024*1024||mime==null||detect(bytes)==null||!Objects.equals(mime,detect(bytes)))throw new AuthException(HttpStatus.BAD_REQUEST,"CHECKOUT_EVIDENCE_INVALID","Ảnh JPEG/PNG/WebP tối đa 10 MB, nhóm và khóa chống trùng phải hợp lệ.");if(dispute!=null&&db.sql("SELECT COUNT(*) FROM checkout_disputes WHERE id=:dispute AND checkout_id=:id").param("dispute",dispute).param("id",id).query(Long.class).single()!=1)throw denied();
  String hash;try{hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}
  var prior=db.sql("SELECT id,content_hash,evidence_type,dispute_id FROM checkout_evidence_files WHERE checkout_id=:id AND uploaded_by=:actor AND file_key=:key FOR UPDATE").param("id",id).param("actor",p.id()).param("key",key).query().listOfRows();if(!prior.isEmpty()){var old=prior.getFirst();if(!hash.equals(old.get("content_hash"))||!type.equals(old.get("evidence_type"))||!Objects.equals(dispute,old.get("dispute_id")==null?null:((Number)old.get("dispute_id")).longValue()))throw new AuthException(HttpStatus.CONFLICT,"CHECKOUT_FILE_KEY_REUSED","Khóa đã dùng cho bằng chứng khác.");return ((Number)old.get("id")).longValue();}
  var keys=new GeneratedKeyHolder();String safe=Objects.toString(name,"evidence").replaceAll("[\\r\\n\\\\/]","_");safe=safe.substring(0,Math.min(180,safe.length()));db.sql("INSERT INTO checkout_evidence_files(checkout_id,dispute_id,evidence_type,original_name,mime_type,file_content,file_size,content_hash,file_key,uploaded_by) VALUES(:id,:dispute,:type,:name,:mime,:bytes,:size,:hash,:key,:actor)").param("id",id).param("dispute",dispute).param("type",type).param("name",safe).param("mime",mime).param("bytes",bytes).param("size",bytes.length).param("hash",hash).param("key",key).param("actor",p.id()).update(keys,"id");long file=keys.getKey().longValue();db.sql("INSERT INTO checkout_history(checkout_id,event_type,actor_id,description) VALUES(:id,'EVIDENCE_ADDED',:actor,:text)").param("id",id).param("actor",p.id()).param("text",type+" · FILE-"+file+"; không thay đổi khoản tiền hoặc xác nhận đã chấp thuận").update();return file;
 }
 @Transactional public File file(AuthenticatedUser p,long id,long file){access(p,id,false);var row=db.sql("SELECT original_name,mime_type,file_content FROM checkout_evidence_files WHERE id=:file AND checkout_id=:id").param("file",file).param("id",id).query().listOfRows().stream().findFirst().orElseThrow(()->new AuthException(HttpStatus.NOT_FOUND,"CHECKOUT_FILE_NOT_FOUND","Không tìm thấy tệp."));new SecurityAudit(db).record(p.id(),"CHECKOUT_EVIDENCE_DOWNLOADED","CHECKOUT",id,"SUCCESS",null);return new File(row.get("original_name").toString(),row.get("mime_type").toString(),(byte[])row.get("file_content"));}
 private static String detect(byte[] b){if(b.length>=3&&(b[0]&255)==255&&(b[1]&255)==216&&(b[2]&255)==255)return "image/jpeg";if(b.length>=8&&(b[0]&255)==137&&b[1]==80&&b[2]==78&&b[3]==71)return "image/png";if(b.length>=12&&new String(b,0,4,java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF")&&new String(b,8,4,java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP"))return "image/webp";return null;}
}
