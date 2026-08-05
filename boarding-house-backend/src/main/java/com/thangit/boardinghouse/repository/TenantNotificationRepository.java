package com.thangit.boardinghouse.repository;

import static com.thangit.boardinghouse.dto.response.notification.TenantNotificationResponses.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class TenantNotificationRepository {
    private static final String SELECT="""
        SELECT n.id,COALESCE(n.code,CONCAT('NTF-',YEAR(n.created_at),'-',LPAD(n.id,6,'0'))) code,
               n.category,n.severity,n.title,n.content,COALESCE(n.summary,LEFT(n.content,500)) summary,
               n.created_at,n.read_at,n.archived_at,n.requires_action,n.requires_acknowledgement,
               n.acknowledged_at,n.expires_at,n.reference_type,n.reference_id,n.action_type,n.action_label,
               n.version,p.name property_name,r.code room_code
        FROM notifications n LEFT JOIN properties p ON p.id=n.property_id LEFT JOIN rooms r ON r.id=n.room_id
        """;
    private final JdbcClient jdbc;
    public TenantNotificationRepository(JdbcClient jdbc){this.jdbc=jdbc;}

    public Summary summary(long userId){return jdbc.sql("""
        SELECT SUM(read_at IS NULL AND archived_at IS NULL) unread_count,
               SUM(requires_action=TRUE AND archived_at IS NULL) action_count,
               SUM(category IN ('INVOICE','PAYMENT','DEBT_REMINDER') AND archived_at IS NULL) invoice_count,
               SUM(category='MAINTENANCE' AND archived_at IS NULL) maintenance_count,
               SUM(created_at>=DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')) month_count
        FROM notifications WHERE user_id=:uid
        """).param("uid",userId).query((rs,n)->new Summary(rs.getLong("unread_count"),rs.getLong("action_count"),rs.getLong("invoice_count"),rs.getLong("maintenance_count"),rs.getLong("month_count"))).single();}
    public long unread(long userId){return jdbc.sql("SELECT COUNT(*) FROM notifications WHERE user_id=:uid AND read_at IS NULL AND archived_at IS NULL").param("uid",userId).query(Long.class).single();}

    public long count(long userId,String where,Map<String,Object> params){var s=jdbc.sql("SELECT COUNT(*) FROM notifications n WHERE n.user_id=:uid"+where).param("uid",userId);for(var e:params.entrySet())s=s.param(e.getKey(),e.getValue());return s.query(Long.class).single();}
    public List<NotificationRow> list(long userId,String where,Map<String,Object> params,String order,int size,int offset){var s=jdbc.sql(SELECT+" WHERE n.user_id=:uid"+where+" ORDER BY "+order+" LIMIT :size OFFSET :offset").param("uid",userId).param("size",size).param("offset",offset);for(var e:params.entrySet())s=s.param(e.getKey(),e.getValue());return s.query((rs,n)->row(rs)).list();}
    public List<NotificationRow> recent(long userId,int limit){return jdbc.sql(SELECT+" WHERE n.user_id=:uid AND n.archived_at IS NULL ORDER BY n.created_at DESC LIMIT :limit").param("uid",userId).param("limit",limit).query((rs,n)->row(rs)).list();}
    public Optional<NotificationDetail> detail(long userId,long id){return jdbc.sql(SELECT+" WHERE n.user_id=:uid AND n.id=:id").param("uid",userId).param("id",id).query((rs,n)->{String action=rs.getString("action_type");Reference reference=reference(rs.getString("reference_type"),rs.getObject("reference_id",Long.class));var permissions=permissions(rs.getObject("read_at",LocalDateTime.class)!=null,rs.getObject("archived_at",LocalDateTime.class)!=null,rs.getBoolean("requires_acknowledgement"),rs.getObject("acknowledged_at",LocalDateTime.class)!=null,reference);return new NotificationDetail(rs.getLong("id"),rs.getString("code"),rs.getString("category"),rs.getString("severity"),rs.getString("title"),rs.getString("content"),rs.getObject("created_at",LocalDateTime.class),rs.getObject("read_at",LocalDateTime.class)!=null,rs.getObject("read_at",LocalDateTime.class),rs.getObject("archived_at",LocalDateTime.class)!=null,rs.getBoolean("requires_action"),rs.getBoolean("requires_acknowledgement"),rs.getObject("acknowledged_at",LocalDateTime.class),rs.getObject("expires_at",LocalDateTime.class),place(rs.getString("property_name"),rs.getString("room_code")),reference,action==null?List.of():List.of(new Action(action,rs.getString("action_label")==null?"Xem chi tiết":rs.getString("action_label"),true)),permissions,rs.getLong("version"));}).optional();}
    public boolean exists(long id){return jdbc.sql("SELECT COUNT(*) FROM notifications WHERE id=:id").param("id",id).query(Long.class).single()>0;}

    public int markRead(long userId,long id){return jdbc.sql("UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP(6)),version=version+1 WHERE id=:id AND user_id=:uid AND read_at IS NULL").param("id",id).param("uid",userId).update();}
    public int markUnread(long userId,long id){return jdbc.sql("UPDATE notifications SET read_at=NULL,version=version+1 WHERE id=:id AND user_id=:uid AND read_at IS NOT NULL").param("id",id).param("uid",userId).update();}
    public int markAllRead(long userId){return jdbc.sql("UPDATE notifications SET read_at=CURRENT_TIMESTAMP(6),version=version+1 WHERE user_id=:uid AND read_at IS NULL AND archived_at IS NULL").param("uid",userId).update();}
    public int archive(long userId,long id){return jdbc.sql("UPDATE notifications SET archived_at=CURRENT_TIMESTAMP(6),version=version+1 WHERE id=:id AND user_id=:uid AND archived_at IS NULL").param("id",id).param("uid",userId).update();}
    public int restore(long userId,long id){return jdbc.sql("UPDATE notifications SET archived_at=NULL,version=version+1 WHERE id=:id AND user_id=:uid AND archived_at IS NOT NULL").param("id",id).param("uid",userId).update();}
    public int acknowledge(long userId,long id){return jdbc.sql("UPDATE notifications SET acknowledged_at=COALESCE(acknowledged_at,CURRENT_TIMESTAMP(6)),read_at=COALESCE(read_at,CURRENT_TIMESTAMP(6)),version=version+1 WHERE id=:id AND user_id=:uid AND requires_acknowledgement=TRUE AND acknowledged_at IS NULL").param("id",id).param("uid",userId).update();}
    public long ownedCount(long userId,List<Long> ids){return jdbc.sql("SELECT COUNT(*) FROM notifications WHERE user_id=:uid AND id IN (:ids)").param("uid",userId).param("ids",ids).query(Long.class).single();}
    public int bulk(long userId,List<Long> ids,String action){String set=switch(action){case "MARK_READ"->"read_at=CURRENT_TIMESTAMP(6)";case "MARK_UNREAD"->"read_at=NULL";case "ARCHIVE"->"archived_at=CURRENT_TIMESTAMP(6)";case "RESTORE"->"archived_at=NULL";default->throw new IllegalArgumentException();};return jdbc.sql("UPDATE notifications SET "+set+",version=version+1 WHERE user_id=:uid AND id IN (:ids)").param("uid",userId).param("ids",ids).update();}

    public Optional<PreferenceRow> preference(long userId){return jdbc.sql("SELECT * FROM notification_preferences WHERE user_id=:uid").param("uid",userId).query((rs,n)->new PreferenceRow(rs.getBoolean("in_app_enabled"),rs.getBoolean("email_enabled"),rs.getString("category_preferences"),rs.getString("digest_mode"),rs.getBoolean("quiet_hours_enabled"),rs.getObject("quiet_hours_start",LocalTime.class),rs.getObject("quiet_hours_end",LocalTime.class),rs.getLong("version"))).optional();}
    public int savePreference(long userId,boolean inApp,boolean email,String categories,String digest,boolean quiet,LocalTime start,LocalTime end,long version){return jdbc.sql("""
        INSERT INTO notification_preferences(user_id,in_app_enabled,email_enabled,category_preferences,digest_mode,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,version)
        VALUES(:uid,:inApp,:email,:categories,:digest,:quiet,:start,:end,0)
        ON DUPLICATE KEY UPDATE in_app_enabled=:inApp,email_enabled=:email,category_preferences=:categories,
          digest_mode=:digest,quiet_hours_enabled=:quiet,quiet_hours_start=:start,quiet_hours_end=:end,version=version+1
        """).param("uid",userId).param("inApp",inApp).param("email",email).param("categories",categories).param("digest",digest).param("quiet",quiet).param("start",start).param("end",end).update();}

    private static NotificationRow row(java.sql.ResultSet rs)throws java.sql.SQLException{boolean read=rs.getObject("read_at",LocalDateTime.class)!=null,archived=rs.getObject("archived_at",LocalDateTime.class)!=null;Reference reference=reference(rs.getString("reference_type"),rs.getObject("reference_id",Long.class));String action=rs.getString("action_type");return new NotificationRow(rs.getLong("id"),rs.getString("code"),rs.getString("category"),rs.getString("severity"),rs.getString("title"),rs.getString("summary"),rs.getObject("created_at",LocalDateTime.class),read,rs.getObject("read_at",LocalDateTime.class),archived,rs.getBoolean("requires_action"),rs.getBoolean("requires_acknowledgement"),place(rs.getString("property_name"),rs.getString("room_code")),reference,action==null?null:new Action(action,rs.getString("action_label")==null?"Xem chi tiết":rs.getString("action_label"),true),permissions(read,archived,rs.getBoolean("requires_acknowledgement"),rs.getObject("acknowledged_at",LocalDateTime.class)!=null,reference));}
    private static Place place(String property,String room){return property==null&&room==null?null:new Place(property,room);}
    private static Reference reference(String type,Long id){return type==null||id==null?null:new Reference(type,id);}
    public static Permissions permissions(boolean read,boolean archived,boolean requiresAck,boolean acknowledged,Reference reference){return new Permissions(!read,read,!archived,archived,requiresAck&&!acknowledged,reference!=null);}
    public record PreferenceRow(boolean inApp,boolean email,String categoriesJson,String digestMode,boolean quietHours,LocalTime start,LocalTime end,long version){}
}
