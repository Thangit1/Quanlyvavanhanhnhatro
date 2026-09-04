package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.response.lifecycle.RentalLifecycleResponses.*;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class RentalLifecycleRepository {
    private final JdbcClient jdbc;
    public RentalLifecycleRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    private String scope(RoleCode role, String alias) {
        return role == RoleCode.OWNER ? alias + ".owner_id=:userId" :
                "EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id=" + alias +
                        ".id AND pm.manager_id=:userId)";
    }

    public boolean propertyAccess(long userId, RoleCode role, long propertyId) {
        return jdbc.sql("SELECT COUNT(*) FROM properties p WHERE p.id=:id AND " + scope(role,"p"))
                .param("id",propertyId).param("userId",userId).query(Long.class).single()>0;
    }
    public boolean tenantInProperty(long tenantProfileId,long propertyId){return jdbc.sql("SELECT COUNT(*) FROM tenant_residences WHERE tenant_profile_id=:tenant AND property_id=:property")
            .param("tenant",tenantProfileId).param("property",propertyId).query(Long.class).single()>0;}
    public boolean hasCheckin(long contractId){return jdbc.sql("SELECT COUNT(*) FROM rental_checkins WHERE contract_id=:id").param("id",contractId).query(Long.class).single()>0;}
    public boolean hasCheckout(long contractId){return jdbc.sql("SELECT COUNT(*) FROM rental_checkouts WHERE contract_id=:id").param("id",contractId).query(Long.class).single()>0;}

    public Optional<Map<String,Object>> room(long id) {
        return jdbc.sql("SELECT r.*,p.name property_name FROM rooms r JOIN properties p ON p.id=r.property_id WHERE r.id=:id")
                .param("id",id).query(RentalLifecycleRepository::map).optional();
    }
    public Optional<Map<String,Object>> booking(long id) {
        return jdbc.sql("SELECT b.*,tp.user_id tenant_user_id FROM rental_bookings b JOIN tenant_profiles tp ON tp.id=b.tenant_profile_id WHERE b.id=:id")
                .param("id",id).query(RentalLifecycleRepository::map).optional();
    }
    public Optional<Map<String,Object>> contract(long id) {
        return jdbc.sql("""
                SELECT c.*,r.property_id,r.status room_status,tp.full_name tenant_name,
                  COALESCE((SELECT SUM(GREATEST(i.total_amount-i.paid_amount,0)) FROM invoices i
                    WHERE i.contract_id=c.id AND i.status<>'CANCELLED'),0) outstanding_debt
                FROM contracts c JOIN rooms r ON r.id=c.room_id
                LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id WHERE c.id=:id
                """).param("id",id).query(RentalLifecycleRepository::map).optional();
    }
    public Optional<Map<String,Object>> checkin(long id) {
        return jdbc.sql("SELECT ci.*,c.room_id,c.tenant_id,c.tenant_profile_id,r.property_id FROM rental_checkins ci JOIN contracts c ON c.id=ci.contract_id JOIN rooms r ON r.id=c.room_id WHERE ci.id=:id")
                .param("id",id).query(RentalLifecycleRepository::map).optional();
    }
    public Optional<Map<String,Object>> checkout(long id) {
        return jdbc.sql("SELECT co.*,c.room_id,c.tenant_id,c.tenant_profile_id,c.deposit_amount,r.property_id,ci.electricity_reading initial_electricity_reading,ci.water_reading initial_water_reading FROM rental_checkouts co JOIN contracts c ON c.id=co.contract_id JOIN rooms r ON r.id=c.room_id LEFT JOIN rental_checkins ci ON ci.id=(SELECT ci2.id FROM rental_checkins ci2 WHERE ci2.contract_id=c.id AND ci2.status='COMPLETED' ORDER BY ci2.id DESC LIMIT 1) WHERE co.id=:id")
                .param("id",id).query(RentalLifecycleRepository::map).optional();
    }

    public LifecycleBoard board(long userId, RoleCode role, Long propertyId) {
        String filter=scope(role,"p")+" AND (:propertyId IS NULL OR p.id=:propertyId)";
        Summary summary=jdbc.sql("""
                SELECT
                  (SELECT COUNT(*) FROM rental_bookings b JOIN properties p ON p.id=b.property_id WHERE %s AND b.status IN ('RESERVED','DEPOSITED')) reserved,
                  (SELECT COUNT(*) FROM rental_checkins x JOIN contracts c ON c.id=x.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE %s AND x.status IN ('DRAFT','READY')) awaiting,
                  (SELECT COUNT(*) FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE %s AND c.status IN ('ACTIVE','EXPIRING')) staying,
                  (SELECT COUNT(*) FROM rental_checkouts x JOIN contracts c ON c.id=x.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE %s AND x.status='REQUESTED') checkout_requested,
                  (SELECT COUNT(*) FROM rental_checkouts x JOIN contracts c ON c.id=x.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE %s AND x.status IN ('INSPECTION','SETTLEMENT')) settlement,
                  (SELECT COUNT(*) FROM rooms r JOIN properties p ON p.id=r.property_id WHERE %s AND r.status IN ('CLEANING','MAINTENANCE')) turnover
                """.formatted(filter,filter,filter,filter,filter,filter)).param("userId",userId).param("propertyId",propertyId)
                .query((rs,n)->new Summary(rs.getLong("reserved"),rs.getLong("awaiting"),rs.getLong("staying"),
                        rs.getLong("checkout_requested"),rs.getLong("settlement"),rs.getLong("turnover"))).single();
        return new LifecycleBoard(summary, properties(userId,role), rooms(userId,role,propertyId),
                tenants(userId,role,propertyId), contracts(userId,role,propertyId),
                bookings(userId,role,propertyId), checkins(userId,role,propertyId), checkouts(userId,role,propertyId));
    }

    private List<Option> properties(long userId,RoleCode role){return jdbc.sql("SELECT p.id,p.code,p.name,NULL parent_id,p.status FROM properties p WHERE "+scope(role,"p")+" ORDER BY p.name")
            .param("userId",userId).query((r,n)->option(r)).list();}
    private List<Option> rooms(long userId,RoleCode role,Long property){return jdbc.sql("SELECT r.id,r.code,CONCAT(p.name,' · Phòng ',r.code) name,p.id parent_id,r.status FROM rooms r JOIN properties p ON p.id=r.property_id WHERE "+scope(role,"p")+" AND (:propertyId IS NULL OR p.id=:propertyId) ORDER BY p.name,r.code")
            .param("userId",userId).param("propertyId",property).query((r,n)->option(r)).list();}
    private List<Option> tenants(long userId,RoleCode role,Long property){return jdbc.sql("""
            SELECT DISTINCT tp.id,tp.tenant_code code,tp.full_name name,tr.property_id parent_id,tp.status
            FROM tenant_profiles tp JOIN tenant_residences tr ON tr.tenant_profile_id=tp.id JOIN properties p ON p.id=tr.property_id
            WHERE %s AND (:propertyId IS NULL OR p.id=:propertyId) ORDER BY tp.full_name
            """.formatted(scope(role,"p"))).param("userId",userId).param("propertyId",property).query((r,n)->option(r)).list();}
    private List<Option> contracts(long userId,RoleCode role,Long property){return jdbc.sql("""
            SELECT c.id,c.code,CONCAT(c.code,' · ',COALESCE(tp.full_name,u.full_name),' · Phòng ',r.code) name,
              r.property_id parent_id,c.status
            FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id JOIN users u ON u.id=c.tenant_id
            LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id WHERE %s AND (:propertyId IS NULL OR p.id=:propertyId)
              AND c.status IN ('PENDING_CONFIRMATION','ACTIVE','EXPIRING') ORDER BY c.start_date DESC
            """.formatted(scope(role,"p"))).param("userId",userId).param("propertyId",property).query((r,n)->option(r)).list();}

    private List<BookingRow> bookings(long userId,RoleCode role,Long property){return jdbc.sql("""
            SELECT b.id,b.code,b.tenant_profile_id,tp.full_name tenant_name,p.id property_id,p.name property_name,
              r.id room_id,r.code room_code,b.reservation_start,b.reservation_end,b.deposit_amount,b.deposit_status,
              b.status,b.contract_id,b.version,b.updated_at FROM rental_bookings b JOIN tenant_profiles tp ON tp.id=b.tenant_profile_id
              JOIN rooms r ON r.id=b.room_id JOIN properties p ON p.id=b.property_id WHERE %s AND (:propertyId IS NULL OR p.id=:propertyId)
              ORDER BY FIELD(b.status,'DEPOSITED','RESERVED','CONTRACT_CREATED','CHECKED_IN','EXPIRED','CANCELLED'),b.updated_at DESC LIMIT 100
            """.formatted(scope(role,"p"))).param("userId",userId).param("propertyId",property).query((r,n)->new BookingRow(
                    r.getLong("id"),r.getString("code"),r.getLong("tenant_profile_id"),r.getString("tenant_name"),
                    r.getLong("property_id"),r.getString("property_name"),r.getLong("room_id"),r.getString("room_code"),
                    r.getObject("reservation_start",java.time.LocalDate.class),r.getObject("reservation_end",java.time.LocalDate.class),
                    r.getBigDecimal("deposit_amount"),r.getString("deposit_status"),r.getString("status"),nullableLong(r,"contract_id"),
                    r.getLong("version"),r.getObject("updated_at",LocalDateTime.class))).list();}
    private List<CheckinRow> checkins(long userId,RoleCode role,Long property){return jdbc.sql("""
            SELECT x.id,x.contract_id,c.code contract_code,COALESCE(tp.full_name,u.full_name) tenant_name,p.name property_name,
              r.id room_id,r.code room_code,x.scheduled_date,x.actual_checkin_at,x.status,x.identity_verified,x.contract_verified,
              x.deposit_verified,x.electricity_reading,x.water_reading,x.keys_cards_count,x.version
            FROM rental_checkins x JOIN contracts c ON c.id=x.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
              JOIN users u ON u.id=c.tenant_id LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id
            WHERE %s AND (:propertyId IS NULL OR p.id=:propertyId) ORDER BY FIELD(x.status,'READY','DRAFT','COMPLETED','CANCELLED'),x.scheduled_date LIMIT 100
            """.formatted(scope(role,"p"))).param("userId",userId).param("propertyId",property).query((r,n)->new CheckinRow(
                    r.getLong("id"),r.getLong("contract_id"),r.getString("contract_code"),r.getString("tenant_name"),r.getString("property_name"),
                    r.getLong("room_id"),r.getString("room_code"),r.getObject("scheduled_date",java.time.LocalDate.class),r.getObject("actual_checkin_at",LocalDateTime.class),
                    r.getString("status"),r.getBoolean("identity_verified"),r.getBoolean("contract_verified"),r.getBoolean("deposit_verified"),
                    r.getBigDecimal("electricity_reading"),r.getBigDecimal("water_reading"),r.getInt("keys_cards_count"),r.getLong("version"))).list();}
    private List<CheckoutRow> checkouts(long userId,RoleCode role,Long property){return jdbc.sql("""
            SELECT x.id,x.contract_id,c.code contract_code,COALESCE(tp.full_name,u.full_name) tenant_name,p.name property_name,
              r.id room_id,r.code room_code,x.requested_date,x.confirmed_date,x.actual_checkout_at,x.status,x.deposit_held,
              x.outstanding_debt,x.additional_charges,x.refund_amount,x.balance_due,x.reason,x.version
            FROM rental_checkouts x JOIN contracts c ON c.id=x.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
              JOIN users u ON u.id=c.tenant_id LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id
            WHERE %s AND (:propertyId IS NULL OR p.id=:propertyId) ORDER BY FIELD(x.status,'REQUESTED','INSPECTION','SETTLEMENT','COMPLETED','CANCELLED'),x.requested_date LIMIT 100
            """.formatted(scope(role,"p"))).param("userId",userId).param("propertyId",property).query((r,n)->new CheckoutRow(
                    r.getLong("id"),r.getLong("contract_id"),r.getString("contract_code"),r.getString("tenant_name"),r.getString("property_name"),
                    r.getLong("room_id"),r.getString("room_code"),r.getObject("requested_date",java.time.LocalDate.class),r.getObject("confirmed_date",java.time.LocalDate.class),
                    r.getObject("actual_checkout_at",LocalDateTime.class),r.getString("status"),r.getBigDecimal("deposit_held"),r.getBigDecimal("outstanding_debt"),
                    r.getBigDecimal("additional_charges"),r.getBigDecimal("refund_amount"),r.getBigDecimal("balance_due"),r.getString("reason"),r.getLong("version"))).list();}

    public Created createBooking(String code,long propertyId,CreateBooking r,long actor){GeneratedKeyHolder kh=new GeneratedKeyHolder();jdbc.sql("""
            INSERT INTO rental_bookings(code,property_id,room_id,tenant_profile_id,status,reservation_start,reservation_end,deposit_amount,deposit_status,source,note,created_by)
            VALUES(:code,:property,:room,:tenant,'RESERVED',:start,:end,:deposit,'UNPAID',:source,:note,:actor)
            """).param("code",code).param("property",propertyId).param("room",r.roomId()).param("tenant",r.tenantProfileId()).param("start",r.reservationStart())
            .param("end",r.reservationEnd()).param("deposit",r.depositAmount()).param("source",clean(r.source())).param("note",clean(r.note())).param("actor",actor).update(kh,"id");
        long id=kh.getKey().longValue();history(id,null,"RESERVED","Đã giữ phòng",actor);return new Created(id,code,"RESERVED");}
    public int changeBooking(long id,String before,ChangeBookingStatus r,long actor){String deposit="DEPOSITED".equals(r.status())?",deposit_status='PAID'":"";int n=jdbc.sql("UPDATE rental_bookings SET status=:status"+deposit+",version=version+1 WHERE id=:id AND version=:version")
            .param("status",r.status()).param("id",id).param("version",r.version()==null?0:r.version()).update();if(n>0)history(id,before,r.status(),r.reason(),actor);return n;}
    public void history(long id,String before,String after,String description,long actor){jdbc.sql("INSERT INTO rental_booking_history(booking_id,previous_status,new_status,description,actor_id) VALUES(:id,:before,:after,:description,:actor)")
            .param("id",id).param("before",before).param("after",after).param("description",clean(description)).param("actor",actor).update();}
    public void roomStatus(long room,String status,String reason,long actor){Map<String,Object> raw=room(room).orElseThrow();String before=String.valueOf(raw.get("status"));jdbc.sql("UPDATE rooms SET status=:status,version=version+1 WHERE id=:id").param("status",status).param("id",room).update();jdbc.sql("INSERT INTO room_status_history(room_id,old_status,new_status,reason,actor_id) VALUES(:room,:before,:after,:reason,:actor)").param("room",room).param("before",before).param("after",status).param("reason",reason).param("actor",actor).update();}
    public void releaseRoomAfterBooking(long roomId,long excludedBooking,long actor){long active=jdbc.sql("SELECT COUNT(*) FROM rental_bookings WHERE room_id=:room AND id<>:booking AND status IN ('RESERVED','DEPOSITED','CONTRACT_CREATED')").param("room",roomId).param("booking",excludedBooking).query(Long.class).single();if(active==0){Map<String,Object>r=room(roomId).orElseThrow();if("RESERVED".equals(String.valueOf(r.get("status"))))roomStatus(roomId,"VACANT","Booking không còn hiệu lực",actor);}}

    public Created createContract(long bookingId,String code,Map<String,Object>b,CreateContract r,long actor){GeneratedKeyHolder kh=new GeneratedKeyHolder();jdbc.sql("""
            INSERT INTO contracts(room_id,tenant_id,tenant_profile_id,code,contract_type,start_date,end_date,deposit_amount,occupant_count,status,payment_cycle,payment_due_day,notice_period_days)
            VALUES(:room,:user,:profile,:code,'FIXED_TERM',:start,:end,:deposit,1,'PENDING_CONFIRMATION','MONTHLY',:due,:notice)
            """).param("room",b.get("room_id")).param("user",b.get("tenant_user_id")).param("profile",b.get("tenant_profile_id")).param("code",code)
            .param("start",r.startDate()).param("end",r.endDate()).param("deposit",r.depositAmount()).param("due",r.paymentDueDay()).param("notice",r.noticePeriodDays()).update(kh,"id");
        long id=kh.getKey().longValue();jdbc.sql("UPDATE rental_bookings SET contract_id=:contract,status='CONTRACT_CREATED',version=version+1 WHERE id=:booking").param("contract",id).param("booking",bookingId).update();history(bookingId,String.valueOf(b.get("status")),"CONTRACT_CREATED","Đã tạo hợp đồng "+code,actor);return new Created(id,code,"PENDING_CONFIRMATION");}

    public Created prepareCheckin(PrepareCheckin r,long actor){GeneratedKeyHolder kh=new GeneratedKeyHolder();jdbc.sql("INSERT INTO rental_checkins(contract_id,booking_id,scheduled_date,status,note,created_by) VALUES(:contract,COALESCE(:booking,(SELECT id FROM rental_bookings WHERE contract_id=:contract LIMIT 1)),:date,'READY',:note,:actor)")
            .param("contract",r.contractId()).param("booking",r.bookingId()).param("date",r.scheduledDate()).param("note",clean(r.note())).param("actor",actor).update(kh,"id");long id=kh.getKey().longValue();
        if(r.assets()==null||r.assets().isEmpty())jdbc.sql("INSERT INTO rental_checkin_assets(checkin_id,room_asset_id,asset_name,quantity,condition_status,note) SELECT :id,ra.id,ra.name,ra.quantity,ra.condition_status,ra.note FROM room_assets ra JOIN contracts c ON c.room_id=ra.room_id WHERE c.id=:contract").param("id",id).param("contract",r.contractId()).update();
        else r.assets().forEach(a->jdbc.sql("INSERT INTO rental_checkin_assets(checkin_id,room_asset_id,asset_name,quantity,condition_status,note) VALUES(:id,:asset,:name,:quantity,:condition,:note)").param("id",id).param("asset",a.roomAssetId()).param("name",a.assetName().trim()).param("quantity",a.quantity()).param("condition",a.conditionStatus()).param("note",clean(a.note())).update());
        return new Created(id,"CI-"+String.format("%06d",id),"READY");}
    public int completeCheckin(long id,CompleteCheckin r,long actor){int n=jdbc.sql("""
            UPDATE rental_checkins SET status='COMPLETED',identity_verified=:identity,contract_verified=:contract,
              deposit_verified=:deposit,electricity_reading=:electricity,water_reading=:water,keys_cards_count=:keys,
              note=:note,actual_checkin_at=NOW(),completed_by=:actor,version=version+1 WHERE id=:id AND version=:version AND status='READY'
            """).param("identity",r.identityVerified()).param("contract",r.contractVerified()).param("deposit",r.depositVerified())
            .param("electricity",r.electricityReading()).param("water",r.waterReading()).param("keys",r.keysCardsCount()).param("note",clean(r.note()))
            .param("actor",actor).param("id",id).param("version",r.version()==null?0:r.version()).update();return n;}
    public void activateAfterCheckin(Map<String,Object> ci,CompleteCheckin r,long actor){long contract=num(ci,"contract_id"),room=num(ci,"room_id"),profile=num(ci,"tenant_profile_id");jdbc.sql("UPDATE contracts SET status='ACTIVE',signed_at=COALESCE(signed_at,NOW()) WHERE id=:id").param("id",contract).update();roomStatus(room,"OCCUPIED","Hoàn tất check-in",actor);
        jdbc.sql("UPDATE rental_bookings SET status='CHECKED_IN',version=version+1 WHERE id=(SELECT booking_id FROM rental_checkins WHERE id=:id) ").param("id",ci.get("id")).update();
        long existing=jdbc.sql("SELECT COUNT(*) FROM tenant_residences WHERE tenant_profile_id=:profile AND contract_id=:contract AND status='ACTIVE'").param("profile",profile).param("contract",contract).query(Long.class).single();if(existing==0)jdbc.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,room_id,contract_id,residence_role,status,move_in_date,created_by) VALUES(:profile,:property,:room,:contract,'REPRESENTATIVE','ACTIVE',CURRENT_DATE,:actor)").param("profile",profile).param("property",ci.get("property_id")).param("room",room).param("contract",contract).param("actor",actor).update();
        updateMeter(room,"ELECTRICITY",r.electricityReading());updateMeter(room,"WATER",r.waterReading());}

    public Created requestCheckout(String code,RequestCheckout r,Map<String,Object> c,long actor){GeneratedKeyHolder kh=new GeneratedKeyHolder();jdbc.sql("INSERT INTO rental_checkouts(contract_id,requested_date,status,deposit_held,outstanding_debt,reason,created_by) VALUES(:contract,:date,'REQUESTED',:deposit,:debt,:reason,:actor)")
            .param("contract",r.contractId()).param("date",r.requestedDate()).param("deposit",c.get("deposit_amount")).param("debt",c.get("outstanding_debt")).param("reason",r.reason().trim()).param("actor",actor).update(kh,"id");long id=kh.getKey().longValue();roomStatus(num(c,"room_id"),"NOTICE","Khách đã yêu cầu trả phòng",actor);return new Created(id,code,"REQUESTED");}
    public int settleCheckout(long id,CompleteCheckout r,BigDecimal debt,BigDecimal deposit,BigDecimal charges,BigDecimal refund,BigDecimal due,long actor){int n=jdbc.sql("""
            UPDATE rental_checkouts SET confirmed_date=:date,actual_checkout_at=NOW(),status='COMPLETED',final_electricity_reading=:electricity,
              final_water_reading=:water,outstanding_debt=:debt,deposit_held=:deposit,additional_charges=:charges,refund_amount=:refund,
              balance_due=:due,note=:note,completed_by=:actor,version=version+1 WHERE id=:id AND version=:version AND status IN ('REQUESTED','INSPECTION','SETTLEMENT')
            """).param("date",r.actualDate()).param("electricity",r.finalElectricityReading()).param("water",r.finalWaterReading()).param("debt",debt).param("deposit",deposit).param("charges",charges).param("refund",refund).param("due",due).param("note",clean(r.note())).param("actor",actor).param("id",id).param("version",r.version()==null?0:r.version()).update();if(n>0&&r.charges()!=null)r.charges().forEach(c->jdbc.sql("INSERT INTO rental_checkout_charges(checkout_id,charge_type,description,amount) VALUES(:id,:type,:description,:amount)").param("id",id).param("type",c.chargeType()).param("description",c.description().trim()).param("amount",c.amount()).update());return n;}
    public String finishCheckout(Map<String,Object> co,CompleteCheckout r,long actor){long contract=num(co,"contract_id"),room=num(co,"room_id"),profile=num(co,"tenant_profile_id");jdbc.sql("UPDATE contracts SET status='TERMINATED',end_date=LEAST(end_date,:date) WHERE id=:id").param("date",r.actualDate()).param("id",contract).update();jdbc.sql("UPDATE tenant_residences SET status='MOVED_OUT',move_out_date=:date WHERE contract_id=:contract AND status='ACTIVE'").param("date",r.actualDate()).param("contract",contract).update();jdbc.sql("UPDATE tenant_profiles SET status='MOVED_OUT' WHERE id=:profile AND NOT EXISTS(SELECT 1 FROM tenant_residences WHERE tenant_profile_id=:profile AND status='ACTIVE')").param("profile",profile).update();updateMeter(room,"ELECTRICITY",r.finalElectricityReading());updateMeter(room,"WATER",r.finalWaterReading());boolean damage=r.charges()!=null&&r.charges().stream().anyMatch(c->"DAMAGE".equals(c.chargeType())&&c.amount().signum()>0);String status=damage?"MAINTENANCE":"CLEANING";roomStatus(room,status,"Hoàn tất check-out",actor);return status;}
    private void updateMeter(long room,String type,BigDecimal value){if(value==null)return;jdbc.sql("UPDATE utility_meters SET current_reading=:value,reading_date=CURRENT_DATE WHERE room_id=:room AND meter_type=:type").param("value",value).param("room",room).param("type",type).update();}
    public void activity(long property,long actor,String type,String description,String url){jdbc.sql("INSERT INTO operational_activities(property_id,actor_id,activity_type,description,target_url) VALUES(:property,:actor,:type,:description,:url)").param("property",property).param("actor",actor).param("type",type).param("description",description).param("url",url).update();}

    private static Option option(ResultSet r)throws SQLException{return new Option(r.getLong("id"),r.getString("code"),r.getString("name"),nullableLong(r,"parent_id"),r.getString("status"));}
    private static Map<String,Object> map(ResultSet r,int n)throws SQLException{Map<String,Object>m=new HashMap<>();var md=r.getMetaData();for(int i=1;i<=md.getColumnCount();i++)m.put(md.getColumnLabel(i),r.getObject(i));return m;}
    private static Long nullableLong(ResultSet r,String c)throws SQLException{Object v=r.getObject(c);return v==null?null:((Number)v).longValue();}
    private static long num(Map<String,Object>m,String k){return ((Number)m.get(k)).longValue();}
    private static String clean(String s){return s==null||s.isBlank()?null:s.trim();}
}
