package com.thangit.boardinghouse.service;

import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingExpirationService {
    private final JdbcClient jdbc;
    private final RoomLifecycleGuard rooms;
    public BookingExpirationService(JdbcClient jdbc,RoomLifecycleGuard rooms){this.jdbc=jdbc;this.rooms=rooms;}
    public List<Long> due(){return jdbc.sql("SELECT id FROM rental_bookings WHERE status IN ('RESERVED','DEPOSITED') AND contract_id IS NULL AND reservation_end<=CURRENT_DATE ORDER BY reservation_end,id LIMIT 200").query(Long.class).list();}
    @Transactional
    public boolean expire(long id){
        rooms.lockBooking(id);
        var rows=jdbc.sql("SELECT status,reservation_end,contract_id,room_id FROM rental_bookings WHERE id=:id FOR UPDATE").param("id",id).query().listOfRows();
        if(rows.isEmpty())return false;var b=rows.getFirst();String before=b.get("status").toString();
        if(!Set.of("RESERVED","DEPOSITED").contains(before)||b.get("contract_id")!=null||RoomLifecycleGuard.date(b.get("reservation_end")).isAfter(LocalDate.now()))return false;
        jdbc.sql("UPDATE rental_bookings SET status='EXPIRED',version=version+1 WHERE id=:id AND status=:before AND contract_id IS NULL").param("id",id).param("before",before).update();
        jdbc.sql("INSERT INTO rental_booking_history(booking_id,previous_status,new_status,description,actor_id) VALUES(:id,:before,'EXPIRED','Hết hạn giữ chỗ; số dư tiền giữ chỗ tiếp tục chờ xử lý theo thỏa thuận',NULL)").param("id",id).param("before",before).update();
        rooms.release(RoomLifecycleGuard.num(b,"room_id"),"Hết hạn giữ chỗ; không tự hoàn hoặc giữ lại tiền",null);return true;
    }
}
