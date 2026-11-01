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
 @Transactional public Map<String,Object> install(AuthenticatedUser p,long room,Install r){
  if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"METER_ACCESS_DENIED","Chỉ nhân viên quản lý đúng phạm vi được lắp đồng hồ.");
  var target=rooms.lockRoom(room);long property=((Number)target.get("property_id")).longValue();rooms.access(p,property);
  var existing=db.sql("SELECT * FROM utility_meters WHERE room_id=:room AND meter_type=:type AND status='ACTIVE'").param("room",room).param("type",r.type()).query().listOfRows();
  if(!existing.isEmpty()){var m=existing.getFirst();if(existing.size()==1&&r.code().trim().equals(m.get("meter_code"))&&r.reading().compareTo(new BigDecimal(m.get("current_reading").toString()))==0)return Map.of("id",m.get("id"));throw conflict("METER_ALREADY_INSTALLED","Đã có đồng hồ; sử dụng quy trình thay đồng hồ có chỉ số tháo/lắp.");}
  if(Set.of("OCCUPIED","NOTICE").contains(target.get("status"))||db.sql("SELECT COUNT(*) FROM contracts WHERE room_id=:room AND operational_ended_at IS NULL AND status NOT IN ('PENDING_CONFIRMATION','CANCELLED','TERMINATED')").param("room",room).query(Long.class).single()>0)throw conflict("METER_INITIAL_INSTALL_NOT_ALLOWED","Phòng đang sử dụng; không được thay dữ liệu đo bằng lắp ban đầu.");
  var key=new GeneratedKeyHolder();db.sql("INSERT INTO utility_meters(room_id,meter_type,meter_code,current_reading,reading_date,status) VALUES(:room,:type,:code,:reading,CURRENT_DATE,'ACTIVE')").param("room",room).param("type",r.type()).param("code",r.code().trim()).param("reading",r.reading()).update(key,"id");long id=key.getKey().longValue();
  db.sql("INSERT INTO utility_meter_events(meter_id,old_code,new_code,old_reading,new_reading,reason,evidence_reference,actor_id) VALUES(:id,'INITIAL',:code,0,:reading,:reason,:reference,:actor)").param("id",id).param("code",r.code().trim()).param("reading",r.reading()).param("reason",r.reason()).param("reference",r.reference()).param("actor",p.id()).update();
  new SecurityAudit(db).record(p.id(),"METER_INSTALLED","ROOM",room,"SUCCESS","meter="+id+"; "+r.reference());return Map.of("id",id);
 }
 private AuthException conflict(String code,String message){return new AuthException(HttpStatus.CONFLICT,code,message);}
}
