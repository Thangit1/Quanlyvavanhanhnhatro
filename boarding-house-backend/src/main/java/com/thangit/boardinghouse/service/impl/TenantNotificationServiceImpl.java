package com.thangit.boardinghouse.service.impl;

import static com.thangit.boardinghouse.dto.request.notification.TenantNotificationRequests.*;
import static com.thangit.boardinghouse.dto.response.notification.TenantNotificationResponses.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.TenantNotificationRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantNotificationService;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantNotificationServiceImpl implements TenantNotificationService {
    public static final Set<String> CATEGORIES=Set.of("INVOICE","PAYMENT","DEBT_REMINDER","CONTRACT","MAINTENANCE","CO_OCCUPANT","UTILITY","ROOM","ANNOUNCEMENT","SECURITY","EMERGENCY","SYSTEM","OTHER");
    private static final Set<String> SEVERITIES=Set.of("INFO","SUCCESS","WARNING","URGENT");
    private static final Set<String> BULK=Set.of("MARK_READ","MARK_UNREAD","ARCHIVE","RESTORE");
    private static final Set<String> MANDATORY=Set.of("INVOICE","CONTRACT","SECURITY","EMERGENCY");
    private final TenantNotificationRepository repository;private final ObjectMapper mapper=new ObjectMapper();
    public TenantNotificationServiceImpl(TenantNotificationRepository repository){this.repository=repository;}
    @Override @Transactional(readOnly=true) public Summary summary(AuthenticatedUser p){tenant(p);return repository.summary(p.id());}
    @Override @Transactional(readOnly=true) public UnreadCount unread(AuthenticatedUser p){tenant(p);return new UnreadCount(repository.unread(p.id()));}
    @Override @Transactional(readOnly=true) public List<NotificationRow> recent(AuthenticatedUser p,int limit){tenant(p);if(limit<1||limit>10)throw bad("Giới hạn thông báo gần đây không hợp lệ.");return repository.recent(p.id(),limit);}
    @Override @Transactional(readOnly=true) public Page<NotificationRow> list(AuthenticatedUser p,String keyword,String category,String severity,String readStatus,Boolean requiresAction,boolean archived,LocalDate startDate,LocalDate endDate,String sort,int page,int size){tenant(p);if(page<0||size<1||size>50)throw bad("Thông tin phân trang không hợp lệ.");var params=new HashMap<String,Object>();var where=new StringBuilder(archived?" AND n.archived_at IS NOT NULL":" AND n.archived_at IS NULL");if(keyword!=null&&!keyword.isBlank()){where.append(" AND (LOWER(n.title) LIKE :keyword OR LOWER(n.content) LIKE :keyword OR LOWER(COALESCE(n.code,'')) LIKE :keyword)");params.put("keyword","%"+keyword.trim().toLowerCase(Locale.ROOT)+"%");}String cat=normalized(category);if(cat!=null){if(!CATEGORIES.contains(cat))throw bad("Loại thông báo không hợp lệ.");where.append(" AND n.category=:category");params.put("category",cat);}String sev=normalized(severity);if(sev!=null){if(!SEVERITIES.contains(sev))throw bad("Mức độ thông báo không hợp lệ.");where.append(" AND n.severity=:severity");params.put("severity",sev);}String read=normalized(readStatus);if(read!=null){if(!Set.of("READ","UNREAD").contains(read))throw bad("Trạng thái đọc không hợp lệ.");where.append(" AND n.read_at IS ").append("READ".equals(read)?"NOT NULL":"NULL");}if(requiresAction!=null){where.append(" AND n.requires_action=:action");params.put("action",requiresAction);}if(startDate!=null){where.append(" AND n.created_at>=:start");params.put("start",startDate.atStartOfDay());}if(endDate!=null){if(startDate!=null&&endDate.isBefore(startDate))throw bad("Khoảng thời gian không hợp lệ.");where.append(" AND n.created_at<:end");params.put("end",endDate.plusDays(1).atStartOfDay());}String order=switch(sort==null?"newest":sort){case "oldest"->"n.created_at ASC";case "unread"->"(n.read_at IS NULL) DESC,n.created_at DESC";case "severity"->"FIELD(n.severity,'URGENT','WARNING','SUCCESS','INFO'),n.created_at DESC";case "action"->"n.requires_action DESC,n.created_at DESC";default->"n.created_at DESC";};long total=repository.count(p.id(),where.toString(),params);return new Page<>(repository.list(p.id(),where.toString(),params,order,size,page*size),page,size,total,(int)Math.ceil((double)total/size),repository.unread(p.id()));}
    @Override @Transactional public NotificationDetail detail(AuthenticatedUser p,long id){tenant(p);owned(p,id);repository.markRead(p.id(),id);return owned(p,id);}
    @Override @Transactional public ActionResult read(AuthenticatedUser p,long id){tenant(p);owned(p,id);repository.markRead(p.id(),id);return result(owned(p,id));}
    @Override @Transactional public ActionResult unread(AuthenticatedUser p,long id){tenant(p);owned(p,id);repository.markUnread(p.id(),id);return result(owned(p,id));}
    @Override @Transactional public BulkResult markAllRead(AuthenticatedUser p){tenant(p);return new BulkResult(repository.markAllRead(p.id()));}
    @Override @Transactional public ActionResult archive(AuthenticatedUser p,long id){tenant(p);owned(p,id);repository.archive(p.id(),id);return result(owned(p,id));}
    @Override @Transactional public ActionResult restore(AuthenticatedUser p,long id){tenant(p);owned(p,id);repository.restore(p.id(),id);return result(owned(p,id));}
    @Override @Transactional public ActionResult acknowledge(AuthenticatedUser p,long id){tenant(p);var d=owned(p,id);if(!d.requiresAcknowledgement())throw bad("Thông báo này không yêu cầu xác nhận.");repository.acknowledge(p.id(),id);return result(owned(p,id));}
    @Override @Transactional public BulkResult bulk(AuthenticatedUser p,BulkAction request){tenant(p);String action=normalized(request.action());if(!BULK.contains(action))throw bad("Thao tác hàng loạt không hợp lệ.");var ids=request.notificationIds().stream().distinct().toList();if(repository.ownedCount(p.id(),ids)!=ids.size())throw new AuthException(HttpStatus.FORBIDDEN,"NOTIFICATION_BULK_FORBIDDEN","Danh sách chứa thông báo không thuộc tài khoản của bạn.");return new BulkResult(repository.bulk(p.id(),ids,action));}
    @Override @Transactional(readOnly=true) public PreferenceData preferences(AuthenticatedUser p){tenant(p);var row=repository.preference(p.id()).orElse(null);if(row==null)return preferenceData(true,false,defaults(),"IMMEDIATE",false,null,null,0);return preferenceData(row.inApp(),row.email(),parse(row.categoriesJson()),row.digestMode(),row.quietHours(),row.start(),row.end(),row.version());}
    @Override @Transactional public PreferenceData preferences(AuthenticatedUser p,Preferences request){tenant(p);if(!request.inApp())throw bad("Thông báo trong ứng dụng là kênh bắt buộc.");if(request.email())throw bad("Kênh email chưa được cấu hình trên hệ thống.");String digest=normalized(request.digestMode());if(!Set.of("IMMEDIATE","DAILY","WEEKLY").contains(digest))throw bad("Chế độ tổng hợp không hợp lệ.");var categories=new LinkedHashMap<>(defaults());request.categories().forEach((key,value)->{String k=normalized(key);if(CATEGORIES.contains(k))categories.put(k,value);});MANDATORY.forEach(k->categories.put(k,true));var q=request.quietHours();if(q.enabled()&&(q.start()==null||q.end()==null))throw bad("Vui lòng chọn đầy đủ khung giờ không làm phiền.");repository.savePreference(p.id(),true,false,json(categories),digest,q.enabled(),q.start(),q.end(),request.version()==null?0:request.version());return preferences(p);}
    private NotificationDetail owned(AuthenticatedUser p,long id){return repository.detail(p.id(),id).orElseThrow(()->repository.exists(id)?new AuthException(HttpStatus.FORBIDDEN,"NOTIFICATION_FORBIDDEN","Bạn không có quyền xem thông báo này."):new AuthException(HttpStatus.NOT_FOUND,"NOTIFICATION_NOT_FOUND","Không tìm thấy thông báo."));}
    private ActionResult result(NotificationDetail d){return new ActionResult(d.id(),d.read(),d.archived(),d.acknowledgedAt()!=null,d.version());}
    private PreferenceData preferenceData(boolean inApp,boolean email,Map<String,Boolean> categories,String digest,boolean quiet,java.time.LocalTime start,java.time.LocalTime end,long version){return new PreferenceData(inApp,email,List.of("IN_APP"),categories,digest,quiet,start,end,version);}
    private Map<String,Boolean> defaults(){var m=new LinkedHashMap<String,Boolean>();CATEGORIES.stream().sorted().forEach(k->m.put(k,true));return m;}
    private Map<String,Boolean> parse(String json){if(json==null||json.isBlank())return defaults();try{var value=mapper.readValue(json,new TypeReference<Map<String,Boolean>>(){});var merged=defaults();merged.putAll(value);MANDATORY.forEach(k->merged.put(k,true));return merged;}catch(Exception e){return defaults();}}
    private String json(Map<String,Boolean> value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private void tenant(AuthenticatedUser p){if(p==null||p.activeRole()!=RoleCode.TENANT)throw new AuthException(HttpStatus.FORBIDDEN,"NOTIFICATION_ROLE_FORBIDDEN","Chỉ khách thuê được truy cập thông báo.");}
    private String normalized(String v){return v==null||v.isBlank()?null:v.trim().toUpperCase(Locale.ROOT);}
    private AuthException bad(String m){return new AuthException(HttpStatus.BAD_REQUEST,"NOTIFICATION_INVALID",m);}
}
