package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly=true)
public class OperationsWorkspaceService {
 public record Asset(@NotNull @Positive Long roomId,@NotBlank @Size(max=60) String code,
  @NotBlank @Size(max=150) String name,@NotBlank @Size(max=50) String category,
  @Min(1) int quantity,@NotBlank String condition,@NotBlank String status,
  LocalDate purchasedAt,@DecimalMin("0") @Digits(integer=13,fraction=2) BigDecimal purchasePrice,Long custodianId,
  @Size(max=500) String note,@Min(0) long version,@NotBlank @Size(max=1000) String reason){}
 public record Decision(@Min(0) long version,boolean approve,@NotBlank @Size(max=1000) String reason){}
 public record Stock(@NotNull @DecimalMin(value="0",inclusive=false) @Digits(integer=10,fraction=2) BigDecimal quantity,@NotBlank @Size(max=1000) String reason,@NotBlank @Size(max=100) String key){}
 private final JdbcClient db;private final SecurityAudit audit;private final PropertyAuthorization access;
 public OperationsWorkspaceService(JdbcClient db,SecurityAudit audit,PropertyAuthorization access){this.db=db;this.audit=audit;this.access=access;}
 private AuthException fail(String code){return new AuthException(HttpStatus.CONFLICT,code,"Dữ liệu đã thay đổi hoặc không hợp lệ. Kiểm tra phạm vi, quyền và chứng từ nguồn.");}
 private AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"OPERATIONS_SCOPE_DENIED","Không có quyền trong phạm vi nhà trọ này.");}
 private void role(AuthenticatedUser p){if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER,RoleCode.ACCOUNTANT).contains(p.activeRole()))throw denied();}
 private String scope(AuthenticatedUser p){role(p);return switch(p.activeRole()){
  case OWNER->"p.owner_id=:actor";
  case MANAGER->"EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id=p.id AND pm.manager_id=:actor)";
  default->"EXISTS(SELECT 1 FROM accountant_property_assignments ap JOIN accountant_profiles a ON a.user_id=ap.accountant_id WHERE ap.property_id=p.id AND ap.accountant_id=:actor)";};}
 private List<Long> properties(AuthenticatedUser p,Long property){var ids=db.sql("SELECT p.id FROM properties p WHERE "+scope(p)+" AND (:property IS NULL OR p.id=:property) ORDER BY p.id").param("actor",p.id()).param("property",property).query(Long.class).list();if(property!=null&&ids.isEmpty())throw denied();return ids;}
 private boolean finance(AuthenticatedUser p,long property){return p.activeRole()!=RoleCode.MANAGER||db.sql("SELECT COUNT(*) FROM manager_property_capabilities WHERE manager_id=:actor AND property_id=:property AND capability='FINANCE_READ'").param("actor",p.id()).param("property",property).query(Long.class).single()>0;}
 private void write(AuthenticatedUser p,long property){properties(p,property);if(p.activeRole()==RoleCode.ACCOUNTANT)throw denied();}
 private void owner(AuthenticatedUser p,long property){write(p,property);if(p.activeRole()!=RoleCode.OWNER)throw denied();}
 public Map<String,Object> options(AuthenticatedUser p){
  var ids=properties(p,null);var safe=ids.isEmpty()?List.of(-1L):ids;
  return Map.of("properties",db.sql("SELECT p.id,p.name,op.organization_id organizationId,op.area_id areaId,o.name organizationName FROM properties p LEFT JOIN organization_property_relationships op ON op.property_id=p.id AND op.ended_at IS NULL LEFT JOIN organizations o ON o.id=op.organization_id WHERE p.id IN (:ids) ORDER BY p.name").param("ids",safe).query().listOfRows(),
   "rooms",db.sql("SELECT id,code,property_id propertyId FROM rooms WHERE property_id IN (:ids) ORDER BY code").param("ids",safe).query().listOfRows(),
   "staff",db.sql("SELECT DISTINCT u.id,u.full_name name,t.property_id propertyId FROM technician_property_assignments t JOIN users u ON u.id=t.technician_id WHERE t.property_id IN (:ids) AND t.revoked_at IS NULL AND u.status='ACTIVE' ORDER BY u.full_name").param("ids",safe).query().listOfRows(),
   "canWrite",p.activeRole()!=RoleCode.ACCOUNTANT,"canApprove",p.activeRole()==RoleCode.OWNER);
 }
 public Map<String,Object> read(AuthenticatedUser p,String tab,Long property,Long organization,Long room,String keyword,String status,String category,int page,int size){
  if(page<0||size<1||size>100||!Set.of("assets","materials","approvals","costs","history").contains(tab))throw fail("OPERATIONS_FILTER_INVALID");
  var ids=properties(p,property);if(organization!=null)ids=db.sql("SELECT property_id FROM organization_property_relationships WHERE ended_at IS NULL AND organization_id=:org AND property_id IN (:ids)").param("org",organization).param("ids",ids.isEmpty()?List.of(-1L):ids).query(Long.class).list();
  var args=new HashMap<String,Object>();args.put("ids",ids.isEmpty()?List.of(-1L):ids);args.put("room",room);args.put("keyword",keyword==null?"%":"%"+keyword.trim()+"%");
  var financial=ids.stream().filter(id->finance(p,id)).toList();args.put("financial",financial.isEmpty()?List.of(-1L):financial);
  String source=switch(tab){
   case "assets"->"SELECT a.id,a.asset_code code,a.name,a.category,a.room_id,a.quantity,a.condition_status,a.lifecycle_status status,a.purchased_at,a.version,a.note,a.custodian_id,u.full_name custodian,r.code room_code,p.id property_id,p.name property_name,CASE WHEN p.id IN (:financial) THEN a.purchase_price END purchase_price FROM room_assets a JOIN rooms r ON r.id=a.room_id JOIN properties p ON p.id=r.property_id LEFT JOIN users u ON u.id=a.custodian_id";
   case "materials"->"SELECT m.id,m.code,m.name,m.unit,m.stock_quantity quantity,m.minimum_quantity,m.status,m.property_id,p.name property_name,NULL room_id,NULL category,CASE WHEN p.id IN (:financial) THEN m.unit_price END unit_price FROM maintenance_materials m JOIN properties p ON p.id=m.property_id";
   case "approvals"->"SELECT mr.id,mr.version,mr.status,mr.note,mr.created_at,mr.urgency category,m.code,m.title name,m.room_id,m.property_id,p.name property_name,u.full_name requester,m.id task_id,(SELECT GROUP_CONCAT(CONCAT(i.material_name,' × ',i.quantity,' ',i.unit) ORDER BY i.id SEPARATOR '; ') FROM maintenance_material_request_items i WHERE i.material_request_id=mr.id) items FROM maintenance_material_requests mr JOIN maintenance_requests m ON m.id=mr.maintenance_request_id JOIN properties p ON p.id=m.property_id JOIN users u ON u.id=mr.requested_by";
   case "costs"->"SELECT c.id,m.version,c.approval_status status,c.responsibility category,c.created_at,c.note,c.expense_id,m.code,m.title name,m.id task_id,m.room_id,m.property_id,p.name property_name,CASE WHEN p.id IN (:financial) THEN c.total_cost END amount,CASE WHEN p.id IN (:financial) THEN m.estimated_cost END estimated_cost,CASE WHEN p.id IN (:financial) THEN m.actual_cost END actual_cost,v.id voucher_id,v.status voucher_status,CASE WHEN p.id IN (:financial) THEN IF(v.status='PAID',v.amount,0) END paid_amount FROM maintenance_costs c JOIN maintenance_requests m ON m.id=c.maintenance_request_id JOIN properties p ON p.id=m.property_id LEFT JOIN payment_vouchers v ON v.expense_id=c.expense_id";
   default->"SELECT h.id,CONCAT('VT-',mm.code) code,h.reason name,'RECORDED' status,NULL category,h.created_at,h.quantity_delta quantity,m.room_id,mm.property_id,p.name property_name,h.request_id task_id FROM maintenance_stock_movements h JOIN maintenance_materials mm ON mm.id=h.material_id JOIN properties p ON p.id=mm.property_id LEFT JOIN maintenance_requests m ON m.id=h.request_id";
  };
  String where=" WHERE q.property_id IN (:ids) AND (:room IS NULL OR q.room_id=:room) AND (q.code LIKE :keyword OR q.name LIKE :keyword)";
  if("costs".equals(tab))where+=" AND q.property_id IN (:financial)";
  if(status!=null&&!status.isBlank()){where+=" AND q.status=:status";args.put("status",status);}
  if(category!=null&&!category.isBlank()){where+=" AND q.category=:category";args.put("category",category);}
  var summary=db.sql("SELECT q.status,COUNT(*) count FROM ("+source+") q"+where+" GROUP BY q.status").params(args).query().listOfRows();
  long total=db.sql("SELECT COUNT(*) FROM ("+source+") q"+where).params(args).query(Long.class).single();args.put("limit",size);args.put("offset",(long)page*size);
  var rows=db.sql("SELECT * FROM ("+source+") q"+where+" ORDER BY q.id DESC LIMIT :limit OFFSET :offset").params(args).query().listOfRows();
  return Map.of("rows",rows,"summary",summary,"totalElements",total,"totalPages",(total+size-1)/size,"page",page,"canWrite",p.activeRole()!=RoleCode.ACCOUNTANT,"canApprove",p.activeRole()==RoleCode.OWNER);
 }
 @Transactional public long saveAsset(AuthenticatedUser p,Long id,Asset r){
  var room=db.sql("SELECT property_id FROM rooms WHERE id=:id").param("id",r.roomId()).query(Long.class).optional().orElseThrow(this::denied);write(p,room);new RoomLifecycleGuard(db).lockRoom(r.roomId());
  if(r.quantity()<1||!Set.of("GOOD","FAIR","DAMAGED","BROKEN","MISSING").contains(r.condition())||!Set.of("NEW","IN_USE","REPAIRING","BROKEN","RETIRED","DISPOSED","NEEDS_CHECK").contains(r.status()))throw fail("ASSET_STATE_INVALID");
  if(r.purchasePrice()!=null&&!finance(p,room))throw denied();
  if(r.custodianId()!=null&&db.sql("SELECT COUNT(*) FROM technician_property_assignments WHERE technician_id=:user AND property_id=:property AND revoked_at IS NULL").param("user",r.custodianId()).param("property",room).query(Long.class).single()!=1)throw denied();
  String beforeCondition=null,beforeStatus=null;
  if(id==null){var keys=new GeneratedKeyHolder();db.sql("INSERT INTO room_assets(room_id,name,asset_code) VALUES(:room,:name,:code)").param("room",r.roomId()).param("name",r.name().trim()).param("code",r.code().trim()).update(keys,"id");id=keys.getKey().longValue();}
  else{var old=db.sql("SELECT * FROM room_assets WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();if(((Number)old.get("room_id")).longValue()!=r.roomId())throw fail("ASSET_ROOM_MOVE_REQUIRES_HANDOVER");beforeCondition=old.get("condition_status").toString();beforeStatus=old.get("lifecycle_status").toString();}
  if(db.sql("UPDATE room_assets SET asset_code=:code,name=:name,category=:category,quantity=:quantity,condition_status=:condition,lifecycle_status=:status,purchased_at=:purchased,purchase_price=CASE WHEN :finance THEN :price ELSE purchase_price END,custodian_id=:custodian,note=:note,version=version+1 WHERE id=:id AND version=:version").param("code",r.code().trim()).param("name",r.name().trim()).param("category",r.category()).param("quantity",r.quantity()).param("condition",r.condition()).param("status",r.status()).param("purchased",r.purchasedAt()).param("finance",finance(p,room)).param("price",r.purchasePrice()).param("custodian",r.custodianId()).param("note",r.note()).param("id",id).param("version",r.version()).update()!=1)throw fail("ASSET_VERSION_CONFLICT");
  db.sql("INSERT INTO room_asset_history(asset_id,action,previous_condition,new_condition,previous_status,new_status,reason,performed_by) VALUES(:id,'SAVED',:before,:after,:old,:next,:reason,:actor)").param("id",id).param("before",beforeCondition).param("after",r.condition()).param("old",beforeStatus).param("next",r.status()).param("reason",r.reason()).param("actor",p.id()).update();audit.record(p.id(),"ASSET_SAVED","ROOM_ASSET",id,"SUCCESS",r.reason());return id;
 }
 public Map<String,Object> assetHistory(AuthenticatedUser p,long id){
  long property=db.sql("SELECT r.property_id FROM room_assets a JOIN rooms r ON r.id=a.room_id WHERE a.id=:id").param("id",id).query(Long.class).optional().orElseThrow(this::denied);properties(p,property);
  return Map.of("changes",db.sql("SELECT h.*,u.full_name actor_name FROM room_asset_history h JOIN users u ON u.id=h.performed_by WHERE asset_id=:id ORDER BY h.id DESC").param("id",id).query().listOfRows(),"handovers",db.sql("SELECT ci.contract_id,ci.id checkin_id,c.code contract_code,a.asset_name,a.quantity,a.condition_status,ci.actual_checkin_at FROM rental_checkin_assets a JOIN rental_checkins ci ON ci.id=a.checkin_id JOIN contracts c ON c.id=ci.contract_id WHERE a.room_asset_id=:id ORDER BY ci.id DESC").param("id",id).query().listOfRows());
 }
 public record Evidence(String name,String mime,byte[] content){}
 private void task(AuthenticatedUser p,long task){long property=db.sql("SELECT property_id FROM maintenance_requests WHERE id=:id").param("id",task).query(Long.class).optional().orElseThrow(this::denied);properties(p,property);}
 public List<Map<String,Object>> attachments(AuthenticatedUser p,long task){task(p,task);return db.sql("SELECT id,attachment_type,file_name,mime_type,file_size,created_at FROM maintenance_attachments WHERE maintenance_request_id=:id ORDER BY id").param("id",task).query().listOfRows();}
 @Transactional public Evidence attachment(AuthenticatedUser p,long task,long file){task(p,task);var row=db.sql("SELECT file_name,mime_type,file_content FROM maintenance_attachments WHERE id=:file AND maintenance_request_id=:task AND file_content IS NOT NULL").param("file",file).param("task",task).query().listOfRows().stream().findFirst().orElseThrow(()->new AuthException(HttpStatus.NOT_FOUND,"MAINTENANCE_FILE_NOT_FOUND","Không tìm thấy tệp."));audit.record(p.id(),"MAINTENANCE_FILE_DOWNLOADED","MAINTENANCE",task,"SUCCESS",null);return new Evidence(row.get("file_name").toString(),row.get("mime_type").toString(),(byte[])row.get("file_content"));}
 @Transactional public void stock(AuthenticatedUser p,long id,Stock r){
  var m=db.sql("SELECT * FROM maintenance_materials WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();long property=((Number)m.get("property_id")).longValue();write(p,property);if(r.quantity()==null||r.quantity().signum()<=0)throw fail("STOCK_QUANTITY_INVALID");
  var previous=db.sql("SELECT * FROM maintenance_stock_movements WHERE operation_key=:key").param("key",r.key()).query().listOfRows();if(!previous.isEmpty()){var prior=previous.getFirst();if(((Number)prior.get("material_id")).longValue()!=id||((Number)prior.get("performed_by")).longValue()!=p.id()||((BigDecimal)prior.get("quantity_delta")).compareTo(r.quantity())!=0||!prior.get("reason").equals(r.reason()))throw fail("STOCK_KEY_REUSED");return;}
  db.sql("UPDATE maintenance_materials SET stock_quantity=stock_quantity+:quantity WHERE id=:id").param("quantity",r.quantity()).param("id",id).update();
  db.sql("INSERT INTO maintenance_stock_movements(material_id,quantity_delta,reason,performed_by,operation_key) VALUES(:id,:quantity,:reason,:actor,:key)").param("id",id).param("quantity",r.quantity()).param("reason",r.reason()).param("actor",p.id()).param("key",r.key()).update();audit.record(p.id(),"MATERIAL_RECEIVED","MATERIAL",id,"SUCCESS",r.reason());
 }
 @Transactional public void reviewMaterial(AuthenticatedUser p,long id,Decision r){
  var request=db.sql("SELECT mr.*,m.property_id FROM maintenance_material_requests mr JOIN maintenance_requests m ON m.id=mr.maintenance_request_id WHERE mr.id=:id FOR UPDATE").param("id",id).query().singleRow();long property=((Number)request.get("property_id")).longValue();write(p,property);
  if(!"PENDING".equals(request.get("status"))||((Number)request.get("version")).longValue()!=r.version())throw fail("MATERIAL_REVIEW_CONFLICT");
  if(((Number)request.get("requested_by")).longValue()==p.id())throw denied();
  var items=db.sql("SELECT * FROM maintenance_material_request_items WHERE material_request_id=:id ORDER BY id FOR UPDATE").param("id",id).query().listOfRows();
  for(var item:items)if(item.get("material_id")!=null&&db.sql("SELECT COUNT(*) FROM maintenance_materials WHERE id=:id AND property_id=:property AND status='ACTIVE'").param("id",item.get("material_id")).param("property",property).query(Long.class).single()!=1)throw fail("MATERIAL_SCOPE_INVALID");
  db.sql("UPDATE maintenance_material_requests SET status=:status,reviewed_by=:actor,reviewed_at=NOW(),version=version+1 WHERE id=:id").param("status",r.approve()?"APPROVED":"REJECTED").param("actor",p.id()).param("id",id).update();
  if(r.approve())db.sql("UPDATE maintenance_material_request_items SET approved_quantity=quantity WHERE material_request_id=:id").param("id",id).update();
  new com.thangit.boardinghouse.repository.AdminMaintenanceRepository(db,new RoomLifecycleGuard(db)).history(((Number)request.get("maintenance_request_id")).longValue(),"MATERIAL_REVIEWED",null,null,r.reason(),p.id());
 }
 @Transactional public void reviewCost(AuthenticatedUser p,long id,Decision r){
  long task=db.sql("SELECT maintenance_request_id FROM maintenance_costs WHERE id=:id").param("id",id).query(Long.class).single();
  var m=db.sql("SELECT * FROM maintenance_requests WHERE id=:id FOR UPDATE").param("id",task).query().singleRow();long property=((Number)m.get("property_id")).longValue();owner(p,property);
  var cost=db.sql("SELECT * FROM maintenance_costs WHERE id=:id FOR UPDATE").param("id",id).query().singleRow();
  if(((Number)m.get("version")).longValue()!=r.version()||!"PENDING".equals(cost.get("approval_status"))||!"WAITING_APPROVAL".equals(m.get("status")))throw fail("MAINTENANCE_COST_REVIEW_CONFLICT");
  if(((Number)cost.get("proposed_by")).longValue()==p.id())throw denied();
  // Only the latest proposal may be approved. Previous approvals need reconciliation first.
  if(db.sql("SELECT COUNT(*) FROM maintenance_costs WHERE maintenance_request_id=:task AND (id>:id OR (approval_status='APPROVED' AND expense_id IS NOT NULL))").param("task",task).param("id",id).query(Long.class).single()>0)throw fail("MAINTENANCE_COST_SUPERSEDED_OR_ACCOUNTED");
  Long expense=null;
  if(r.approve()){
   if(!"OWNER".equals(cost.get("responsibility")))throw fail("TENANT_COST_REQUIRES_SETTLEMENT_APPROVAL");
   db.sql("CALL assert_management_period_open(:property,:date)").param("property",property).param("date",com.thangit.boardinghouse.service.BusinessTime.today(InvoicePaymentRules.ZONE)).update();
   var keys=new GeneratedKeyHolder();db.sql("INSERT INTO expenses(property_id,amount,expense_date,status,description) VALUES(:property,:amount,:date,'APPROVED',:description)").param("property",property).param("amount",cost.get("total_cost")).param("date",com.thangit.boardinghouse.service.BusinessTime.today(InvoicePaymentRules.ZONE)).param("description","Bảo trì "+m.get("code")+" · "+r.reason().substring(0,Math.min(350,r.reason().length()))).update(keys,"id");expense=keys.getKey().longValue();
  }
  db.sql("UPDATE maintenance_costs SET approval_status=:status,approved_by=:actor,approved_at=NOW(),expense_id=:expense WHERE id=:id").param("status",r.approve()?"APPROVED":"REJECTED").param("actor",p.id()).param("expense",expense).param("id",id).update();
  db.sql("UPDATE maintenance_requests SET status='IN_PROGRESS',version=version+1 WHERE id=:id").param("id",task).update();
  new com.thangit.boardinghouse.repository.AdminMaintenanceRepository(db,new RoomLifecycleGuard(db)).history(task,"COST_REVIEWED","WAITING_APPROVAL","IN_PROGRESS",r.reason(),p.id());audit.record(p.id(),"MAINTENANCE_COST_REVIEWED","MAINTENANCE_COST",id,"SUCCESS",r.reason());
 }
}
