package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.maintenance.AdminMaintenanceRequests.*;
import com.thangit.boardinghouse.dto.response.maintenance.AdminMaintenanceResponses.*;
import com.thangit.boardinghouse.repository.AdminMaintenanceRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminMaintenanceService;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminMaintenanceServiceImpl implements AdminMaintenanceService {
    private static final List<String> CATEGORIES = List.of("ELECTRICAL","WATER","INTERNET","AIR_CONDITIONER","WATER_HEATER","DOOR_LOCK","FURNITURE","APPLIANCE","STRUCTURE","LEAKAGE","SANITATION","SECURITY","FIRE_SAFETY","COMMON_AREA","ELEVATOR","OTHER");
    private static final List<String> PRIORITIES = List.of("LOW","MEDIUM","HIGH","URGENT");
    private final AdminMaintenanceRepository repository;

    public AdminMaintenanceServiceImpl(AdminMaintenanceRepository repository) { this.repository = repository; }

    @Override @Transactional(readOnly = true)
    public Summary summary(AuthenticatedUser p, Long propertyId) { read(p); if(propertyId!=null) property(p,propertyId); return repository.summary(p.id(),p.activeRole(),propertyId); }

    @Override @Transactional(readOnly = true)
    public Options options(AuthenticatedUser p) { read(p); return new Options(repository.properties(p.id(),p.activeRole()),repository.buildings(p.id(),p.activeRole()),repository.floors(p.id(),p.activeRole()),repository.rooms(p.id(),p.activeRole()),repository.assets(p.id(),p.activeRole()),repository.technicians()); }

    @Override @Transactional(readOnly = true)
    public Page<RequestRow> list(AuthenticatedUser p, Long propertyId, Long roomId, String keyword,
                                 String category, String priority, String status, Boolean overdue,
                                 String sort, int page, int size) {
        read(p); if(propertyId!=null)property(p,propertyId);
        return repository.list(p.id(),p.activeRole(),propertyId,roomId,keyword,category,priority,status,overdue,sort,Math.max(0,page),Math.min(100,Math.max(10,size)));
    }

    @Override @Transactional(readOnly = true)
    public Detail detail(AuthenticatedUser p,long id){Map<String,Object>m=accessible(p,id,false);return detailOf(p,m);}

    @Override @Transactional
    public Created create(AuthenticatedUser p,CreateRequest r){write(p);property(p,r.propertyId());validateCategory(r.category());validatePriority(r.priority());if(r.roomId()==null)throw bad("MAINTENANCE_LOCATION_REQUIRED","Vui lòng chọn phòng hoặc khu vực xử lý.");LocalDateTime sla=LocalDateTime.now().plusHours(slaHours(r.priority()));long id=repository.create(p.id(),r.propertyId(),r.roomId(),r.assetId(),r.reporterId(),r.source(),r.maintenanceType(),r.title().trim(),r.description().trim(),r.category(),r.priority(),r.safetyRisk(),r.detectedAt(),r.preferredServiceTime(),sla,nvl(r.estimatedCost()),blankOr(r.costResponsibility(),"OWNER"));Map<String,Object>m=repository.request(id,false).orElseThrow();repository.history(id,"CREATED",null,"NEW","Tạo yêu cầu bảo trì",p.id());return new Created(id,s(m,"code"),"NEW");}

    @Override @Transactional
    public Detail triage(AuthenticatedUser p,long id,TriageRequest r){write(p);Map<String,Object>m=accessible(p,id,true);validateCategory(r.category());validatePriority(r.priority());changed(repository.updateTriage(id,r.category(),r.priority(),r.slaDueAt(),r.safetyRisk(),r.version()));history(id,p,"TRIAGED",s(m,"status"),"TRIAGED","Đã phân loại sự cố và thiết lập SLA");return detail(p,id);}

    @Override @Transactional
    public Detail assign(AuthenticatedUser p,long id,AssignRequest r){write(p);Map<String,Object>m=accessible(p,id,true);if(!repository.isActiveTechnician(r.technicianId()))throw bad("TECHNICIAN_INVALID","Nhân viên kỹ thuật không tồn tại hoặc đã ngừng hoạt động.");changed(repository.assign(id,r.technicianId(),p.id(),r.note(),r.version()));history(id,p,"ASSIGNED",s(m,"status"),"ASSIGNED","Đã phân công nhân viên kỹ thuật");if(r.plannedStart()!=null&&r.plannedEnd()!=null){long version=r.version()+1;changed(repository.schedule(id,r.plannedStart(),r.plannedEnd(),(int)Math.max(15,ChronoUnit.MINUTES.between(r.plannedStart(),r.plannedEnd())),false,r.note(),version));history(id,p,"SCHEDULED","ASSIGNED","SCHEDULED","Đã lên lịch từ thông tin phân công");}return detail(p,id);}

    @Override @Transactional
    public Detail schedule(AuthenticatedUser p,long id,ScheduleRequest r){write(p);Map<String,Object>m=accessible(p,id,true);if(!r.scheduledEnd().isAfter(r.scheduledStart()))throw bad("SCHEDULE_INVALID","Thời gian kết thúc phải sau thời gian bắt đầu.");changed(repository.schedule(id,r.scheduledStart(),r.scheduledEnd(),r.estimatedDurationMinutes(),r.tenantPresenceRequired(),r.note(),r.version()));history(id,p,"SCHEDULED",s(m,"status"),"SCHEDULED","Đã cập nhật lịch xử lý");return detail(p,id);}

    @Override @Transactional
    public Detail start(AuthenticatedUser p,long id,long version){write(p);Map<String,Object>m=accessible(p,id,true);changed(repository.transition(id,"ASSIGNED,SCHEDULED,REOPENED,ON_HOLD","IN_PROGRESS",version,",progress_percent=GREATEST(progress_percent,1)"));history(id,p,"STARTED",s(m,"status"),"IN_PROGRESS","Bắt đầu xử lý công việc");return detail(p,id);}

    @Override @Transactional
    public Detail workLog(AuthenticatedUser p,long id,WorkLogRequest r){write(p);Map<String,Object>m=accessible(p,id,true);String next=s(m,"status");if("WAITING_PARTS".equals(r.actionType()))next="WAITING_PARTS";else if("WAITING_TENANT".equals(r.actionType()))next="WAITING_TENANT";else if("ON_HOLD".equals(r.actionType()))next="ON_HOLD";else if(List.of("ASSIGNED","SCHEDULED","REOPENED","WAITING_PARTS","WAITING_TENANT","ON_HOLD").contains(next))next="IN_PROGRESS";changed(repository.workLog(id,r.actionType(),r.progressPercent(),r.diagnosis(),r.workPerformed(),r.note(),r.startedAt(),r.endedAt(),p.id(),r.version(),next));history(id,p,"WORK_LOG",s(m,"status"),next,"Đã ghi nhận tiến độ "+r.progressPercent()+"%");return detail(p,id);}

    @Override @Transactional
    public Detail addMaterial(AuthenticatedUser p,long id,MaterialUsageRequest r){write(p);Map<String,Object>m=accessible(p,id,true);changed(repository.addMaterial(id,r.materialId(),r.materialName().trim(),r.quantity(),r.unit(),r.unitPrice(),p.id(),r.version()));history(id,p,"MATERIAL_ADDED",s(m,"status"),s(m,"status"),"Đã ghi nhận vật tư: "+r.materialName());return detail(p,id);}

    @Override @Transactional
    public Detail submitCost(AuthenticatedUser p,long id,CostRequest r){write(p);Map<String,Object>m=accessible(p,id,true);changed(repository.addCost(id,nvl(r.laborCost()),nvl(r.materialCost()),nvl(r.externalServiceCost()),nvl(r.otherCost()),r.responsibility(),nvl(r.tenantShareAmount()),r.note(),p.id(),r.version()));history(id,p,"COST_SUBMITTED",s(m,"status"),"WAITING_APPROVAL","Đã gửi chi phí chờ phê duyệt");return detail(p,id);}

    @Override @Transactional
    public Detail complete(AuthenticatedUser p,long id,CompleteRequest r){write(p);Map<String,Object>m=accessible(p,id,true);changed(repository.complete(id,r.diagnosis().trim(),r.resolution().trim(),r.version()));history(id,p,"COMPLETED",s(m,"status"),"INSPECTION_PENDING","Kỹ thuật đã hoàn thành, chờ nghiệm thu");return detail(p,id);}

    @Override @Transactional
    public Detail inspect(AuthenticatedUser p,long id,InspectionRequest r){write(p);Map<String,Object>m=accessible(p,id,true);if(!List.of("PASSED","FAILED").contains(r.result()))throw bad("INSPECTION_RESULT_INVALID","Kết quả nghiệm thu không hợp lệ.");changed(repository.inspect(id,r.result(),r.rating(),r.comment(),r.assetWorking(),r.costConfirmed(),p.id(),r.version()));String next="PASSED".equals(r.result())?"RESOLVED":"REOPENED";history(id,p,"INSPECTED",s(m,"status"),next,"PASSED".equals(r.result())?"Nghiệm thu đạt":"Nghiệm thu không đạt, mở lại yêu cầu");return detail(p,id);}

    @Override @Transactional
    public Detail reopen(AuthenticatedUser p,long id,ReasonRequest r){write(p);Map<String,Object>m=accessible(p,id,true);changed(repository.transition(id,"RESOLVED,REJECTED","REOPENED",r.version(),",resolved_at=NULL"));history(id,p,"REOPENED",s(m,"status"),"REOPENED",r.reason());return detail(p,id);}

    @Override @Transactional
    public Detail cancel(AuthenticatedUser p,long id,ReasonRequest r){write(p);Map<String,Object>m=accessible(p,id,true);changed(repository.transition(id,"NEW,TRIAGED,ASSIGNED,SCHEDULED,IN_PROGRESS,WAITING_TENANT,WAITING_PARTS,WAITING_APPROVAL,ON_HOLD,REOPENED","CANCELLED",r.version(),",cancelled_at=NOW(),cancellation_reason="+quote(r.reason())));history(id,p,"CANCELLED",s(m,"status"),"CANCELLED",r.reason());return detail(p,id);}

    @Override @Transactional(readOnly=true)
    public List<CalendarItem> calendar(AuthenticatedUser p,LocalDate from,LocalDate to){read(p);LocalDate start=from==null?LocalDate.now().withDayOfMonth(1):from;LocalDate end=to==null?start.plusMonths(1).minusDays(1):to;if(end.isBefore(start)||ChronoUnit.DAYS.between(start,end)>366)throw bad("CALENDAR_RANGE_INVALID","Khoảng xem lịch không hợp lệ.");return repository.calendar(p.id(),p.activeRole(),start,end);}
    @Override @Transactional(readOnly=true) public List<Plan> plans(AuthenticatedUser p){read(p);return repository.plans(p.id(),p.activeRole());}
    @Override @Transactional public Plan createPlan(AuthenticatedUser p,PlanRequest r){write(p);property(p,r.propertyId());if(r.endDate()!=null&&r.endDate().isBefore(r.startDate()))throw bad("PLAN_DATE_INVALID","Ngày kết thúc kế hoạch không hợp lệ.");long id=repository.createPlan(p.id(),r.propertyId(),r.name().trim(),r.assetCategory(),r.frequencyType(),r.frequencyInterval(),r.startDate(),r.endDate(),r.assigneeId(),r.reminderDaysBefore(),nvl(r.estimatedCost()),r.active()?"ACTIVE":"INACTIVE");return repository.plans(p.id(),p.activeRole()).stream().filter(x->x.id()==id).findFirst().orElseThrow();}
    @Override @Transactional(readOnly=true) public List<Material> materials(AuthenticatedUser p){read(p);return repository.materials(p.id(),p.activeRole());}
    @Override @Transactional public Material createMaterial(AuthenticatedUser p,MaterialRequest r){write(p);property(p,r.propertyId());long id=repository.createMaterial(r.propertyId(),r.code().trim(),r.name().trim(),r.unit().trim(),nvl(r.stockQuantity()),nvl(r.minimumQuantity()),nvl(r.unitPrice()));return repository.materials(p.id(),p.activeRole()).stream().filter(x->x.id()==id).findFirst().orElseThrow();}
    @Override @Transactional(readOnly=true) public Report report(AuthenticatedUser p){read(p);return repository.report(p.id(),p.activeRole());}
    @Override @Transactional(readOnly=true) public byte[] export(AuthenticatedUser p,Long propertyId,String status){StringBuilder csv=new StringBuilder("\uFEFFMã yêu cầu,Tiêu đề,Khu trọ,Phòng,Loại,Mức độ,Trạng thái,Chi phí\n");for(RequestRow r:list(p,propertyId,null,null,null,null,status,null,"newest",0,100).content())csv.append(q(r.requestCode())).append(',').append(q(r.title())).append(',').append(q(r.property().name())).append(',').append(q(r.room()==null?null:r.room().name())).append(',').append(r.category()).append(',').append(r.priority()).append(',').append(r.status()).append(',').append(r.actualCost()).append('\n');return csv.toString().getBytes(StandardCharsets.UTF_8);}

    private Detail detailOf(AuthenticatedUser p,Map<String,Object>m){long id=l(m,"id");String status=s(m,"status");Option property=new Option(l(m,"property_id"),s(m,"property_name"),null,null);Option room=m.get("room_id")==null?null:new Option(l(m,"room_id"),s(m,"room_code"),l(m,"property_id"),null);Option reporter=m.get("reporter_id")==null&&m.get("tenant_id")==null?null:new Option(m.get("reporter_id")==null?l(m,"tenant_id"):l(m,"reporter_id"),s(m,"reporter_name"),null,s(m,"reporter_phone"));Option assignee=m.get("assigned_to")==null?null:new Option(l(m,"assigned_to"),s(m,"assignee_name"),null,null);LocalDateTime created=dt(m,"created_at"),sla=dt(m,"sla_due_at");RequestRow row=new RequestRow(id,s(m,"code"),s(m,"title"),s(m,"issue_type"),s(m,"priority"),status,bool(m,"safety_risk"),property,room,reporter,assignee,created,dt(m,"preferred_service_time"),sla,Math.max(0,ChronoUnit.HOURS.between(created,LocalDateTime.now())),sla!=null&&sla.isBefore(LocalDateTime.now())&&!List.of("RESOLVED","CANCELLED").contains(status),money(m,"estimated_cost"),money(m,"actual_cost"),integer(m,"progress_percent"),l(m,"version"));boolean active=!List.of("RESOLVED","REJECTED","CANCELLED").contains(status);Permissions permissions=new Permissions(List.of("SUBMITTED","RECEIVED","NEW","REOPENED").contains(status),List.of("SUBMITTED","RECEIVED","NEW","TRIAGED","REOPENED","ASSIGNED").contains(status),List.of("ASSIGNED","SCHEDULED").contains(status),List.of("ASSIGNED","SCHEDULED","REOPENED","ON_HOLD").contains(status),active,active,active,p.activeRole()!=RoleCode.TECHNICIAN,List.of("IN_PROGRESS","WAITING_PARTS","WAITING_TENANT","WAITING_APPROVAL","ON_HOLD").contains(status),List.of("COMPLETED","INSPECTION_PENDING").contains(status),List.of("RESOLVED","REJECTED").contains(status),active);Option asset=m.get("asset_id")==null?null:new Option(l(m,"asset_id"),s(m,"asset_name"),m.get("room_id")==null?null:l(m,"room_id"),null);return new Detail(row,s(m,"description"),s(m,"source"),s(m,"maintenance_type"),asset,dt(m,"detected_at"),dt(m,"preferred_service_time"),s(m,"diagnosis"),s(m,"resolution"),s(m,"cost_responsibility"),repository.schedules(id),repository.logs(id),repository.usages(id),repository.costs(id),repository.inspections(id),repository.histories(id),permissions);}
    private Map<String,Object> accessible(AuthenticatedUser p,long id,boolean lock){read(p);Map<String,Object>m=repository.request(id,lock).orElseThrow(()->new AuthException(HttpStatus.NOT_FOUND,"MAINTENANCE_NOT_FOUND","Không tìm thấy yêu cầu bảo trì."));property(p,l(m,"property_id"));return m;}
    private void read(AuthenticatedUser p){if(p==null||!List.of(RoleCode.OWNER,RoleCode.MANAGER,RoleCode.ACCOUNTANT).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"MAINTENANCE_ACCESS_DENIED","Bạn không có quyền truy cập phân hệ bảo trì quản trị.");}
    private void write(AuthenticatedUser p){read(p);if(p.activeRole()==RoleCode.ACCOUNTANT)throw new AuthException(HttpStatus.FORBIDDEN,"MAINTENANCE_WRITE_DENIED","Kế toán chỉ được xem chi phí bảo trì trong giao diện này.");}
    private void property(AuthenticatedUser p,long id){if(!repository.canAccess(p.id(),p.activeRole(),id))throw new AuthException(HttpStatus.FORBIDDEN,"MAINTENANCE_PROPERTY_DENIED","Bạn không có quyền với khu trọ này.");}
    private void validateCategory(String x){if(!CATEGORIES.contains(x))throw bad("MAINTENANCE_CATEGORY_INVALID","Loại sự cố không hợp lệ.");}
    private void validatePriority(String x){if(!PRIORITIES.contains(x))throw bad("MAINTENANCE_PRIORITY_INVALID","Mức độ ưu tiên không hợp lệ.");}
    private void changed(int count){if(count==0)throw new AuthException(HttpStatus.CONFLICT,"MAINTENANCE_VERSION_CONFLICT","Yêu cầu đã được người khác cập nhật hoặc trạng thái không cho phép. Vui lòng tải lại.");}
    private void history(long id,AuthenticatedUser p,String action,String before,String after,String description){repository.history(id,action,before,after,description,p.id());}
    private AuthException bad(String code,String message){return new AuthException(HttpStatus.BAD_REQUEST,code,message);}
    private static int slaHours(String priority){return switch(priority){case "URGENT"->4;case "HIGH"->12;case "LOW"->72;default->24;};}
    private static BigDecimal nvl(BigDecimal x){return x==null?BigDecimal.ZERO:x;}
    private static String blankOr(String x,String fallback){return x==null||x.isBlank()?fallback:x;}
    private static String q(String x){return x==null?"":"\""+x.replace("\"","\"\"")+"\"";}
    private static String quote(String x){return "'"+x.replace("'","''")+"'";}
    private static String s(Map<String,Object>m,String k){Object x=m.get(k);return x==null?null:x.toString();}
    private static long l(Map<String,Object>m,String k){return ((Number)m.get(k)).longValue();}
    private static int integer(Map<String,Object>m,String k){return m.get(k)==null?0:((Number)m.get(k)).intValue();}
    private static boolean bool(Map<String,Object>m,String k){return m.get(k)!=null&&(Boolean)m.get(k);}
    private static BigDecimal money(Map<String,Object>m,String k){Object x=m.get(k);return x==null?BigDecimal.ZERO:(BigDecimal)x;}
    private static LocalDateTime dt(Map<String,Object>m,String k){Object x=m.get(k);return x==null?null:x instanceof LocalDateTime d?d:((Timestamp)x).toLocalDateTime();}
}
