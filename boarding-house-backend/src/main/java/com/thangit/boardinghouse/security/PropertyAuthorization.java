package com.thangit.boardinghouse.security;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.common.exception.AuthException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.constraints.*;
import java.util.*;
@Service
public class PropertyAuthorization {
 public enum Capability { FINANCE_READ,FINANCE_WRITE,DEPOSIT_APPROVE,CONTRACT_APPROVE,EXPORT }
 public record ManagerAssignment(@NotNull @Positive Long userId,@NotNull @Size(max=5) Set<Capability> capabilities,@NotBlank @Size(max=500) String reason){}
 public void requireExport(AuthenticatedUser p,Long property){if(p.activeRole()!=RoleCode.MANAGER)return;if(property!=null){require(p,property,Capability.EXPORT);return;}for(long id:db.sql("SELECT property_id FROM property_managers WHERE manager_id=:user").param("user",p.id()).query(Long.class).list())require(p,id,Capability.EXPORT);}
 private final JdbcClient db;private final SecurityAudit audit;
 public PropertyAuthorization(JdbcClient db,SecurityAudit audit){this.db=db;this.audit=audit;}
 public void require(AuthenticatedUser p,long property,Capability capability){
  if(p==null)throw denied();
  if(p.activeRole()==RoleCode.OWNER&&owns(p,property))return;
  if(p.activeRole()==RoleCode.MANAGER&&db.sql("SELECT COUNT(*) FROM property_managers pm JOIN manager_property_capabilities c ON c.manager_id=pm.manager_id AND c.property_id=pm.property_id WHERE pm.manager_id=:user AND pm.property_id=:property AND c.capability=:capability").param("user",p.id()).param("property",property).param("capability",capability.name()).query(Long.class).single()==1)return;
  throw denied();
 }
 private boolean owns(AuthenticatedUser p,long property){return db.sql("SELECT COUNT(*) FROM properties WHERE id=:id AND owner_id=:user").param("id",property).param("user",p.id()).query(Long.class).single()==1;}
 @Transactional public void assignManager(AuthenticatedUser p,long property,ManagerAssignment r){
  if(p==null||p.activeRole()!=RoleCode.OWNER||!owns(p,property))throw denied();
  db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",p.id()).query(Long.class).single();
  if(db.sql("SELECT COUNT(*) FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=:id AND u.status='ACTIVE' AND r.code='MANAGER'").param("id",r.userId()).query(Long.class).single()!=1)throw new AuthException(HttpStatus.BAD_REQUEST,"MANAGER_ROLE_REQUIRED","Tài khoản phải có vai trò quản lý được cấp từ trước.");
  db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:property,:manager) ON DUPLICATE KEY UPDATE manager_id=VALUES(manager_id)").param("property",property).param("manager",r.userId()).update();
  var before=db.sql("SELECT capability FROM manager_property_capabilities WHERE manager_id=:manager AND property_id=:property").param("manager",r.userId()).param("property",property).query(String.class).list();
  db.sql("DELETE FROM manager_property_capabilities WHERE manager_id=:manager AND property_id=:property").param("manager",r.userId()).param("property",property).update();
  for(var capability:r.capabilities())db.sql("INSERT INTO manager_property_capabilities(manager_id,property_id,capability,granted_by) VALUES(:manager,:property,:capability,:actor)").param("manager",r.userId()).param("property",property).param("capability",capability.name()).param("actor",p.id()).update();
  audit.record(p.id(),"MANAGER_ASSIGNED","PROPERTY",property,"SUCCESS","manager="+r.userId()+"; previous="+before+"; capabilities="+r.capabilities()+"; "+r.reason());
 }
 @Transactional public void revokeManager(AuthenticatedUser p,long property,long manager,String reason){if(p==null||p.activeRole()!=RoleCode.OWNER||!owns(p,property))throw denied();db.sql("SELECT id FROM users WHERE id=:id FOR UPDATE").param("id",p.id()).query(Long.class).single();db.sql("DELETE FROM manager_property_capabilities WHERE property_id=:property AND manager_id=:manager").param("property",property).param("manager",manager).update();db.sql("DELETE FROM property_managers WHERE property_id=:property AND manager_id=:manager").param("property",property).param("manager",manager).update();audit.record(p.id(),"MANAGER_REVOKED","PROPERTY",property,"SUCCESS","manager="+manager+"; "+reason);}
 @Transactional(readOnly=true) public Map<String,Object> detail(AuthenticatedUser p,long property){if(p==null||p.activeRole()!=RoleCode.OWNER||!owns(p,property))throw denied();return Map.of("assignments",db.sql("SELECT pm.manager_id,u.full_name FROM property_managers pm JOIN users u ON u.id=pm.manager_id WHERE pm.property_id=:id").param("id",property).query().listOfRows(),"capabilities",db.sql("SELECT manager_id,capability,source FROM manager_property_capabilities WHERE property_id=:id ORDER BY manager_id,capability").param("id",property).query().listOfRows());}
 private AuthException denied(){return new AuthException(HttpStatus.FORBIDDEN,"PROPERTY_CAPABILITY_DENIED","Không được cấp quyền cho thao tác trong khu trọ này.");}
}
