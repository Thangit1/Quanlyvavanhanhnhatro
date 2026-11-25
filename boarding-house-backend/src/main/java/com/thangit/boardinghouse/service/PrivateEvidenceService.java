package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.security.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
public class PrivateEvidenceService {
 public record File(String name,String type,byte[] content){}
 private final JdbcClient db;private final PropertyAuthorization access;private final SecurityAudit audit;
 public PrivateEvidenceService(JdbcClient db,PropertyAuthorization access,SecurityAudit audit){this.db=db;this.access=access;this.audit=audit;}
 @Transactional public File proof(AuthenticatedUser p,long id){
  if(p==null)throw missing();
  var proof=db.sql("SELECT f.id,f.tenant_id,f.original_name,f.mime_type,f.file_content,i.tenant_id invoice_tenant,i.property_id FROM tenant_payment_proofs f JOIN invoices i ON i.id=f.invoice_id WHERE f.id=:id").param("id",id).query().listOfRows().stream().findFirst().orElseThrow(this::missing);
  long property=((Number)proof.get("property_id")).longValue();
  if(p.activeRole()==RoleCode.TENANT){if(((Number)proof.get("tenant_id")).longValue()!=p.id()||((Number)proof.get("invoice_tenant")).longValue()!=p.id())throw missing();}
  else if(p.activeRole()==RoleCode.ACCOUNTANT){if(db.sql("SELECT COUNT(*) FROM accountant_profiles ap JOIN accountant_property_assignments a ON a.accountant_id=ap.user_id WHERE ap.user_id=:user AND a.property_id=:property").param("user",p.id()).param("property",property).query(Long.class).single()!=1)throw missing();}
  else if(p.activeRole()==RoleCode.OWNER||p.activeRole()==RoleCode.MANAGER)access.require(p,property,PropertyAuthorization.Capability.FINANCE_READ);
  else throw missing();
  audit.record(p.id(),"PRIVATE_EVIDENCE_DOWNLOADED","PAYMENT_PROOF",id,"SUCCESS",null);
  return new File(proof.get("original_name").toString(),proof.get("mime_type").toString(),(byte[])proof.get("file_content"));
 }
 private AuthException missing(){return new AuthException(HttpStatus.NOT_FOUND,"EVIDENCE_NOT_FOUND","Không tìm thấy minh chứng trong phạm vi được phép.");}
}
