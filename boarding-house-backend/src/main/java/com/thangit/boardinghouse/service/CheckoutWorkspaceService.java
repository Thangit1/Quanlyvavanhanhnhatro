package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A paged projection of the existing checkout workflow, never another settlement writer. */
@Service
@Transactional(readOnly=true)
public class CheckoutWorkspaceService {
 public record Filter(Long propertyId,Long organizationId,Long roomId,LocalDate from,LocalDate to,String keyword,String stage,String financialStatus,Long assignee,Boolean disputed,int page,int size){}
 private final JdbcClient db;
 public CheckoutWorkspaceService(JdbcClient db){this.db=db;}
 public record Assignment(@jakarta.validation.constraints.Positive long userId,@jakarta.validation.constraints.Min(0) long version,@jakarta.validation.constraints.NotNull java.time.LocalDateTime inspectionAt,@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=1000) String reason){}
 @Transactional public void assign(AuthenticatedUser p,long id,Assignment r){new RoomLifecycleGuard(db).lockCheckout(id);var co=db.sql("SELECT co.*,room.property_id FROM rental_checkouts co JOIN contracts c ON c.id=co.contract_id JOIN rooms room ON room.id=c.room_id WHERE co.id=:id FOR UPDATE").param("id",id).query().singleRow();long property=((Number)co.get("property_id")).longValue();scopeIds(p,property);if(!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw denied();if(p.activeRole()==RoleCode.MANAGER)new PropertyAuthorization(db,new SecurityAudit(db)).require(p,property,PropertyAuthorization.Capability.CONTRACT_APPROVE);if(((Number)co.get("version")).longValue()!=r.version()||co.get("actual_checkout_at")!=null||Set.of("COMPLETED","CANCELLED").contains(co.get("status"))||r.inspectionAt().isBefore(com.thangit.boardinghouse.service.BusinessTime.now()))throw new AuthException(HttpStatus.CONFLICT,"CHECKOUT_ASSIGNMENT_CONFLICT","Hồ sơ đã thay đổi, đã bàn giao hoặc lịch kiểm kê không hợp lệ.");if(db.sql("SELECT COUNT(*) FROM users u WHERE u.id=:user AND u.status='ACTIVE' AND (EXISTS(SELECT 1 FROM properties WHERE id=:property AND owner_id=u.id) OR EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id=:property AND pm.manager_id=u.id))").param("user",r.userId()).param("property",property).query(Long.class).single()!=1)throw denied();db.sql("UPDATE rental_checkouts SET handover_assignee_id=:user,inspection_scheduled_at=:at,version=version+1 WHERE id=:id").param("user",r.userId()).param("at",r.inspectionAt()).param("id",id).update();db.sql("INSERT INTO checkout_history(checkout_id,event_type,actor_id,description) VALUES(:id,'ASSIGNMENT_UPDATED',:actor,:text)").param("id",id).param("actor",p.id()).param("text","Phụ trách #"+r.userId()+"; lịch kiểm kê "+r.inspectionAt()+"; "+r.reason()).update();db.sql("INSERT INTO notifications(user_id,title,content,type,category) VALUES(:tenant,'Lịch kiểm kê trả phòng',:text,'CONTRACT','CONTRACT')").param("tenant",db.sql("SELECT tenant_id FROM contracts WHERE id=:id").param("id",co.get("contract_id")).query(Long.class).single()).param("text","Kiểm kê dự kiến "+r.inspectionAt()+"; hồ sơ #"+id+". Chưa xác nhận bàn giao hoặc quyết toán.").update();}
 private AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"CHECKOUT_WORKSPACE_DENIED","Không có quyền trong phạm vi nhà trọ này.");}
 private String scope(AuthenticatedUser p){if(p==null)throw denied();return switch(p.activeRole()){
  case OWNER->"p.owner_id=:actor";
  case MANAGER->"EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id=p.id AND pm.manager_id=:actor)";
  case ACCOUNTANT->"EXISTS(SELECT 1 FROM accountant_property_assignments a JOIN accountant_profiles ap ON ap.user_id=a.accountant_id WHERE a.property_id=p.id AND a.accountant_id=:actor)";
  default->throw denied();};}
 private List<Long> scopeIds(AuthenticatedUser p,Long property){String sql=scope(p);var ids=db.sql("SELECT p.id FROM properties p WHERE "+sql+" AND (:property IS NULL OR p.id=:property) ORDER BY p.id").param("actor",p.id()).param("property",property).query(Long.class).list();if(property!=null&&ids.isEmpty())throw denied();return ids;}
 public Map<String,Object> options(AuthenticatedUser p){var ids=scopeIds(p,null);var safe=ids.isEmpty()?List.of(-1L):ids;return Map.of(
  "properties",db.sql("SELECT p.id,p.name,op.organization_id organizationId,o.name organizationName FROM properties p LEFT JOIN organization_property_relationships op ON op.property_id=p.id AND op.ended_at IS NULL LEFT JOIN organizations o ON o.id=op.organization_id WHERE p.id IN (:ids) ORDER BY p.name").param("ids",safe).query().listOfRows(),
  "rooms",db.sql("SELECT id,code,property_id propertyId FROM rooms WHERE property_id IN (:ids) ORDER BY code").param("ids",safe).query().listOfRows(),
  "contracts",db.sql("SELECT c.id,c.code,u.full_name tenantName,r.code roomCode,r.property_id propertyId,NOT EXISTS(SELECT 1 FROM rental_checkouts co WHERE co.contract_id=c.id AND co.status<>'CANCELLED') canRequest FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN users u ON u.id=c.tenant_id WHERE r.property_id IN (:ids) AND c.status IN ('ACTIVE','EXPIRING','EXPIRED','TERMINATION_REQUESTED') ORDER BY c.id DESC").param("ids",safe).query().listOfRows(),
  "staff",db.sql("SELECT DISTINCT u.id,u.full_name name FROM users u WHERE u.id IN (SELECT handover_assignee_id FROM rental_checkouts co JOIN contracts c ON c.id=co.contract_id JOIN rooms r ON r.id=c.room_id WHERE r.property_id IN (:ids) UNION SELECT inspected_by FROM rental_checkouts co JOIN contracts c ON c.id=co.contract_id JOIN rooms r ON r.id=c.room_id WHERE r.property_id IN (:ids)) ORDER BY name").param("ids",safe).query().listOfRows(),
  "assignees",db.sql("SELECT u.id,u.full_name name,p.id propertyId FROM properties p JOIN users u ON u.id=p.owner_id WHERE p.id IN (:ids) UNION SELECT u.id,u.full_name,p.id FROM property_managers pm JOIN properties p ON p.id=pm.property_id JOIN users u ON u.id=pm.manager_id WHERE p.id IN (:ids) AND u.status='ACTIVE'").param("ids",safe).query().listOfRows(),"canRequest",p.activeRole()==RoleCode.OWNER||p.activeRole()==RoleCode.MANAGER);
 }
 public Map<String,Object> read(AuthenticatedUser p,Filter f){
  if(f.page()<0||f.size()<1||f.size()>100||f.from()!=null&&f.to()!=null&&(f.to().isBefore(f.from())||f.to().isAfter(f.from().plusYears(3))))throw new AuthException(HttpStatus.BAD_REQUEST,"CHECKOUT_FILTER_INVALID","Khoảng ngày hoặc phân trang không hợp lệ.");
  var ids=scopeIds(p,f.propertyId());if(f.organizationId()!=null)ids=db.sql("SELECT property_id FROM organization_property_relationships WHERE ended_at IS NULL AND organization_id=:org AND property_id IN (:ids)").param("org",f.organizationId()).param("ids",ids.isEmpty()?List.of(-1L):ids).query(Long.class).list();
  var args=new HashMap<String,Object>();args.put("ids",ids.isEmpty()?List.of(-1L):ids);args.put("actor",p.id());
  String readable=p.activeRole()==RoleCode.MANAGER?"EXISTS(SELECT 1 FROM manager_property_capabilities cap WHERE cap.manager_id=:actor AND cap.property_id=r.property_id AND cap.capability='FINANCE_READ')":"TRUE";
  String source="""
   SELECT co.id,CONCAT('CO-',co.id) code,co.contract_id,c.code contract_code,c.status contract_status,c.operational_ended_at,c.financially_closed_at,
    r.id room_id,r.code room_code,r.status room_status,r.property_id,p.name property_name,u.full_name tenant_name,c.tenant_profile_id,
    co.created_at,co.requested_date,co.confirmed_date,co.inspection_at,co.actual_checkout_at,co.status,co.workflow_stage,co.financial_status,
    co.inspection_scheduled_at,co.version,co.approved_version_id,co.settlement_applied_at,COALESCE(co.handover_assignee_id,co.inspected_by) assignee_id,actor.full_name assignee_name,
    EXISTS(SELECT 1 FROM checkout_disputes dis WHERE dis.checkout_id=co.id AND dis.status='OPEN') disputed,
    CASE WHEN co.inspection_at IS NULL THEN 'PENDING' ELSE 'RECORDED' END inspection_status,
    CASE WHEN EXISTS(SELECT 1 FROM deposit_refund_requests ref WHERE ref.checkout_id=co.id AND ref.status IN ('REQUESTED','APPROVED','PARTIAL')) THEN 'PENDING'
     WHEN EXISTS(SELECT 1 FROM deposit_refund_requests ref WHERE ref.checkout_id=co.id AND ref.status='PAID') THEN 'PAID' ELSE 'NONE' END refund_status,
    COALESCE(debt.amount,0) source_debt,COALESCE(d.balance_amount,0) source_deposit,
   """+readable+" can_open,"+
   " CASE WHEN "+readable+" THEN COALESCE(debt.amount,0) END current_debt, CASE WHEN "+readable+" THEN d.balance_amount END held_deposit"+
   " FROM rental_checkouts co JOIN contracts c ON c.id=co.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id JOIN users u ON u.id=c.tenant_id LEFT JOIN users actor ON actor.id=COALESCE(co.handover_assignee_id,co.inspected_by) LEFT JOIN tenant_deposits d ON d.contract_id=c.id LEFT JOIN (SELECT contract_id,SUM(remaining_amount) amount FROM invoices WHERE status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') GROUP BY contract_id) debt ON debt.contract_id=c.id";
  String stage="CASE WHEN s.status='CANCELLED' THEN 'CANCELLED' WHEN s.status='COMPLETED' THEN 'COMPLETED' WHEN s.disputed THEN 'DISPUTED' WHEN s.confirmed_date IS NULL THEN 'SCHEDULE_PENDING' WHEN s.inspection_at IS NULL THEN 'INSPECTION' WHEN s.approved_version_id IS NULL THEN 'SETTLEMENT' WHEN s.settlement_applied_at IS NULL THEN 'CONFIRMATION' WHEN NOT s.can_open THEN 'FINANCE_PENDING' WHEN s.source_debt>0 THEN 'DEBT' WHEN s.source_deposit>0 OR s.refund_status='PENDING' THEN 'REFUND' ELSE 'CLOSE_READY' END";
  String projection="SELECT s.*,"+stage+" stage FROM ("+source+") s";
  String where=" WHERE q.property_id IN (:ids)";
  if(f.from()!=null){where+=" AND q.requested_date>=:from";args.put("from",f.from());}if(f.to()!=null){where+=" AND q.requested_date<=:to";args.put("to",f.to());}
  if(f.roomId()!=null){where+=" AND q.room_id=:room";args.put("room",f.roomId());}
  if(f.keyword()!=null&&!f.keyword().isBlank()){where+=" AND (q.code LIKE :keyword OR q.contract_code LIKE :keyword OR q.room_code LIKE :keyword OR q.tenant_name LIKE :keyword)";args.put("keyword","%"+f.keyword().trim()+"%");}
  if(f.stage()!=null&&!f.stage().isBlank()){where+=" AND q.stage=:stage";args.put("stage",f.stage());}
  if(f.financialStatus()!=null&&!f.financialStatus().isBlank()){where+=" AND q.financial_status=:financial";args.put("financial",f.financialStatus());}
  if(f.assignee()!=null){where+=" AND q.assignee_id=:assignee";args.put("assignee",f.assignee());}
  if(f.disputed()!=null){where+=" AND q.disputed=:disputed";args.put("disputed",f.disputed());}
  var summary=db.sql("SELECT q.stage,COUNT(*) count FROM ("+projection+") q"+where+" GROUP BY q.stage").params(args).query().listOfRows();
  long total=db.sql("SELECT COUNT(*) FROM ("+projection+") q"+where).params(args).query(Long.class).single();args.put("limit",f.size());args.put("offset",(long)f.page()*f.size());
  var rows=db.sql("SELECT * FROM ("+projection+") q"+where+" ORDER BY q.created_at DESC,q.id DESC LIMIT :limit OFFSET :offset").params(args).query().listOfRows();for(var row:rows){row.remove("source_debt");row.remove("source_deposit");}
  return Map.of("rows",rows,"summary",summary,"totalElements",total,"totalPages",(total+f.size()-1)/f.size(),"page",f.page(),"dateBasis","REQUESTED_DATE","phaseBasis","DERIVED_FROM_EXISTING_WORKFLOW");
 }
}
