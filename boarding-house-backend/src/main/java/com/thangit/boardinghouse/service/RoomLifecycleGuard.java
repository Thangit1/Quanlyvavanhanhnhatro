package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** One lock order and one writer for operational room status. Call from a transaction. */
@Service
public class RoomLifecycleGuard {
    private final JdbcClient jdbc;
    public RoomLifecycleGuard(JdbcClient jdbc){this.jdbc=jdbc;}
    public void capability(AuthenticatedUser p,long property,com.thangit.boardinghouse.security.PropertyAuthorization.Capability capability){new com.thangit.boardinghouse.security.PropertyAuthorization(jdbc,new com.thangit.boardinghouse.security.SecurityAudit(jdbc)).require(p,property,capability);}
    private static final String LIVE="'PENDING_CONFIRMATION','ACTIVE','EXPIRING','TERMINATION_REQUESTED','EXPIRED','SETTLING'";
    private static final String HANDOVER="EXISTS(SELECT 1 FROM rental_checkouts x WHERE x.contract_id=c.id AND x.actual_checkout_at IS NOT NULL AND x.status IN ('SETTLEMENT','COMPLETED'))";

    public Map<String,Object> lockRoom(long id) {
        long owner=jdbc.sql("SELECT p.owner_id FROM rooms r JOIN properties p ON p.id=r.property_id WHERE r.id=:id").param("id",id).query(Long.class).optional().orElseThrow(()->error("ROOM_NOT_FOUND","Không tìm thấy phòng."));
        jdbc.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",owner).query(Long.class).single();
        return jdbc.sql("SELECT r.*,p.status property_status FROM rooms r JOIN properties p ON p.id=r.property_id WHERE r.id=:id FOR UPDATE").param("id",id).query(RoomLifecycleGuard::row).single();
    }
    public void lockBooking(long id){lockReference("SELECT room_id FROM rental_bookings WHERE id=:id",id);}
    public void propertyCanStop(long property){
        long owner=jdbc.sql("SELECT owner_id FROM properties WHERE id=:id").param("id",property).query(Long.class).single();
        jdbc.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",owner).query(Long.class).single();
        for(long room:jdbc.sql("SELECT id FROM rooms WHERE property_id=:id ORDER BY id FOR UPDATE").param("id",property).query(Long.class).list())
            if(physicalOccupancy(room,null)||bookings(room,null))throw error("PROPERTY_HAS_LIVE_COMMITMENTS","Khu trọ còn booking, hợp đồng hoặc người ở chưa bàn giao.");
    }
    public void lockContract(long id){lockReference("SELECT room_id FROM contracts WHERE id=:id",id);}
    public void lockCheckin(long id){lockReference("SELECT c.room_id FROM rental_checkins x JOIN contracts c ON c.id=x.contract_id WHERE x.id=:id",id);}
    public void lockCheckout(long id){lockReference("SELECT c.room_id FROM rental_checkouts x JOIN contracts c ON c.id=x.contract_id WHERE x.id=:id",id);}
    private void lockReference(String sql,long id){jdbc.sql(sql).param("id",id).query(Long.class).optional().ifPresent(this::lockRoom);}
    public void access(AuthenticatedUser p,long property){
        if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"ROOM_ACCESS_DENIED","Bạn không có quyền vận hành phòng.");
        String scope=p.activeRole()==RoleCode.OWNER?"p.owner_id=:user":"EXISTS(SELECT 1 FROM property_managers m WHERE m.property_id=p.id AND m.manager_id=:user)";
        if(jdbc.sql("SELECT COUNT(*) FROM properties p WHERE p.id=:id AND "+scope).param("id",property).param("user",p.id()).query(Long.class).single()==0)throw new AuthException(HttpStatus.FORBIDDEN,"PROPERTY_ACCESS_DENIED","Phòng không thuộc phạm vi được phân quyền.");
    }
    public boolean physicalOccupancy(long room,Long excludingContract){
        return !jdbc.sql("SELECT c.id FROM contracts c WHERE c.room_id=:room AND (:excluded IS NULL OR c.id<>:excluded) AND c.status IN ("+LIVE+") AND NOT "+HANDOVER+" FOR UPDATE")
                .param("room",room).param("excluded",excludingContract).query(Long.class).list().isEmpty()
            || !jdbc.sql("SELECT id FROM tenant_residences WHERE room_id=:room AND status='ACTIVE' AND (:excluded IS NULL OR contract_id IS NULL OR contract_id<>:excluded) FOR UPDATE")
                .param("room",room).param("excluded",excludingContract).query(Long.class).list().isEmpty()
            || !jdbc.sql("SELECT ci.id FROM rental_checkins ci JOIN contracts c ON c.id=ci.contract_id WHERE c.room_id=:room AND ci.status='COMPLETED' AND (:excluded IS NULL OR c.id<>:excluded) AND NOT "+HANDOVER+" FOR UPDATE")
                .param("room",room).param("excluded",excludingContract).query(Long.class).list().isEmpty();
    }
    public boolean bookings(long room,Long excludingBooking){return !jdbc.sql("SELECT id FROM rental_bookings WHERE room_id=:room AND (:excluded IS NULL OR id<>:excluded) AND status IN ('RESERVED','DEPOSITED','CONTRACT_CREATED') FOR UPDATE")
            .param("room",room).param("excluded",excludingBooking).query(Long.class).list().isEmpty();}
    public boolean maintenance(long room){return !jdbc.sql("SELECT id FROM maintenance_requests WHERE room_id=:room AND status NOT IN ('RESOLVED','CANCELLED','REJECTED') FOR UPDATE")
            .param("room",room).query(Long.class).list().isEmpty();}
    public void availableForBooking(long id){var r=lockRoom(id);
        if(!"ACTIVE".equals(r.get("property_status"))||!Set.of("VACANT","READY").contains(r.get("status")))throw error("ROOM_NOT_AVAILABLE","Phòng chưa sẵn sàng nhận giữ chỗ.");
        if(physicalOccupancy(id,null)||bookings(id,null))throw error("ROOM_ALREADY_COMMITTED","Phòng còn hợp đồng, người ở hoặc booking có hiệu lực.");
        if(maintenance(id))throw error("ROOM_MAINTENANCE_PENDING","Phòng còn công việc bảo trì chưa được nghiệm thu.");
    }
    public void newContract(long room,LocalDate start,LocalDate end,long booking){var r=lockRoom(room);
        if(!"ACTIVE".equals(r.get("property_status"))||!Set.of("RESERVED","VACANT","READY").contains(r.get("status")))throw error("ROOM_NOT_AVAILABLE","Phòng không còn sẵn sàng để lập hợp đồng.");
        contractDates(room,start,end,null,booking);
        if(physicalOccupancy(room,null))throw error("ROOM_OCCUPANCY_CONFLICT","Hợp đồng cũ hoặc người ở chưa bàn giao phòng.");
        if(maintenance(room))throw error("ROOM_MAINTENANCE_PENDING","Cần nghiệm thu bảo trì trước khi lập hợp đồng.");
    }
    public void checkout(long contract,LocalDate actual){lockContract(contract);
        var c=jdbc.sql("SELECT * FROM contracts WHERE id=:id FOR UPDATE").param("id",contract).query(RoomLifecycleGuard::row).single();var r=lockRoom(num(c,"room_id"));
        if(!Set.of("ACTIVE","EXPIRING","EXPIRED","TERMINATION_REQUESTED").contains(c.get("status"))||!Set.of("OCCUPIED","NOTICE").contains(r.get("status")))throw error("CHECKOUT_OCCUPANCY_INVALID","Phòng/hợp đồng không còn trong lượt cư trú cần bàn giao.");
        if(actual!=null&&(actual.isAfter(LocalDate.now())||actual.isBefore(date(c.get("start_date")))))throw error("CHECKOUT_DATE_INVALID","Ngày bàn giao thực tế không hợp lệ.");
        if(physicalOccupancy(num(c,"room_id"),contract))throw error("ROOM_OCCUPANCY_CONFLICT","Phòng có dữ liệu chiếm dụng xung đột; cần đối soát trước khi trả phòng.");
    }
    public void contractDates(long room,LocalDate start,LocalDate end,Long excludedContract,Long excludedBooking){
        if(start==null||end==null||!start.isBefore(end))throw error("CONTRACT_DATE_INVALID","Khoảng thuê [ngày bắt đầu, ngày kết thúc) phải có độ dài dương.");
        var conflicts=jdbc.sql("SELECT c.id FROM contracts c WHERE c.room_id=:room AND (:excluded IS NULL OR c.id<>:excluded) AND c.status IN ("+LIVE+") AND c.start_date<:end AND :start<c.end_date AND NOT "+HANDOVER+" FOR UPDATE")
                .param("room",room).param("excluded",excludedContract).param("start",start).param("end",end).query(Long.class).list();
        if(!conflicts.isEmpty())throw error("CONTRACT_DATE_CONFLICT","Thời gian thuê chồng lấn hợp đồng đã cam kết.");
        if(bookings(room,excludedBooking))throw error("BOOKING_CONFLICT","Phòng có lượt giữ chỗ khác; hệ thống chưa hỗ trợ nhiều lượt đặt trước theo lịch.");
    }
    public void checkin(long contract,LocalDate today){
        lockContract(contract);
        // Source occupancy must actually end before a replacement contract is handed over.
        if(jdbc.sql("SELECT COUNT(*) FROM contract_change_requests q LEFT JOIN rental_checkouts x ON x.id=q.checkout_id WHERE q.target_contract_id=:id AND (q.status<>'PREPARED' OR x.actual_checkout_at IS NULL OR DATE(x.actual_checkout_at)+INTERVAL x.include_handover_day DAY>:date) FOR UPDATE").param("id",contract).param("date",today).query(Long.class).single()>0)throw error("TRANSFER_OLD_HANDOVER_REQUIRED","Cần bàn giao phòng cũ và phân tách ngày tính tiền trước nhận phòng mới.");
        lockContract(contract);var c=jdbc.sql("SELECT * FROM contracts WHERE id=:id FOR UPDATE").param("id",contract).query(RoomLifecycleGuard::row).single();long room=num(c,"room_id");var r=lockRoom(room);
        if(!"PENDING_CONFIRMATION".equals(c.get("status")))throw error("CONTRACT_NOT_READY_FOR_CHECKIN","Hợp đồng không còn chờ nhận phòng.");
        if(today.isBefore(date(c.get("start_date")))||!today.isBefore(date(c.get("end_date"))))throw error("CHECKIN_DATE_INVALID","Ngày nhận phòng nằm ngoài khoảng thuê đã thỏa thuận.");
        if(!"ACTIVE".equals(r.get("property_status"))||!Set.of("RESERVED","VACANT","READY").contains(r.get("status")))throw error("ROOM_NOT_READY_FOR_CHECKIN","Phòng đang có người ở, vệ sinh, bảo trì hoặc ngừng khai thác.");
        var linked=jdbc.sql("SELECT id FROM rental_bookings WHERE contract_id=:id AND room_id=:room AND status='CONTRACT_CREATED' FOR UPDATE").param("id",contract).param("room",room).query(Long.class).list();
        if(linked.size()!=1)throw error("BOOKING_CONTRACT_MISMATCH","Hợp đồng chờ nhận phòng cần đúng một booking tương ứng.");
        if(physicalOccupancy(room,contract)||bookings(room,linked.getFirst()))throw error("ROOM_OCCUPANCY_CONFLICT","Phòng còn người ở, hợp đồng hoặc check-in khác chưa bàn giao.");
        contractDates(room,date(c.get("start_date")),date(c.get("end_date")),contract,linked.getFirst());
        if(maintenance(room))throw error("ROOM_MAINTENANCE_PENDING","Công việc bảo trì của phòng chưa được nghiệm thu.");
    }
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void transition(long room,String next,String reason,Long actor){
        if(!Set.of("VACANT","READY","RESERVED","OCCUPIED","NOTICE","CLEANING","MAINTENANCE","INACTIVE").contains(next))throw error("ROOM_STATUS_INVALID","Trạng thái phòng không hợp lệ.");
        var r=lockRoom(room);String before=r.get("status").toString();if(before.equals(next))return;
        if(jdbc.sql("UPDATE rooms SET status=:next,version=version+1 WHERE id=:id AND status=:before AND version=:version")
                .param("next",next).param("id",room).param("before",before).param("version",r.get("version")).update()!=1)throw error("ROOM_VERSION_CONFLICT","Phòng vừa được cập nhật; vui lòng tải lại.");
        jdbc.sql("INSERT INTO room_status_history(room_id,old_status,new_status,reason,actor_id) VALUES(:room,:before,:next,:reason,:actor)")
                .param("room",room).param("before",before).param("next",next).param("reason",reason).param("actor",actor).update();
    }
    public void release(long room,String reason,Long actor){var r=lockRoom(room);
        if(physicalOccupancy(room,null)||bookings(room,null))return;
        String status=r.get("status").toString();
        if("RESERVED".equals(status))transition(room,maintenance(room)?"MAINTENANCE":"VACANT",reason,actor);
        else if(Set.of("OCCUPIED","NOTICE").contains(status))transition(room,maintenance(room)?"MAINTENANCE":"CLEANING",reason,actor);
    }
    public void manual(long room,String next,Long version,String reason,boolean confirmed,long actor){var r=lockRoom(room);
        if(version==null||num(r,"version")!=version)throw error("ROOM_VERSION_CONFLICT","Thiếu version hoặc phòng vừa được người khác cập nhật.");
        if(reason==null||reason.isBlank())throw error("ROOM_STATUS_REASON_REQUIRED","Cần nêu lý do thay đổi trạng thái phòng.");
        String before=r.get("status").toString();
        Map<String,Set<String>> graph=Map.of("VACANT",Set.of("READY","MAINTENANCE","INACTIVE"),"READY",Set.of("VACANT","MAINTENANCE","INACTIVE"),"CLEANING",Set.of("READY","MAINTENANCE"),"MAINTENANCE",Set.of("READY","CLEANING","INACTIVE"),"INACTIVE",Set.of("VACANT","MAINTENANCE"));
        if(!graph.getOrDefault(before,Set.of()).contains(next))throw error("ROOM_STATUS_TRANSITION_INVALID","Trạng thái giữ chỗ/có người ở/thông báo trả phải thay đổi qua quy trình thuê; không được ghi đè thủ công.");
        if(physicalOccupancy(room,null)||bookings(room,null))throw error("ROOM_HAS_LIVE_COMMITMENT","Phòng còn người ở, hợp đồng hoặc giữ chỗ có hiệu lực.");
        if(Set.of("VACANT","READY").contains(next)&&maintenance(room))throw error("ROOM_MAINTENANCE_PENDING","Công việc bảo trì bắt buộc chưa được nghiệm thu.");
        if(Set.of("VACANT","READY").contains(next)&&!"ACTIVE".equals(r.get("property_status")))throw error("PROPERTY_INACTIVE","Khu trọ đã ngừng khai thác.");
        if("READY".equals(next)&&!confirmed)throw error("ROOM_READINESS_CONFIRMATION_REQUIRED","Cần xác nhận đã kiểm tra vệ sinh, tài sản và điều kiện khai thác.");
        transition(room,next,reason+(confirmed?"; đã nghiệm thu điều kiện khai thác":""),actor);
    }
    public void resident(long room,Long contract,String role,long tenant){var r=lockRoom(room);
        if(contract==null)throw error("RESIDENCE_CONTRACT_REQUIRED","Nhận phòng mới phải qua booking, hợp đồng và check-in.");
        var c=jdbc.sql("SELECT * FROM contracts WHERE id=:id FOR UPDATE").param("id",contract).query(RoomLifecycleGuard::row).optional().orElseThrow(()->error("CONTRACT_NOT_FOUND","Không tìm thấy hợp đồng cư trú."));
        if(num(c,"room_id")!=room||!Set.of("ACTIVE","EXPIRING","TERMINATION_REQUESTED").contains(c.get("status"))||!Set.of("OCCUPIED","NOTICE").contains(r.get("status")))throw error("RESIDENCE_CONTRACT_MISMATCH","Chỉ bổ sung cư trú vào đúng phòng và hợp đồng đã nhận phòng.");
        if("REPRESENTATIVE".equals(role)&&(c.get("tenant_profile_id")==null||num(c,"tenant_profile_id")!=tenant))throw error("CONTRACT_REPRESENTATIVE_MISMATCH","Người đại diện không khớp hợp đồng.");
        if(physicalOccupancy(room,contract))throw error("ROOM_OCCUPANCY_CONFLICT","Có hợp đồng khác đang chiếm dụng phòng.");
        long residents=jdbc.sql("SELECT COUNT(*) FROM tenant_residences WHERE room_id=:room AND status='ACTIVE' AND tenant_profile_id<>:tenant").param("room",room).param("tenant",tenant).query(Long.class).single();
        long legacy=jdbc.sql("SELECT COUNT(*) FROM contract_occupants WHERE contract_id=:id AND residence_status='ACTIVE'").param("id",contract).query(Long.class).single();
        if(Math.max(residents,Math.max(num(c,"occupant_count"),legacy+1))+1>num(r,"capacity"))throw error("ROOM_CAPACITY_EXCEEDED","Thêm cư trú sẽ vượt sức chứa phòng.");
        if(!"REPRESENTATIVE".equals(role)&&jdbc.sql("SELECT COUNT(*) FROM tenant_residences WHERE tenant_profile_id=:tenant AND room_id<>:room AND status='ACTIVE'").param("tenant",tenant).param("room",room).query(Long.class).single()>0)throw error("RESIDENCE_CONFLICT","Người ở cùng còn cư trú tại phòng khác; phải xử lý chuyển đi trước.");
    }
    public void maintenanceOpened(long room,long actor){var r=lockRoom(room);if(Set.of("VACANT","READY","CLEANING").contains(r.get("status")))transition(room,"MAINTENANCE","Phát sinh công việc bảo trì cần nghiệm thu",actor);}
    public void extension(long contract,LocalDate end){lockContract(contract);var c=jdbc.sql("SELECT * FROM contracts WHERE id=:id FOR UPDATE").param("id",contract).query(RoomLifecycleGuard::row).single();
        if(!Set.of("ACTIVE","EXPIRING","EXPIRED").contains(c.get("status"))||!end.isAfter(date(c.get("end_date"))))throw error("EXTENSION_DATE_INVALID","Chỉ gia hạn hợp đồng đang thuê sang ngày kết thúc muộn hơn.");
        Long booking=jdbc.sql("SELECT id FROM rental_bookings WHERE contract_id=:id").param("id",contract).query(Long.class).optional().orElse(null);
        contractDates(num(c,"room_id"),date(c.get("start_date")),end,contract,booking);
    }
    @Deprecated
    public void approveExtension(AuthenticatedUser p,long contract,long request,String reason){throw error("EXTENSION_AGREEMENT_REQUIRED","Use the versioned agreement workflow and tenant confirmation");}
    @Transactional(readOnly=true)
    public List<Map<String,Object>> extensions(AuthenticatedUser p,long contract){
        long property=jdbc.sql("SELECT r.property_id FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE c.id=:id").param("id",contract).query(Long.class).optional().orElseThrow(()->error("CONTRACT_NOT_FOUND","Không tìm thấy hợp đồng."));
        access(p,property);return jdbc.sql("SELECT id,requested_end_date,note,status,created_at,reviewed_by,reviewed_at,review_reason FROM contract_extension_requests WHERE contract_id=:id ORDER BY created_at DESC,id DESC").param("id",contract).query().listOfRows();
    }
    public static long num(Map<String,Object> r,String k){return ((Number)r.get(k)).longValue();}
    public static LocalDate date(Object v){return v instanceof LocalDate d?d:((java.sql.Date)v).toLocalDate();}
    private static Map<String,Object> row(ResultSet rs,int n)throws SQLException{Map<String,Object> r=new LinkedHashMap<>();for(int i=1;i<=rs.getMetaData().getColumnCount();i++)r.put(rs.getMetaData().getColumnLabel(i),rs.getObject(i));return r;}
    private static AuthException error(String c,String m){return new AuthException(HttpStatus.CONFLICT,c,m);}
}
