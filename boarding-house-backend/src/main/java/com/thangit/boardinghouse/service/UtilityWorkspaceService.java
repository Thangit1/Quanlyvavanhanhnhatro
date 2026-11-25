package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.security.PropertyAuthorization.Capability;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Projection over existing billing sources. Bulk operations commit independently per contract. */
@Service
public class UtilityWorkspaceService {
    public record Line(@Positive long contractId,@NotNull @Valid MonthlyBillingService.Reading reading){}
    public record Bulk(@NotEmpty @Size(max=50) List<Line> rows){}
    public record WarningPolicy(@Positive long propertyId,@Min(0) long version,@NotNull @DecimalMin(value="1",inclusive=false) @DecimalMax("1000") @Digits(integer=4,fraction=3) java.math.BigDecimal highMultiplier,boolean warnZero,@NotBlank @Size(max=1000) String reason){}
    private final JdbcClient db;
    private final MonthlyBillingService billing;
    private final Validator validator;
    public UtilityWorkspaceService(JdbcClient db,MonthlyBillingService billing,Validator validator){this.db=db;this.billing=billing;this.validator=validator;}
    @org.springframework.transaction.annotation.Transactional
    public void warningPolicy(AuthenticatedUser p,WarningPolicy request){
        scope(p,request.propertyId());
        if(p.activeRole()!=RoleCode.OWNER)throw new AuthException(HttpStatus.FORBIDDEN,"UTILITY_POLICY_OWNER_REQUIRED","Chỉ chủ nhà cấu hình ngưỡng rà soát.");
        var before=db.sql("SELECT utility_high_usage_multiplier,utility_warn_zero,utility_warning_version FROM properties WHERE id=:id FOR UPDATE").param("id",request.propertyId()).query().singleRow();
        if(db.sql("UPDATE properties SET utility_high_usage_multiplier=:ratio,utility_warn_zero=:zero,utility_warning_version=utility_warning_version+1 WHERE id=:id AND owner_id=:owner AND utility_warning_version=:version").param("ratio",request.highMultiplier()).param("zero",request.warnZero()).param("id",request.propertyId()).param("owner",p.id()).param("version",request.version()).update()!=1)throw new AuthException(HttpStatus.CONFLICT,"UTILITY_POLICY_VERSION_CONFLICT","Cấu hình đã thay đổi; tải lại trước khi lưu.");
        new com.thangit.boardinghouse.security.SecurityAudit(db).record(p.id(),"UTILITY_WARNING_POLICY_CHANGED","PROPERTY",request.propertyId(),"SUCCESS","before="+before+"; after="+request);
    }
    private boolean scope(AuthenticatedUser p,long property){
        if(p==null)throw new AuthException(HttpStatus.FORBIDDEN,"UTILITY_ACCESS_DENIED","Không có quyền xem điện nước.");
        var guard=new RoomLifecycleGuard(db);
        if(Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole())){
            guard.access(p,property);
            if(p.activeRole()==RoleCode.MANAGER)guard.capability(p,property,Capability.FINANCE_READ);
            return p.activeRole()==RoleCode.OWNER||db.sql("SELECT COUNT(*) FROM manager_property_capabilities WHERE manager_id=:id AND property_id=:p AND capability='FINANCE_WRITE'").param("id",p.id()).param("p",property).query(Long.class).single()>0;
        }
        if(p.activeRole()==RoleCode.ACCOUNTANT&&db.sql("SELECT COUNT(*) FROM accountant_property_assignments WHERE accountant_id=:id AND property_id=:p").param("id",p.id()).param("p",property).query(Long.class).single()>0)return false;
        throw new AuthException(HttpStatus.FORBIDDEN,"UTILITY_ACCESS_DENIED","Nhà trọ không thuộc phạm vi được phân quyền.");
    }
    public Map<String,Object> workspace(AuthenticatedUser p,long property,LocalDate period){
        boolean write=scope(p,property);
        if(period.getDayOfMonth()!=1)throw MonthlyBillingService.fail("BILLING_PERIOD_INVALID","Kỳ phải là ngày đầu tháng.");
        var contracts=db.sql("""
            SELECT c.id,c.code,c.status contract_status,r.id room_id,r.code room_code,tp.full_name tenant_name
            FROM contracts c JOIN rooms r ON r.id=c.room_id LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id
            WHERE r.property_id=:property AND c.status IN ('ACTIVE','EXPIRING','TERMINATION_REQUESTED','SETTLING','EXPIRED','TERMINATED')
            AND c.start_date<:end AND c.end_date>=:period
            AND EXISTS(SELECT 1 FROM rental_checkins ci WHERE ci.contract_id=c.id AND ci.actual_checkin_at IS NOT NULL AND ci.actual_checkin_at<:end)
            AND NOT EXISTS(SELECT 1 FROM rental_checkouts co WHERE co.contract_id=c.id AND co.actual_checkout_at<=:period)
            AND EXISTS(SELECT 1 FROM contract_utility_rates ur WHERE ur.contract_id=c.id AND ur.calculation_method='METER' AND ur.code IN ('ELECTRICITY','WATER'))
            ORDER BY r.code,c.id
            """).param("property",property).param("period",period).param("end",period.plusMonths(1)).query().listOfRows();
        var rows=new ArrayList<Map<String,Object>>();
        for(var contract:contracts){
            long id=((Number)contract.get("id")).longValue();var row=new LinkedHashMap<String,Object>(contract);
            try{
                var detail=billing.detail(p,id,period);row.put("detail",detail);
                var rates=db.sql("SELECT code,calculation_method,unit_price,unit FROM contract_utility_rates WHERE contract_id=:id AND code IN ('ELECTRICITY','WATER') ORDER BY code").param("id",id).query().listOfRows();
                for(var rate:rates)rate.put("effectivePrice",billing.price(id,rate.get("code").toString(),period,MonthlyBillingService.money(rate.get("unit_price"))));
                row.put("policies",rates);
                row.put("replacements",db.sql("SELECT e.* FROM utility_meter_events e WHERE e.contract_id=:id AND e.billing_period=:period ORDER BY e.occurred_at,e.id").param("id",id).param("period",period).query().listOfRows());
                row.put("comparison",db.sql("SELECT electricity_consumption,water_consumption FROM utility_readings WHERE contract_id=:id AND billing_period=:period AND reading_status='CONFIRMED'").param("id",id).param("period",period.minusMonths(1)).query().listOfRows().stream().findFirst().orElse(Map.of()));
                boolean locked=db.sql("SELECT COUNT(*) FROM invoices WHERE contract_id=:id AND billing_period>=:period AND status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED')").param("id",id).param("period",period).query(Long.class).single()>0;
                locked=locked||db.sql("SELECT COUNT(*) FROM accounting_periods WHERE property_id=:id AND :period BETWEEN start_date AND end_date AND status='CLOSED'").param("id",property).param("period",period).query(Long.class).single()>0;
                row.put("locked",locked);row.put("canWrite",write&&!locked&&!"TERMINATED".equals(contract.get("contract_status"))&&!period.isAfter(com.thangit.boardinghouse.service.BusinessTime.today(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).withDayOfMonth(1)));
            }catch(AuthException error){row.put("error",error.getMessage());row.put("code",error.code());row.put("canWrite",false);}
            rows.add(row);
        }
        var policy=db.sql("SELECT utility_high_usage_multiplier highMultiplier,utility_warn_zero warnZero,utility_warning_version version FROM properties WHERE id=:id").param("id",property).query().singleRow();
        return Map.of("propertyId",property,"period",period,"canWrite",write,"rows",rows,"supportedPricing",List.of("METER","FIXED"),"warningPolicy",policy);
    }
    // Deliberately no outer transaction: one failed row must not roll back a successful room.
    public List<Map<String,Object>> bulk(AuthenticatedUser p,Bulk request){
        if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"UTILITY_WRITE_DENIED","Không có quyền chốt chỉ số.");
        if(request.rows()==null||request.rows().isEmpty()||request.rows().size()>50)throw MonthlyBillingService.fail("BULK_SIZE_INVALID","Mỗi lần chốt từ 1 đến 50 hợp đồng.");
        var seen=new HashSet<Long>();var result=new ArrayList<Map<String,Object>>();
        for(int index=0;index<request.rows().size();index++){
            var line=request.rows().get(index);var out=new LinkedHashMap<String,Object>();out.put("index",index);
            if(line!=null)out.put("contractId",line.contractId());
            try{
                if(line==null||!validator.validate(line).isEmpty())throw MonthlyBillingService.fail("READING_INVALID","Thiếu dữ liệu, chứng từ hoặc chỉ số không hợp lệ.");
                if(!seen.add(line.contractId()))throw MonthlyBillingService.fail("BULK_DUPLICATE_CONTRACT","Hợp đồng bị lặp trong cùng lần gửi.");
                out.put("reading",billing.record(p,line.contractId(),line.reading()));out.put("success",true);
            }catch(AuthException error){out.put("success",false);out.put("code",error.code());out.put("message",error.getMessage());}
            catch(org.springframework.dao.DataAccessException error){out.put("success",false);out.put("code","CONCURRENT_UPDATE");out.put("message","Dữ liệu thay đổi đồng thời. Tải lại và đối chiếu trước khi thử lại.");}
            catch(RuntimeException error){out.put("success",false);out.put("code","ROW_FAILED");out.put("message","Không thể chốt dòng này. Kiểm tra dữ liệu và thử lại; không tự sửa lịch sử.");}
            result.add(out);
        }
        return result;
    }
}
