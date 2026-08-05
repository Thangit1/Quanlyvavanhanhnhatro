package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.maintenance.AdminMaintenanceResponses.*;
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
public class AdminMaintenanceRepository {
    private final JdbcClient jdbc;

    public AdminMaintenanceRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    private String scope(RoleCode role, String propertyAlias) {
        if (role == RoleCode.OWNER) return propertyAlias + ".owner_id=:userId";
        if (role == RoleCode.TECHNICIAN) return "(m.assigned_to=:userId OR EXISTS(SELECT 1 FROM maintenance_assignments ma WHERE ma.maintenance_request_id=m.id AND ma.user_id=:userId AND ma.unassigned_at IS NULL))";
        return "EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id=" + propertyAlias + ".id AND pm.manager_id=:userId)";
    }

    public boolean canAccess(long userId, RoleCode role, long propertyId) {
        String sql = "SELECT COUNT(*) FROM properties p WHERE p.id=:propertyId AND " + scope(role, "p").replace("m.assigned_to=:userId", "FALSE");
        return jdbc.sql(sql).param("userId", userId).param("propertyId", propertyId)
                .query(Long.class).single() > 0;
    }

    public Summary summary(long userId, RoleCode role, Long propertyId) {
        String sql = """
                SELECT COUNT(CASE WHEN m.status NOT IN ('RESOLVED','REJECTED','CANCELLED') THEN 1 END) open_count,
                  COUNT(CASE WHEN m.status='NEW' THEN 1 END) new_count,
                  COUNT(CASE WHEN m.priority='URGENT' AND m.status NOT IN ('RESOLVED','CANCELLED') THEN 1 END) urgent_count,
                  COUNT(CASE WHEN m.assigned_to IS NULL AND m.status NOT IN ('RESOLVED','REJECTED','CANCELLED') THEN 1 END) unassigned_count,
                  COUNT(CASE WHEN m.status='IN_PROGRESS' THEN 1 END) progress_count,
                  COUNT(CASE WHEN m.sla_due_at<NOW() AND m.status NOT IN ('RESOLVED','CANCELLED') THEN 1 END) overdue_count,
                  COUNT(CASE WHEN m.status IN ('COMPLETED','INSPECTION_PENDING') THEN 1 END) inspection_count,
                  COALESCE(SUM(CASE WHEN m.resolved_at>=DATE_FORMAT(CURDATE(),'%%Y-%%m-01') THEN m.actual_cost ELSE 0 END),0) monthly_cost,
                  COALESCE(AVG(CASE WHEN m.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,m.created_at,m.resolved_at)/60 END),0) average_hours,
                  COALESCE(100*SUM(CASE WHEN m.resolved_at IS NOT NULL AND (m.sla_due_at IS NULL OR m.resolved_at<=m.sla_due_at) THEN 1 ELSE 0 END)/NULLIF(SUM(m.resolved_at IS NOT NULL),0),0) on_time_rate
                FROM maintenance_requests m JOIN properties p ON p.id=m.property_id
                WHERE %s AND (:propertyId IS NULL OR m.property_id=:propertyId)
                """.formatted(scope(role, "p"));
        return jdbc.sql(sql).param("userId", userId).param("propertyId", propertyId).query((rs, n) ->
                new Summary(rs.getLong("open_count"), rs.getLong("new_count"), rs.getLong("urgent_count"),
                        rs.getLong("unassigned_count"), rs.getLong("progress_count"), rs.getLong("overdue_count"),
                        rs.getLong("inspection_count"), money(rs, "monthly_cost"), money(rs, "average_hours"),
                        money(rs, "on_time_rate"))).single();
    }

    public Page<RequestRow> list(long userId, RoleCode role, Long propertyId, Long roomId,
                                 String keyword, String category, String priority, String status,
                                 Boolean overdue, String sort, int page, int size) {
        String where = " WHERE " + scope(role, "p") +
                " AND (:propertyId IS NULL OR m.property_id=:propertyId) AND (:roomId IS NULL OR m.room_id=:roomId)" +
                " AND (:keyword IS NULL OR m.code LIKE :search OR m.title LIKE :search OR m.description LIKE :search OR r.code LIKE :search OR p.name LIKE :search OR reporter.full_name LIKE :search OR assignee.full_name LIKE :search)" +
                " AND (:category IS NULL OR m.issue_type=:category) AND (:priority IS NULL OR m.priority=:priority)" +
                " AND (:status IS NULL OR (:status='UNASSIGNED' AND m.assigned_to IS NULL AND m.status NOT IN ('RESOLVED','REJECTED','CANCELLED')) OR m.status=:status) AND (:overdue IS NULL OR :overdue=FALSE OR (m.sla_due_at<NOW() AND m.status NOT IN ('RESOLVED','CANCELLED')))";
        String from = " FROM maintenance_requests m JOIN properties p ON p.id=m.property_id LEFT JOIN rooms r ON r.id=m.room_id LEFT JOIN users reporter ON reporter.id=COALESCE(m.reporter_id,m.tenant_id) LEFT JOIN users assignee ON assignee.id=m.assigned_to LEFT JOIN maintenance_schedules sch ON sch.id=(SELECT MAX(s2.id) FROM maintenance_schedules s2 WHERE s2.maintenance_request_id=m.id AND s2.status='ACTIVE') ";
        String order = switch (sort == null ? "newest" : sort) {
            case "oldest" -> "m.created_at ASC";
            case "priority" -> "FIELD(m.priority,'URGENT','HIGH','MEDIUM','LOW'),m.created_at DESC";
            case "sla" -> "m.sla_due_at ASC";
            case "cost" -> "m.actual_cost DESC";
            case "updated" -> "m.updated_at DESC";
            default -> "m.created_at DESC";
        };
        var count = bind(jdbc.sql("SELECT COUNT(*)" + from + where), userId, propertyId, roomId, keyword, category, priority, status, overdue)
                .query(Long.class).single();
        String select = "SELECT m.*,p.name property_name,r.code room_code,reporter.full_name reporter_name,reporter.phone reporter_phone,assignee.full_name assignee_name,sch.scheduled_start ";
        List<RequestRow> rows = bind(jdbc.sql(select + from + where + " ORDER BY " + order + " LIMIT :limit OFFSET :offset"), userId, propertyId, roomId, keyword, category, priority, status, overdue)
                .param("limit", size).param("offset", page * size).query(this::row).list();
        return new Page<>(rows, count, (int) Math.ceil(count / (double) size), page, size);
    }

    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec q, long userId, Long propertyId,
                                           Long roomId, String keyword, String category,
                                           String priority, String status, Boolean overdue) {
        String clean = blank(keyword);
        return q.param("userId", userId).param("propertyId", propertyId).param("roomId", roomId)
                .param("keyword", clean).param("search", clean == null ? null : "%" + clean + "%")
                .param("category", blank(category)).param("priority", blank(priority))
                .param("status", blank(status)).param("overdue", overdue);
    }

    public Optional<Map<String, Object>> request(long id, boolean lock) {
        return jdbc.sql("SELECT m.*,p.name property_name,r.code room_code,reporter.full_name reporter_name,reporter.phone reporter_phone,assignee.full_name assignee_name,ra.name asset_name FROM maintenance_requests m JOIN properties p ON p.id=m.property_id LEFT JOIN rooms r ON r.id=m.room_id LEFT JOIN users reporter ON reporter.id=COALESCE(m.reporter_id,m.tenant_id) LEFT JOIN users assignee ON assignee.id=m.assigned_to LEFT JOIN room_assets ra ON ra.id=m.asset_id WHERE m.id=:id" + (lock ? " FOR UPDATE" : ""))
                .param("id", id).query(AdminMaintenanceRepository::map).optional();
    }

    public long create(long userId, long propertyId, Long roomId, Long assetId, Long reporterId,
                       String source, String type, String title, String description, String category,
                       String priority, boolean risk, LocalDateTime detectedAt,
                       LocalDateTime preferredAt, LocalDateTime slaDueAt, BigDecimal estimated,
                       String responsibility) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO maintenance_requests(property_id,building_id,floor_id,room_id,asset_id,tenant_id,reporter_id,reporter_type,source,maintenance_type,code,title,description,issue_type,priority,safety_risk,detected_at,preferred_service_time,sla_due_at,estimated_cost,cost_responsibility,created_by)
                SELECT :propertyId,r.building_id,r.floor_id,:roomId,:assetId,CASE WHEN :source='TENANT' THEN :reporterId END,:reporterId,:source,:source,:type,CONCAT('BT-',DATE_FORMAT(NOW(),'%Y%m%d'),'-',LPAD(FLOOR(RAND()*100000),5,'0')),:title,:description,:category,:priority,:risk,:detectedAt,:preferredAt,:slaDueAt,:estimated,:responsibility,:userId
                FROM (SELECT 1) x LEFT JOIN rooms r ON r.id=:roomId
                """).param("propertyId", propertyId).param("roomId", roomId).param("assetId", assetId)
                .param("reporterId", reporterId).param("source", source).param("type", type)
                .param("title", title).param("description", description).param("category", category)
                .param("priority", priority).param("risk", risk).param("detectedAt", detectedAt)
                .param("preferredAt", preferredAt).param("slaDueAt", slaDueAt)
                .param("estimated", estimated).param("responsibility", responsibility)
                .param("userId", userId).update(keys,"id");
        return keys.getKey().longValue();
    }

    public int updateTriage(long id, String category, String priority, LocalDateTime sla,
                            boolean risk, long version) {
        return jdbc.sql("UPDATE maintenance_requests SET issue_type=:category,priority=:priority,sla_due_at=:sla,safety_risk=:risk,status='TRIAGED',version=version+1 WHERE id=:id AND version=:version AND status IN ('SUBMITTED','RECEIVED','NEW','REOPENED')")
                .param("category", category).param("priority", priority).param("sla", sla)
                .param("risk", risk).param("id", id).param("version", version).update();
    }

    public int assign(long id, long technician, long actor, String note, long version) {
        jdbc.sql("UPDATE maintenance_assignments SET unassigned_at=NOW() WHERE maintenance_request_id=:id AND assignment_role='PRIMARY' AND unassigned_at IS NULL").param("id", id).update();
        int changed = jdbc.sql("UPDATE maintenance_requests SET assigned_to=:technician,status='ASSIGNED',version=version+1 WHERE id=:id AND version=:version AND status IN ('SUBMITTED','RECEIVED','NEW','TRIAGED','REOPENED','ASSIGNED')")
                .param("technician", technician).param("id", id).param("version", version).update();
        if (changed > 0) jdbc.sql("INSERT INTO maintenance_assignments(maintenance_request_id,user_id,assignment_role,assigned_by,note) VALUES(:id,:technician,'PRIMARY',:actor,:note)")
                .param("id", id).param("technician", technician).param("actor", actor).param("note", blank(note)).update();
        return changed;
    }

    public int schedule(long id, LocalDateTime start, LocalDateTime end, int duration,
                        boolean tenantPresence, String note, long version) {
        int changed = jdbc.sql("UPDATE maintenance_requests SET status='SCHEDULED',preferred_service_time=:start,version=version+1 WHERE id=:id AND version=:version AND status IN ('ASSIGNED','SCHEDULED')")
                .param("start", start).param("id", id).param("version", version).update();
        if (changed > 0) {
            jdbc.sql("UPDATE maintenance_schedules SET status='REPLACED',changed_reason=:note WHERE maintenance_request_id=:id AND status='ACTIVE'").param("note", blank(note)).param("id", id).update();
            jdbc.sql("INSERT INTO maintenance_schedules(maintenance_request_id,scheduled_start,scheduled_end,estimated_duration_minutes,tenant_presence_required,changed_reason) VALUES(:id,:start,:end,:duration,:presence,:note)")
                    .param("id", id).param("start", start).param("end", end).param("duration", duration).param("presence", tenantPresence).param("note", blank(note)).update();
        }
        return changed;
    }

    public int transition(long id, String fromStatuses, String status, long version,
                          String extraSql) {
        return jdbc.sql("UPDATE maintenance_requests SET status=:status,version=version+1" + extraSql + " WHERE id=:id AND version=:version AND FIND_IN_SET(status,:from)>0")
                .param("status", status).param("id", id).param("version", version)
                .param("from", fromStatuses).update();
    }

    public int workLog(long id, String action, int progress, String diagnosis, String work,
                       String note, LocalDateTime started, LocalDateTime ended, long actor,
                       long version, String nextStatus) {
        int changed = jdbc.sql("UPDATE maintenance_requests SET progress_percent=:progress,diagnosis=COALESCE(:diagnosis,diagnosis),status=:status,version=version+1 WHERE id=:id AND version=:version AND status NOT IN ('RESOLVED','REJECTED','CANCELLED')")
                .param("progress", progress).param("diagnosis", blank(diagnosis)).param("status", nextStatus)
                .param("id", id).param("version", version).update();
        if (changed > 0) jdbc.sql("INSERT INTO maintenance_work_logs(maintenance_request_id,action_type,progress_percent,diagnosis,work_performed,note,started_at,ended_at,created_by) VALUES(:id,:action,:progress,:diagnosis,:work,:note,:started,:ended,:actor)")
                .param("id", id).param("action", action).param("progress", progress)
                .param("diagnosis", blank(diagnosis)).param("work", blank(work)).param("note", blank(note))
                .param("started", started).param("ended", ended).param("actor", actor).update();
        return changed;
    }

    public int addMaterial(long id, Long materialId, String name, BigDecimal quantity,
                           String unit, BigDecimal price, long actor, long version) {
        int changed = jdbc.sql("UPDATE maintenance_requests SET actual_cost=actual_cost+:amount,version=version+1 WHERE id=:id AND version=:version AND status NOT IN ('RESOLVED','CANCELLED')")
                .param("amount", quantity.multiply(price)).param("id", id).param("version", version).update();
        if (changed > 0) {
            jdbc.sql("INSERT INTO maintenance_material_usages(maintenance_request_id,material_id,material_name,quantity,unit,unit_price,amount,created_by) VALUES(:id,:material,:name,:quantity,:unit,:price,:amount,:actor)")
                    .param("id", id).param("material", materialId).param("name", name).param("quantity", quantity)
                    .param("unit", unit).param("price", price).param("amount", quantity.multiply(price)).param("actor", actor).update();
            if (materialId != null) jdbc.sql("UPDATE maintenance_materials SET stock_quantity=GREATEST(0,stock_quantity-:quantity) WHERE id=:id").param("quantity", quantity).param("id", materialId).update();
        }
        return changed;
    }

    public int addCost(long id, BigDecimal labor, BigDecimal material, BigDecimal external,
                       BigDecimal other, String responsibility, BigDecimal tenantShare,
                       String note, long actor, long version) {
        BigDecimal total = labor.add(material).add(external).add(other);
        int changed = jdbc.sql("UPDATE maintenance_requests SET actual_cost=:total,cost_responsibility=:responsibility,status='WAITING_APPROVAL',version=version+1 WHERE id=:id AND version=:version AND status NOT IN ('RESOLVED','CANCELLED')")
                .param("total", total).param("responsibility", responsibility).param("id", id).param("version", version).update();
        if (changed > 0) jdbc.sql("INSERT INTO maintenance_costs(maintenance_request_id,labor_cost,material_cost,external_service_cost,other_cost,total_cost,responsibility,tenant_share_amount,proposed_by,note) VALUES(:id,:labor,:material,:external,:other,:total,:responsibility,:tenant,:actor,:note)")
                .param("id", id).param("labor", labor).param("material", material).param("external", external).param("other", other).param("total", total).param("responsibility", responsibility).param("tenant", tenantShare).param("actor", actor).param("note", blank(note)).update();
        return changed;
    }

    public int complete(long id, String diagnosis, String resolution, long version) {
        return jdbc.sql("UPDATE maintenance_requests SET diagnosis=:diagnosis,resolution=:resolution,progress_percent=100,status='INSPECTION_PENDING',completed_at=NOW(),version=version+1 WHERE id=:id AND version=:version AND status IN ('IN_PROGRESS','WAITING_PARTS','WAITING_TENANT','WAITING_APPROVAL','ON_HOLD')")
                .param("diagnosis", diagnosis).param("resolution", resolution).param("id", id).param("version", version).update();
    }

    public int inspect(long id, String result, Integer rating, String comment, boolean working,
                       boolean costConfirmed, long actor, long version) {
        String status = "PASSED".equals(result) ? "RESOLVED" : "REOPENED";
        int changed = jdbc.sql("UPDATE maintenance_requests SET status=:status,resolved_at=CASE WHEN :status='RESOLVED' THEN NOW() ELSE NULL END,version=version+1 WHERE id=:id AND version=:version AND status IN ('COMPLETED','INSPECTION_PENDING')")
                .param("status", status).param("id", id).param("version", version).update();
        if (changed > 0) jdbc.sql("INSERT INTO maintenance_inspections(maintenance_request_id,inspector_id,result,rating,comment,asset_working,cost_confirmed) VALUES(:id,:actor,:result,:rating,:comment,:working,:cost)")
                .param("id", id).param("actor", actor).param("result", result).param("rating", rating).param("comment", blank(comment)).param("working", working).param("cost", costConfirmed).update();
        return changed;
    }

    public void history(long id, String action, String previous, String next, String description, long actor) {
        jdbc.sql("INSERT INTO maintenance_history(maintenance_request_id,action,previous_status,new_status,description,performed_by) VALUES(:id,:action,:previous,:next,:description,:actor)")
                .param("id", id).param("action", action).param("previous", previous).param("next", next)
                .param("description", description).param("actor", actor).update();
    }

    public List<Option> properties(long userId, RoleCode role) { return options("SELECT p.id,p.name,NULL parent_id,p.address detail FROM properties p WHERE " + scope(role, "p").replace("m.assigned_to=:userId", "FALSE") + " ORDER BY p.name", userId); }
    public List<Option> buildings(long userId, RoleCode role) { return options("SELECT b.id,b.name,b.property_id parent_id,b.code detail FROM buildings b JOIN properties p ON p.id=b.property_id WHERE " + scope(role, "p").replace("m.assigned_to=:userId", "FALSE") + " ORDER BY b.name", userId); }
    public List<Option> floors(long userId, RoleCode role) { return options("SELECT f.id,f.name,f.building_id parent_id,f.code detail FROM floors f JOIN buildings b ON b.id=f.building_id JOIN properties p ON p.id=b.property_id WHERE " + scope(role, "p").replace("m.assigned_to=:userId", "FALSE") + " ORDER BY f.display_order", userId); }
    public List<Option> rooms(long userId, RoleCode role) { return options("SELECT r.id,COALESCE(r.name,r.code) name,r.floor_id parent_id,r.code detail FROM rooms r JOIN properties p ON p.id=r.property_id WHERE " + scope(role, "p").replace("m.assigned_to=:userId", "FALSE") + " ORDER BY r.code", userId); }
    public List<Option> assets(long userId, RoleCode role) { return options("SELECT a.id,a.name,a.room_id parent_id,a.condition_status detail FROM room_assets a JOIN rooms r ON r.id=a.room_id JOIN properties p ON p.id=r.property_id WHERE " + scope(role, "p").replace("m.assigned_to=:userId", "FALSE") + " ORDER BY a.name", userId); }
    public List<Option> technicians() { return jdbc.sql("SELECT DISTINCT u.id,u.full_name name,NULL parent_id,u.phone detail FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles ro ON ro.id=ur.role_id WHERE ro.code='TECHNICIAN' AND u.status='ACTIVE' ORDER BY u.full_name").query(this::option).list(); }
    public boolean isActiveTechnician(long id) { return jdbc.sql("SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=:id AND u.status='ACTIVE' AND r.code='TECHNICIAN'").param("id",id).query(Long.class).single()>0; }
    private List<Option> options(String sql, long userId) { return jdbc.sql(sql).param("userId", userId).query(this::option).list(); }

    public List<Schedule> schedules(long id) { return jdbc.sql("SELECT * FROM maintenance_schedules WHERE maintenance_request_id=:id ORDER BY scheduled_start DESC").param("id", id).query((r,n)->new Schedule(r.getLong("id"),dt(r,"scheduled_start"),dt(r,"scheduled_end"),r.getInt("estimated_duration_minutes"),r.getBoolean("tenant_presence_required"),r.getString("status"))).list(); }
    public List<WorkLog> logs(long id) { return jdbc.sql("SELECT l.*,u.full_name actor_name FROM maintenance_work_logs l JOIN users u ON u.id=l.created_by WHERE l.maintenance_request_id=:id ORDER BY l.created_at DESC").param("id",id).query((r,n)->new WorkLog(r.getLong("id"),r.getString("action_type"),r.getInt("progress_percent"),r.getString("diagnosis"),r.getString("work_performed"),r.getString("note"),dt(r,"started_at"),dt(r,"ended_at"),new Option(r.getLong("created_by"),r.getString("actor_name"),null,null),dt(r,"created_at"))).list(); }
    public List<MaterialUsage> usages(long id) { return jdbc.sql("SELECT * FROM maintenance_material_usages WHERE maintenance_request_id=:id ORDER BY created_at DESC").param("id",id).query((r,n)->new MaterialUsage(r.getLong("id"),r.getString("material_name"),money(r,"quantity"),r.getString("unit"),money(r,"unit_price"),money(r,"amount"),r.getString("status"),dt(r,"created_at"))).list(); }
    public List<Cost> costs(long id) { return jdbc.sql("SELECT * FROM maintenance_costs WHERE maintenance_request_id=:id ORDER BY created_at DESC").param("id",id).query((r,n)->new Cost(r.getLong("id"),money(r,"labor_cost"),money(r,"material_cost"),money(r,"external_service_cost"),money(r,"other_cost"),money(r,"total_cost"),r.getString("responsibility"),money(r,"tenant_share_amount"),r.getString("approval_status"),r.getString("note"),dt(r,"created_at"))).list(); }
    public List<Inspection> inspections(long id) { return jdbc.sql("SELECT i.*,u.full_name inspector_name FROM maintenance_inspections i JOIN users u ON u.id=i.inspector_id WHERE i.maintenance_request_id=:id ORDER BY i.inspected_at DESC").param("id",id).query((r,n)->new Inspection(r.getLong("id"),r.getString("result"),(Integer)r.getObject("rating"),r.getString("comment"),r.getBoolean("asset_working"),r.getBoolean("cost_confirmed"),new Option(r.getLong("inspector_id"),r.getString("inspector_name"),null,null),dt(r,"inspected_at"))).list(); }
    public List<History> histories(long id) { return jdbc.sql("SELECT h.*,u.full_name actor_name FROM maintenance_history h JOIN users u ON u.id=h.performed_by WHERE h.maintenance_request_id=:id ORDER BY h.created_at DESC").param("id",id).query((r,n)->new History(r.getLong("id"),r.getString("action"),r.getString("previous_status"),r.getString("new_status"),r.getString("description"),new Option(r.getLong("performed_by"),r.getString("actor_name"),null,null),dt(r,"created_at"))).list(); }

    public List<CalendarItem> calendar(long userId, RoleCode role, LocalDate from, LocalDate to) { return jdbc.sql("SELECT m.id,m.code,m.title,m.priority,m.status,p.name property_name,r.code room_code,u.full_name assignee_name,s.scheduled_start,s.scheduled_end FROM maintenance_schedules s JOIN maintenance_requests m ON m.id=s.maintenance_request_id JOIN properties p ON p.id=m.property_id LEFT JOIN rooms r ON r.id=m.room_id LEFT JOIN users u ON u.id=m.assigned_to WHERE s.status='ACTIVE' AND " + scope(role,"p") + " AND s.scheduled_start>=:from AND s.scheduled_start<DATE_ADD(:to,INTERVAL 1 DAY) ORDER BY s.scheduled_start").param("userId",userId).param("from",from).param("to",to).query((r,n)->new CalendarItem(r.getLong("id"),r.getString("code"),r.getString("title"),r.getString("priority"),r.getString("status"),r.getString("property_name"),r.getString("room_code"),r.getString("assignee_name"),dt(r,"scheduled_start"),dt(r,"scheduled_end"))).list(); }

    public List<Plan> plans(long userId, RoleCode role) { return jdbc.sql("SELECT x.*,p.name property_name,u.full_name assignee_name FROM preventive_maintenance_plans x JOIN properties p ON p.id=x.property_id LEFT JOIN users u ON u.id=x.assignee_id WHERE " + scope(role,"p").replace("m.assigned_to=:userId","FALSE") + " ORDER BY x.next_run_date").param("userId",userId).query((r,n)->new Plan(r.getLong("id"),r.getLong("property_id"),r.getString("property_name"),r.getString("name"),r.getString("asset_category"),r.getString("frequency_type"),r.getInt("frequency_interval"),r.getObject("start_date",LocalDate.class),r.getObject("end_date",LocalDate.class),r.getObject("assignee_id")==null?null:new Option(r.getLong("assignee_id"),r.getString("assignee_name"),null,null),r.getInt("reminder_days_before"),money(r,"estimated_cost"),r.getString("status"),r.getObject("next_run_date",LocalDate.class))).list(); }
    public long createPlan(long actor,long property,String name,String category,String frequency,int interval,LocalDate start,LocalDate end,Long assignee,int reminder,BigDecimal cost,String status){KeyHolder keys=new GeneratedKeyHolder();jdbc.sql("INSERT INTO preventive_maintenance_plans(property_id,name,asset_category,frequency_type,frequency_interval,start_date,end_date,assignee_id,reminder_days_before,estimated_cost,status,next_run_date,created_by) VALUES(:property,:name,:category,:frequency,:interval,:start,:end,:assignee,:reminder,:cost,:status,:start,:actor)").param("property",property).param("name",name).param("category",category).param("frequency",frequency).param("interval",interval).param("start",start).param("end",end).param("assignee",assignee).param("reminder",reminder).param("cost",cost).param("status",status).param("actor",actor).update(keys,"id");return keys.getKey().longValue();}

    public List<Material> materials(long userId, RoleCode role) { return jdbc.sql("SELECT x.*,p.name property_name FROM maintenance_materials x JOIN properties p ON p.id=x.property_id WHERE " + scope(role,"p").replace("m.assigned_to=:userId","FALSE") + " ORDER BY x.name").param("userId",userId).query((r,n)->new Material(r.getLong("id"),r.getLong("property_id"),r.getString("property_name"),r.getString("code"),r.getString("name"),r.getString("unit"),money(r,"stock_quantity"),money(r,"minimum_quantity"),money(r,"unit_price"),r.getString("status"))).list(); }
    public long createMaterial(long property,String code,String name,String unit,BigDecimal stock,BigDecimal minimum,BigDecimal price){KeyHolder keys=new GeneratedKeyHolder();jdbc.sql("INSERT INTO maintenance_materials(property_id,code,name,unit,stock_quantity,minimum_quantity,unit_price) VALUES(:property,:code,:name,:unit,:stock,:minimum,:price)").param("property",property).param("code",code).param("name",name).param("unit",unit).param("stock",stock).param("minimum",minimum).param("price",price).update(keys,"id");return keys.getKey().longValue();}

    public Report report(long userId, RoleCode role) { return jdbc.sql("SELECT COALESCE(SUM(m.actual_cost),0) total_cost,COALESCE(SUM(CASE WHEN m.cost_responsibility='OWNER' THEN m.actual_cost ELSE 0 END),0) owner_cost,COALESCE(SUM(CASE WHEN m.cost_responsibility='TENANT' THEN m.actual_cost ELSE 0 END),0) tenant_cost,COUNT(CASE WHEN m.status='RESOLVED' THEN 1 END) resolved_count,COALESCE(AVG(CASE WHEN m.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,m.created_at,m.resolved_at)/60 END),0) average_hours FROM maintenance_requests m JOIN properties p ON p.id=m.property_id WHERE " + scope(role,"p")).param("userId",userId).query((r,n)->new Report(money(r,"total_cost"),money(r,"owner_cost"),money(r,"tenant_cost"),r.getLong("resolved_count"),money(r,"average_hours"),List.of())).single(); }

    private RequestRow row(ResultSet r, int n) throws SQLException {
        LocalDateTime sla=dt(r,"sla_due_at"); String status=r.getString("status");
        return new RequestRow(r.getLong("id"),r.getString("code"),r.getString("title"),r.getString("issue_type"),r.getString("priority"),status,r.getBoolean("safety_risk"),new Option(r.getLong("property_id"),r.getString("property_name"),null,null),r.getObject("room_id")==null?null:new Option(r.getLong("room_id"),r.getString("room_code"),r.getLong("property_id"),null),r.getObject("reporter_id")==null&&r.getObject("tenant_id")==null?null:new Option(r.getLong("reporter_id")>0?r.getLong("reporter_id"):r.getLong("tenant_id"),r.getString("reporter_name"),null,r.getString("reporter_phone")),r.getObject("assigned_to")==null?null:new Option(r.getLong("assigned_to"),r.getString("assignee_name"),null,null),dt(r,"created_at"),dt(r,"scheduled_start"),sla,Math.max(0,java.time.Duration.between(dt(r,"created_at"),LocalDateTime.now()).toHours()),sla!=null&&sla.isBefore(LocalDateTime.now())&&!List.of("RESOLVED","CANCELLED").contains(status),money(r,"estimated_cost"),money(r,"actual_cost"),r.getInt("progress_percent"),r.getLong("version"));
    }
    private Option option(ResultSet r, int n) throws SQLException {
        Number parentId = (Number) r.getObject("parent_id");
        return new Option(r.getLong("id"), r.getString("name"),
                parentId == null ? null : parentId.longValue(), r.getString("detail"));
    }
    private static Map<String,Object> map(ResultSet r,int n)throws SQLException{Map<String,Object> result=new HashMap<>();var meta=r.getMetaData();for(int i=1;i<=meta.getColumnCount();i++)result.put(meta.getColumnLabel(i),r.getObject(i));return result;}
    private static BigDecimal money(ResultSet r,String c)throws SQLException{BigDecimal x=r.getBigDecimal(c);return x==null?BigDecimal.ZERO:x;}
    private static LocalDateTime dt(ResultSet r,String c)throws SQLException{var x=r.getTimestamp(c);return x==null?null:x.toLocalDateTime();}
    private static String blank(String x){return x==null||x.isBlank()?null:x.trim();}
}
