package com.thangit.boardinghouse.repository;

import static com.thangit.boardinghouse.dto.response.account.TenantAccountResponses.*;
import com.thangit.boardinghouse.dto.request.account.TenantAccountRequests.UpdateProfile;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class TenantAccountRepository {
    private final JdbcClient jdbc;
    public TenantAccountRepository(JdbcClient jdbc){this.jdbc=jdbc;}

    public Optional<Map<String,Object>> account(long userId){return jdbc.sql("""
        SELECT u.id,u.email account_email,u.phone account_phone,u.full_name account_name,u.avatar_url user_avatar,
          u.status account_status,u.created_at account_created_at,u.last_login_at,u.password_changed_at,
          tp.id profile_id,tp.tenant_code,tp.full_name,tp.avatar_url,tp.date_of_birth,tp.gender,tp.nationality,
          tp.phone,tp.phone_verified,tp.email,tp.email_verified,tp.permanent_address,tp.occupation,tp.workplace,
          tp.emergency_contact_name,tp.emergency_contact_relationship,tp.emergency_contact_phone,
          tp.emergency_contact_address,tp.profile_status,tp.version,
          tr.property_id,p.name property_name,p.address property_address,tr.room_id,r.code room_code,
          r.building_name,r.floor_name,tr.residence_role,tr.status residence_status,tr.move_in_date,
          c.id contract_id,c.code contract_code,c.start_date,c.end_date,c.status contract_status,
          COALESCE(tpr.status,'NOT_DECLARED') temporary_status
        FROM users u JOIN tenant_profiles tp ON tp.user_id=u.id
        LEFT JOIN tenant_residences tr ON tr.id=(SELECT x.id FROM tenant_residences x WHERE x.tenant_profile_id=tp.id ORDER BY (x.status='ACTIVE') DESC,x.id DESC LIMIT 1)
        LEFT JOIN properties p ON p.id=tr.property_id LEFT JOIN rooms r ON r.id=tr.room_id
        LEFT JOIN contracts c ON c.id=tr.contract_id
        LEFT JOIN temporary_residence_records tpr ON tpr.tenant_profile_id=tp.id AND tpr.property_id=tr.property_id
        WHERE u.id=:userId
        """).param("userId",userId).query(TenantAccountRepository::map).optional();}

    public long activeSessions(long userId){return jdbc.sql("SELECT COUNT(*) FROM refresh_tokens WHERE user_id=:id AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP(6)").param("id",userId).query(Long.class).single();}
    public long pendingDocuments(long userId){return count("SELECT COUNT(*) FROM tenant_documents d JOIN tenant_profiles tp ON tp.id=d.tenant_profile_id WHERE tp.user_id=:id AND d.verification_status IN ('PENDING','NEED_REPLACEMENT','REJECTED','EXPIRED')",userId);}
    public long pendingUpdates(long userId){return count("SELECT COUNT(*) FROM tenant_profile_update_requests x JOIN tenant_profiles tp ON tp.id=x.tenant_profile_id WHERE tp.user_id=:id AND x.status='PENDING'",userId);}
    public long pendingResidence(long userId){return count("SELECT COUNT(*) FROM temporary_residence_records x JOIN tenant_profiles tp ON tp.id=x.tenant_profile_id WHERE tp.user_id=:id AND x.status IN ('NOT_DECLARED','PENDING','NEED_MORE_INFORMATION','REJECTED','EXPIRED')",userId);}
    private long count(String sql,long id){return jdbc.sql(sql).param("id",id).query(Long.class).single();}

    public int updateProfile(long userId,UpdateProfile r){return jdbc.sql("""
        UPDATE tenant_profiles SET occupation=:occupation,workplace=:workplace,phone=:phone,email=:email,
          permanent_address=:address,emergency_contact_name=:emergencyName,
          emergency_contact_relationship=:relationship,emergency_contact_phone=:emergencyPhone,
          emergency_contact_address=:emergencyAddress,version=version+1
        WHERE user_id=:userId AND version=:version
        """).param("occupation",blank(r.occupation())).param("workplace",blank(r.workplace()))
        .param("phone",normalizePhone(r.phone())).param("email",lower(r.contactEmail()))
        .param("address",blank(r.addressDetail())).param("emergencyName",r.emergencyContact()==null?null:blank(r.emergencyContact().fullName()))
        .param("relationship",r.emergencyContact()==null?null:blank(r.emergencyContact().relationship()))
        .param("emergencyPhone",r.emergencyContact()==null?null:normalizePhone(r.emergencyContact().phone()))
        .param("emergencyAddress",r.emergencyContact()==null?null:blank(r.emergencyContact().address()))
        .param("userId",userId).param("version",r.version()).update();}
    public boolean phoneExists(String phone,long userId){return phone!=null&&jdbc.sql("SELECT COUNT(*) FROM tenant_profiles WHERE phone=:phone AND user_id<>:id").param("phone",normalizePhone(phone)).param("id",userId).query(Long.class).single()>0;}
    public boolean emailExists(String email,long userId){return email!=null&&jdbc.sql("SELECT COUNT(*) FROM tenant_profiles WHERE LOWER(email)=LOWER(:email) AND user_id<>:id").param("email",email).param("id",userId).query(Long.class).single()>0;}

    public long addUpdateRequest(long userId,String changesJson,String reason,String note){GeneratedKeyHolder keys=new GeneratedKeyHolder();jdbc.sql("""
        INSERT INTO tenant_profile_update_requests(tenant_profile_id,field_changes_json,reason,note)
        SELECT id,:changes,:reason,:note FROM tenant_profiles WHERE user_id=:userId
        """).param("changes",changesJson).param("reason",reason.trim()).param("note",blank(note)).param("userId",userId).update(keys,"id");return keys.getKey().longValue();}
    public List<UpdateRequestRow> updateRequests(long userId){return jdbc.sql("""
        SELECT x.id,x.status,x.reason,x.note,x.public_response,x.created_at,x.reviewed_at
        FROM tenant_profile_update_requests x JOIN tenant_profiles tp ON tp.id=x.tenant_profile_id
        WHERE tp.user_id=:id ORDER BY x.created_at DESC LIMIT 50
        """).param("id",userId).query((rs,n)->new UpdateRequestRow(rs.getLong("id"),rs.getString("status"),rs.getString("reason"),rs.getString("note"),rs.getString("public_response"),ldt(rs,"created_at"),ldt(rs,"reviewed_at"))).list();}

    public List<DocumentRow> documents(long userId){return jdbc.sql("""
        SELECT d.id,d.document_type,d.document_number_last_four,d.original_name,d.content_type,d.file_size,
          d.issue_date,d.expires_at,d.verification_status,d.public_note,d.document_side,d.uploaded_at,d.version
        FROM tenant_documents d JOIN tenant_profiles tp ON tp.id=d.tenant_profile_id
        WHERE tp.user_id=:id ORDER BY d.uploaded_at DESC
        """).param("id",userId).query((rs,n)->document(rs)).list();}
    public long addDocument(long userId,String type,String lastFour,LocalDate issueDate,LocalDate expiresAt,String side,
                            String note,String name,String contentType,byte[] content){GeneratedKeyHolder keys=new GeneratedKeyHolder();jdbc.sql("""
        INSERT INTO tenant_documents(tenant_profile_id,document_type,document_number_last_four,original_name,
          content_type,file_size,file_content,issue_date,expires_at,verification_status,public_note,document_side,uploaded_by)
        SELECT id,:type,:lastFour,:name,:contentType,:size,:content,:issueDate,:expiresAt,'PENDING',:note,:side,:userId
        FROM tenant_profiles WHERE user_id=:userId
        """).param("type",type).param("lastFour",lastFour).param("name",name).param("contentType",contentType)
        .param("size",content.length).param("content",content).param("issueDate",issueDate).param("expiresAt",expiresAt)
        .param("note",blank(note)).param("side",side).param("userId",userId).update(keys,"id");return keys.getKey().longValue();}
    public Optional<FileData> document(long userId,long documentId){return jdbc.sql("""
        SELECT d.original_name,d.content_type,d.file_content FROM tenant_documents d
        JOIN tenant_profiles tp ON tp.id=d.tenant_profile_id WHERE tp.user_id=:userId AND d.id=:documentId
        """).param("userId",userId).param("documentId",documentId).query((rs,n)->new FileData(rs.getString(1),rs.getString(2),rs.getBytes(3))).optional();}

    public void saveAvatar(long userId,String name,String type,byte[] content){jdbc.sql("""
        INSERT INTO tenant_avatar_files(tenant_profile_id,original_name,content_type,file_size,file_content)
        SELECT id,:name,:type,:size,:content FROM tenant_profiles WHERE user_id=:userId
        ON DUPLICATE KEY UPDATE original_name=VALUES(original_name),content_type=VALUES(content_type),file_size=VALUES(file_size),file_content=VALUES(file_content)
        """).param("name",name).param("type",type).param("size",content.length).param("content",content).param("userId",userId).update();
        jdbc.sql("UPDATE tenant_profiles SET avatar_url='/api/tenant/account/avatar/content' WHERE user_id=:id").param("id",userId).update();
        jdbc.sql("UPDATE users SET avatar_url='/api/tenant/account/avatar/content' WHERE id=:id").param("id",userId).update();}
    public int deleteAvatar(long userId){int n=jdbc.sql("DELETE a FROM tenant_avatar_files a JOIN tenant_profiles tp ON tp.id=a.tenant_profile_id WHERE tp.user_id=:id").param("id",userId).update();jdbc.sql("UPDATE tenant_profiles SET avatar_url=NULL WHERE user_id=:id").param("id",userId).update();jdbc.sql("UPDATE users SET avatar_url=NULL WHERE id=:id").param("id",userId).update();return n;}
    public Optional<FileData> avatar(long userId){return jdbc.sql("SELECT a.original_name,a.content_type,a.file_content FROM tenant_avatar_files a JOIN tenant_profiles tp ON tp.id=a.tenant_profile_id WHERE tp.user_id=:id").param("id",userId).query((rs,n)->new FileData(rs.getString(1),rs.getString(2),rs.getBytes(3))).optional();}

    public List<SessionInternal> sessions(long userId){return jdbc.sql("""
        SELECT id,token_hash,user_agent,ip_address,created_at,COALESCE(last_used_at,created_at) last_active_at,
          (revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP(6)) active
        FROM refresh_tokens WHERE user_id=:id ORDER BY created_at DESC LIMIT 50
        """).param("id",userId).query((rs,n)->new SessionInternal(rs.getLong("id"),rs.getString("token_hash"),rs.getString("user_agent"),rs.getString("ip_address"),ldt(rs,"created_at"),ldt(rs,"last_active_at"),rs.getBoolean("active"))).list();}
    public int revokeSession(long userId,long sessionId){return jdbc.sql("UPDATE refresh_tokens SET revoked_at=CURRENT_TIMESTAMP(6) WHERE id=:sessionId AND user_id=:userId AND revoked_at IS NULL").param("sessionId",sessionId).param("userId",userId).update();}
    public int revokeAll(long userId,String keepHash){String suffix=keepHash==null?"":" AND token_hash<>:hash";var spec=jdbc.sql("UPDATE refresh_tokens SET revoked_at=CURRENT_TIMESTAMP(6) WHERE user_id=:id AND revoked_at IS NULL"+suffix).param("id",userId);if(keepHash!=null)spec.param("hash",keepHash);return spec.update();}

    public Optional<PreferenceData> preferences(long userId){return jdbc.sql("SELECT language,theme,timezone,date_format,time_format,reduced_motion,version FROM tenant_account_preferences WHERE user_id=:id").param("id",userId).query((rs,n)->new PreferenceData(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4),rs.getString(5),rs.getBoolean(6),rs.getLong(7))).optional();}
    public int savePreferences(long userId,String language,String theme,String timezone,String dateFormat,String timeFormat,boolean reduced,long version){if(preferences(userId).isEmpty()){return jdbc.sql("INSERT INTO tenant_account_preferences(user_id,language,theme,timezone,date_format,time_format,reduced_motion) VALUES(:id,:language,:theme,:timezone,:dateFormat,:timeFormat,:reduced)").param("id",userId).param("language",language).param("theme",theme).param("timezone",timezone).param("dateFormat",dateFormat).param("timeFormat",timeFormat).param("reduced",reduced).update();}return jdbc.sql("UPDATE tenant_account_preferences SET language=:language,theme=:theme,timezone=:timezone,date_format=:dateFormat,time_format=:timeFormat,reduced_motion=:reduced,version=version+1 WHERE user_id=:id AND version=:version").param("id",userId).param("language",language).param("theme",theme).param("timezone",timezone).param("dateFormat",dateFormat).param("timeFormat",timeFormat).param("reduced",reduced).param("version",version).update();}

    public Page<ActivityRow> activities(long userId,int page,int size){long total=count("SELECT COUNT(*) FROM tenant_activity_logs x JOIN tenant_profiles tp ON tp.id=x.tenant_profile_id WHERE tp.user_id=:id",userId);var rows=jdbc.sql("""
        SELECT x.id,x.action,x.description,x.created_at FROM tenant_activity_logs x
        JOIN tenant_profiles tp ON tp.id=x.tenant_profile_id WHERE tp.user_id=:id
        ORDER BY x.created_at DESC LIMIT :limit OFFSET :offset
        """).param("id",userId).param("limit",size).param("offset",page*size).query((rs,n)->new ActivityRow(rs.getLong(1),rs.getString(2),rs.getString(3),ldt(rs,"created_at"),null)).list();return new Page<>(rows,page,size,total,(int)Math.ceil(total/(double)size));}
    public void audit(long userId,String action,String description){jdbc.sql("INSERT INTO tenant_activity_logs(tenant_profile_id,actor_id,action,description) SELECT id,:userId,:action,:description FROM tenant_profiles WHERE user_id=:userId").param("userId",userId).param("action",action).param("description",description).update();}
    public Optional<SupportInfo> supportInfo(long userId){return jdbc.sql("""
        SELECT owner.phone,owner.email FROM tenant_profiles tp
        JOIN tenant_residences tr ON tr.id=(SELECT x.id FROM tenant_residences x WHERE x.tenant_profile_id=tp.id ORDER BY (x.status='ACTIVE') DESC,x.id DESC LIMIT 1)
        JOIN properties p ON p.id=tr.property_id JOIN users owner ON owner.id=p.owner_id
        WHERE tp.user_id=:id
        """).param("id",userId).query((rs,n)->new SupportInfo(rs.getString("phone"),rs.getString("email"),"Theo giờ làm việc của quản lý khu trọ",true)).optional();}
    public long support(long userId,String subject,String content,String priority,String contact,String name,String type,byte[] bytes){GeneratedKeyHolder keys=new GeneratedKeyHolder();jdbc.sql("INSERT INTO tenant_account_support_requests(user_id,subject,content,priority,preferred_contact,attachment_name,attachment_type,attachment_size,attachment_content) VALUES(:id,:subject,:content,:priority,:contact,:name,:type,:size,:bytes)").param("id",userId).param("subject",subject).param("content",content).param("priority",priority).param("contact",contact).param("name",name).param("type",type).param("size",bytes==null?null:bytes.length).param("bytes",bytes).update(keys,"id");long id=keys.getKey().longValue();jdbc.sql("UPDATE tenant_account_support_requests SET code=:code WHERE id=:id").param("code","HT%06d".formatted(id)).param("id",id).update();return id;}

    public record SessionInternal(long id,String tokenHash,String userAgent,String ipAddress,LocalDateTime createdAt,LocalDateTime lastActiveAt,boolean active){}
    private static DocumentRow document(ResultSet rs)throws SQLException{String last=rs.getString("document_number_last_four");return new DocumentRow(rs.getLong("id"),rs.getString("document_type"),last==null?null:"********"+last,rs.getString("original_name"),rs.getString("content_type"),rs.getLong("file_size"),rs.getObject("issue_date",LocalDate.class),rs.getObject("expires_at",LocalDate.class),rs.getString("verification_status"),rs.getString("public_note"),rs.getString("document_side"),ldt(rs,"uploaded_at"),rs.getLong("version"));}
    private static Map<String,Object> map(ResultSet rs,int row)throws SQLException{var m=new LinkedHashMap<String,Object>();var meta=rs.getMetaData();for(int i=1;i<=meta.getColumnCount();i++)m.put(meta.getColumnLabel(i),rs.getObject(i));return m;}
    private static LocalDateTime ldt(ResultSet rs,String key)throws SQLException{return rs.getObject(key,LocalDateTime.class);}
    private static String blank(String s){return s==null||s.isBlank()?null:s.trim();}
    private static String lower(String s){s=blank(s);return s==null?null:s.toLowerCase(Locale.ROOT);}
    private static String normalizePhone(String s){s=blank(s);return s==null?null:s.replaceAll("[ .()-]","");}
}
