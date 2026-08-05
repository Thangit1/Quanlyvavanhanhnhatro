package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.report.AdminReportRequests.ExportRequest;
import com.thangit.boardinghouse.dto.response.report.AdminReportResponses.*;
import com.thangit.boardinghouse.repository.AdminReportRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminReportService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminReportServiceImpl implements AdminReportService {
    private static final Set<String> TYPES=Set.of("OCCUPANCY","OPERATIONS","REVENUE","EXPENSES","PROFIT","DEBT","INVOICES","PAYMENTS","CONTRACTS","TENANTS","UTILITIES","MAINTENANCE","ASSETS");
    private final AdminReportRepository repository;
    public AdminReportServiceImpl(AdminReportRepository repository){this.repository=repository;}

    @Override @Transactional(readOnly=true)
    public Overview overview(AuthenticatedUser p,List<Long>ids,LocalDate start,LocalDate end,LocalDate previousStart,LocalDate previousEnd){
        requireGeneral(p);Range range=range(start,end);List<Long> scope=scope(p,ids);
        Range previous=previousStart==null||previousEnd==null?range.previous():range(previousStart,previousEnd);
        Map<String,Object> rooms=repository.roomSummary(p.id(),p.activeRole(),scope);
        Map<String,Object> current=repository.periodSummary(p.id(),p.activeRole(),scope,range.start(),range.end());
        Map<String,Object> old=repository.periodSummary(p.id(),p.activeRole(),scope,previous.start(),previous.end());
        Map<String,BigDecimal> summary=new LinkedHashMap<>();rooms.forEach((k,v)->summary.put(k,decimal(v)));current.forEach((k,v)->summary.put(k,decimal(v)));
        BigDecimal available=summary.getOrDefault("availableRooms",BigDecimal.ZERO);
        summary.put("occupancyRate",percentage(summary.get("occupiedRooms"),available));
        BigDecimal revenue=summary.getOrDefault("confirmedRevenue",BigDecimal.ZERO),expense=summary.getOrDefault("confirmedExpense",BigDecimal.ZERO);
        summary.put("profit",revenue.subtract(expense));summary.put("profitMargin",percentage(revenue.subtract(expense),revenue));
        Map<String,BigDecimal> comparison=new LinkedHashMap<>();
        comparison.put("revenueChangePercent",change(revenue,decimal(old.get("confirmedRevenue"))));
        comparison.put("expenseChangePercent",change(expense,decimal(old.get("confirmedExpense"))));
        comparison.put("profitChangePercent",change(revenue.subtract(expense),decimal(old.get("confirmedRevenue")).subtract(decimal(old.get("confirmedExpense")))));
        comparison.put("debtChangePercent",change(summary.get("outstandingDebt"),decimal(old.get("outstandingDebt"))));
        List<Alert>alerts=new ArrayList<>();
        if(summary.get("outstandingDebt").signum()>0)alerts.add(new Alert("OUTSTANDING_DEBT","ATTENTION","Công nợ cần theo dõi","Còn "+summary.get("outstandingDebt").toPlainString()+" đồng chưa thu.","/admin/reports/debt"));
        if(summary.get("expiringContracts").signum()>0)alerts.add(new Alert("EXPIRING_CONTRACTS","IMPORTANT","Hợp đồng sắp hết hạn","Có "+summary.get("expiringContracts").toPlainString()+" hợp đồng hết hạn trong 30 ngày.","/admin/reports/contracts"));
        if(summary.get("openMaintenance").signum()>0)alerts.add(new Alert("OPEN_MAINTENANCE","INFO","Yêu cầu bảo trì đang mở","Có "+summary.get("openMaintenance").toPlainString()+" yêu cầu cần xử lý.","/admin/reports/maintenance"));
        return new Overview(new Scope(scope,range.start(),range.end()),repository.properties(p.id(),p.activeRole()),summary,comparison,
                repository.roomStatuses(p.id(),p.activeRole(),scope),repository.financeTrend(p.id(),p.activeRole(),scope,range.start(),range.end()),alerts,LocalDateTime.now());
    }

    @Override @Transactional(readOnly=true)
    public ReportData report(AuthenticatedUser p,String raw,List<Long>ids,LocalDate start,LocalDate end){
        String type=normalize(raw);requireReport(p,type);Range range=range(start,end);List<Long> scope=scope(p,ids);
        return switch(type){
            case "OCCUPANCY","OPERATIONS"->repository.occupancy(p.id(),p.activeRole(),scope,range.start(),range.end());
            case "REVENUE","PAYMENTS"->repository.revenue(p.id(),p.activeRole(),scope,range.start(),range.end());
            case "EXPENSES"->repository.expenses(p.id(),p.activeRole(),scope,range.start(),range.end());
            case "PROFIT"->profit(p,scope,range);
            case "DEBT","INVOICES"->repository.debt(p.id(),p.activeRole(),scope,range.start(),range.end());
            case "CONTRACTS"->repository.contracts(p.id(),p.activeRole(),scope,range.start(),range.end());
            case "TENANTS"->repository.tenants(p.id(),p.activeRole(),scope,range.start(),range.end());
            case "UTILITIES"->repository.utilities(p.id(),p.activeRole(),scope,range.start(),range.end());
            case "MAINTENANCE"->repository.maintenance(p.id(),p.activeRole(),scope,range.start(),range.end());
            case "ASSETS"->repository.assets(p.id(),p.activeRole(),scope,range.start(),range.end());
            default->throw bad("REPORT_TYPE_INVALID","Loại báo cáo không hợp lệ.");
        };
    }

    private ReportData profit(AuthenticatedUser p,List<Long>scope,Range range){
        ReportData revenue=repository.revenue(p.id(),p.activeRole(),scope,range.start(),range.end());
        ReportData expenses=repository.expenses(p.id(),p.activeRole(),scope,range.start(),range.end());
        BigDecimal income=revenue.summary().getOrDefault("confirmedRevenue",BigDecimal.ZERO),cost=expenses.summary().getOrDefault("totalExpense",BigDecimal.ZERO),profit=income.subtract(cost);
        Map<String,BigDecimal> summary=new LinkedHashMap<>();summary.put("confirmedRevenue",income);summary.put("confirmedExpense",cost);summary.put("profit",profit);summary.put("profitMargin",percentage(profit,income));
        return new ReportData("PROFIT",new Scope(scope,range.start(),range.end()),summary,revenue.trend(),expenses.breakdown(),expenses.details(),LocalDateTime.now());
    }

    @Override @Transactional
    public ExportJob createExport(AuthenticatedUser p,ExportRequest request){
        String type=normalize(request.reportType());requireExport(p,type);if(!"CSV".equalsIgnoreCase(request.format()))throw bad("REPORT_FORMAT_UNSUPPORTED","Hệ thống hiện hỗ trợ xuất CSV; XLSX và PDF chưa được bật.");
        ReportData data=report(p,type,request.propertyIds(),request.startDate(),request.endDate());
        byte[] content=csv(data,request.columns());String name="bao-cao-"+type.toLowerCase(Locale.ROOT)+"-"+request.startDate()+"-"+request.endDate()+".csv";
        long id=repository.saveExport(p.id(),type,"CSV",Map.of("propertyIds",data.scope().propertyIds(),"startDate",request.startDate().toString(),"endDate",request.endDate().toString()),request.columns(),name,content);
        return repository.export(p.id(),id).orElseThrow();
    }
    @Override @Transactional(readOnly=true) public List<ExportJob> exports(AuthenticatedUser p){requireGeneral(p);return repository.exports(p.id());}
    @Override @Transactional(readOnly=true) public ExportJob export(AuthenticatedUser p,long id){requireGeneral(p);return repository.export(p.id(),id).orElseThrow(()->bad("REPORT_EXPORT_NOT_FOUND","Không tìm thấy tác vụ xuất báo cáo."));}
    @Override @Transactional(readOnly=true) public byte[] download(AuthenticatedUser p,long id){ExportJob job=export(p,id);if(job.expiresAt()!=null&&job.expiresAt().isBefore(LocalDateTime.now()))throw bad("REPORT_EXPORT_EXPIRED","Tệp báo cáo đã hết hạn.");return repository.exportContent(p.id(),id).orElseThrow(()->bad("REPORT_EXPORT_NOT_READY","Tệp báo cáo chưa sẵn sàng."));}

    private List<Long> scope(AuthenticatedUser p,List<Long>requested){List<PropertyOption> options=repository.properties(p.id(),p.activeRole());Set<Long>allowed=options.stream().map(PropertyOption::id).collect(java.util.stream.Collectors.toSet());if(requested==null||requested.isEmpty())return options.stream().map(PropertyOption::id).toList();List<Long>unique=requested.stream().distinct().toList();if(unique.size()>20||!allowed.containsAll(unique))throw new AuthException(HttpStatus.FORBIDDEN,"REPORT_PROPERTY_DENIED","Bạn không có quyền xem một hoặc nhiều khu trọ đã chọn.");return unique;}
    private Range range(LocalDate start,LocalDate end){LocalDate today=LocalDate.now();LocalDate s=start==null?today.withDayOfMonth(1):start;LocalDate e=end==null?today:end;if(e.isBefore(s)||ChronoUnit.DAYS.between(s,e)>730)throw bad("REPORT_DATE_RANGE_INVALID","Khoảng thời gian báo cáo không hợp lệ hoặc vượt quá 2 năm.");return new Range(s,e);}
    private String normalize(String raw){String type=raw==null?"":raw.trim().toUpperCase(Locale.ROOT);if(!TYPES.contains(type))throw bad("REPORT_TYPE_INVALID","Loại báo cáo không hợp lệ.");return type;}
    private void requireGeneral(AuthenticatedUser p){if(p==null||!List.of(RoleCode.OWNER,RoleCode.MANAGER,RoleCode.ACCOUNTANT).contains(p.activeRole()))throw new AuthException(HttpStatus.FORBIDDEN,"REPORT_ACCESS_DENIED","Bạn không có quyền truy cập báo cáo quản trị.");}
    private void requireReport(AuthenticatedUser p,String type){if(p!=null&&p.activeRole()==RoleCode.TECHNICIAN&&Set.of("MAINTENANCE","ASSETS").contains(type))return;requireGeneral(p);}
    private void requireExport(AuthenticatedUser p,String type){requireReport(p,type);if(p.activeRole()==RoleCode.TECHNICIAN)throw new AuthException(HttpStatus.FORBIDDEN,"REPORT_EXPORT_DENIED","Bạn không có quyền xuất báo cáo này.");}
    private AuthException bad(String code,String message){return new AuthException(HttpStatus.BAD_REQUEST,code,message);}
    private BigDecimal decimal(Object value){return value==null?BigDecimal.ZERO:value instanceof BigDecimal b?b:new BigDecimal(value.toString());}
    private BigDecimal percentage(BigDecimal value,BigDecimal total){return total==null||total.signum()==0?BigDecimal.ZERO:value.multiply(BigDecimal.valueOf(100)).divide(total,2,RoundingMode.HALF_UP);}
    private BigDecimal change(BigDecimal current,BigDecimal previous){return previous==null||previous.signum()==0?BigDecimal.ZERO:current.subtract(previous).multiply(BigDecimal.valueOf(100)).divide(previous.abs(),2,RoundingMode.HALF_UP);}
    private byte[] csv(ReportData data,List<String>requested){List<Map<String,Object>>rows=data.details();List<String>columns=requested==null||requested.isEmpty()?(rows.isEmpty()?new ArrayList<>(data.summary().keySet()):new ArrayList<>(rows.getFirst().keySet())):requested;StringBuilder out=new StringBuilder("\ufeff");out.append(String.join(",",columns.stream().map(this::quote).toList())).append('\n');if(rows.isEmpty())out.append(String.join(",",columns.stream().map(c->quote(data.summary().get(c))).toList())).append('\n');else for(Map<String,Object>row:rows)out.append(String.join(",",columns.stream().map(c->quote(row.get(c))).toList())).append('\n');return out.toString().getBytes(StandardCharsets.UTF_8);}
    private String quote(Object value){return "\""+(value==null?"":value.toString().replace("\"","\"\""))+"\"";}
    private record Range(LocalDate start,LocalDate end){Range previous(){long days=ChronoUnit.DAYS.between(start,end)+1;return new Range(start.minusDays(days),start.minusDays(1));}}
}
