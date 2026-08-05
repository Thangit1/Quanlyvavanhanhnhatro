package com.thangit.boardinghouse.repository;

import static com.thangit.boardinghouse.dto.response.maintenance.TechnicianResponses.*;

import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests;
import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.*;
import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.Checklist;
import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.Diagnosis;
import com.thangit.boardinghouse.dto.request.maintenance.TechnicianRequests.WorkLog;
import com.thangit.boardinghouse.dto.response.maintenance.TechnicianResponses;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Stream;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class TechnicianPortalRepository {
    private static final String ASSIGNED = "(m.assigned_to=:userId OR EXISTS(SELECT 1 FROM maintenance_assignments ax WHERE ax.maintenance_request_id=m.id AND ax.user_id=:userId AND ax.unassigned_at IS NULL))";
    private static final String TASK_FROM = """
        FROM maintenance_requests m
        JOIN properties p ON p.id=m.property_id
        LEFT JOIN rooms r ON r.id=m.room_id
        LEFT JOIN room_assets a ON a.id=m.asset_id
        LEFT JOIN maintenance_schedules s ON s.id=(SELECT MAX(sx.id) FROM maintenance_schedules sx WHERE sx.maintenance_request_id=m.id AND sx.status='ACTIVE')
        WHERE """ + ASSIGNED;
    private static final String TASK_SELECT = """
        SELECT m.id,m.code,m.title,m.issue_type,m.priority,m.maintenance_type,m.status,m.progress_percent,
          m.sla_due_at,m.tenant_presence_required,m.version,p.id property_id,p.name property_name,
          r.id room_id,r.code room_code,r.building_name,r.floor_name,a.id asset_id,
          COALESCE(a.asset_code,CONCAT('TB-',a.id)) asset_code,a.name asset_name,
          s.scheduled_start,s.estimated_duration_minutes,
          COALESCE((SELECT ma.assignment_role FROM maintenance_assignments ma WHERE ma.maintenance_request_id=m.id AND ma.user_id=:userId AND ma.unassigned_at IS NULL ORDER BY ma.id DESC LIMIT 1),'PRIMARY') assignment_role
        """;

    private final JdbcClient jdbc;
    public TechnicianPortalRepository(JdbcClient jdbc) { this.jdbc=jdbc; }

    public Optional<Technician> technician(long userId) {
        return jdbc.sql("""
            SELECT u.id,u.full_name,u.email,u.phone,u.avatar_url,
              COALESCE(tp.employee_code,CONCAT('KT-',LPAD(u.id,6,'0'))) employee_code,
              tp.expertise,tp.working_area,tp.work_schedule,COALESCE(tp.working_status,'AVAILABLE') working_status,
              COALESCE(tp.version,0) version
            FROM users u LEFT JOIN technician_profiles tp ON tp.user_id=u.id WHERE u.id=:id
            """).param("id",userId).query((rs,n)->new Technician(rs.getLong("id"),rs.getString("employee_code"),
                rs.getString("full_name"),rs.getString("email"),rs.getString("phone"),rs.getString("avatar_url"),
                rs.getString("expertise"),rs.getString("working_area"),rs.getString("work_schedule"),
                rs.getString("working_status"),rs.getLong("version"))).optional();
    }

    public Summary summary(long userId) {
        return jdbc.sql("""
            SELECT COUNT(CASE WHEN DATE(COALESCE(s.scheduled_start,m.created_at))=CURDATE() THEN 1 END) today_count,
              COUNT(CASE WHEN m.status='IN_PROGRESS' THEN 1 END) progress_count,
              COUNT(CASE WHEN m.priority='URGENT' AND m.status NOT IN ('RESOLVED','CANCELLED','DECLINED') THEN 1 END) urgent_count,
              COUNT(CASE WHEN m.sla_due_at<NOW() AND m.status NOT IN ('RESOLVED','CANCELLED','DECLINED') THEN 1 END) overdue_count,
              COUNT(CASE WHEN m.status='WAITING_PARTS' THEN 1 END) waiting_parts_count,
              COUNT(CASE WHEN m.status IN ('COMPLETED','INSPECTION_PENDING') THEN 1 END) inspection_count,
              COUNT(CASE WHEN m.completed_at>=DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN 1 END) completed_month,
              COALESCE(100*SUM(CASE WHEN m.completed_at IS NOT NULL AND (m.sla_due_at IS NULL OR m.completed_at<=m.sla_due_at) THEN 1 ELSE 0 END)/NULLIF(SUM(m.completed_at IS NOT NULL),0),0) on_time_rate
            FROM maintenance_requests m
            LEFT JOIN maintenance_schedules s ON s.id=(SELECT MAX(sx.id) FROM maintenance_schedules sx WHERE sx.maintenance_request_id=m.id AND sx.status='ACTIVE')
            WHERE """+ASSIGNED).param("userId",userId).query((rs,n)->new Summary(rs.getLong("today_count"),
                rs.getLong("progress_count"),rs.getLong("urgent_count"),rs.getLong("overdue_count"),
                rs.getLong("waiting_parts_count"),rs.getLong("inspection_count"),rs.getLong("completed_month"),
                decimal(rs,"on_time_rate"))).single();
    }

    public Page<TaskRow> tasks(long userId,String keyword,String status,String priority,String category,
                               Long propertyId,LocalDate from,LocalDate to,Boolean overdue,
                               String taskType,int page,int size,String sort) {
        String filters="""
          AND (:keyword IS NULL OR m.code LIKE :search OR m.title LIKE :search OR p.name LIKE :search OR r.code LIKE :search)
          AND (:status IS NULL OR m.status=:status) AND (:priority IS NULL OR m.priority=:priority)
          AND (:category IS NULL OR m.issue_type=:category) AND (:propertyId IS NULL OR m.property_id=:propertyId)
          AND (:fromDate IS NULL OR DATE(COALESCE(s.scheduled_start,m.created_at))>=:fromDate)
          AND (:toDate IS NULL OR DATE(COALESCE(s.scheduled_start,m.created_at))<=:toDate)
          AND (:overdue IS NULL OR :overdue=FALSE OR (m.sla_due_at<NOW() AND m.status NOT IN ('RESOLVED','CANCELLED','DECLINED')))
          AND (:taskType IS NULL OR m.maintenance_type=:taskType)
          """;
        String order=switch(sort==null?"schedule":sort){case "oldest"->"m.created_at ASC";case "priority"->"FIELD(m.priority,'URGENT','HIGH','MEDIUM','LOW'),m.sla_due_at";case "updated"->"m.updated_at DESC";default->"COALESCE(s.scheduled_start,m.sla_due_at,m.created_at) ASC";};
        var count=bind(jdbc.sql("SELECT COUNT(*) "+TASK_FROM+filters),userId,keyword,status,priority,category,propertyId,from,to,overdue,taskType).query(Long.class).single();
        var rows=bind(jdbc.sql(TASK_SELECT+TASK_FROM+filters+" ORDER BY "+order+" LIMIT :limit OFFSET :offset"),userId,keyword,status,priority,category,propertyId,from,to,overdue,taskType)
            .param("limit",size).param("offset",page*size).query(this::task).list();
        return new Page<>(rows,page,size,count,(int)Math.ceil(count/(double)size));
    }

    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec q,long userId,String keyword,String status,String priority,
            String category,Long propertyId,LocalDate from,LocalDate to,Boolean overdue,String taskType){String k=blank(keyword);return q.param("userId",userId).param("keyword",k).param("search",k==null?null:"%"+k+"%")
        .param("status",blank(status)).param("priority",blank(priority)).param("category",blank(category)).param("propertyId",propertyId)
        .param("fromDate",from).param("toDate",to).param("overdue",overdue).param("taskType",blank(taskType));}

    public List<TaskRow> highlighted(long userId,String mode,int limit){String filter=switch(mode){case "CURRENT"->" AND m.status='IN_PROGRESS'";case "URGENT"->" AND m.priority='URGENT' AND m.status NOT IN ('RESOLVED','CANCELLED','DECLINED')";default->" AND m.status NOT IN ('RESOLVED','CANCELLED','DECLINED')";};return jdbc.sql(TASK_SELECT+TASK_FROM+filter+" ORDER BY COALESCE(s.scheduled_start,m.sla_due_at,m.created_at) LIMIT :limit").param("userId",userId).param("limit",limit).query(this::task).list();}

    public Optional<Map<String,Object>> taskData(long userId,long taskId,boolean lock){return jdbc.sql("""
        SELECT m.*,p.name property_name,p.address property_address,r.code room_code,r.building_name,r.floor_name,
          a.name asset_name,a.asset_code,a.brand,a.model,a.serial_number,a.condition_status,a.warranty_expiry,
          t.full_name tenant_name,t.phone tenant_phone
        FROM maintenance_requests m JOIN properties p ON p.id=m.property_id
        LEFT JOIN rooms r ON r.id=m.room_id LEFT JOIN room_assets a ON a.id=m.asset_id
        LEFT JOIN users t ON t.id=COALESCE(m.tenant_id,m.reporter_id)
        WHERE m.id=:taskId AND """+ASSIGNED+(lock?" FOR UPDATE":"")).param("taskId",taskId).param("userId",userId).query(TechnicianPortalRepository::map).optional();}

    public Optional<TaskRow> taskRow(long userId,long taskId){return jdbc.sql(TASK_SELECT+TASK_FROM+" AND m.id=:taskId").param("userId",userId).param("taskId",taskId).query(this::task).optional();}
    public Optional<Schedule> schedule(long taskId){return jdbc.sql("SELECT * FROM maintenance_schedules WHERE maintenance_request_id=:id AND status='ACTIVE' ORDER BY id DESC LIMIT 1").param("id",taskId).query((rs,n)->new Schedule(rs.getLong("id"),ldt(rs,"scheduled_start"),ldt(rs,"scheduled_end"),rs.getInt("estimated_duration_minutes"),rs.getBoolean("tenant_presence_required"),rs.getString("status"))).optional();}
    public Optional<TechnicianResponses.Diagnosis> diagnosis(long taskId){return jdbc.sql("SELECT * FROM maintenance_diagnoses WHERE maintenance_request_id=:id").param("id",taskId).query((rs,n)->new TechnicianResponses.Diagnosis(rs.getLong("id"),rs.getString("observed_condition"),rs.getString("symptoms"),rs.getString("preliminary_cause"),rs.getString("root_cause"),rs.getString("damage_level"),rs.getBoolean("asset_usable"),rs.getBoolean("safety_risk"),rs.getBoolean("replacement_required"),rs.getBoolean("support_required"),rs.getBoolean("external_vendor_required"),rs.getString("recommended_solution"),ldt(rs,"updated_at"))).optional();}
    public List<TechnicianResponses.Checklist> checklist(long taskId){return jdbc.sql("SELECT * FROM maintenance_checklist_items WHERE maintenance_request_id=:id ORDER BY display_order,id").param("id",taskId).query((rs,n)->new TechnicianResponses.Checklist(rs.getLong("id"),rs.getString("label"),rs.getBoolean("required"),rs.getString("result"),rs.getString("note"),rs.getInt("display_order"))).list();}
    public List<TechnicianResponses.WorkLog> logs(long taskId){return jdbc.sql("SELECT id,action_type,work_performed,diagnosis,progress_percent,TIMESTAMPDIFF(MINUTE,started_at,ended_at) duration_minutes,note,created_at FROM maintenance_work_logs WHERE maintenance_request_id=:id ORDER BY created_at DESC").param("id",taskId).query((rs,n)->new TechnicianResponses.WorkLog(rs.getLong("id"),rs.getString("action_type"),rs.getString("work_performed"),rs.getString("diagnosis"),rs.getInt("progress_percent"),Math.max(0,rs.getInt("duration_minutes")),rs.getString("note"),ldt(rs,"created_at"))).list();}
    public List<Material> usages(long taskId){return jdbc.sql("SELECT u.id,u.material_id,mm.code,u.material_name,u.quantity,u.unit,u.unit_price,u.amount,u.status,0 used_quantity,0 returned_quantity,u.created_at FROM maintenance_material_usages u LEFT JOIN maintenance_materials mm ON mm.id=u.material_id WHERE u.maintenance_request_id=:id ORDER BY u.created_at DESC").param("id",taskId).query(this::material).list();}
    public List<Cost> costs(long taskId){return jdbc.sql("SELECT * FROM maintenance_costs WHERE maintenance_request_id=:id ORDER BY created_at DESC").param("id",taskId).query((rs,n)->new Cost(rs.getLong("id"),decimal(rs,"labor_cost"),decimal(rs,"material_cost"),decimal(rs,"external_service_cost"),decimal(rs,"other_cost"),decimal(rs,"total_cost"),rs.getString("responsibility"),rs.getString("approval_status"),rs.getString("note"),ldt(rs,"created_at"))).list();}
    public List<Attachment> attachments(long taskId){return jdbc.sql("SELECT id,attachment_type,file_name,mime_type,file_size,caption,created_at FROM maintenance_attachments WHERE maintenance_request_id=:id ORDER BY created_at DESC").param("id",taskId).query((rs,n)->new Attachment(rs.getLong("id"),rs.getString("attachment_type"),rs.getString("file_name"),rs.getString("mime_type"),rs.getLong("file_size"),rs.getString("caption"),"/technician/tasks/"+taskId+"/attachments/"+rs.getLong("id"),ldt(rs,"created_at"))).list();}
    public List<MessageRow> messages(long taskId){return jdbc.sql("SELECT x.id,u.full_name,r.code role_code,x.content,x.internal,x.created_at FROM maintenance_messages x JOIN users u ON u.id=x.sender_id LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id WHERE x.maintenance_request_id=:id GROUP BY x.id,u.full_name,r.code,x.content,x.internal,x.created_at ORDER BY x.created_at").param("id",taskId).query((rs,n)->new MessageRow(rs.getLong("id"),rs.getString("full_name"),rs.getString("role_code"),rs.getString("content"),rs.getBoolean("internal"),ldt(rs,"created_at"))).list();}
    public List<History> history(long taskId){return jdbc.sql("SELECT id,action,previous_status,new_status,description,created_at FROM maintenance_history WHERE maintenance_request_id=:id ORDER BY created_at DESC").param("id",taskId).query((rs,n)->new History(rs.getLong("id"),rs.getString("action"),rs.getString("previous_status"),rs.getString("new_status"),rs.getString("description"),ldt(rs,"created_at"))).list();}
    public Optional<Inspection> inspection(long taskId){return jdbc.sql("SELECT i.*,u.full_name FROM maintenance_inspections i JOIN users u ON u.id=i.inspector_id WHERE i.maintenance_request_id=:id ORDER BY i.id DESC LIMIT 1").param("id",taskId).query((rs,n)->new Inspection(rs.getString("result"),(Integer)rs.getObject("rating"),rs.getString("comment"),rs.getBoolean("asset_working"),rs.getBoolean("cost_confirmed"),rs.getString("full_name"),ldt(rs,"inspected_at"))).optional();}

    public int transition(long userId,long taskId,long version,List<String> from,String to,String actionNote){String allowed=from.stream().map(x->"'"+x+"'").reduce((a,b)->a+","+b).orElse("''");String extra=switch(to){case "ACCEPTED"->",accepted_at=NOW()";case "TRAVELING"->",traveling_at=NOW()";case "ARRIVED"->",checked_in_at=NOW()";case "IN_PROGRESS"->",work_started_at=COALESCE(work_started_at,NOW()),paused_at=NULL,pause_reason=NULL,progress_percent=GREATEST(progress_percent,1)";default->"";};return jdbc.sql("UPDATE maintenance_requests m SET status=:to,version=version+1"+extra+" WHERE id=:taskId AND version=:version AND status IN ("+allowed+") AND "+ASSIGNED).param("to",to).param("taskId",taskId).param("version",version).param("userId",userId).update();}
    public int decline(long userId,long taskId,long version,String reason){return jdbc.sql("UPDATE maintenance_requests m SET status='DECLINED',declined_at=NOW(),decline_reason=:reason,version=version+1 WHERE id=:taskId AND version=:version AND status IN ('ASSIGNED','NEW_ASSIGNMENT') AND "+ASSIGNED).param("reason",reason).param("taskId",taskId).param("version",version).param("userId",userId).update();}
    public int checkIn(long userId,long taskId,long version,LocalDateTime at,String note){return jdbc.sql("UPDATE maintenance_requests m SET status='ARRIVED',checked_in_at=COALESCE(:at,NOW()),check_in_note=:note,version=version+1 WHERE id=:taskId AND version=:version AND status IN ('TRAVELING','ACCEPTED','SCHEDULED') AND "+ASSIGNED).param("at",at).param("note",blank(note)).param("taskId",taskId).param("version",version).param("userId",userId).update();}
    public int pause(long userId,long taskId,long version,String status,String reason){return jdbc.sql("UPDATE maintenance_requests m SET status=:status,paused_at=NOW(),pause_reason=:reason,version=version+1 WHERE id=:taskId AND version=:version AND status='IN_PROGRESS' AND "+ASSIGNED).param("status",status).param("reason",reason).param("taskId",taskId).param("version",version).param("userId",userId).update();}
    public int bump(long userId,long taskId,long version){return jdbc.sql("UPDATE maintenance_requests m SET version=version+1 WHERE id=:taskId AND version=:version AND "+ASSIGNED).param("taskId",taskId).param("version",version).param("userId",userId).update();}
    public void history(long taskId,long userId,String action,String before,String after,String description){jdbc.sql("INSERT INTO maintenance_history(maintenance_request_id,action,previous_status,new_status,description,visibility,performed_by) VALUES(:id,:action,:before,:after,:description,'TENANT_VISIBLE',:userId)").param("id",taskId).param("action",action).param("before",before).param("after",after).param("description",description).param("userId",userId).update();}
    public void notifyManagers(long taskId,String title,String content,String type){jdbc.sql("""
        INSERT INTO notifications(user_id,title,content,type)
        SELECT DISTINCT x.user_id,:title,:content,:type FROM (
          SELECT p.owner_id user_id FROM maintenance_requests m JOIN properties p ON p.id=m.property_id WHERE m.id=:taskId
          UNION SELECT pm.manager_id FROM maintenance_requests m JOIN property_managers pm ON pm.property_id=m.property_id WHERE m.id=:taskId
        ) x
        """).param("title",title).param("content",content).param("type",type).param("taskId",taskId).update();}
    public void addWorkLog(long taskId,long userId,WorkLog r){LocalDateTime end=LocalDateTime.now();jdbc.sql("INSERT INTO maintenance_work_logs(maintenance_request_id,action_type,progress_percent,diagnosis,work_performed,note,started_at,ended_at,created_by) VALUES(:id,:type,:progress,:result,:description,:note,:start,:end,:userId)").param("id",taskId).param("type",r.activityType()).param("progress",r.progressPercent()).param("result",blank(r.result())).param("description",r.description().trim()).param("note",blank(r.note())).param("start",end.minusMinutes(r.durationMinutes())).param("end",end).param("userId",userId).update();jdbc.sql("UPDATE maintenance_requests SET progress_percent=:progress WHERE id=:id").param("progress",r.progressPercent()).param("id",taskId).update();}
    public void saveDiagnosis(long taskId,long userId,Diagnosis r){jdbc.sql("""
        INSERT INTO maintenance_diagnoses(maintenance_request_id,observed_condition,symptoms,preliminary_cause,root_cause,damage_level,asset_usable,safety_risk,replacement_required,support_required,external_vendor_required,recommended_solution,created_by)
        VALUES(:id,:observed,:symptoms,:preliminary,:root,:damage,:usable,:risk,:replacement,:support,:external,:solution,:userId)
        ON DUPLICATE KEY UPDATE observed_condition=VALUES(observed_condition),symptoms=VALUES(symptoms),preliminary_cause=VALUES(preliminary_cause),root_cause=VALUES(root_cause),damage_level=VALUES(damage_level),asset_usable=VALUES(asset_usable),safety_risk=VALUES(safety_risk),replacement_required=VALUES(replacement_required),support_required=VALUES(support_required),external_vendor_required=VALUES(external_vendor_required),recommended_solution=VALUES(recommended_solution),created_by=VALUES(created_by)
        """).param("id",taskId).param("observed",r.observedCondition().trim()).param("symptoms",blank(r.symptoms())).param("preliminary",blank(r.preliminaryCause())).param("root",blank(r.rootCause())).param("damage",r.damageLevel()).param("usable",r.assetUsable()).param("risk",r.safetyRisk()).param("replacement",r.replacementRequired()).param("support",r.supportRequired()).param("external",r.externalVendorRequired()).param("solution",r.recommendedSolution().trim()).param("userId",userId).update();jdbc.sql("UPDATE maintenance_requests SET diagnosis=:diagnosis,safety_risk=:risk,asset_usable=:usable WHERE id=:id").param("diagnosis",blank(r.rootCause())==null?r.preliminaryCause():r.rootCause()).param("risk",r.safetyRisk()).param("usable",r.assetUsable()).param("id",taskId).update();}
    public void updateChecklist(long taskId,long userId,ChecklistItem item){jdbc.sql("UPDATE maintenance_checklist_items SET result=:result,note=:note,updated_by=:userId,updated_at=NOW() WHERE id=:itemId AND maintenance_request_id=:taskId").param("result",item.result()).param("note",blank(item.note())).param("userId",userId).param("itemId",item.checklistItemId()).param("taskId",taskId).update();}
    public long createMaterialRequest(long taskId,long userId,MaterialRequest r){GeneratedKeyHolder keys=new GeneratedKeyHolder();jdbc.sql("INSERT INTO maintenance_material_requests(maintenance_request_id,requested_by,needed_at,urgency,note) VALUES(:taskId,:userId,:neededAt,:urgency,:note)").param("taskId",taskId).param("userId",userId).param("neededAt",r.neededAt()).param("urgency",r.urgency()==null?"MEDIUM":r.urgency()).param("note",blank(r.note())).update(keys,"id");long id=Objects.requireNonNull(keys.getKey()).longValue();for(MaterialItem i:r.items())jdbc.sql("INSERT INTO maintenance_material_request_items(material_request_id,material_id,material_name,quantity,unit,reason) VALUES(:requestId,:materialId,:name,:quantity,:unit,:reason)").param("requestId",id).param("materialId",i.materialId()).param("name",i.materialName().trim()).param("quantity",i.quantity()).param("unit",i.unit().trim()).param("reason",i.reason().trim()).update();return id;}
    public void addUsage(long taskId,long userId,MaterialUsage r){Map<String,Object> i=jdbc.sql("SELECT i.*,COALESCE(mm.unit_price,0) unit_price FROM maintenance_material_request_items i JOIN maintenance_material_requests m ON m.id=i.material_request_id LEFT JOIN maintenance_materials mm ON mm.id=i.material_id WHERE i.id=:id AND m.maintenance_request_id=:taskId AND m.requested_by=:userId AND m.status IN ('APPROVED','RECEIVED')").param("id",r.materialRequestItemId()).param("taskId",taskId).param("userId",userId).query(TechnicianPortalRepository::map).single();jdbc.sql("UPDATE maintenance_material_request_items SET used_quantity=:used,returned_quantity=:returned WHERE id=:id").param("used",r.usedQuantity()).param("returned",r.returnedQuantity()).param("id",r.materialRequestItemId()).update();BigDecimal price=(BigDecimal)i.get("unit_price");jdbc.sql("INSERT INTO maintenance_material_usages(maintenance_request_id,material_id,material_name,quantity,unit,unit_price,amount,status,created_by) VALUES(:taskId,:materialId,:name,:quantity,:unit,:price,:amount,'CONFIRMED',:userId)").param("taskId",taskId).param("materialId",i.get("material_id")).param("name",i.get("material_name")).param("quantity",r.usedQuantity()).param("unit",i.get("unit")).param("price",price).param("amount",price.multiply(r.usedQuantity())).param("userId",userId).update();}
    public void cost(long taskId,long userId,CostProposal r){BigDecimal labor=BigDecimal.ZERO,material=BigDecimal.ZERO,external=BigDecimal.ZERO,other=BigDecimal.ZERO;for(CostItem i:r.items()){BigDecimal amount=i.quantity().multiply(i.unitPrice());switch(i.costType()){case "LABOR"->labor=labor.add(amount);case "MATERIAL"->material=material.add(amount);case "EXTERNAL_SERVICE"->external=external.add(amount);default->other=other.add(amount);}}BigDecimal total=labor.add(material).add(external).add(other);jdbc.sql("INSERT INTO maintenance_costs(maintenance_request_id,labor_cost,material_cost,external_service_cost,other_cost,total_cost,responsibility,approval_status,proposed_by,note) VALUES(:id,:labor,:material,:external,:other,:total,:responsibility,'PENDING',:userId,:note)").param("id",taskId).param("labor",labor).param("material",material).param("external",external).param("other",other).param("total",total).param("responsibility",r.proposedResponsibility()).param("userId",userId).param("note",blank(r.note())).update();jdbc.sql("UPDATE maintenance_requests SET estimated_cost=:total,cost_responsibility=:responsibility,status='WAITING_APPROVAL' WHERE id=:id").param("total",total).param("responsibility",r.proposedResponsibility()).param("id",taskId).update();}
    public void complete(long taskId,Complete r){jdbc.sql("UPDATE maintenance_requests SET status='INSPECTION_PENDING',progress_percent=100,diagnosis=:root,resolution=:resolution,work_started_at=COALESCE(work_started_at,:started),completed_at=COALESCE(:completed,NOW()),asset_condition_after=:condition,test_result=:test,follow_up_required=:followUp,follow_up_date=:followDate,technician_recommendation=:recommendation,version=version+1 WHERE id=:id AND version=:version AND status='IN_PROGRESS'").param("root",r.rootCause().trim()).param("resolution",r.resolution().trim()).param("started",r.startedAt()).param("completed",r.completedAt()).param("condition",r.assetConditionAfter()).param("test",r.testResult().trim()).param("followUp",r.followUpRequired()).param("followDate",r.followUpDate()).param("recommendation",blank(r.recommendation())).param("id",taskId).param("version",r.version()).update();}
    public long countLogs(long taskId){return count("SELECT COUNT(*) FROM maintenance_work_logs WHERE maintenance_request_id=:id",taskId);}
    public long incompleteRequiredChecklist(long taskId){return count("SELECT COUNT(*) FROM maintenance_checklist_items WHERE maintenance_request_id=:id AND required=TRUE AND result IS NULL",taskId);}
    public long countAfterAttachments(long taskId){return count("SELECT COUNT(*) FROM maintenance_attachments WHERE maintenance_request_id=:id AND attachment_type IN ('AFTER','RESULT')",taskId);}
    private long count(String sql,long id){return jdbc.sql(sql).param("id",id).query(Long.class).single();}
    public long attachment(long taskId,long userId,String type,String name,String mime,byte[] bytes,String caption){GeneratedKeyHolder keys=new GeneratedKeyHolder();jdbc.sql("INSERT INTO maintenance_attachments(maintenance_request_id,attachment_type,file_url,file_content,file_name,mime_type,file_size,caption,visibility,uploaded_by) SELECT m.id,:type,NULL,:content,:name,:mime,:size,:caption,'TENANT_VISIBLE',:userId FROM maintenance_requests m WHERE m.id=:taskId AND "+ASSIGNED).param("type",type).param("content",bytes).param("name",name).param("mime",mime).param("size",bytes.length).param("caption",blank(caption)).param("userId",userId).param("taskId",taskId).update(keys,"id");return Objects.requireNonNull(keys.getKey()).longValue();}
    public Optional<FileData> attachmentFile(long taskId,long attachmentId,long userId){return jdbc.sql("SELECT a.file_name,a.mime_type,a.file_content FROM maintenance_attachments a JOIN maintenance_requests m ON m.id=a.maintenance_request_id WHERE a.id=:attachmentId AND m.id=:taskId AND "+ASSIGNED).param("attachmentId",attachmentId).param("taskId",taskId).param("userId",userId).query((rs,n)->new FileData(rs.getString(1),rs.getString(2),rs.getBytes(3))).optional();}
    public void message(long taskId,long userId,Message r){jdbc.sql("INSERT INTO maintenance_messages(maintenance_request_id,sender_id,content,internal) VALUES(:taskId,:userId,:content,:internal)").param("taskId",taskId).param("userId",userId).param("content",r.content().trim()).param("internal",r.internal()).update();}
    public void reschedule(long taskId,long userId,Reschedule r){jdbc.sql("INSERT INTO maintenance_reschedule_requests(maintenance_request_id,requested_by,proposed_start,reason) VALUES(:taskId,:userId,:start,:reason)").param("taskId",taskId).param("userId",userId).param("start",r.proposedStart()).param("reason",r.reason().trim()).update();}
    public void transfer(long taskId,long userId,String reason){jdbc.sql("INSERT INTO maintenance_transfer_requests(maintenance_request_id,requested_by,reason) VALUES(:taskId,:userId,:reason)").param("taskId",taskId).param("userId",userId).param("reason",reason).update();}

    public List<CalendarItem> calendar(long userId,LocalDate from,LocalDate to){return jdbc.sql(TASK_SELECT+TASK_FROM+" AND DATE(COALESCE(s.scheduled_start,m.created_at)) BETWEEN :fromDate AND :toDate ORDER BY COALESCE(s.scheduled_start,m.created_at)").param("userId",userId).param("fromDate",from).param("toDate",to).query((rs,n)->new CalendarItem(rs.getLong("id"),rs.getString("code"),rs.getString("title"),rs.getString("priority"),rs.getString("status"),rs.getString("property_name"),rs.getString("room_code"),ldt(rs,"scheduled_start"),ldt(rs,"scheduled_start")==null?null:ldt(rs,"scheduled_start").plusMinutes(rs.getInt("estimated_duration_minutes")))).list();}
    public List<PreventivePlan> plans(long userId){return jdbc.sql("SELECT x.*,p.name property_name FROM preventive_maintenance_plans x JOIN properties p ON p.id=x.property_id WHERE x.assignee_id=:id ORDER BY x.next_run_date").param("id",userId).query((rs,n)->new PreventivePlan(rs.getLong("id"),rs.getString("property_name"),rs.getString("name"),rs.getString("asset_category"),rs.getString("frequency_type"),rs.getInt("frequency_interval"),rs.getObject("next_run_date",LocalDate.class),rs.getString("status"),decimal(rs,"estimated_cost"))).list();}
    public List<Asset> assets(long userId){return jdbc.sql("""
        SELECT a.*,r.code room_code,p.name property_name,COUNT(DISTINCT m.id) maintenance_count
        FROM room_assets a JOIN rooms r ON r.id=a.room_id JOIN properties p ON p.id=r.property_id
        LEFT JOIN maintenance_requests m ON m.asset_id=a.id
        WHERE EXISTS(SELECT 1 FROM maintenance_requests tx WHERE tx.asset_id=a.id AND (tx.assigned_to=:id OR EXISTS(SELECT 1 FROM maintenance_assignments ma WHERE ma.maintenance_request_id=tx.id AND ma.user_id=:id AND ma.unassigned_at IS NULL)))
        GROUP BY a.id,r.code,p.name ORDER BY a.name
        """).param("id",userId).query(this::asset).list();}
    public Optional<Asset> asset(long userId,long assetId){return assets(userId).stream().filter(x->x.id()==assetId).findFirst();}
    public List<MaterialCatalog> materials(long userId){return jdbc.sql("""
        SELECT DISTINCT mm.*,p.name property_name FROM maintenance_materials mm JOIN properties p ON p.id=mm.property_id
        WHERE EXISTS(SELECT 1 FROM maintenance_requests m WHERE m.property_id=mm.property_id AND (m.assigned_to=:id OR EXISTS(SELECT 1 FROM maintenance_assignments ma WHERE ma.maintenance_request_id=m.id AND ma.user_id=:id AND ma.unassigned_at IS NULL))) ORDER BY mm.name
        """).param("id",userId).query((rs,n)->new MaterialCatalog(rs.getLong("id"),rs.getString("code"),rs.getString("name"),rs.getString("unit"),decimal(rs,"stock_quantity"),decimal(rs,"minimum_quantity"),decimal(rs,"unit_price"),rs.getString("property_name"),rs.getString("status"))).list();}
    public List<MaterialRequestRow> materialRequests(long userId){return jdbc.sql("SELECT x.*,m.code task_code,m.title task_title FROM maintenance_material_requests x JOIN maintenance_requests m ON m.id=x.maintenance_request_id WHERE x.requested_by=:id ORDER BY x.created_at DESC").param("id",userId).query((rs,n)->new MaterialRequestRow(rs.getLong("id"),rs.getString("task_code"),rs.getString("task_title"),rs.getString("urgency"),rs.getString("status"),ldt(rs,"needed_at"),rs.getString("note"),ldt(rs,"created_at"),materialRequestItems(rs.getLong("id")),rs.getLong("version"))).list();}
    private List<Material> materialRequestItems(long requestId){return jdbc.sql("SELECT i.id,i.material_id,mm.code,i.material_name,i.quantity,i.unit,COALESCE(mm.unit_price,0) unit_price,COALESCE(mm.unit_price,0)*i.quantity amount,r.status,i.used_quantity,i.returned_quantity,r.created_at FROM maintenance_material_request_items i JOIN maintenance_material_requests r ON r.id=i.material_request_id LEFT JOIN maintenance_materials mm ON mm.id=i.material_id WHERE i.material_request_id=:id").param("id",requestId).query(this::material).list();}
    public int receiveMaterialRequest(long userId,long requestId,long version){return jdbc.sql("UPDATE maintenance_material_requests SET status='RECEIVED',received_at=NOW(),version=version+1 WHERE id=:id AND requested_by=:userId AND status='APPROVED' AND version=:version").param("id",requestId).param("userId",userId).param("version",version).update();}
    public List<Notification> notifications(long userId){return jdbc.sql("SELECT * FROM notifications WHERE user_id=:id ORDER BY created_at DESC LIMIT 100").param("id",userId).query((rs,n)->new Notification(rs.getLong("id"),rs.getString("title"),rs.getString("content"),rs.getString("type"),rs.getObject("read_at")!=null,ldt(rs,"created_at"))).list();}
    public int markRead(long userId,long id){return jdbc.sql("UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=:id AND user_id=:userId").param("id",id).param("userId",userId).update();}
    public Performance performance(long userId){return jdbc.sql("""
        SELECT COUNT(*) assigned_count,COUNT(CASE WHEN m.completed_at IS NOT NULL THEN 1 END) completed_count,
          COUNT(CASE WHEN m.completed_at IS NOT NULL AND (m.sla_due_at IS NULL OR m.completed_at<=m.sla_due_at) THEN 1 END) on_time_count,
          COUNT(CASE WHEN m.completed_at>m.sla_due_at THEN 1 END) overdue_count,
          COUNT(CASE WHEN i.result='PASSED' THEN 1 END) first_pass_count,
          COUNT(CASE WHEN m.status='REOPENED' OR EXISTS(SELECT 1 FROM maintenance_history h WHERE h.maintenance_request_id=m.id AND h.action='REOPENED') THEN 1 END) reopened_count,
          COALESCE(AVG(CASE WHEN m.completed_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,m.work_started_at,m.completed_at)/60 END),0) avg_hours,
          COALESCE(SUM(CASE WHEN h.new_status='WAITING_PARTS' THEN TIMESTAMPDIFF(HOUR,h.created_at,COALESCE((SELECT MIN(h2.created_at) FROM maintenance_history h2 WHERE h2.maintenance_request_id=m.id AND h2.created_at>h.created_at),NOW())) ELSE 0 END),0) waiting_hours,
          COUNT(CASE WHEN m.priority='URGENT' THEN 1 END) urgent_count,COALESCE(AVG(i.rating),0) avg_rating
        FROM maintenance_requests m LEFT JOIN maintenance_inspections i ON i.maintenance_request_id=m.id
        LEFT JOIN maintenance_history h ON h.maintenance_request_id=m.id AND h.new_status='WAITING_PARTS'
        WHERE """+ASSIGNED).param("userId",userId).query((rs,n)->new Performance(rs.getLong("assigned_count"),rs.getLong("completed_count"),rs.getLong("on_time_count"),rs.getLong("overdue_count"),rs.getLong("first_pass_count"),rs.getLong("reopened_count"),decimal(rs,"avg_hours"),decimal(rs,"waiting_hours"),rs.getLong("urgent_count"),decimal(rs,"avg_rating"),trend(userId),categories(userId))).single();}
    private List<MetricPoint> trend(long userId){return jdbc.sql("SELECT DATE_FORMAT(created_at,'%Y-%m') label,COUNT(*) value FROM maintenance_requests m WHERE "+ASSIGNED+" AND created_at>=DATE_SUB(CURDATE(),INTERVAL 5 MONTH) GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY label").param("userId",userId).query((rs,n)->new MetricPoint(rs.getString("label"),rs.getBigDecimal("value"))).list();}
    private List<MetricPoint> categories(long userId){return jdbc.sql("SELECT issue_type label,COUNT(*) value FROM maintenance_requests m WHERE "+ASSIGNED+" GROUP BY issue_type ORDER BY value DESC LIMIT 8").param("userId",userId).query((rs,n)->new MetricPoint(rs.getString("label"),rs.getBigDecimal("value"))).list();}
    public Account account(long userId){Technician t=technician(userId).orElseThrow();Map<String,Object> p=jdbc.sql("SELECT COALESCE(cost_limit,0) cost_limit,COALESCE(notify_assignment,TRUE) notify_assignment,COALESCE(notify_schedule,TRUE) notify_schedule,COALESCE(notify_urgent,TRUE) notify_urgent,COALESCE(notify_material,TRUE) notify_material FROM technician_profiles WHERE user_id=:id").param("id",userId).query(TechnicianPortalRepository::map).optional().orElse(Map.of("cost_limit",BigDecimal.ZERO,"notify_assignment",true,"notify_schedule",true,"notify_urgent",true,"notify_material",true));return new Account(t,(BigDecimal)p.get("cost_limit"),flag(p.get("notify_assignment")),flag(p.get("notify_schedule")),flag(p.get("notify_urgent")),flag(p.get("notify_material")),sessions(userId));}
    public List<Session> sessions(long userId){return jdbc.sql("SELECT id,user_agent,ip_address,created_at,COALESCE(last_used_at,created_at) last_active_at,(revoked_at IS NULL AND expires_at>NOW()) active FROM refresh_tokens WHERE user_id=:id ORDER BY created_at DESC LIMIT 20").param("id",userId).query((rs,n)->new Session(rs.getLong("id"),rs.getString("user_agent"),rs.getString("ip_address"),ldt(rs,"created_at"),ldt(rs,"last_active_at"),rs.getBoolean("active"))).list();}
    public int updateProfile(long userId,ProfileUpdate r){return jdbc.sql("UPDATE users u JOIN technician_profiles tp ON tp.user_id=u.id SET u.email=LOWER(:email),u.phone=:phone,tp.version=tp.version+1 WHERE u.id=:id AND tp.version=:version").param("email",r.email()).param("phone",blank(r.phone())).param("id",userId).param("version",r.version()).update();}
    public int updatePreferences(long userId,PreferenceUpdate r){return jdbc.sql("UPDATE technician_profiles SET notify_assignment=:a,notify_schedule=:s,notify_urgent=:u,notify_material=:m,version=version+1 WHERE user_id=:id AND version=:version").param("a",r.notifyAssignment()).param("s",r.notifySchedule()).param("u",r.notifyUrgent()).param("m",r.notifyMaterial()).param("id",userId).param("version",r.version()).update();}
    public Optional<String> passwordHash(long userId){return jdbc.sql("SELECT password_hash FROM users WHERE id=:id").param("id",userId).query(String.class).optional();}
    public int changePassword(long userId,String hash){return jdbc.sql("UPDATE users SET password_hash=:hash,password_changed_at=NOW() WHERE id=:id").param("hash",hash).param("id",userId).update();}
    public int revokeSession(long userId,long sessionId){return jdbc.sql("UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=:id AND user_id=:userId AND revoked_at IS NULL").param("id",sessionId).param("userId",userId).update();}
    public boolean emailExists(long userId,String email){return jdbc.sql("SELECT COUNT(*) FROM users WHERE LOWER(email)=LOWER(:email) AND id<>:id").param("email",email).param("id",userId).query(Long.class).single()>0;}

    private TaskRow task(ResultSet rs,int n)throws SQLException{LocalDateTime sla=ldt(rs,"sla_due_at");String status=rs.getString("status");Option property=new Option(rs.getLong("property_id"),null,rs.getString("property_name"),null);Option room=rs.getObject("room_id")==null?null:new Option(rs.getLong("room_id"),rs.getString("room_code"),rs.getString("room_code"),join(rs.getString("building_name"),rs.getString("floor_name")));Option asset=rs.getObject("asset_id")==null?null:new Option(rs.getLong("asset_id"),rs.getString("asset_code"),rs.getString("asset_name"),null);return new TaskRow(rs.getLong("id"),"CV-"+rs.getString("code"),rs.getString("code"),rs.getString("title"),rs.getString("issue_type"),rs.getString("priority"),rs.getString("maintenance_type"),rs.getString("assignment_role"),property,room,asset,ldt(rs,"scheduled_start"),rs.getInt("estimated_duration_minutes"),sla,sla!=null&&sla.isBefore(LocalDateTime.now())&&!List.of("RESOLVED","CANCELLED","DECLINED").contains(status),rs.getBoolean("tenant_presence_required"),status,rs.getInt("progress_percent"),rs.getLong("version"),permissions(status));}
    public static Permissions permissions(String s){boolean active=!List.of("RESOLVED","CANCELLED","DECLINED","INSPECTION_PENDING","COMPLETED").contains(s);return new Permissions(List.of("ASSIGNED","NEW_ASSIGNMENT").contains(s),List.of("ASSIGNED","NEW_ASSIGNMENT").contains(s),List.of("ACCEPTED","SCHEDULED").contains(s),List.of("TRAVELING","ACCEPTED","SCHEDULED").contains(s),List.of("ARRIVED","ACCEPTED","SCHEDULED").contains(s),"IN_PROGRESS".equals(s),List.of("PAUSED","WAITING_TENANT","WAITING_PARTS","WAITING_APPROVAL").contains(s),"IN_PROGRESS".equals(s),active,active,active,active,"IN_PROGRESS".equals(s),active);}
    private Asset asset(ResultSet rs,int n)throws SQLException{return new Asset(rs.getLong("id"),rs.getString("asset_code"),rs.getString("name"),rs.getString("brand"),rs.getString("model"),rs.getString("serial_number"),rs.getString("condition_status"),rs.getString("property_name"),rs.getString("room_code"),rs.getObject("installed_at",LocalDate.class),rs.getObject("warranty_expiry",LocalDate.class),rs.getObject("last_maintained_at",LocalDate.class),rs.getLong("maintenance_count"));}
    private Material material(ResultSet rs,int n)throws SQLException{return new Material(rs.getLong("id"),(Long)rs.getObject("material_id"),rs.getString("code"),rs.getString("material_name"),decimal(rs,"quantity"),rs.getString("unit"),decimal(rs,"unit_price"),decimal(rs,"amount"),rs.getString("status"),decimal(rs,"used_quantity"),decimal(rs,"returned_quantity"),ldt(rs,"created_at"));}
    private static String blank(String x){return x==null||x.isBlank()?null:x.trim();}
    private static boolean flag(Object x){return x instanceof Boolean b?b:x instanceof Number n&&n.intValue()!=0;}
    private static String join(String a,String b){return Stream.of(a,b).filter(Objects::nonNull).reduce((x,y)->x+" · "+y).orElse(null);}
    private static BigDecimal decimal(ResultSet rs,String c)throws SQLException{BigDecimal x=rs.getBigDecimal(c);return x==null?BigDecimal.ZERO:x;}
    private static LocalDateTime ldt(ResultSet rs,String c)throws SQLException{return rs.getObject(c,LocalDateTime.class);}
    private static Map<String,Object> map(ResultSet rs,int n)throws SQLException{Map<String,Object> m=new LinkedHashMap<>();var md=rs.getMetaData();for(int i=1;i<=md.getColumnCount();i++)m.put(md.getColumnLabel(i),rs.getObject(i));return m;}
}
