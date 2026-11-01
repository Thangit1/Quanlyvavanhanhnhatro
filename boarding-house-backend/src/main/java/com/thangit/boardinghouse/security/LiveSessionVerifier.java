package com.thangit.boardinghouse.security;
import java.time.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.thangit.boardinghouse.common.exception.AuthException;
import org.springframework.http.HttpStatus;
@Service
public class LiveSessionVerifier {
 private final JdbcClient db;
 public LiveSessionVerifier(JdbcClient db){this.db=db;}
 @Transactional(readOnly=true) public AuthenticatedUser verify(AuthenticatedUser token){
  var user=db.sql("SELECT id,email,status,locked_until,password_changed_at,security_version FROM users WHERE id=:id").param("id",token.id()).query().listOfRows().stream().findFirst().orElseThrow(this::invalid);
  if(!"ACTIVE".equals(user.get("status"))||future(user.get("locked_until")))throw invalid();
  if((token.securityVersion()==null?0:token.securityVersion())!=((Number)user.get("security_version")).longValue())throw invalid();
  if(token.issuedAt()==null||token.issuedAt().isAfter(Instant.now().plusSeconds(30)))throw invalid();
  if(db.sql("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=:id AND r.code=:role").param("id",token.id()).param("role",token.activeRole().name()).query(Long.class).single()!=1)throw invalid();
  if(token.sessionFamily()!=null&&db.sql("SELECT COUNT(*) FROM refresh_tokens WHERE user_id=:id AND family_id=:family AND active_role=:role AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(6)").param("id",token.id()).param("family",token.sessionFamily()).param("role",token.activeRole().name()).query(Long.class).single()==0)throw invalid();
  return new AuthenticatedUser(token.id(),user.get("email").toString(),token.activeRole(),token.securityVersion(),token.issuedAt(),token.sessionFamily());
 }
 @Transactional public void logout(AuthenticatedUser p){if(p==null||p.sessionFamily()==null)return;db.sql("UPDATE refresh_tokens SET revoked_at=UTC_TIMESTAMP(6) WHERE user_id=:user AND family_id=:family AND revoked_at IS NULL").param("user",p.id()).param("family",p.sessionFamily()).update();}
 private boolean future(Object at){return at!=null&&instant(at).isAfter(Instant.now());}
 private Instant instant(Object value){if(value instanceof java.sql.Timestamp t)return t.toInstant();if(value instanceof Instant i)return i;return ((LocalDateTime)value).toInstant(ZoneOffset.UTC);}
 private AuthException invalid(){return new AuthException(HttpStatus.UNAUTHORIZED,"SESSION_REVOKED","Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.");}
}
