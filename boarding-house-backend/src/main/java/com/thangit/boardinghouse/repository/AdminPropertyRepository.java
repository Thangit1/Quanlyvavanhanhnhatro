package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.*;
import com.thangit.boardinghouse.dto.response.property.AdminPropertyResponses.*;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class AdminPropertyRepository {
    private final JdbcClient jdbc;
    public AdminPropertyRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    private String scope(RoleCode role, String alias) {
        return role == RoleCode.OWNER ? alias + ".owner_id=:userId" :
                "EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id=" + alias + ".id AND pm.manager_id=:userId)";
    }

    public boolean canAccess(long userId, RoleCode role, long propertyId) {
        return jdbc.sql("SELECT COUNT(*) FROM properties p WHERE p.id=:propertyId AND " + scope(role, "p"))
                .param("propertyId", propertyId).param("userId", userId).query(Long.class).single() > 0;
    }

    public boolean codeExists(String code, Long excludedId) {
        return jdbc.sql("SELECT COUNT(*) FROM properties WHERE UPPER(code)=UPPER(:code) AND (:excludedId IS NULL OR id<>:excludedId)")
                .param("code", code).param("excludedId", excludedId).query(Long.class).single() > 0;
    }

    public PropertySummary propertySummary(long userId, RoleCode role) {
        String sql = """
                SELECT COUNT(DISTINCT p.id) total_properties,
                  COUNT(DISTINCT CASE WHEN p.status='ACTIVE' THEN p.id END) active_properties,
                  COUNT(DISTINCT r.id) total_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='OCCUPIED' THEN r.id END) occupied_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='VACANT' THEN r.id END) vacant_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='MAINTENANCE' THEN r.id END) maintenance_rooms
                FROM properties p LEFT JOIN rooms r ON r.property_id=p.id WHERE %s
                """.formatted(scope(role, "p"));
        return jdbc.sql(sql).param("userId", userId).query((rs, n) -> new PropertySummary(
                rs.getLong("total_properties"), rs.getLong("active_properties"), rs.getLong("total_rooms"),
                rs.getLong("occupied_rooms"), rs.getLong("vacant_rooms"), rs.getLong("maintenance_rooms"))).single();
    }

    public long countProperties(long userId, RoleCode role, String keyword, String status) {
        return jdbc.sql("SELECT COUNT(*) FROM properties p WHERE " + scope(role, "p") +
                        " AND (:status IS NULL OR p.status=:status) AND (:keyword IS NULL OR p.name LIKE CONCAT('%',:keyword,'%') OR p.code LIKE CONCAT('%',:keyword,'%') OR p.address LIKE CONCAT('%',:keyword,'%'))")
                .param("userId", userId).param("status", blank(status)).param("keyword", blank(keyword))
                .query(Long.class).single();
    }

    public List<PropertyRow> properties(long userId, RoleCode role, String keyword, String status, int offset, int size) {
        String sql = """
                SELECT p.id,p.code,p.name,p.type,p.address,p.thumbnail_url,p.status,p.version,
                  m.id manager_id,m.full_name manager_name,COUNT(DISTINCT b.id) building_count,
                  COUNT(DISTINCT f.id) floor_count,COUNT(DISTINCT r.id) total_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='OCCUPIED' THEN r.id END) occupied_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='VACANT' THEN r.id END) vacant_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='RESERVED' THEN r.id END) reserved_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='MAINTENANCE' THEN r.id END) maintenance_rooms,
                  COALESCE((SELECT SUM(py.amount) FROM payments py JOIN invoices i ON i.id=py.invoice_id
                    JOIN contracts c ON c.id=i.contract_id JOIN rooms rr ON rr.id=c.room_id
                    WHERE rr.property_id=p.id AND py.status='CONFIRMED' AND py.transaction_type='PAYMENT'
                    AND py.paid_at>=DATE_FORMAT(CURRENT_DATE,'%%Y-%%m-01')),0) revenue,
                  COALESCE((SELECT SUM(GREATEST(i.total_amount-i.paid_amount,0)) FROM invoices i
                    JOIN contracts c ON c.id=i.contract_id JOIN rooms rr ON rr.id=c.room_id
                    WHERE rr.property_id=p.id AND i.status NOT IN ('PAID','CANCELLED')),0) debt
                FROM properties p LEFT JOIN property_managers pm ON pm.property_id=p.id
                LEFT JOIN users m ON m.id=pm.manager_id LEFT JOIN buildings b ON b.property_id=p.id
                LEFT JOIN floors f ON f.building_id=b.id LEFT JOIN rooms r ON r.property_id=p.id
                WHERE %s AND (:status IS NULL OR p.status=:status)
                  AND (:keyword IS NULL OR p.name LIKE CONCAT('%%',:keyword,'%%') OR p.code LIKE CONCAT('%%',:keyword,'%%') OR p.address LIKE CONCAT('%%',:keyword,'%%'))
                GROUP BY p.id,p.code,p.name,p.type,p.address,p.thumbnail_url,p.status,p.version,m.id,m.full_name
                ORDER BY p.updated_at DESC LIMIT :size OFFSET :offset
                """.formatted(scope(role, "p"));
        return jdbc.sql(sql).param("userId", userId).param("status", blank(status)).param("keyword", blank(keyword))
                .param("size", size).param("offset", offset).query((rs, n) -> propertyRow(rs)).list();
    }

    public Optional<Map<String,Object>> property(long propertyId) {
        return jdbc.sql("SELECT p.*,m.id manager_id,m.full_name manager_name FROM properties p LEFT JOIN property_managers pm ON pm.property_id=p.id LEFT JOIN users m ON m.id=pm.manager_id WHERE p.id=:id LIMIT 1")
                .param("id", propertyId).query(AdminPropertyRepository::map).optional();
    }

    public long createProperty(long ownerId, SaveProperty request) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO properties(owner_id,code,name,type,description,address,phone,email,operation_start_date,thumbnail_url,status)
                VALUES(:ownerId,:code,:name,:type,:description,:address,:phone,:email,:startDate,:thumbnail,'ACTIVE')
                """).param("ownerId", ownerId).param("code", request.code().trim().toUpperCase())
                .param("name", request.name().trim()).param("type", request.type()).param("description", blank(request.description()))
                .param("address", request.address().trim()).param("phone", blank(request.phone())).param("email", blank(request.email()))
                .param("startDate", request.operationStartDate()).param("thumbnail", blank(request.thumbnailUrl())).update(keys, "id");
        long id = keys.getKey().longValue();
        assignManager(id, request.managerId());
        return id;
    }

    public int updateProperty(long id, SaveProperty request) {
        String version = request.version() == null ? "" : " AND version=:version";
        var spec = jdbc.sql("UPDATE properties SET code=:code,name=:name,type=:type,description=:description,address=:address,phone=:phone,email=:email,operation_start_date=:startDate,thumbnail_url=:thumbnail,version=version+1 WHERE id=:id" + version)
                .param("id", id).param("code", request.code().trim().toUpperCase()).param("name", request.name().trim())
                .param("type", request.type()).param("description", blank(request.description())).param("address", request.address().trim())
                .param("phone", blank(request.phone())).param("email", blank(request.email())).param("startDate", request.operationStartDate())
                .param("thumbnail", blank(request.thumbnailUrl()));
        if (request.version() != null) spec.param("version", request.version());
        int updated = spec.update();
        if (updated > 0) assignManager(id, request.managerId());
        return updated;
    }

    public int setPropertyStatus(long id, String status, Long version) {
        var spec = jdbc.sql("UPDATE properties SET status=:status,version=version+1 WHERE id=:id" + (version == null ? "" : " AND version=:version"))
                .param("id", id).param("status", status);
        if (version != null) spec.param("version", version);
        return spec.update();
    }

    public long activeContractCount(long propertyId) {
        return jdbc.sql("SELECT COUNT(*) FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE r.property_id=:id AND c.status='ACTIVE'")
                .param("id", propertyId).query(Long.class).single();
    }

    public List<Building> buildings(long propertyId) {
        List<Map<String,Object>> rows = jdbc.sql("""
                SELECT b.id building_id,b.code building_code,b.name building_name,b.display_order building_order,
                       f.id floor_id,f.code floor_code,f.name floor_name,f.floor_number,f.display_order floor_order,
                       COUNT(r.id) total_rooms,SUM(CASE WHEN r.status='OCCUPIED' THEN 1 ELSE 0 END) occupied_rooms
                FROM buildings b LEFT JOIN floors f ON f.building_id=b.id LEFT JOIN rooms r ON r.floor_id=f.id
                WHERE b.property_id=:id GROUP BY b.id,b.code,b.name,b.display_order,f.id,f.code,f.name,f.floor_number,f.display_order
                ORDER BY b.display_order,b.name,f.display_order,f.name
                """).param("id", propertyId).query(AdminPropertyRepository::map).list();
        return rows.stream().map(row -> number(row,"building_id")).distinct().map(buildingId -> {
            Map<String,Object> first = rows.stream().filter(r -> number(r,"building_id").equals(buildingId)).findFirst().orElseThrow();
            List<Floor> floors = rows.stream().filter(r -> number(r,"building_id").equals(buildingId) && r.get("floor_id") != null)
                    .map(r -> new Floor(number(r,"floor_id"), string(r,"floor_code"), string(r,"floor_name"), integer(r,"floor_number"),
                            integer(r,"floor_order"), longValue(r,"total_rooms"), longValue(r,"occupied_rooms"))).toList();
            return new Building(buildingId,string(first,"building_code"),string(first,"building_name"),integer(first,"building_order"),floors);
        }).toList();
    }

    public long createBuilding(long propertyId, SaveBuilding request) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO buildings(property_id,code,name,display_order) VALUES(:propertyId,:code,:name,:order)")
                .param("propertyId", propertyId).param("code", request.code().trim().toUpperCase()).param("name", request.name().trim())
                .param("order", request.displayOrder() == null ? 0 : request.displayOrder()).update(keys,"id");
        return keys.getKey().longValue();
    }

    public Optional<Long> propertyIdForBuilding(long buildingId) {
        return jdbc.sql("SELECT property_id FROM buildings WHERE id=:id").param("id", buildingId).query(Long.class).optional();
    }

    public long createFloor(long buildingId, SaveFloor request) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("INSERT INTO floors(building_id,code,name,floor_number,display_order) VALUES(:buildingId,:code,:name,:number,:order)")
                .param("buildingId", buildingId).param("code", request.code().trim().toUpperCase()).param("name", request.name().trim())
                .param("number", request.floorNumber()).param("order", request.displayOrder() == null ? 0 : request.displayOrder()).update(keys,"id");
        return keys.getKey().longValue();
    }

    public List<Option> propertyOptions(long userId, RoleCode role) {
        return jdbc.sql("SELECT p.id,p.name FROM properties p WHERE p.status='ACTIVE' AND " + scope(role,"p") + " ORDER BY p.name")
                .param("userId",userId).query((rs,n)->new Option(rs.getLong("id"),rs.getString("name"),null)).list();
    }
    public List<Option> buildingOptions(long userId, RoleCode role) {
        return jdbc.sql("SELECT b.id,b.name,b.property_id FROM buildings b JOIN properties p ON p.id=b.property_id WHERE b.status='ACTIVE' AND " + scope(role,"p") + " ORDER BY p.name,b.display_order")
                .param("userId",userId).query((rs,n)->new Option(rs.getLong("id"),rs.getString("name"),rs.getLong("property_id"))).list();
    }
    public List<Option> floorOptions(long userId, RoleCode role) {
        return jdbc.sql("SELECT f.id,f.name,f.building_id FROM floors f JOIN buildings b ON b.id=f.building_id JOIN properties p ON p.id=b.property_id WHERE f.status='ACTIVE' AND " + scope(role,"p") + " ORDER BY p.name,b.display_order,f.display_order")
                .param("userId",userId).query((rs,n)->new Option(rs.getLong("id"),rs.getString("name"),rs.getLong("building_id"))).list();
    }
    public List<Amenity> amenities() {
        return jdbc.sql("SELECT id,code,name,icon FROM amenities ORDER BY name").query((rs,n)->new Amenity(rs.getLong("id"),rs.getString("code"),rs.getString("name"),rs.getString("icon"))).list();
    }

    public boolean validHierarchy(long propertyId,long buildingId,long floorId) {
        return jdbc.sql("SELECT COUNT(*) FROM floors f JOIN buildings b ON b.id=f.building_id WHERE f.id=:floor AND b.id=:building AND b.property_id=:property")
                .param("floor",floorId).param("building",buildingId).param("property",propertyId).query(Long.class).single()>0;
    }
    public boolean roomCodeExists(long propertyId,String code,Long excludedId) {
        return jdbc.sql("SELECT COUNT(*) FROM rooms WHERE property_id=:property AND UPPER(code)=UPPER(:code) AND (:excluded IS NULL OR id<>:excluded)")
                .param("property",propertyId).param("code",code).param("excluded",excludedId).query(Long.class).single()>0;
    }
    public long createRoom(SaveRoom request) {
        KeyHolder keys=new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO rooms(property_id,building_id,floor_id,building_name,floor_name,code,name,room_type,description,area,monthly_rent,deposit_amount,capacity,status,image_url)
                SELECT :property,:building,:floor,b.name,f.name,:code,:name,:type,:description,:area,:rent,:deposit,:capacity,'VACANT',:image
                FROM buildings b JOIN floors f ON f.building_id=b.id WHERE b.id=:building AND f.id=:floor
                """).param("property",request.propertyId()).param("building",request.buildingId()).param("floor",request.floorId())
                .param("code",request.code().trim().toUpperCase()).param("name",request.name().trim()).param("type",blank(request.roomType()))
                .param("description",blank(request.description())).param("area",request.area()).param("rent",request.monthlyRent())
                .param("deposit",request.depositAmount()==null?BigDecimal.ZERO:request.depositAmount()).param("capacity",request.capacity())
                .param("image",blank(request.imageUrl())).update(keys,"id");
        long id=keys.getKey().longValue(); replaceRoomChildren(id,request); return id;
    }
    public int updateRoom(long id,SaveRoom request) {
        var spec=jdbc.sql("""
                UPDATE rooms r JOIN buildings b ON b.id=:building JOIN floors f ON f.id=:floor AND f.building_id=b.id
                SET r.property_id=:property,r.building_id=:building,r.floor_id=:floor,r.building_name=b.name,r.floor_name=f.name,
                    r.code=:code,r.name=:name,r.room_type=:type,r.description=:description,r.area=:area,r.monthly_rent=:rent,
                    r.deposit_amount=:deposit,r.capacity=:capacity,r.image_url=:image,r.version=r.version+1
                WHERE r.id=:id
                """+(request.version()==null?"":" AND r.version=:version"))
                .param("id",id).param("property",request.propertyId()).param("building",request.buildingId()).param("floor",request.floorId())
                .param("code",request.code().trim().toUpperCase()).param("name",request.name().trim()).param("type",blank(request.roomType()))
                .param("description",blank(request.description())).param("area",request.area()).param("rent",request.monthlyRent())
                .param("deposit",request.depositAmount()==null?BigDecimal.ZERO:request.depositAmount()).param("capacity",request.capacity()).param("image",blank(request.imageUrl()));
        if(request.version()!=null) spec.param("version",request.version()); int updated=spec.update();
        if(updated>0) replaceRoomChildren(id,request); return updated;
    }
    private void replaceRoomChildren(long roomId,SaveRoom request) {
        jdbc.sql("DELETE FROM room_amenities WHERE room_id=:id").param("id",roomId).update();
        if(request.amenityIds()!=null) request.amenityIds().stream().distinct().forEach(id -> jdbc.sql("INSERT INTO room_amenities(room_id,amenity_id) SELECT :room,:amenity WHERE EXISTS(SELECT 1 FROM amenities WHERE id=:amenity)").param("room",roomId).param("amenity",id).update());
        jdbc.sql("DELETE FROM room_assets WHERE room_id=:id").param("id",roomId).update();
        if(request.assets()!=null) request.assets().forEach(a -> jdbc.sql("INSERT INTO room_assets(room_id,name,quantity,condition_status,note) VALUES(:room,:name,:quantity,:condition,:note)").param("room",roomId).param("name",a.name().trim()).param("quantity",a.quantity()).param("condition",a.conditionStatus()).param("note",blank(a.note())).update());
    }

    public long countRooms(long userId,RoleCode role,Long propertyId,Long buildingId,Long floorId,String status,String keyword) {
        return roomStatement("SELECT COUNT(*) FROM rooms r JOIN properties p ON p.id=r.property_id WHERE ",userId,role,propertyId,buildingId,floorId,status,keyword).query(Long.class).single();
    }
    public RoomSummary roomSummary(long userId,RoleCode role,Long propertyId) {
        String sql="""
                SELECT COUNT(r.id) total_rooms,SUM(r.status='OCCUPIED') occupied_rooms,SUM(r.status='VACANT') vacant_rooms,
                SUM(r.status='RESERVED') reserved_rooms,SUM(r.status='MAINTENANCE') maintenance_rooms,SUM(r.status='INACTIVE') inactive_rooms
                FROM rooms r JOIN properties p ON p.id=r.property_id WHERE %s AND (:property IS NULL OR p.id=:property)
                """.formatted(scope(role,"p"));
        return jdbc.sql(sql).param("userId",userId).param("property",propertyId).query((rs,n)->new RoomSummary(rs.getLong("total_rooms"),rs.getLong("occupied_rooms"),rs.getLong("vacant_rooms"),rs.getLong("reserved_rooms"),rs.getLong("maintenance_rooms"),rs.getLong("inactive_rooms"))).single();
    }
    private JdbcClient.StatementSpec roomStatement(String prefix,long userId,RoleCode role,Long propertyId,Long buildingId,Long floorId,String status,String keyword) {
        String filters=scope(role,"p")+" AND (:property IS NULL OR r.property_id=:property) AND (:building IS NULL OR r.building_id=:building) AND (:floor IS NULL OR r.floor_id=:floor) AND (:status IS NULL OR r.status=:status) AND (:keyword IS NULL OR r.code LIKE CONCAT('%',:keyword,'%') OR r.name LIKE CONCAT('%',:keyword,'%'))";
        String sql=prefix+filters;
        if(prefix.contains("SELECT r.id")) sql += " ORDER BY p.name,b.display_order,f.display_order,r.code LIMIT :size OFFSET :offset";
        return jdbc.sql(sql).param("userId",userId).param("property",propertyId).param("building",buildingId).param("floor",floorId).param("status",blank(status)).param("keyword",blank(keyword));
    }
    public List<RoomRow> rooms(long userId,RoleCode role,Long propertyId,Long buildingId,Long floorId,String status,String keyword,int offset,int size) {
        String select="""
                SELECT r.id,r.code room_code,r.name,r.image_url,p.id property_id,p.name property_name,b.id building_id,b.name building_name,
                  f.id floor_id,f.name floor_name,r.room_type,r.area,r.monthly_rent,r.deposit_amount,r.capacity,r.status,r.version,r.updated_at,
                  c.id contract_id,c.code contract_code,c.start_date,c.end_date,c.status contract_status,u.id tenant_id,u.full_name tenant_name,u.phone tenant_phone,
                  COALESCE((SELECT COUNT(*) FROM contract_occupants co WHERE co.contract_id=c.id AND co.residence_status='ACTIVE'),IF(c.id IS NULL,0,c.occupant_count)) current_occupants,
                  COALESCE((SELECT SUM(GREATEST(i.total_amount-i.paid_amount,0)) FROM invoices i WHERE i.contract_id=c.id AND i.status NOT IN ('PAID','CANCELLED')),0) debt,
                  (SELECT COUNT(*) FROM maintenance_requests m WHERE m.room_id=r.id AND m.status NOT IN ('COMPLETED','CANCELLED')) maintenance_count
                FROM rooms r JOIN properties p ON p.id=r.property_id LEFT JOIN buildings b ON b.id=r.building_id LEFT JOIN floors f ON f.id=r.floor_id
                LEFT JOIN contracts c ON c.id=(SELECT cc.id FROM contracts cc WHERE cc.room_id=r.id AND cc.status='ACTIVE' ORDER BY cc.start_date DESC LIMIT 1)
                LEFT JOIN users u ON u.id=c.tenant_id WHERE
                """;
        return roomStatement(select,userId,role,propertyId,buildingId,floorId,status,keyword).param("size",size).param("offset",offset)
                .query((rs,n)->roomRow(rs)).list();
    }
    public Optional<RoomRow> room(long id) {
        String sql="""
                SELECT r.id,r.code room_code,r.name,r.image_url,p.id property_id,p.name property_name,b.id building_id,b.name building_name,
                  f.id floor_id,f.name floor_name,r.room_type,r.area,r.monthly_rent,r.deposit_amount,r.capacity,r.status,r.version,r.updated_at,
                  c.id contract_id,c.code contract_code,c.start_date,c.end_date,c.status contract_status,u.id tenant_id,u.full_name tenant_name,u.phone tenant_phone,
                  COALESCE((SELECT COUNT(*) FROM contract_occupants co WHERE co.contract_id=c.id AND co.residence_status='ACTIVE'),IF(c.id IS NULL,0,c.occupant_count)) current_occupants,
                  COALESCE((SELECT SUM(GREATEST(i.total_amount-i.paid_amount,0)) FROM invoices i WHERE i.contract_id=c.id AND i.status NOT IN ('PAID','CANCELLED')),0) debt,
                  (SELECT COUNT(*) FROM maintenance_requests m WHERE m.room_id=r.id AND m.status NOT IN ('COMPLETED','CANCELLED')) maintenance_count
                FROM rooms r JOIN properties p ON p.id=r.property_id LEFT JOIN buildings b ON b.id=r.building_id LEFT JOIN floors f ON f.id=r.floor_id
                LEFT JOIN contracts c ON c.id=(SELECT cc.id FROM contracts cc WHERE cc.room_id=r.id AND cc.status='ACTIVE' ORDER BY cc.start_date DESC LIMIT 1)
                LEFT JOIN users u ON u.id=c.tenant_id WHERE r.id=:id
                """;
        return jdbc.sql(sql).param("id",id).query((rs,n)->roomRow(rs)).optional();
    }
    public Optional<Map<String,Object>> roomRaw(long id) { return jdbc.sql("SELECT * FROM rooms WHERE id=:id").param("id",id).query(AdminPropertyRepository::map).optional(); }
    public List<Tenant> occupants(long id) {
        return jdbc.sql("""
                SELECT u.id,u.full_name,u.phone,TRUE representative FROM contracts c JOIN users u ON u.id=c.tenant_id WHERE c.room_id=:id AND c.status='ACTIVE'
                UNION ALL SELECT NULL,co.full_name,NULL,FALSE FROM contract_occupants co JOIN contracts c ON c.id=co.contract_id WHERE c.room_id=:id AND c.status='ACTIVE' AND co.residence_status='ACTIVE'
                """).param("id",id).query((rs,n)->new Tenant(nullableLong(rs,"id"),rs.getString("full_name"),rs.getString("phone"),rs.getBoolean("representative"))).list();
    }
    public List<Amenity> roomAmenities(long id) { return jdbc.sql("SELECT a.id,a.code,a.name,a.icon FROM amenities a JOIN room_amenities ra ON ra.amenity_id=a.id WHERE ra.room_id=:id ORDER BY a.name").param("id",id).query((rs,n)->new Amenity(rs.getLong("id"),rs.getString("code"),rs.getString("name"),rs.getString("icon"))).list(); }
    public List<Asset> roomAssets(long id) { return jdbc.sql("SELECT id,name,quantity,condition_status,note FROM room_assets WHERE room_id=:id ORDER BY name").param("id",id).query((rs,n)->new Asset(rs.getLong("id"),rs.getString("name"),rs.getInt("quantity"),rs.getString("condition_status"),rs.getString("note"))).list(); }
    public List<Meter> roomMeters(long id) { return jdbc.sql("SELECT id,meter_type,meter_code,current_reading,reading_date,status FROM utility_meters WHERE room_id=:id ORDER BY meter_type").param("id",id).query((rs,n)->new Meter(rs.getLong("id"),rs.getString("meter_type"),rs.getString("meter_code"),rs.getBigDecimal("current_reading"),rs.getObject("reading_date",LocalDate.class),rs.getString("status"))).list(); }
    public List<String> roomImages(long id) { return jdbc.sql("SELECT image_url FROM room_images WHERE room_id=:id ORDER BY display_order").param("id",id).query(String.class).list(); }
    public List<History> priceHistory(long id) { return jdbc.sql("SELECT h.id,h.old_price,h.new_price,h.reason,u.full_name,h.effective_date,h.created_at FROM room_price_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.room_id=:id ORDER BY h.effective_date DESC,h.id DESC").param("id",id).query((rs,n)->new History(rs.getLong("id"),"PRICE",rs.getBigDecimal("old_price").toPlainString(),rs.getBigDecimal("new_price").toPlainString(),rs.getString("reason"),rs.getString("full_name"),rs.getObject("effective_date",LocalDate.class),rs.getObject("created_at",LocalDateTime.class))).list(); }
    public List<History> statusHistory(long id) { return jdbc.sql("SELECT h.id,h.old_status,h.new_status,h.reason,u.full_name,h.created_at FROM room_status_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.room_id=:id ORDER BY h.created_at DESC,h.id DESC").param("id",id).query((rs,n)->new History(rs.getLong("id"),"STATUS",rs.getString("old_status"),rs.getString("new_status"),rs.getString("reason"),rs.getString("full_name"),null,rs.getObject("created_at",LocalDateTime.class))).list(); }
    public List<Activity> activities(long propertyId) { return jdbc.sql("SELECT a.id,a.activity_type,a.description,u.full_name,a.created_at FROM operational_activities a LEFT JOIN users u ON u.id=a.actor_id WHERE a.property_id=:id ORDER BY a.created_at DESC LIMIT 50").param("id",propertyId).query((rs,n)->new Activity(rs.getLong("id"),rs.getString("activity_type"),rs.getString("description"),rs.getString("full_name"),rs.getObject("created_at",LocalDateTime.class))).list(); }
    public void addActivity(long propertyId,long actorId,String type,String description,String targetUrl) { jdbc.sql("INSERT INTO operational_activities(property_id,actor_id,activity_type,description,target_url) VALUES(:property,:actor,:type,:description,:url)").param("property",propertyId).param("actor",actorId).param("type",type).param("description",description).param("url",targetUrl).update(); }
    public int changePrice(long roomId,BigDecimal oldPrice,ChangePrice request,long actorId) {
        var spec=jdbc.sql("UPDATE rooms SET monthly_rent=:price,version=version+1 WHERE id=:id"+(request.version()==null?"":" AND version=:version")).param("price",request.newPrice()).param("id",roomId); if(request.version()!=null) spec.param("version",request.version()); int updated=spec.update();
        if(updated>0) jdbc.sql("INSERT INTO room_price_history(room_id,old_price,new_price,effective_date,reason,actor_id) VALUES(:room,:old,:new,:date,:reason,:actor)").param("room",roomId).param("old",oldPrice).param("new",request.newPrice()).param("date",request.effectiveDate()).param("reason",blank(request.reason())).param("actor",actorId).update(); return updated;
    }
    public int changeStatus(long roomId,String oldStatus,ChangeStatus request,long actorId) {
        var spec=jdbc.sql("UPDATE rooms SET status=:status,version=version+1 WHERE id=:id"+(request.version()==null?"":" AND version=:version")).param("status",request.status()).param("id",roomId); if(request.version()!=null) spec.param("version",request.version()); int updated=spec.update();
        if(updated>0) jdbc.sql("INSERT INTO room_status_history(room_id,old_status,new_status,reason,actor_id) VALUES(:room,:old,:new,:reason,:actor)").param("room",roomId).param("old",oldStatus).param("new",request.status()).param("reason",blank(request.reason())).param("actor",actorId).update(); return updated;
    }

    private void assignManager(long propertyId,Long managerId) { jdbc.sql("DELETE FROM property_managers WHERE property_id=:id").param("id",propertyId).update(); if(managerId!=null) jdbc.sql("INSERT INTO property_managers(property_id,manager_id) SELECT :property,:manager WHERE EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=:manager AND r.code='MANAGER')").param("property",propertyId).param("manager",managerId).update(); }
    private static PropertyRow propertyRow(ResultSet rs) throws SQLException { long total=rs.getLong("total_rooms"),occupied=rs.getLong("occupied_rooms"); Long manager=nullableLong(rs,"manager_id"); return new PropertyRow(rs.getLong("id"),rs.getString("code"),rs.getString("name"),rs.getString("type"),rs.getString("address"),rs.getString("thumbnail_url"),manager==null?null:new Manager(manager,rs.getString("manager_name")),rs.getLong("building_count"),rs.getLong("floor_count"),total,occupied,rs.getLong("vacant_rooms"),rs.getLong("reserved_rooms"),rs.getLong("maintenance_rooms"),total==0?0:Math.round(occupied*1000d/total)/10d,rs.getBigDecimal("revenue"),rs.getBigDecimal("debt"),rs.getString("status"),rs.getLong("version")); }
    private static RoomRow roomRow(ResultSet rs) throws SQLException { Long tenantId=nullableLong(rs,"tenant_id"),contractId=nullableLong(rs,"contract_id"); return new RoomRow(rs.getLong("id"),rs.getString("room_code"),rs.getString("name"),rs.getString("image_url"),rs.getLong("property_id"),rs.getString("property_name"),nullableLong(rs,"building_id"),rs.getString("building_name"),nullableLong(rs,"floor_id"),rs.getString("floor_name"),rs.getString("room_type"),rs.getBigDecimal("area"),rs.getBigDecimal("monthly_rent"),rs.getBigDecimal("deposit_amount"),rs.getInt("capacity"),rs.getLong("current_occupants"),tenantId==null?null:new Tenant(tenantId,rs.getString("tenant_name"),rs.getString("tenant_phone"),true),contractId==null?null:new Contract(contractId,rs.getString("contract_code"),rs.getObject("start_date",LocalDate.class),rs.getObject("end_date",LocalDate.class),rs.getString("contract_status")),rs.getBigDecimal("debt"),rs.getLong("maintenance_count"),rs.getString("status"),rs.getLong("version"),rs.getObject("updated_at",LocalDateTime.class)); }
    private static Map<String,Object> map(ResultSet rs,int n) throws SQLException { Map<String,Object> result=new HashMap<>(); var md=rs.getMetaData(); for(int i=1;i<=md.getColumnCount();i++) result.put(md.getColumnLabel(i),rs.getObject(i)); return result; }
    private static String blank(String v){return v==null||v.isBlank()?null:v.trim();} private static String string(Map<String,Object> m,String k){return m.get(k)==null?null:m.get(k).toString();} private static Long number(Map<String,Object> m,String k){return ((Number)m.get(k)).longValue();} private static long longValue(Map<String,Object> m,String k){return m.get(k)==null?0:((Number)m.get(k)).longValue();} private static Integer integer(Map<String,Object> m,String k){return m.get(k)==null?null:((Number)m.get(k)).intValue();} private static Long nullableLong(ResultSet rs,String c)throws SQLException{Object v=rs.getObject(c);return v==null?null:((Number)v).longValue();}
}
