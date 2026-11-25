package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoomMeterService {
 public record Install(@NotBlank @Pattern(regexp="ELECTRICITY|WATER") String type,@NotBlank @Size(max=50) String code,@NotNull @DecimalMin("0") @Digits(integer=10,fraction=2) BigDecimal reading,@NotBlank @Size(max=500) String reference,@NotBlank @Size(max=1000) String reason){}
 private final JdbcClient db;private final RoomLifecycleGuard rooms;
 public RoomMeterService(JdbcClient db,RoomLifecycleGuard rooms){this.db=db;this.rooms=rooms;}
 public Map<String,Object> management(AuthenticatedUser p,long room){
  var target=db.sql("SELECT r.*,p.status property_status FROM rooms r JOIN properties p ON p.id=r.property_id WHERE r.id=:id").param("id",room).query().singleRow();
  boolean staff=p!=null&&Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole());
  if(staff)rooms.access(p,((Number)target.get("property_id")).longValue());
  boolean permission=staff&&(p.activeRole()==RoleCode.OWNER||db.sql("SELECT COUNT(*) FROM manager_property_capabilities WHERE property_id=:property AND manager_id=:user AND capability='CONTRACT_APPROVE'").param("property",target.get("property_id")).param("user",p.id()).query(Long.class).single()>0);
  var installed=db.sql("SELECT meter_type FROM utility_meters WHERE room_id=:id").param("id",room).query(String.class).list();
  String blocked=blockedReason(room,target);
  var allowed=permission&&blocked==null?List.of("ELECTRICITY","WATER").stream().filter(type->!installed.contains(type)).toList():List.<String>of();
  var out=new LinkedHashMap<String,Object>();out.put("installableTypes",allowed);out.put("canInstall",!allowed.isEmpty());out.put("reason",!permission?"Cần Owner hoặc Manager được giao quyền phê duyệt hợp đồng.":blocked!=null?blocked:allowed.isEmpty()?"Phòng đã có công tơ. Thay thế theo quy trình tháo/lắp có chứng từ.":null);
  out.put("events",staff?db.sql("SELECT e.id,m.meter_type,e.old_code,e.new_code,e.old_reading,e.new_reading,e.removed_reading,e.reason,e.evidence_reference,e.occurred_at,u.full_name actor_name FROM utility_meter_events e JOIN utility_meters m ON m.id=e.meter_id JOIN users u ON u.id=e.actor_id WHERE m.room_id=:id ORDER BY e.occurred_at DESC,e.id DESC").param("id",room).query().listOfRows():List.of());return out;
 }
 private String blockedReason(long room,Map<String,Object> target){
  if(!"ACTIVE".equals(target.get("property_status")))return "Nhà trọ không hoạt động; chưa thể lắp công tơ ban đầu.";
  if(Set.of("OCCUPIED","NOTICE").contains(target.get("status"))||db.sql("SELECT COUNT(*) FROM contracts WHERE room_id=:room AND operational_ended_at IS NULL AND status NOT IN ('DRAFT','PENDING_CONFIRMATION','CANCELLED','TERMINATED')").param("room",room).query(Long.class).single()>0||db.sql("SELECT COUNT(*) FROM tenant_residences WHERE room_id=:room AND status='ACTIVE' AND move_in_date<=CURRENT_DATE AND (move_out_date IS NULL OR move_out_date>CURRENT_DATE)").param("room",room).query(Long.class).single()>0)return "Phòng đang sử dụng; không được thay dữ liệu đo bằng lắp ban đầu.";
  return null;
 }
 @Transactional public Map<String,Object> install(AuthenticatedUser p,long room,Install r){
  if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"METER_ACCESS_DENIED","Chỉ nhân viên quản lý đúng phạm vi được lắp đồng hồ.");
  var target=rooms.lockRoom(room);long property=((Number)target.get("property_id")).longValue();rooms.access(p,property);
  if(p.activeRole()==RoleCode.MANAGER)rooms.capability(p,property,PropertyAuthorization.Capability.CONTRACT_APPROVE);
  String blocked=blockedReason(room,target);if(blocked!=null)throw conflict("METER_INITIAL_INSTALL_NOT_ALLOWED",blocked);
  var existing=db.sql("SELECT * FROM utility_meters WHERE room_id=:room AND meter_type=:type").param("room",room).param("type",r.type()).query().listOfRows();
  if(!existing.isEmpty()){var m=existing.getFirst();if(existing.size()==1&&"ACTIVE".equals(m.get("status"))&&r.code().trim().equals(m.get("meter_code"))&&r.reading().compareTo(new BigDecimal(m.get("current_reading").toString()))==0)return Map.of("id",m.get("id"));throw conflict("METER_ALREADY_INSTALLED","Đã có công tơ, kể cả công tơ ngừng hoạt động; sử dụng quy trình thay có chỉ số tháo/lắp.");}
  if(db.sql("SELECT COUNT(*) FROM utility_meters WHERE meter_code=:code").param("code",r.code().trim()).query(Long.class).single()>0)throw conflict("METER_CODE_EXISTS","Mã công tơ đã được đăng ký; kiểm tra mã thực tế.");
  var key=new GeneratedKeyHolder();try{db.sql("INSERT INTO utility_meters(room_id,meter_type,meter_code,current_reading,reading_date,status) VALUES(:room,:type,:code,:reading,CURRENT_DATE,'ACTIVE')").param("room",room).param("type",r.type()).param("code",r.code().trim()).param("reading",r.reading()).update(key,"id");}catch(org.springframework.dao.DuplicateKeyException e){throw conflict("METER_CODE_EXISTS","Mã công tơ hoặc loại công tơ đã được đăng ký; vui lòng tải lại.");}long id=key.getKey().longValue();
  db.sql("INSERT INTO utility_meter_events(meter_id,old_code,new_code,old_reading,new_reading,reason,evidence_reference,actor_id) VALUES(:id,'INITIAL',:code,0,:reading,:reason,:reference,:actor)").param("id",id).param("code",r.code().trim()).param("reading",r.reading()).param("reason",r.reason()).param("reference",r.reference()).param("actor",p.id()).update();
  new SecurityAudit(db).record(p.id(),"METER_INSTALLED","ROOM",room,"SUCCESS","meter="+id+"; "+r.reference());return Map.of("id",id);
 }
 private AuthException conflict(String code,String message){return new AuthException(HttpStatus.CONFLICT,code,message);}
}
