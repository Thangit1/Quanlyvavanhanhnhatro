package com.thangit.boardinghouse.repository;

import static com.thangit.boardinghouse.dto.response.maintenance.TenantMaintenanceResponses.*;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class TenantMaintenanceRepository {
    private final JdbcClient jdbc;
    public TenantMaintenanceRepository(JdbcClient jdbc){this.jdbc=jdbc;}

    public Summary summary(long tenant){return jdbc.sql("""
        SELECT SUM(status NOT IN ('RESOLVED','REJECTED','CANCELLED')) open_count,
          SUM(status IN ('ASSIGNED','SCHEDULED','IN_PROGRESS','WAITING_PARTS','REOPENED')) progress_count,
          SUM(status IN ('NEED_MORE_INFORMATION','WAITING_TENANT')) response_count,
          SUM(status IN ('COMPLETED','INSPECTION_PENDING')) inspection_count,
          SUM(status='RESOLVED' AND resolved_at>=DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')) resolved_month
        FROM maintenance_requests WHERE COALESCE(reporter_id,tenant_id)=:tenant
        """).param("tenant",tenant).query((r,n)->new Summary(r.getLong("open_count"),r.getLong("progress_count"),
            r.getLong("response_count"),r.getLong("inspection_count"),r.getLong("resolved_month"))).single();}

    public Page<RequestRow> list(long tenant,String statuses,String keyword,String category,String priority,Long roomId,
                                 LocalDate start,LocalDate end,int page,int size,String order){
        String filters="";
        if(statuses!=null)filters+=" AND FIND_IN_SET(m.status,:statuses)>0";
        if(keyword!=null)filters+=" AND (LOWER(m.code) LIKE :search OR LOWER(m.title) LIKE :search OR LOWER(m.description) LIKE :search OR LOWER(m.issue_type) LIKE :search)";
        if(category!=null)filters+=" AND m.issue_type=:category";if(priority!=null)filters+=" AND COALESCE(m.reported_priority,m.priority)=:priority";
        if(roomId!=null)filters+=" AND m.room_id=:room";if(start!=null)filters+=" AND DATE(m.created_at)>=:start";if(end!=null)filters+=" AND DATE(m.created_at)<=:end";
        String from="""
          FROM maintenance_requests m JOIN properties p ON p.id=m.property_id LEFT JOIN rooms r ON r.id=m.room_id
          LEFT JOIN users tech ON tech.id=m.assigned_to
          LEFT JOIN maintenance_schedules sch ON sch.id=(SELECT MAX(s2.id) FROM maintenance_schedules s2 WHERE s2.maintenance_request_id=m.id AND s2.status='ACTIVE')
          WHERE COALESCE(m.reporter_id,m.tenant_id)=:tenant
          """+filters;
        long total=bind(jdbc.sql("SELECT COUNT(*) "+from),tenant,statuses,keyword,category,priority,roomId,start,end).query(Long.class).single();
        List<RequestRow> rows=bind(jdbc.sql("""
          SELECT m.id,m.code,m.title,m.issue_type,COALESCE(m.reported_priority,m.priority) reported_priority,p.name property_name,
            r.code room_code,m.area_code,m.status,m.created_at,m.updated_at,sch.scheduled_start,tech.full_name technician_name,m.version,
            (SELECT ma.id FROM maintenance_attachments ma WHERE ma.maintenance_request_id=m.id AND ma.visibility='TENANT_VISIBLE' AND ma.mime_type LIKE 'image/%' ORDER BY ma.id LIMIT 1) thumbnail_id
          """+from+" ORDER BY "+order+" LIMIT :size OFFSET :offset"),tenant,statuses,keyword,category,priority,roomId,start,end)
          .param("size",size).param("offset",page*size).query((r,n)->new RequestRow(r.getLong("id"),r.getString("code"),r.getString("title"),r.getString("issue_type"),
            r.getString("reported_priority"),r.getString("property_name"),r.getString("room_code"),r.getString("area_code"),r.getString("status"),dt(r,"created_at"),dt(r,"updated_at"),dt(r,"scheduled_start"),r.getString("technician_name"),nullableLong(r,"thumbnail_id"),permissions(r.getString("status"),hasSchedule(r)),r.getLong("version"))).list();
        return new Page<>(rows,page,size,total,(int)Math.ceil(total/(double)size));}

    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec q,long tenant,String statuses,String keyword,String category,String priority,Long room,LocalDate start,LocalDate end){q=q.param("tenant",tenant);if(statuses!=null)q=q.param("statuses",statuses);if(keyword!=null)q=q.param("search","%"+keyword.toLowerCase()+"%");if(category!=null)q=q.param("category",category);if(priority!=null)q=q.param("priority",priority);if(room!=null)q=q.param("room",room);if(start!=null)q=q.param("start",start);if(end!=null)q=q.param("end",end);return q;}

    public List<AvailableLocation> locations(long tenant){return jdbc.sql("""
        SELECT c.id contract_id,c.code contract_code,p.id property_id,p.name property_name,p.address,
          r.id room_id,r.code room_code,r.building_name,r.floor_name,ps.manager_phone
        FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
          LEFT JOIN property_settings ps ON ps.property_id=p.id
        WHERE c.tenant_id=:tenant AND c.status IN ('ACTIVE','EXPIRING') AND c.start_date<=CURRENT_DATE AND c.end_date>=CURRENT_DATE
        ORDER BY p.name,r.code
        """).param("tenant",tenant).query((r,n)->{long room=r.getLong("room_id");Location l=new Location(r.getLong("property_id"),r.getString("property_name"),r.getString("address"),r.getString("building_name"),r.getString("floor_name"),room,r.getString("room_code"),"ROOM","Phòng đang ở",r.getLong("contract_id"),r.getString("contract_code"));return new AvailableLocation(l,assets(room),r.getString("manager_phone"));}).list();}
    public List<Asset> assets(long room){return jdbc.sql("SELECT id,name,condition_status FROM room_assets WHERE room_id=:room ORDER BY name")
        .param("room",room).query((r,n)->new Asset(r.getLong("id"),r.getString("name"),r.getString("condition_status"))).list();}
    public Optional<AvailableLocation> activeLocation(long tenant,long room){return locations(tenant).stream().filter(x->x.location().roomId()==room).findFirst();}
    public boolean assetInRoom(long room,long asset){return jdbc.sql("SELECT COUNT(*) FROM room_assets WHERE id=:asset AND room_id=:room").param("asset",asset).param("room",room).query(Long.class).single()>0;}

    public Optional<Map<String,Object>> request(long tenant,long id,boolean lock){return jdbc.sql("""
        SELECT m.*,p.name property_name,p.address property_address,p.owner_id,r.code room_code,r.building_name,r.floor_name,
          c.id contract_id,c.code contract_code,ra.name asset_name,ra.condition_status asset_condition,
          tech.full_name technician_name
        FROM maintenance_requests m JOIN properties p ON p.id=m.property_id LEFT JOIN rooms r ON r.id=m.room_id
          LEFT JOIN contracts c ON c.id=(SELECT c2.id FROM contracts c2 WHERE c2.room_id=m.room_id AND c2.tenant_id=:tenant ORDER BY c2.end_date DESC LIMIT 1)
          LEFT JOIN room_assets ra ON ra.id=m.asset_id LEFT JOIN users tech ON tech.id=m.assigned_to
        WHERE m.id=:id AND COALESCE(m.reporter_id,m.tenant_id)=:tenant
        """+(lock?" FOR UPDATE":"")).param("tenant",tenant).param("id",id).query(Map.class).optional()
        .map(row -> (Map<String,Object>) row);}
    public Optional<Created> byIdempotency(long tenant,String key){return jdbc.sql("SELECT id,code,status FROM maintenance_requests WHERE reporter_id=:tenant AND tenant_idempotency_key=:key")
        .param("tenant",tenant).param("key",key).query((r,n)->new Created(r.getLong("id"),r.getString("code"),r.getString("status"))).optional();}
    public boolean duplicateOpen(long tenant,long room,Long asset,String category){return jdbc.sql("""
        SELECT COUNT(*) FROM maintenance_requests WHERE reporter_id=:tenant AND room_id=:room AND issue_type=:category
          AND (asset_id<=>:asset) AND status NOT IN ('RESOLVED','REJECTED','CANCELLED') AND created_at>=DATE_SUB(NOW(),INTERVAL 24 HOUR)
        """).param("tenant",tenant).param("room",room).param("asset",asset).param("category",category).query(Long.class).single()>0;}

    public Created create(long tenant,AvailableLocation available,Long asset,String area,String title,String description,String category,String priority,
        LocalDateTime detected,boolean risk,boolean continuous,Boolean usable,LocalDate date,String slot,boolean presence,String access,String phone,String note,boolean pets,String key){
        KeyHolder kh=new GeneratedKeyHolder();Location l=available.location();LocalDateTime preferred=slotStart(date,slot);
        int inserted=jdbc.sql("""
          INSERT IGNORE INTO maintenance_requests(property_id,building_id,floor_id,room_id,area_code,asset_id,tenant_id,reporter_id,reporter_type,source,
            maintenance_type,code,title,description,issue_type,priority,reported_priority,status,safety_risk,continuous_issue,asset_usable,detected_at,
            preferred_service_time,preferred_date,preferred_time_slot,tenant_presence_required,access_preference,contact_phone,access_note,pets_present,
            tenant_idempotency_key,sla_due_at,created_by)
          SELECT :property,r.building_id,r.floor_id,:room,:area,:asset,:tenant,:tenant,'TENANT','TENANT','CORRECTIVE',
            CONCAT('SC-',DATE_FORMAT(NOW(),'%Y%m%d'),'-',UPPER(SUBSTRING(REPLACE(UUID(),'-',''),1,8))),:title,:description,:category,:priority,:priority,
            'SUBMITTED',:risk,:continuous,:usable,:detected,:preferred,:date,:slot,:presence,:access,:phone,:note,:pets,:key,
            DATE_ADD(NOW(),INTERVAL CASE :priority WHEN 'URGENT' THEN 4 WHEN 'HIGH' THEN 12 WHEN 'LOW' THEN 72 ELSE 24 END HOUR),:tenant
          FROM rooms r WHERE r.id=:room
          """).param("property",l.propertyId()).param("room",l.roomId()).param("area",area).param("asset",asset).param("tenant",tenant)
          .param("title",title).param("description",description).param("category",category).param("priority",priority).param("risk",risk).param("continuous",continuous)
          .param("usable",usable).param("detected",detected).param("preferred",preferred).param("date",date).param("slot",slot).param("presence",presence)
          .param("access",access).param("phone",phone).param("note",blank(note)).param("pets",pets).param("key",key).update(kh,"id");
        if(inserted==0)return byIdempotency(tenant,key).orElseThrow();long id=kh.getKey().longValue();return jdbc.sql("SELECT id,code,status FROM maintenance_requests WHERE id=:id").param("id",id).query((r,n)->new Created(r.getLong("id"),r.getString("code"),r.getString("status"))).single();}

    public List<Attachment> attachments(long id){return jdbc.sql("""
        SELECT id,attachment_type,file_name,mime_type,file_size,caption,uploaded_by,created_at FROM maintenance_attachments
        WHERE maintenance_request_id=:id AND visibility='TENANT_VISIBLE' ORDER BY created_at
        """).param("id",id).query((r,n)->new Attachment(r.getLong("id"),r.getString("attachment_type"),r.getString("file_name"),r.getString("mime_type"),r.getLong("file_size"),r.getString("caption"),r.getLong("uploaded_by"),dt(r,"created_at"),"/api/tenant/maintenance/attachments/"+r.getLong("id"))).list();}
    public long addAttachment(long request,long user,String type,String name,String mime,byte[] content,String caption){KeyHolder kh=new GeneratedKeyHolder();jdbc.sql("""
        INSERT INTO maintenance_attachments(maintenance_request_id,attachment_type,file_url,file_content,file_name,mime_type,file_size,caption,visibility,uploaded_by)
        VALUES(:request,:type,NULL,:content,:name,:mime,:size,:caption,'TENANT_VISIBLE',:user)
        """).param("request",request).param("type",type).param("content",content).param("name",name).param("mime",mime).param("size",content.length).param("caption",blank(caption)).param("user",user).update(kh,"id");return kh.getKey().longValue();}
    public int attachmentCount(long request){return jdbc.sql("SELECT COUNT(*) FROM maintenance_attachments WHERE maintenance_request_id=:id AND visibility='TENANT_VISIBLE'").param("id",request).query(Integer.class).single();}
    public Optional<FileData> file(long tenant,long attachment){return jdbc.sql("""
        SELECT a.file_name,a.mime_type,a.file_content FROM maintenance_attachments a JOIN maintenance_requests m ON m.id=a.maintenance_request_id
        WHERE a.id=:attachment AND COALESCE(m.reporter_id,m.tenant_id)=:tenant AND a.visibility='TENANT_VISIBLE' AND a.file_content IS NOT NULL
        """).param("attachment",attachment).param("tenant",tenant).query((r,n)->new FileData(r.getString("file_name"),r.getString("mime_type"),r.getBytes("file_content"))).optional();}

    public List<MessageItem> messages(long request,long tenant){jdbc.sql("UPDATE maintenance_messages SET read_at=COALESCE(read_at,NOW()) WHERE maintenance_request_id=:request AND sender_id<>:tenant AND internal=FALSE").param("request",request).param("tenant",tenant).update();return jdbc.sql("""
        SELECT x.*,u.full_name sender_name FROM maintenance_messages x JOIN users u ON u.id=x.sender_id
        WHERE x.maintenance_request_id=:request AND x.internal=FALSE ORDER BY x.created_at
        """).param("request",request).query((r,n)->new MessageItem(r.getLong("id"),r.getLong("sender_id"),r.getString("sender_name"),r.getLong("sender_id")==tenant,r.getString("message_type"),r.getString("content"),dt(r,"created_at"),dt(r,"read_at"))).list();}
    public MessageItem addMessage(long request,long tenant,String content){KeyHolder kh=new GeneratedKeyHolder();jdbc.sql("INSERT INTO maintenance_messages(maintenance_request_id,sender_id,content) VALUES(:request,:tenant,:content)").param("request",request).param("tenant",tenant).param("content",content).update(kh,"id");return jdbc.sql("SELECT x.*,u.full_name sender_name FROM maintenance_messages x JOIN users u ON u.id=x.sender_id WHERE x.id=:id").param("id",kh.getKey().longValue()).query((r,n)->new MessageItem(r.getLong("id"),r.getLong("sender_id"),r.getString("sender_name"),true,r.getString("message_type"),r.getString("content"),dt(r,"created_at"),dt(r,"read_at"))).single();}
    public List<Timeline> timeline(long request){return jdbc.sql("""
        SELECT h.*,u.full_name actor_name FROM maintenance_history h JOIN users u ON u.id=h.performed_by
        WHERE h.maintenance_request_id=:request AND h.visibility='TENANT_VISIBLE' ORDER BY h.created_at
        """).param("request",request).query((r,n)->new Timeline(r.getLong("id"),r.getString("action"),r.getString("previous_status"),r.getString("new_status"),r.getString("description"),r.getString("actor_name"),dt(r,"created_at"))).list();}
    public void history(long request,String action,String before,String after,String description,long actor){jdbc.sql("INSERT INTO maintenance_history(maintenance_request_id,action,previous_status,new_status,description,visibility,performed_by) VALUES(:request,:action,:before,:after,:description,'TENANT_VISIBLE',:actor)").param("request",request).param("action",action).param("before",before).param("after",after).param("description",description).param("actor",actor).update();}

    public Schedule schedule(long request){return jdbc.sql("""
        SELECT s.*,sr.response tenant_response,sr.created_at response_at FROM maintenance_schedules s
        LEFT JOIN maintenance_schedule_responses sr ON sr.id=(SELECT MAX(x.id) FROM maintenance_schedule_responses x WHERE x.schedule_id=s.id)
        WHERE s.maintenance_request_id=:request AND s.status='ACTIVE' ORDER BY s.id DESC LIMIT 1
        """).param("request",request).query((r,n)->new Schedule(r.getLong("id"),dt(r,"scheduled_start"),dt(r,"scheduled_end"),r.getInt("estimated_duration_minutes"),r.getBoolean("tenant_presence_required"),r.getString("status"),r.getString("tenant_response"),dt(r,"response_at"))).optional().orElse(null);}
    public int scheduleResponse(long request,long schedule,long tenant,String response,LocalDateTime preferred,String note,long version){int changed=touch(request,version,"ASSIGNED,SCHEDULED");if(changed>0)jdbc.sql("INSERT INTO maintenance_schedule_responses(maintenance_request_id,schedule_id,tenant_id,response,preferred_start,note) VALUES(:request,:schedule,:tenant,:response,:preferred,:note)").param("request",request).param("schedule",schedule).param("tenant",tenant).param("response",response).param("preferred",preferred).param("note",blank(note)).update();return changed;}
    public int additional(long request,long tenant,String content,String phone,long version,String current){String next="NEED_MORE_INFORMATION".equals(current)?"RECEIVED":current;int changed=jdbc.sql("UPDATE maintenance_requests SET contact_phone=COALESCE(:phone,contact_phone),status=:next,version=version+1 WHERE id=:id AND version=:version AND status NOT IN ('RESOLVED','REJECTED','CANCELLED')").param("phone",blank(phone)).param("next",next).param("id",request).param("version",version).update();if(changed>0)jdbc.sql("INSERT INTO maintenance_additional_information(maintenance_request_id,tenant_id,content,contact_phone) VALUES(:request,:tenant,:content,:phone)").param("request",request).param("tenant",tenant).param("content",content).param("phone",blank(phone)).update();return changed;}
    public int cancel(long request,long version,String reason){return jdbc.sql("UPDATE maintenance_requests SET status='CANCELLED',cancelled_at=NOW(),cancellation_reason=:reason,version=version+1 WHERE id=:id AND version=:version AND status IN ('SUBMITTED','RECEIVED','NEW') AND NOT EXISTS(SELECT 1 FROM maintenance_schedules s WHERE s.maintenance_request_id=:id AND s.status='ACTIVE') AND NOT EXISTS(SELECT 1 FROM maintenance_costs c WHERE c.maintenance_request_id=:id)").param("reason",reason).param("id",request).param("version",version).update();}
    public boolean hasFeedback(long request,long tenant){return jdbc.sql("SELECT COUNT(*) FROM maintenance_feedback WHERE maintenance_request_id=:request AND tenant_id=:tenant").param("request",request).param("tenant",tenant).query(Long.class).single()>0;}
    public int feedback(long request,long tenant,String result,int rating,Integer staff,Integer time,String comment,boolean working,long version){String next="PASSED".equals(result)?"RESOLVED":"REOPENED";int changed=jdbc.sql("UPDATE maintenance_requests SET status=:next,resolved_at=CASE WHEN :next='RESOLVED' THEN NOW() ELSE NULL END,version=version+1 WHERE id=:id AND version=:version AND status IN ('COMPLETED','INSPECTION_PENDING')").param("next",next).param("id",request).param("version",version).update();if(changed>0)jdbc.sql("INSERT INTO maintenance_feedback(maintenance_request_id,tenant_id,result,rating,staff_attitude_rating,resolution_time_rating,comment,asset_working) VALUES(:request,:tenant,:result,:rating,:staff,:time,:comment,:working)").param("request",request).param("tenant",tenant).param("result",result).param("rating",rating).param("staff",staff).param("time",time).param("comment",blank(comment)).param("working",working).update();return changed;}
    public FeedbackInfo feedback(long request,long tenant){return jdbc.sql("SELECT * FROM maintenance_feedback WHERE maintenance_request_id=:request AND tenant_id=:tenant").param("request",request).param("tenant",tenant).query((r,n)->new FeedbackInfo(r.getString("result"),r.getInt("rating"),(Integer)r.getObject("staff_attitude_rating"),(Integer)r.getObject("resolution_time_rating"),r.getString("comment"),r.getBoolean("asset_working"),dt(r,"created_at"))).optional().orElse(null);}
    public int reopen(long request,long tenant,String reason,LocalDateTime recurring,String priority,LocalDateTime preferred,long version){int changed=jdbc.sql("UPDATE maintenance_requests SET status='REOPENED',reported_priority=:priority,preferred_service_time=COALESCE(:preferred,preferred_service_time),resolved_at=NULL,version=version+1 WHERE id=:id AND version=:version AND status='RESOLVED' AND resolved_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)").param("priority",priority).param("preferred",preferred).param("id",request).param("version",version).update();if(changed>0)jdbc.sql("INSERT INTO maintenance_reopen_requests(maintenance_request_id,tenant_id,reason,recurring_at,current_priority,preferred_service_time) VALUES(:request,:tenant,:reason,:recurring,:priority,:preferred)").param("request",request).param("tenant",tenant).param("reason",reason).param("recurring",recurring).param("priority",priority).param("preferred",preferred).update();return changed;}
    public TenantCost cost(long request){return jdbc.sql("SELECT tenant_share_amount,responsibility,approval_status FROM maintenance_costs WHERE maintenance_request_id=:request AND approval_status='APPROVED' AND tenant_share_amount>0 ORDER BY approved_at DESC LIMIT 1").param("request",request).query((r,n)->new TenantCost(r.getBigDecimal("tenant_share_amount"),r.getString("responsibility"),r.getString("approval_status"))).optional().orElse(null);}
    public int touch(long request,long version,String statuses){return jdbc.sql("UPDATE maintenance_requests SET version=version+1 WHERE id=:id AND version=:version AND FIND_IN_SET(status,:statuses)>0").param("id",request).param("version",version).param("statuses",statuses).update();}
    public void notifyManagers(long property,String title,String content){jdbc.sql("""
        INSERT INTO notifications(user_id,title,content,type,category)
        SELECT user_id,:title,:content,'MAINTENANCE','MAINTENANCE' FROM (
          SELECT owner_id user_id FROM properties WHERE id=:property UNION SELECT manager_id FROM property_managers WHERE property_id=:property
        ) recipients
        """).param("property",property).param("title",title).param("content",content).update();}

    public static Permissions permissions(String status,boolean hasSchedule){boolean terminal=List.of("RESOLVED","REJECTED","CANCELLED").contains(status);return new Permissions(true,List.of("SUBMITTED","RECEIVED","NEW").contains(status),!terminal,List.of("ASSIGNED","SCHEDULED").contains(status)&&hasSchedule,List.of("ASSIGNED","SCHEDULED").contains(status)&&hasSchedule,!terminal,List.of("COMPLETED","INSPECTION_PENDING").contains(status),"RESOLVED".equals(status),!terminal);}
    private static boolean hasSchedule(ResultSet r){try{return r.getObject("scheduled_start")!=null;}catch(SQLException e){return false;}}
    private static LocalDateTime slotStart(LocalDate date,String slot){return date.atTime(Integer.parseInt(slot.substring(0,2)),Integer.parseInt(slot.substring(3,5)));}
    private static String blank(String v){return v==null||v.isBlank()?null:v.trim();}private static Long nullableLong(ResultSet r,String c)throws SQLException{long v=r.getLong(c);return r.wasNull()?null:v;}private static LocalDateTime dt(ResultSet r,String c)throws SQLException{return r.getObject(c,LocalDateTime.class);}
}
