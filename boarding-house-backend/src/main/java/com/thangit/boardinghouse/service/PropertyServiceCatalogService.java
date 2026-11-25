package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.AgreedService;
import com.thangit.boardinghouse.security.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PropertyServiceCatalogService {
    public record Save(@NotNull @Valid AgreedService service,
        @NotBlank @Pattern(regexp="UTILITY|PARKING|CLEANING|EQUIPMENT|OTHER") String category,
        boolean recommended,boolean allowPriceOverride,@NotNull @Min(0) Long version,
        @NotBlank @Size(max=1000) String reason) {}
    private final JdbcClient db;
    public PropertyServiceCatalogService(JdbcClient db){this.db=db;}
    private AuthException fail(String code,String text){return new AuthException(HttpStatus.BAD_REQUEST,code,text);}
    private void access(AuthenticatedUser p,long property){
        if(p==null||!Set.of(RoleCode.OWNER,RoleCode.MANAGER).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"SERVICE_ACCESS_DENIED","Không có quyền truy cập dịch vụ nhà trọ.");
        new RoomLifecycleGuard(db).access(p,property);
    }
    private boolean override(long actor,long property){return db.sql("SELECT COUNT(*) FROM properties p WHERE p.id=:property AND (p.owner_id=:actor OR EXISTS(SELECT 1 FROM manager_property_capabilities m WHERE m.property_id=p.id AND m.manager_id=:actor AND m.capability='FINANCE_WRITE'))").param("property",property).param("actor",actor).query(Long.class).single()==1;}
    @Transactional(readOnly=true) public Map<String,Object> list(AuthenticatedUser p,long property){access(p,property);return Map.of("items",items(property),"canConfigure",p.activeRole()==RoleCode.OWNER,"canOverride",override(p.id(),property),"history",db.sql("SELECT h.id,h.content,h.reason,h.created_at,u.full_name actor_name FROM billing_configuration_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.owner_id=(SELECT owner_id FROM properties WHERE id=:property) AND h.content LIKE :prefix ORDER BY h.id DESC LIMIT 50").param("property",property).param("prefix","PROPERTY_SERVICE property="+property+";%").query().listOfRows());}
    public List<Map<String,Object>> items(long property){return db.sql("SELECT * FROM property_service_catalog WHERE property_id=:id ORDER BY category,name,id").param("id",property).query().listOfRows();}
    @Transactional public long save(AuthenticatedUser p,long property,Long id,Save request){
        access(p,property);
        if(p.activeRole()!=RoleCode.OWNER)throw new AuthException(HttpStatus.FORBIDDEN,"SERVICE_CONFIGURATION_DENIED","Chỉ chủ nhà được cấu hình bảng giá gốc.");
        db.sql("SELECT id FROM properties WHERE id=:id FOR UPDATE").param("id",property).query(Long.class).single();
        var before=id==null?Map.of():db.sql("SELECT * FROM property_service_catalog WHERE id=:id AND property_id=:property FOR UPDATE").param("id",id).param("property",property).query().listOfRows().stream().findFirst().orElse(Map.of());
        var s=request.service();validate(s,LocalDate.of(1900,1,1),LocalDate.of(9999,12,31));
        var same=db.sql("SELECT id FROM property_service_catalog WHERE property_id=:p AND code=:code").param("p",property).param("code",s.code().trim()).query(Long.class).optional();
        if(same.isPresent()&&!Objects.equals(same.get(),id))throw fail("SERVICE_DUPLICATE","Mã dịch vụ đã tồn tại tại nhà trọ.");
        var params=new HashMap<String,Object>();params.put("property",property);params.put("code",s.code().trim().toUpperCase(Locale.ROOT));params.put("name",s.name().trim());params.put("description",s.description());params.put("category",request.category());params.put("method",s.calculationMethod());params.put("price",s.unitPrice());params.put("unit",unit(s));params.put("qty",quantity(s));params.put("cycle",cycle(s));params.put("status",Objects.toString(s.status(),"ACTIVE"));params.put("recommended",request.recommended());params.put("override",request.allowPriceOverride());params.put("prorate",s.prorate());params.put("actor",p.id());params.put("version",request.version());
        if(id==null){var keys=new GeneratedKeyHolder();db.sql("INSERT INTO property_service_catalog(property_id,code,name,description,category,calculation_method,unit_price,unit,quantity,billing_cycle,status,is_default,allow_price_override,prorate,updated_by) VALUES(:property,:code,:name,:description,:category,:method,:price,:unit,:qty,:cycle,:status,:recommended,:override,:prorate,:actor)").params(params).update(keys,"id");id=keys.getKey().longValue();}
        else {params.put("id",id);if(db.sql("UPDATE property_service_catalog SET code=:code,name=:name,description=:description,category=:category,calculation_method=:method,unit_price=:price,unit=:unit,quantity=:qty,billing_cycle=:cycle,status=:status,is_default=:recommended,allow_price_override=:override,prorate=:prorate,updated_by=:actor,version=version+1 WHERE id=:id AND property_id=:property AND version=:version").params(params).update()!=1)throw new AuthException(HttpStatus.CONFLICT,"SERVICE_VERSION_CONFLICT","Bảng giá đã thay đổi hoặc dịch vụ không thuộc nhà trọ.");}
        db.sql("INSERT INTO billing_configuration_history(owner_id,actor_id,content,reason) SELECT owner_id,:actor,:content,:reason FROM properties WHERE id=:property").param("property",property).param("actor",p.id()).param("content","PROPERTY_SERVICE property="+property+"; before="+before+"; after="+params).param("reason",request.reason()).update();
        new SecurityAudit(db).record(p.id(),"PROPERTY_SERVICE_SAVED","PROPERTY",property,"SUCCESS","service="+id+"; "+request.reason());return id;
    }
    public static String cycle(AgreedService s){return s.billingCycle()!=null?s.billingCycle():switch(s.calculationMethod()){case "USAGE"->"ON_USAGE";case "ONCE"->"ONCE";default->"MONTHLY";};}
    public static String unit(AgreedService s){return s.unit()==null?"tháng":s.unit();}
    public static BigDecimal quantity(AgreedService s){return s.quantity()==null?BigDecimal.ONE:s.quantity();}
    private void validate(AgreedService s,LocalDate start,LocalDate end){
        if(s.code()==null||s.code().isBlank()||s.code().length()>30||s.name()==null||s.name().isBlank()||s.name().length()>100||s.unitPrice()==null||s.unitPrice().signum()<0||s.unitPrice().precision()-s.unitPrice().scale()>13||s.unitPrice().scale()>2||quantity(s).signum()<=0||quantity(s).compareTo(new BigDecimal("999999999"))>0||quantity(s).scale()>3)throw fail("SERVICE_INVALID","Tên, mã, đơn giá hoặc số lượng dịch vụ không hợp lệ.");
        if(!Set.of("FIXED","PER_PERSON","QUANTITY","USAGE","ONCE").contains(s.calculationMethod())||!Set.of("ACTIVE","INACTIVE").contains(Objects.toString(s.status(),"ACTIVE")))throw fail("SERVICE_INVALID","Cách tính hoặc trạng thái dịch vụ không hợp lệ.");
        String expected=switch(s.calculationMethod()){case "USAGE"->"ON_USAGE";case "ONCE"->"ONCE";default->"MONTHLY";};
        if(!expected.equals(cycle(s))||unit(s).isBlank()||unit(s).length()>30||s.prorate()&&Set.of("USAGE","ONCE").contains(s.calculationMethod()))throw fail("SERVICE_CYCLE_INVALID","Chu kỳ/đơn vị hoặc phân bổ không phù hợp cách tính dịch vụ.");
        LocalDate effective=s.effectiveDate()==null?start:s.effectiveDate();
        if(effective.isBefore(start)||!effective.isBefore(end)||s.endDate()!=null&&(!s.endDate().isAfter(effective)||s.endDate().isAfter(end)))throw fail("SERVICE_DATES_INVALID","Thời gian dịch vụ phải nằm trong thời hạn thuê; ngày ngừng không tính phí.");
        if(s.description()!=null&&s.description().length()>5000||s.note()!=null&&s.note().length()>2000)throw fail("SERVICE_TEXT_TOO_LONG","Mô tả tối đa 5000 và ghi chú tối đa 2000 ký tự.");
        if(Set.of("ELECTRICITY","WATER","ROOM_RENT").contains(s.code().trim().toUpperCase(Locale.ROOT)))throw fail("SERVICE_DUPLICATE","Điện, nước và tiền thuê đã có chính sách riêng.");
        if("FIXED".equals(s.calculationMethod())&&quantity(s).compareTo(BigDecimal.ONE)!=0)throw fail("SERVICE_QUANTITY_INVALID","Hợp đồng áp dụng một phòng; dùng cách tính theo số lượng cho xe/thiết bị.");
    }
    public void snapshots(long contract,List<AgreedService> services,long actor){
        if(services==null)return;if(services.size()>30)throw fail("SERVICE_LIMIT","Tối đa 30 dịch vụ trong một hợp đồng.");
        var c=db.sql("SELECT c.start_date,c.end_date,r.property_id FROM contracts c JOIN rooms r ON r.id=c.room_id WHERE c.id=:id").param("id",contract).query().singleRow();
        var codes=new HashSet<String>();var names=new HashSet<String>();var pending=new ArrayList<Map<String,Object>>();
        for(var s:services){validate(s,RoomLifecycleGuard.date(c.get("start_date")),RoomLifecycleGuard.date(c.get("end_date")));
            if(!codes.add(s.code().trim().toUpperCase(Locale.ROOT))||!names.add(s.name().trim().toLowerCase(Locale.ROOT)))throw fail("SERVICE_DUPLICATE","Không thêm trùng mã hoặc tên dịch vụ trong hợp đồng.");
            if(s.catalogServiceId()!=null){
                var catalog=db.sql("SELECT * FROM property_service_catalog WHERE id=:id AND property_id=:property FOR SHARE").param("id",s.catalogServiceId()).param("property",c.get("property_id")).query((rs,n)->{var row=new HashMap<String,Object>();var md=rs.getMetaData();for(int i=1;i<=md.getColumnCount();i++)row.put(md.getColumnLabel(i),rs.getObject(i));return row;}).optional().orElseThrow(()->fail("SERVICE_SCOPE_INVALID","Dịch vụ không thuộc nhà trọ đã chọn."));
                boolean retained=db.sql("SELECT COUNT(*) FROM contract_services WHERE contract_id=:id AND catalog_service_id=:catalog AND code=:code AND calculation_method=:method AND unit_price=:price AND unit=:unit AND billing_cycle=:cycle AND prorate=:prorate").param("id",contract).param("catalog",s.catalogServiceId()).param("code",s.code()).param("method",s.calculationMethod()).param("price",s.unitPrice()).param("unit",unit(s)).param("cycle",cycle(s)).param("prorate",s.prorate()).query(Long.class).single()>0;
                if(!retained&&(!"ACTIVE".equals(catalog.get("status"))||!s.code().equalsIgnoreCase(catalog.get("code").toString())))throw fail("SERVICE_CATALOG_CHANGED","Dịch vụ đã ngừng hoặc mã không khớp bảng giá; kiểm tra lại lựa chọn.");
                boolean editable=override(actor,((Number)c.get("property_id")).longValue());
                if(!retained&&(!editable||!Boolean.TRUE.equals(catalog.get("allow_price_override")))){
                    if(s.unitPrice().compareTo((BigDecimal)catalog.get("unit_price"))!=0||!s.calculationMethod().equals(catalog.get("calculation_method"))||!cycle(s).equals(catalog.get("billing_cycle"))||!unit(s).equals(catalog.get("unit"))||s.prorate()!=Boolean.TRUE.equals(catalog.get("prorate")))throw fail("SERVICE_PRICE_CHANGED","Giá hoặc cách tính phải khớp cấu hình nhà trọ; tải lại và xác nhận bảng giá mới.");
                }
            }else if(!override(actor,((Number)c.get("property_id")).longValue()))throw new AuthException(HttpStatus.FORBIDDEN,"SERVICE_OVERRIDE_DENIED","Cần quyền tài chính để thỏa thuận dịch vụ tùy chỉnh.");
            boolean extended=s.unit()!=null||s.billingCycle()!=null||s.description()!=null||s.quantity()!=null||s.catalogServiceId()!=null||s.note()!=null||s.status()!=null||s.effectiveDate()!=null||s.endDate()!=null||s.prorate()||!Set.of("FIXED","PER_PERSON").contains(s.calculationMethod());
            var params=new HashMap<String,Object>();params.put("id",contract);params.put("catalog",s.catalogServiceId());params.put("code",s.code());params.put("name",s.name());params.put("description",s.description());params.put("method",s.calculationMethod());params.put("price",s.unitPrice());params.put("unit",unit(s));params.put("qty",quantity(s));params.put("cycle",extended?cycle(s):"MONTHLY");params.put("start",s.effectiveDate()==null?c.get("start_date"):s.effectiveDate());params.put("end",s.endDate());params.put("status",Objects.toString(s.status(),"ACTIVE"));params.put("note",s.note());params.put("prorate",s.prorate());params.put("extended",extended?1:0);
            pending.add(params);
        }
        if(db.sql("SELECT COUNT(*) FROM service_period_usage u JOIN contract_services s ON s.id=u.service_id WHERE s.contract_id=:id").param("id",contract).query(Long.class).single()>0)throw fail("SERVICE_USAGE_EXISTS","Dịch vụ đã có ghi nhận sử dụng; cần điều chỉnh có đối soát, không thay thế danh sách.");
        db.sql("DELETE FROM contract_services WHERE contract_id=:id").param("id",contract).update();
        for(var params:pending)db.sql("INSERT INTO contract_services(contract_id,catalog_service_id,code,name,description,calculation_method,unit_price,unit,quantity,billing_cycle,effective_date,end_date,status,note,prorate,snapshot_version) VALUES(:id,:catalog,:code,:name,:description,:method,:price,:unit,:qty,:cycle,:start,:end,:status,:note,:prorate,:extended)").params(params).update();
    }
    public Map<String,Object> estimate(long contract){
        BigDecimal monthly=BigDecimal.ZERO,once=BigDecimal.ZERO;int usage=0;
        var c=db.sql("SELECT start_date,end_date,deposit_amount,agreed_monthly_rent FROM contracts WHERE id=:id").param("id",contract).query().singleRow();
        LocalDate start=RoomLifecycleGuard.date(c.get("start_date")),monthEnd=start.withDayOfMonth(1).plusMonths(1),contractEnd=RoomLifecycleGuard.date(c.get("end_date"));
        for(var s:db.sql("SELECT * FROM contract_services WHERE contract_id=:id AND status='ACTIVE'").param("id",contract).query().listOfRows()){
            LocalDate effective=RoomLifecycleGuard.date(s.get("effective_date")),stop=s.get("end_date")==null?contractEnd:RoomLifecycleGuard.date(s.get("end_date"));
            if(!effective.isBefore(monthEnd)||!stop.isAfter(start))continue;
            if("USAGE".equals(s.get("calculation_method"))){usage++;continue;}
            BigDecimal amount=((BigDecimal)s.get("unit_price")).multiply(s.get("quantity")==null?BigDecimal.ONE:(BigDecimal)s.get("quantity"));
            if("ONCE".equals(s.get("calculation_method")))once=once.add(amount);else monthly=monthly.add(amount);
        }
        BigDecimal fixed=db.sql("SELECT COALESCE(SUM(unit_price),0) FROM contract_utility_rates WHERE contract_id=:id AND calculation_method='FIXED' AND effective_date<:end").param("id",contract).param("end",monthEnd).query(BigDecimal.class).single();
        BigDecimal rent=c.get("agreed_monthly_rent")==null?BigDecimal.ZERO:(BigDecimal)c.get("agreed_monthly_rent"),deposit=(BigDecimal)c.get("deposit_amount");
        return Map.of("recurringEstimate",monthly.setScale(2,RoundingMode.HALF_UP),"onceEstimate",once.setScale(2,RoundingMode.HALF_UP),"fixedUtilitiesEstimate",fixed,"initialEstimate",rent.add(deposit).add(monthly).add(once).add(fixed).setScale(2,RoundingMode.HALF_UP),"usageServiceCount",usage,"isEstimate",true);
    }
}
