package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.AdminInvoiceRepository;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoicePaymentPolicyService {
    public record Save(@Positive long propertyId,@Min(0) long version,@Min(1) @Max(31) Integer openingDay,@Min(-1) @Max(1) int monthOffset,@NotBlank @Size(max=1000) String reason){}
    private final JdbcClient db;
    public InvoicePaymentPolicyService(JdbcClient db){this.db=db;}
    private void access(AuthenticatedUser p,long property){if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER,RoleCode.ACCOUNTANT).contains(p.activeRole())||!new AdminInvoiceRepository(db).canAccess(p.id(),p.activeRole(),property))throw new AuthException(HttpStatus.FORBIDDEN,"INVOICE_POLICY_ACCESS_DENIED","Không có quyền xem chính sách thanh toán của nhà trọ.");}
    @Transactional(readOnly=true) public Map<String,Object> get(AuthenticatedUser p,long property,LocalDate period){access(p,property);var data=new LinkedHashMap<>(db.sql("SELECT invoice_payment_open_day openingDay,invoice_payment_open_month_offset monthOffset,invoice_payment_policy_version version FROM properties WHERE id=:id").param("id",property).query().singleRow());data.put("timezone",InvoicePaymentRules.ZONE.getId());data.put("dateRule","CLAMP_TO_MONTH_END");data.put("canConfigure",p.activeRole()==RoleCode.OWNER);data.put("openingDate",resolve(db,property,period));return data;}
    public static LocalDate resolve(JdbcClient db,long property,LocalDate period){var policy=db.sql("SELECT invoice_payment_open_day,invoice_payment_open_month_offset FROM properties WHERE id=:id").param("id",property).query().singleRow();return policy.get("invoice_payment_open_day")==null?null:BillingCalendar.day(YearMonth.from(period).plusMonths(((Number)policy.get("invoice_payment_open_month_offset")).longValue()),((Number)policy.get("invoice_payment_open_day")).intValue());}
    @Transactional public void save(AuthenticatedUser p,Save request){access(p,request.propertyId());if(p.activeRole()!=RoleCode.OWNER)throw new AuthException(HttpStatus.FORBIDDEN,"INVOICE_POLICY_OWNER_REQUIRED","Chỉ chủ nhà cấu hình chính sách cho hóa đơn mới.");var before=db.sql("SELECT invoice_payment_open_day,invoice_payment_open_month_offset,invoice_payment_policy_version FROM properties WHERE id=:id FOR UPDATE").param("id",request.propertyId()).query().singleRow();if(db.sql("UPDATE properties SET invoice_payment_open_day=:day,invoice_payment_open_month_offset=:offset,invoice_payment_policy_version=invoice_payment_policy_version+1 WHERE id=:id AND owner_id=:owner AND invoice_payment_policy_version=:version").param("day",request.openingDay()).param("offset",request.monthOffset()).param("id",request.propertyId()).param("owner",p.id()).param("version",request.version()).update()!=1)throw new AuthException(HttpStatus.CONFLICT,"INVOICE_POLICY_VERSION_CONFLICT","Chính sách đã thay đổi; tải lại trước khi lưu.");new SecurityAudit(db).record(p.id(),"INVOICE_PAYMENT_POLICY_CHANGED","PROPERTY",request.propertyId(),"SUCCESS","before="+before+"; after="+request);}
}
