package com.thangit.boardinghouse.repository;

import static com.thangit.boardinghouse.dto.response.occupant.TenantCoOccupantResponses.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class TenantCoOccupantRepository {
    private final JdbcClient jdbc;
    public TenantCoOccupantRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Optional<ActiveContext> activeContext(long userId) {
        return jdbc.sql("""
            SELECT tr.id residence_id,tr.tenant_profile_id,tr.residence_role,tr.property_id,tr.room_id,
                   tr.contract_id,p.name property_name,p.address,r.building_name,r.floor_name,r.code room_code,
                   r.room_type,r.area,r.capacity room_capacity,r.status room_status,c.code contract_code,
                   c.end_date,c.status contract_status,COALESCE(tp.full_name,me.full_name) representative_name,
                   (SELECT COUNT(*) FROM tenant_residences x WHERE x.room_id=tr.room_id AND x.status='ACTIVE') occupant_count
            FROM tenant_profiles me JOIN tenant_residences tr ON tr.tenant_profile_id=me.id AND tr.status='ACTIVE'
            JOIN properties p ON p.id=tr.property_id JOIN rooms r ON r.id=tr.room_id
            LEFT JOIN contracts c ON c.id=tr.contract_id
            LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id
            WHERE me.user_id=:userId ORDER BY (tr.residence_role='REPRESENTATIVE') DESC,tr.id DESC LIMIT 1
            """).param("userId", userId).query((rs, n) -> new ActiveContext(
                rs.getLong("residence_id"),rs.getLong("tenant_profile_id"),rs.getString("residence_role"),
                rs.getLong("property_id"),rs.getLong("room_id"),rs.getObject("contract_id",Long.class),
                rs.getString("property_name"),rs.getString("address"),rs.getString("building_name"),
                rs.getString("floor_name"),rs.getString("room_code"),rs.getString("room_type"),
                rs.getBigDecimal("area"),rs.getInt("room_capacity"),rs.getString("room_status"),
                rs.getString("contract_code"),rs.getObject("end_date",LocalDate.class),
                rs.getString("contract_status"),rs.getString("representative_name"),rs.getInt("occupant_count"))).optional();
    }

    public Summary summary(ActiveContext c) {
        return jdbc.sql("""
            SELECT COUNT(*) active_count,SUM(tr.residence_role='REPRESENTATIVE') representative_count,
                   SUM(tr.residence_role<>'REPRESENTATIVE') occupant_count,
                   (SELECT COUNT(*) FROM co_occupant_requests q WHERE q.room_id=:roomId
                    AND q.status IN ('SUBMITTED','UNDER_REVIEW','NEED_MORE_INFORMATION')) pending_count,
                   SUM(COALESCE(tpr.status,'NOT_DECLARED') IN ('NOT_DECLARED','PENDING','NEED_MORE_INFORMATION','EXPIRED')) temp_pending
            FROM tenant_residences tr
            LEFT JOIN temporary_residence_records tpr ON tpr.tenant_profile_id=tr.tenant_profile_id AND tpr.property_id=tr.property_id
            WHERE tr.room_id=:roomId AND tr.status='ACTIVE'
            """).param("roomId",c.roomId()).query((rs,n)->new Summary(rs.getInt("active_count"),
                rs.getInt("representative_count"),rs.getInt("occupant_count"),rs.getInt("pending_count"),
                rs.getInt("temp_pending"))).single();
    }

    public List<OccupantRow> occupants(ActiveContext c,int size,int offset) {
        return jdbc.sql("""
            SELECT tp.id,tp.tenant_code,tp.full_name,tp.avatar_url,tp.phone,tp.user_id,tr.residence_role,
                   tr.relationship,tr.move_in_date,tr.status residence_status,
                   COALESCE(tpr.status,'NOT_DECLARED') temporary_status,COALESCE(u.status,'NOT_CREATED') account_status,
                   tp.date_of_birth IS NOT NULL AND tp.phone IS NOT NULL profile_completed
            FROM tenant_residences tr JOIN tenant_profiles tp ON tp.id=tr.tenant_profile_id
            LEFT JOIN users u ON u.id=tp.user_id
            LEFT JOIN temporary_residence_records tpr ON tpr.tenant_profile_id=tp.id AND tpr.property_id=tr.property_id
            WHERE tr.room_id=:roomId AND tr.status='ACTIVE'
            ORDER BY (tr.residence_role='REPRESENTATIVE') DESC,tp.full_name LIMIT :size OFFSET :offset
            """).param("roomId",c.roomId()).param("size",size).param("offset",offset)
            .query((rs,n)->{ long id=rs.getLong("id"); boolean representative="REPRESENTATIVE".equals(c.role());
                String role=rs.getString("residence_role"); return new OccupantRow(id,rs.getString("tenant_code"),
                rs.getString("full_name"),rs.getString("avatar_url"),role,rs.getObject("move_in_date",LocalDate.class),
                maskPhone(rs.getString("phone")),rs.getString("relationship"),rs.getString("residence_status"),
                rs.getString("temporary_status"),rs.getString("account_status"),rs.getBoolean("profile_completed"),
                new OccupantPermissions(representative||id==c.profileId(),representative&&!"REPRESENTATIVE".equals(role),id==c.profileId())); }).list();
    }
    public long occupantCount(long roomId){return jdbc.sql("SELECT COUNT(*) FROM tenant_residences WHERE room_id=:id AND status='ACTIVE'").param("id",roomId).query(Long.class).single();}

    public Optional<OccupantDetail> occupant(ActiveContext c,long id) {
        return jdbc.sql("""
            SELECT tp.id,tp.tenant_code,tp.full_name,tp.avatar_url,tp.date_of_birth,tp.gender,tp.phone,tp.email,
                   tp.occupation,tp.workplace,tp.user_id,tr.residence_role,tr.relationship,tr.move_in_date,
                   tr.status residence_status,COALESCE(u.status,'NOT_CREATED') account_status,
                   COALESCE(tpr.status,'NOT_DECLARED') temporary_status,tpr.registered_at,tpr.expires_at,tpr.note temporary_note
            FROM tenant_residences tr JOIN tenant_profiles tp ON tp.id=tr.tenant_profile_id
            LEFT JOIN users u ON u.id=tp.user_id
            LEFT JOIN temporary_residence_records tpr ON tpr.tenant_profile_id=tp.id AND tpr.property_id=tr.property_id
            WHERE tr.room_id=:roomId AND tr.status='ACTIVE' AND tp.id=:id
            """).param("roomId",c.roomId()).param("id",id).query((rs,n)->{
                boolean self=id==c.profileId(), representative="REPRESENTATIVE".equals(c.role());
                return new OccupantDetail(id,rs.getString("tenant_code"),rs.getString("full_name"),rs.getString("avatar_url"),
                    self?rs.getObject("date_of_birth",LocalDate.class):null,rs.getString("gender"),maskPhone(rs.getString("phone")),
                    maskEmail(rs.getString("email")),rs.getString("residence_role"),rs.getString("relationship"),
                    rs.getString("occupation"),rs.getString("workplace"),rs.getObject("move_in_date",LocalDate.class),
                    rs.getString("residence_status"),rs.getString("account_status"),new TemporaryResidence(
                    rs.getString("temporary_status"),rs.getObject("registered_at",LocalDate.class),
                    rs.getObject("registered_at",LocalDate.class),rs.getObject("expires_at",LocalDate.class),
                    rs.getString("temporary_note")),residenceHistory(id),new OccupantPermissions(self||representative,
                    representative&&!"REPRESENTATIVE".equals(rs.getString("residence_role")),self)); }).optional();
    }

    public List<ResidencePeriod> residenceHistory(long profileId){return jdbc.sql("""
        SELECT tr.id,p.name property_name,r.code room_code,tr.residence_role,tr.move_in_date,tr.move_out_date,tr.status,tr.relationship
        FROM tenant_residences tr JOIN properties p ON p.id=tr.property_id LEFT JOIN rooms r ON r.id=tr.room_id
        WHERE tr.tenant_profile_id=:id ORDER BY tr.move_in_date DESC
        """).param("id",profileId).query((rs,n)->new ResidencePeriod(rs.getLong("id"),rs.getString("property_name"),
        rs.getString("room_code"),rs.getString("residence_role"),rs.getObject("move_in_date",LocalDate.class),
        rs.getObject("move_out_date",LocalDate.class),rs.getString("status"),rs.getString("relationship"))).list();}

    public long countRequests(ActiveContext c,String status){String f=status==null?"":" AND q.status=:status";var s=jdbc.sql("SELECT COUNT(*) FROM co_occupant_requests q WHERE q.room_id=:roomId"+f).param("roomId",c.roomId());if(status!=null)s=s.param("status",status);return s.query(Long.class).single();}
    public List<RequestRow> requests(ActiveContext c,String status,int size,int offset){String f=status==null?"":" AND q.status=:status";var s=jdbc.sql("""
        SELECT q.id,q.code,q.full_name,q.request_type,q.status,q.information_request_message,q.submitted_at,q.updated_at,q.version
        FROM co_occupant_requests q WHERE q.room_id=:roomId%s ORDER BY q.updated_at DESC LIMIT :size OFFSET :offset
        """.formatted(f)).param("roomId",c.roomId()).param("size",size).param("offset",offset);if(status!=null)s=s.param("status",status);return s.query((rs,n)->new RequestRow(rs.getLong("id"),rs.getString("code"),rs.getString("full_name"),rs.getString("request_type"),rs.getString("status"),rs.getString("information_request_message"),rs.getObject("submitted_at",LocalDateTime.class),rs.getObject("updated_at",LocalDateTime.class),permissions(rs.getString("status")))).list();}

    public Optional<RequestBase> request(ActiveContext c,long id){return jdbc.sql("SELECT * FROM co_occupant_requests WHERE id=:id AND room_id=:roomId").param("id",id).param("roomId",c.roomId()).query((rs,n)->new RequestBase(rs.getLong("id"),rs.getString("code"),rs.getString("request_type"),rs.getString("status"),rs.getLong("version"),rs.getLong("requester_user_id"),rs.getString("full_name"),rs.getObject("date_of_birth",LocalDate.class),rs.getString("gender"),rs.getString("phone"),rs.getString("email"),rs.getString("relationship"),rs.getString("occupation"),rs.getString("workplace"),rs.getString("identity_number"),rs.getString("identity_type"),rs.getObject("expected_move_in_date",LocalDate.class),rs.getObject("expected_move_out_date",LocalDate.class),rs.getString("reason"),rs.getString("note"),rs.getString("public_feedback"),rs.getString("information_request_message"),rs.getObject("information_deadline",LocalDate.class),rs.getObject("submitted_at",LocalDateTime.class),rs.getObject("updated_at",LocalDateTime.class))).optional();}
    public boolean requestExists(long id){return jdbc.sql("SELECT COUNT(*) FROM co_occupant_requests WHERE id=:id").param("id",id).query(Long.class).single()>0;}
    public Optional<RequestBase> byIdempotency(long userId,String key){return jdbc.sql("SELECT * FROM co_occupant_requests WHERE requester_user_id=:uid AND idempotency_key=:k").param("uid",userId).param("k",key).query((rs,n)->new RequestBase(rs.getLong("id"),rs.getString("code"),rs.getString("request_type"),rs.getString("status"),rs.getLong("version"),rs.getLong("requester_user_id"),rs.getString("full_name"),rs.getObject("date_of_birth",LocalDate.class),rs.getString("gender"),rs.getString("phone"),rs.getString("email"),rs.getString("relationship"),rs.getString("occupation"),rs.getString("workplace"),rs.getString("identity_number"),rs.getString("identity_type"),rs.getObject("expected_move_in_date",LocalDate.class),rs.getObject("expected_move_out_date",LocalDate.class),rs.getString("reason"),rs.getString("note"),rs.getString("public_feedback"),rs.getString("information_request_message"),rs.getObject("information_deadline",LocalDate.class),rs.getObject("submitted_at",LocalDateTime.class),rs.getObject("updated_at",LocalDateTime.class))).optional();}
    public boolean duplicate(long roomId,String phone,String identity){return jdbc.sql("SELECT COUNT(*) FROM co_occupant_requests WHERE room_id=:room AND status IN ('SUBMITTED','UNDER_REVIEW','NEED_MORE_INFORMATION') AND (phone=:phone OR identity_number=:identity)").param("room",roomId).param("phone",phone).param("identity",identity).query(Long.class).single()>0;}

    public long create(long userId,ActiveContext c,String key,com.thangit.boardinghouse.dto.request.occupant.TenantCoOccupantRequests.CreateRequest r){jdbc.sql("""
        INSERT INTO co_occupant_requests(request_type,property_id,room_id,contract_id,requester_user_id,full_name,date_of_birth,gender,phone,email,permanent_address,hometown,nationality,occupation,workplace,relationship,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,identity_type,identity_number,identity_issued_date,identity_expires_date,identity_issued_place,expected_move_in_date,expected_move_out_date,previous_address,reason,note,request_account,idempotency_key)
        VALUES('ADD_CO_OCCUPANT',:property,:room,:contract,:user,:name,:dob,:gender,:phone,:email,:address,:hometown,:nationality,:occupation,:workplace,:relationship,:ecName,:ecPhone,:ecRelation,:idType,:idNumber,:issued,:expires,:issuedPlace,:moveIn,:moveOut,:previous,:reason,:note,:account,:key)
        """).params(map("property",c.propertyId(),"room",c.roomId(),"contract",c.contractId(),"user",userId,
        "name",r.fullName().trim(),"dob",r.dateOfBirth(),"gender",nullable(r.gender()),"phone",r.phone().trim(),
        "email",nullable(r.email()),"address",r.permanentAddress().trim(),"hometown",nullable(r.hometown()),
        "nationality",nullable(r.nationality()),"occupation",nullable(r.occupation()),"workplace",nullable(r.workplace()),
        "relationship",r.relationship().trim(),"ecName",r.emergencyContact()==null?null:r.emergencyContact().fullName().trim(),
        "ecPhone",r.emergencyContact()==null?null:r.emergencyContact().phone().trim(),"ecRelation",r.emergencyContact()==null?null:r.emergencyContact().relationship().trim(),
        "idType",r.identityDocument().type(),"idNumber",r.identityDocument().number().trim(),"issued",r.identityDocument().issuedDate(),
        "expires",r.identityDocument().expiresDate(),"issuedPlace",nullable(r.identityDocument().issuedPlace()),
        "moveIn",r.expectedMoveInDate(),"moveOut",r.expectedMoveOutDate(),"previous",nullable(r.previousAddress()),
        "reason",r.reason().trim(),"note",nullable(r.note()),"account",r.requestAccount(),"key",key)).update();long id=jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();jdbc.sql("UPDATE co_occupant_requests SET code=CONCAT('OC-',YEAR(CURRENT_DATE),'-',LPAD(id,6,'0')) WHERE id=:id").param("id",id).update();return id;}

    public List<DocumentInfo> documents(long id){return jdbc.sql("SELECT id,document_type,original_name,content_type,file_size,uploaded_at,file_content IS NOT NULL downloadable FROM co_occupant_request_documents WHERE request_id=:id AND tenant_visible=TRUE ORDER BY uploaded_at DESC").param("id",id).query((rs,n)->new DocumentInfo(rs.getLong("id"),rs.getString("document_type"),rs.getString("original_name"),rs.getString("content_type"),rs.getLong("file_size"),rs.getObject("uploaded_at",LocalDateTime.class),rs.getBoolean("downloadable"))).list();}
    public long addDocument(long requestId,long userId,String type,String name,String mime,byte[] content){jdbc.sql("INSERT INTO co_occupant_request_documents(request_id,document_type,original_name,content_type,file_size,file_content,uploaded_by) VALUES(:r,:t,:n,:m,:s,:c,:u)").param("r",requestId).param("t",type).param("n",name).param("m",mime).param("s",content.length).param("c",content).param("u",userId).update();return jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();}
    public Optional<FileData> file(ActiveContext c,long userId,long id){return jdbc.sql("SELECT d.original_name,d.content_type,d.file_content FROM co_occupant_request_documents d JOIN co_occupant_requests q ON q.id=d.request_id WHERE d.id=:id AND q.room_id=:room AND d.tenant_visible=TRUE AND (:representative=TRUE OR q.requester_user_id=:user)").param("id",id).param("room",c.roomId()).param("representative","REPRESENTATIVE".equals(c.role())).param("user",userId).query((rs,n)->new FileData(rs.getString("original_name"),rs.getString("content_type"),rs.getBytes("file_content"))).optional();}
    public List<TimelineItem> history(long id){return jdbc.sql("SELECT id,event_type,description,actor_name,occurred_at FROM co_occupant_request_history WHERE request_id=:id AND tenant_visible=TRUE ORDER BY occurred_at").param("id",id).query((rs,n)->new TimelineItem(rs.getLong("id"),rs.getString("event_type"),rs.getString("description"),rs.getString("actor_name"),rs.getObject("occurred_at",LocalDateTime.class))).list();}
    public void addHistory(long id,String event,String description,String actor){jdbc.sql("INSERT INTO co_occupant_request_history(request_id,event_type,description,actor_name) VALUES(:id,:e,:d,:a)").param("id",id).param("e",event).param("d",description).param("a",actor).update();}
    public int cancel(long id,long version,String reason){return jdbc.sql("UPDATE co_occupant_requests SET status='CANCELLED',public_feedback=:reason,version=version+1 WHERE id=:id AND version=:version AND status IN ('SUBMITTED','NEED_MORE_INFORMATION')").param("reason",reason).param("id",id).param("version",version).update();}
    public int additional(long id,long version,long userId,String content){int n=jdbc.sql("UPDATE co_occupant_requests SET status='SUBMITTED',version=version+1 WHERE id=:id AND version=:version AND status='NEED_MORE_INFORMATION'").param("id",id).param("version",version).update();if(n>0)jdbc.sql("INSERT INTO co_occupant_additional_information(request_id,submitted_by,content) VALUES(:id,:u,:c)").param("id",id).param("u",userId).param("c",content).update();return n;}
    public long createMoveOut(long userId,ActiveContext c,long profileId,String name,String key,LocalDate date,String reason,String note,String phone){jdbc.sql("INSERT INTO co_occupant_requests(request_type,property_id,room_id,contract_id,requester_user_id,occupant_profile_id,full_name,phone,expected_move_out_date,reason,note,idempotency_key) VALUES('MOVE_OUT',:p,:r,:c,:u,:o,:name,:phone,:date,:reason,:note,:key)").param("p",c.propertyId()).param("r",c.roomId()).param("c",c.contractId()).param("u",userId).param("o",profileId).param("name",name).param("phone",phone).param("date",date).param("reason",reason).param("note",nullable(note)).param("key",key).update();long id=jdbc.sql("SELECT LAST_INSERT_ID()").query(Long.class).single();jdbc.sql("UPDATE co_occupant_requests SET code=CONCAT('OC-',YEAR(CURRENT_DATE),'-',LPAD(id,6,'0')) WHERE id=:id").param("id",id).update();return id;}
    public void notifyManagers(ActiveContext c,String title,String content){jdbc.sql("INSERT INTO notifications(user_id,title,content,type,category) SELECT p.owner_id,:title,:content,'CO_OCCUPANT','CO_OCCUPANT' FROM properties p WHERE p.id=:property UNION SELECT pm.manager_id,:title,:content,'CO_OCCUPANT','CO_OCCUPANT' FROM property_managers pm WHERE pm.property_id=:property").param("title",title).param("content",content).param("property",c.propertyId()).update();}

    public long historyCount(ActiveContext c){return jdbc.sql("SELECT COUNT(*) FROM tenant_residences WHERE room_id=:room AND status<>'ACTIVE'").param("room",c.roomId()).query(Long.class).single();}
    public List<ResidencePeriod> roomHistory(ActiveContext c,int size,int offset){return jdbc.sql("""
        SELECT tr.id,p.name property_name,r.code room_code,tr.residence_role,tr.move_in_date,tr.move_out_date,tr.status,tr.relationship
        FROM tenant_residences tr JOIN properties p ON p.id=tr.property_id LEFT JOIN rooms r ON r.id=tr.room_id
        WHERE tr.room_id=:room AND tr.status<>'ACTIVE' ORDER BY tr.move_out_date DESC LIMIT :size OFFSET :offset
        """).param("room",c.roomId()).param("size",size).param("offset",offset).query((rs,n)->new ResidencePeriod(rs.getLong("id"),rs.getString("property_name"),rs.getString("room_code"),rs.getString("residence_role"),rs.getObject("move_in_date",LocalDate.class),rs.getObject("move_out_date",LocalDate.class),rs.getString("status"),rs.getString("relationship"))).list();}

    public static RequestPermissions permissions(String status){return new RequestPermissions(java.util.Set.of("SUBMITTED","NEED_MORE_INFORMATION").contains(status),"NEED_MORE_INFORMATION".equals(status),"NEED_MORE_INFORMATION".equals(status));}
    private static String maskPhone(String v){if(v==null||v.length()<7)return v;return v.substring(0,3)+"****"+v.substring(v.length()-3);}
    private static String maskEmail(String v){if(v==null||!v.contains("@"))return null;return v.charAt(0)+"***"+v.substring(v.indexOf('@'));}
    private static String nullable(String v){return v==null||v.isBlank()?null:v.trim();}
    private static java.util.Map<String,Object> map(Object... values){var result=new java.util.HashMap<String,Object>();for(int i=0;i<values.length;i+=2)result.put((String)values[i],values[i+1]);return result;}
    public record ActiveContext(long residenceId,long profileId,String role,long propertyId,long roomId,Long contractId,String propertyName,String address,String buildingName,String floorName,String roomCode,String roomType,java.math.BigDecimal area,int capacity,String roomStatus,String contractCode,LocalDate endDate,String contractStatus,String representativeName,int occupantCount){}
    public record RequestBase(long id,String code,String type,String status,long version,long requesterUserId,String fullName,LocalDate dateOfBirth,String gender,String phone,String email,String relationship,String occupation,String workplace,String identityNumber,String identityType,LocalDate moveIn,LocalDate moveOut,String reason,String note,String publicFeedback,String informationMessage,LocalDate informationDeadline,LocalDateTime submittedAt,LocalDateTime updatedAt){}
}
