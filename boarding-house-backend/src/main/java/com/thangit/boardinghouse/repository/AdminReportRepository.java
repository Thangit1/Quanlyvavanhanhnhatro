package com.thangit.boardinghouse.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.report.AdminReportResponses.*;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AdminReportRepository {
    private final JdbcClient jdbc;
    private final ObjectMapper json = new ObjectMapper();

    public AdminReportRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private String scope(RoleCode role, String alias) {
        if (role == RoleCode.OWNER) return alias + ".owner_id=:userId";
        if (role == RoleCode.TECHNICIAN) return "EXISTS(SELECT 1 FROM maintenance_requests scoped_m WHERE scoped_m.property_id=" + alias + ".id AND scoped_m.assigned_to=:userId)";
        return "EXISTS(SELECT 1 FROM property_managers pm WHERE pm.property_id=" + alias + ".id AND pm.manager_id=:userId)";
    }

    private String propertyFilter(List<Long> propertyIds, String alias) {
        return propertyIds == null || propertyIds.isEmpty() ? "" : " AND " + alias + ".id IN (:propertyIds)";
    }

    private Map<String, Object> params(long userId, List<Long> propertyIds, LocalDate start, LocalDate end) {
        Map<String, Object> values = new HashMap<>();
        values.put("userId", userId);
        if (propertyIds != null && !propertyIds.isEmpty()) values.put("propertyIds", propertyIds);
        values.put("startDate", start);
        values.put("endExclusive", end.plusDays(1));
        return values;
    }

    public List<PropertyOption> properties(long userId, RoleCode role) {
        String sql = "SELECT p.id,p.name FROM properties p WHERE p.status='ACTIVE' AND " + scope(role, "p") + " ORDER BY p.name";
        return jdbc.sql(sql).param("userId", userId)
                .query((r, n) -> new PropertyOption(r.getLong("id"), r.getString("name"))).list();
    }

    public Map<String, Object> roomSummary(long userId, RoleCode role, List<Long> ids) {
        String sql = """
                SELECT COUNT(DISTINCT p.id) total_properties,COUNT(r.id) total_rooms,
                  SUM(r.status='OCCUPIED') occupied_rooms,SUM(r.status='VACANT') vacant_rooms,
                  SUM(r.status='RESERVED') reserved_rooms,SUM(r.status='MAINTENANCE') maintenance_rooms,
                  SUM(r.status='INACTIVE') inactive_rooms,
                  SUM(r.status NOT IN ('INACTIVE','MAINTENANCE')) available_rooms
                FROM properties p LEFT JOIN rooms r ON r.property_id=p.id
                WHERE %s%s
                """.formatted(scope(role, "p"), propertyFilter(ids, "p"));
        return one(sql, params(userId, ids, LocalDate.now(), LocalDate.now()));
    }

    public Map<String, Object> periodSummary(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String filter = propertyFilter(ids, "p");
        String sql = """
                SELECT
                  COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END)
                    FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN properties p ON p.id=i.property_id
                    WHERE py.status='CONFIRMED' AND i.status<>'CANCELLED' AND py.paid_at>=:startDate AND py.paid_at<:endExclusive AND %s%s),0) confirmed_revenue,
                  COALESCE((SELECT SUM(e.amount) FROM expenses e JOIN properties p ON p.id=e.property_id
                    WHERE e.status IN ('CONFIRMED','APPROVED') AND e.expense_date>=:startDate AND e.expense_date<:endExclusive AND %s%s),0) confirmed_expense,
                  COALESCE((SELECT SUM(GREATEST(i.remaining_amount,0)) FROM invoices i JOIN properties p ON p.id=i.property_id
                    WHERE i.status<>'CANCELLED' AND %s%s),0) outstanding_debt,
                  (SELECT COUNT(*) FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
                    WHERE c.status='ACTIVE' AND c.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY) AND %s%s) expiring_contracts,
                  (SELECT COUNT(*) FROM maintenance_requests m JOIN properties p ON p.id=m.property_id
                    WHERE m.status NOT IN ('RESOLVED','REJECTED','CANCELLED') AND %s%s) open_maintenance,
                  (SELECT COUNT(*) FROM tenant_residences tr JOIN properties p ON p.id=tr.property_id
                    WHERE tr.status='ACTIVE' AND %s%s) active_tenants
                """.formatted(
                scope(role,"p"),filter, scope(role,"p"),filter, scope(role,"p"),filter,
                scope(role,"p"),filter, scope(role,"p"),filter, scope(role,"p"),filter);
        return one(sql, params(userId, ids, start, end));
    }

    public List<ChartPoint> roomStatuses(long userId, RoleCode role, List<Long> ids) {
        String sql = "SELECT r.status label,COUNT(*) value FROM rooms r JOIN properties p ON p.id=r.property_id WHERE "
                + scope(role,"p") + propertyFilter(ids,"p") + " GROUP BY r.status ORDER BY value DESC";
        return points(sql, params(userId, ids, LocalDate.now(), LocalDate.now()));
    }

    public List<ChartPoint> financeTrend(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String filter = propertyFilter(ids, "p");
        String sql = """
                SELECT DATE_FORMAT(MIN(x.day),'%%m/%%Y') label,SUM(x.revenue) value,SUM(x.expense) secondary_value,'FINANCE' category
                FROM (
                  SELECT DATE(py.paid_at) day,CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END revenue,0 expense
                  FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN properties p ON p.id=i.property_id
                  WHERE py.status='CONFIRMED' AND i.status<>'CANCELLED' AND py.paid_at>=:startDate AND py.paid_at<:endExclusive AND %s%s
                  UNION ALL
                  SELECT e.expense_date day,0 revenue,e.amount expense FROM expenses e JOIN properties p ON p.id=e.property_id
                  WHERE e.status IN ('CONFIRMED','APPROVED') AND e.expense_date>=:startDate AND e.expense_date<:endExclusive AND %s%s
                ) x GROUP BY YEAR(x.day),MONTH(x.day) ORDER BY YEAR(x.day),MONTH(x.day)
                """.formatted(scope(role,"p"),filter,scope(role,"p"),filter);
        return points(sql, params(userId, ids, start, end));
    }

    public ReportData occupancy(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        Map<String, Object> raw = roomSummary(userId, role, ids);
        Map<String, BigDecimal> summary = decimals(raw);
        BigDecimal available = summary.getOrDefault("availableRooms", BigDecimal.ZERO);
        summary.put("occupancyRate", percent(summary.get("occupiedRooms"), available));
        String sql = """
                SELECT p.name property_name,COUNT(r.id) total_rooms,SUM(r.status='OCCUPIED') occupied_rooms,
                 SUM(r.status='VACANT') vacant_rooms,SUM(r.status='MAINTENANCE') maintenance_rooms,
                 SUM(r.status='INACTIVE') inactive_rooms,
                 ROUND(100*SUM(r.status='OCCUPIED')/NULLIF(SUM(r.status NOT IN ('INACTIVE','MAINTENANCE')),0),2) occupancy_rate,
                 COALESCE(AVG(r.monthly_rent),0) average_room_rent
                FROM properties p LEFT JOIN rooms r ON r.property_id=p.id WHERE %s%s GROUP BY p.id,p.name ORDER BY p.name
                """.formatted(scope(role,"p"),propertyFilter(ids,"p"));
        return data("OCCUPANCY", ids, start, end, summary, List.of(), roomStatuses(userId,role,ids),
                list(sql, params(userId,ids,start,end)));
    }

    public ReportData revenue(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String filter=propertyFilter(ids,"p");
        String metrics="""
                SELECT COALESCE(SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END),0) confirmed_revenue,
                 COUNT(DISTINCT py.id) payment_count,COALESCE(AVG(CASE WHEN py.transaction_type='PAYMENT' THEN py.amount END),0) average_payment
                FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN properties p ON p.id=i.property_id
                WHERE py.status='CONFIRMED' AND i.status<>'CANCELLED' AND py.paid_at>=:startDate AND py.paid_at<:endExclusive AND %s%s
                """.formatted(scope(role,"p"),filter);
        String breakdown="""
                SELECT py.payment_method label,SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END) value,NULL secondary_value,'PAYMENT_METHOD' category
                FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN properties p ON p.id=i.property_id
                WHERE py.status='CONFIRMED' AND i.status<>'CANCELLED' AND py.paid_at>=:startDate AND py.paid_at<:endExclusive AND %s%s GROUP BY py.payment_method ORDER BY value DESC
                """.formatted(scope(role,"p"),filter);
        String rows="""
                SELECT py.paid_at payment_date,p.name property_name,r.code room_code,i.code invoice_code,
                 py.receipt_code,py.payment_method,py.transaction_type,py.amount,py.status
                FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN rooms r ON r.id=i.room_id JOIN properties p ON p.id=i.property_id
                WHERE py.status='CONFIRMED' AND i.status<>'CANCELLED' AND py.paid_at>=:startDate AND py.paid_at<:endExclusive AND %s%s ORDER BY py.paid_at DESC LIMIT 200
                """.formatted(scope(role,"p"),filter);
        Map<String,Object> p=params(userId,ids,start,end);
        return data("REVENUE",ids,start,end,decimals(one(metrics,p)),financeTrend(userId,role,ids,start,end),points(breakdown,p),list(rows,p));
    }

    public ReportData expenses(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String filter=propertyFilter(ids,"p");
        String metrics="SELECT COALESCE(SUM(e.amount),0) total_expense,COUNT(*) expense_count,COALESCE(AVG(e.amount),0) average_expense FROM expenses e JOIN properties p ON p.id=e.property_id WHERE e.status IN ('CONFIRMED','APPROVED') AND e.expense_date>=:startDate AND e.expense_date<:endExclusive AND "+scope(role,"p")+filter;
        String byProperty="SELECT p.name label,SUM(e.amount) value,NULL secondary_value,'PROPERTY' category FROM expenses e JOIN properties p ON p.id=e.property_id WHERE e.status IN ('CONFIRMED','APPROVED') AND e.expense_date>=:startDate AND e.expense_date<:endExclusive AND "+scope(role,"p")+filter+" GROUP BY p.id,p.name ORDER BY value DESC";
        String rows="SELECT e.id,e.expense_date,p.name property_name,e.description,e.amount,e.status FROM expenses e JOIN properties p ON p.id=e.property_id WHERE e.status IN ('CONFIRMED','APPROVED') AND e.expense_date>=:startDate AND e.expense_date<:endExclusive AND "+scope(role,"p")+filter+" ORDER BY e.expense_date DESC,e.id DESC LIMIT 200";
        Map<String,Object> p=params(userId,ids,start,end);
        return data("EXPENSES",ids,start,end,decimals(one(metrics,p)),List.of(),points(byProperty,p),list(rows,p));
    }

    public ReportData debt(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String filter=propertyFilter(ids,"p");
        String where=" i.status<>'CANCELLED' AND i.issue_date>=:startDate AND i.issue_date<:endExclusive AND "+scope(role,"p")+filter;
        String metrics="SELECT COALESCE(SUM(i.total_amount),0) total_invoice_amount,COALESCE(SUM(i.paid_amount),0) total_paid_amount,COALESCE(SUM(i.remaining_amount),0) outstanding_debt,SUM(i.status='UNPAID') unpaid_invoice_count,SUM(i.status='PARTIALLY_PAID') partially_paid_invoice_count,SUM(i.due_date<CURRENT_DATE AND i.remaining_amount>0) overdue_invoice_count FROM invoices i JOIN properties p ON p.id=i.property_id WHERE"+where;
        String aging="SELECT CASE WHEN i.due_date>=CURRENT_DATE THEN 'NOT_DUE' WHEN DATEDIFF(CURRENT_DATE,i.due_date)<=7 THEN 'OVERDUE_1_7' WHEN DATEDIFF(CURRENT_DATE,i.due_date)<=15 THEN 'OVERDUE_8_15' WHEN DATEDIFF(CURRENT_DATE,i.due_date)<=30 THEN 'OVERDUE_16_30' WHEN DATEDIFF(CURRENT_DATE,i.due_date)<=60 THEN 'OVERDUE_31_60' ELSE 'OVER_60_DAYS' END label,SUM(i.remaining_amount) value,COUNT(*) secondary_value,'AGING' category FROM invoices i JOIN properties p ON p.id=i.property_id WHERE i.remaining_amount>0 AND"+where+" GROUP BY label ORDER BY MIN(i.due_date) DESC";
        String rows="SELECT i.code invoice_code,p.name property_name,r.code room_code,tp.full_name tenant_name,c.code contract_code,i.total_amount,i.paid_amount,i.remaining_amount,i.due_date,GREATEST(DATEDIFF(CURRENT_DATE,i.due_date),0) overdue_days,i.status FROM invoices i JOIN properties p ON p.id=i.property_id LEFT JOIN rooms r ON r.id=i.room_id LEFT JOIN contracts c ON c.id=i.contract_id LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id WHERE"+where+" ORDER BY i.remaining_amount DESC LIMIT 200";
        Map<String,Object> p=params(userId,ids,start,end);Map<String,BigDecimal>s=decimals(one(metrics,p));s.put("collectionRate",percent(s.get("totalPaidAmount"),s.get("totalInvoiceAmount")));
        return data("DEBT",ids,start,end,s,List.of(),points(aging,p),list(rows,p));
    }

    public ReportData contracts(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String f=propertyFilter(ids,"p");String sc=scope(role,"p");
        String metrics="SELECT SUM(c.status='ACTIVE') active_contracts,SUM(c.created_at>=:startDate AND c.created_at<:endExclusive) new_contracts,SUM(c.status='ACTIVE' AND c.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)) expiring_contracts,SUM(c.status='EXPIRED') expired_contracts,SUM(c.status='TERMINATED') terminated_contracts,COALESCE(AVG(DATEDIFF(c.end_date,c.start_date)),0) average_term_days FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE "+sc+f;
        String breakdown="SELECT c.status label,COUNT(*) value,NULL secondary_value,'STATUS' category FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE "+sc+f+" GROUP BY c.status ORDER BY value DESC";
        String rows="SELECT c.code contract_code,p.name property_name,r.code room_code,tp.full_name tenant_name,c.start_date,c.end_date,DATEDIFF(c.end_date,CURRENT_DATE) days_remaining,r.monthly_rent,c.deposit_amount,c.status FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id WHERE "+sc+f+" ORDER BY c.end_date LIMIT 200";
        Map<String,Object> p=params(userId,ids,start,end);return data("CONTRACTS",ids,start,end,decimals(one(metrics,p)),List.of(),points(breakdown,p),list(rows,p));
    }

    public ReportData tenants(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String f=propertyFilter(ids,"p");String sc=scope(role,"p");
        String metrics="SELECT COUNT(*) active_residents,SUM(tr.residence_role='REPRESENTATIVE') representatives,SUM(tr.residence_role<>'REPRESENTATIVE') occupants,SUM(tr.move_in_date>=:startDate AND tr.move_in_date<:endExclusive) moved_in,SUM(tr.move_out_date>=:startDate AND tr.move_out_date<:endExclusive) moved_out,SUM(COALESCE(tpr.status,'NOT_DECLARED')='NOT_DECLARED') temporary_residence_missing FROM tenant_residences tr JOIN tenant_profiles tp ON tp.id=tr.tenant_profile_id JOIN properties p ON p.id=tr.property_id LEFT JOIN temporary_residence_records tpr ON tpr.tenant_profile_id=tp.id AND tpr.property_id=p.id WHERE tr.status='ACTIVE' AND "+sc+f;
        String breakdown="SELECT p.name label,COUNT(*) value,NULL secondary_value,'PROPERTY' category FROM tenant_residences tr JOIN properties p ON p.id=tr.property_id WHERE tr.status='ACTIVE' AND "+sc+f+" GROUP BY p.id,p.name ORDER BY value DESC";
        String rows="SELECT tp.tenant_code,p.name property_name,r.code room_code,tp.full_name,tr.residence_role,tr.move_in_date,tr.move_out_date,tp.status profile_status,COALESCE(tpr.status,'NOT_DECLARED') temporary_residence_status FROM tenant_residences tr JOIN tenant_profiles tp ON tp.id=tr.tenant_profile_id JOIN properties p ON p.id=tr.property_id LEFT JOIN rooms r ON r.id=tr.room_id LEFT JOIN temporary_residence_records tpr ON tpr.tenant_profile_id=tp.id AND tpr.property_id=p.id WHERE "+sc+f+" ORDER BY tp.full_name LIMIT 200";
        Map<String,Object> p=params(userId,ids,start,end);return data("TENANTS",ids,start,end,decimals(one(metrics,p)),List.of(),points(breakdown,p),list(rows,p));
    }

    public ReportData utilities(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String f=propertyFilter(ids,"p");String sc=scope(role,"p");String where=" u.billing_period>=:startDate AND u.billing_period<:endExclusive AND "+sc+f;
        String metrics="SELECT COALESCE(SUM(GREATEST(u.electricity_current-u.electricity_previous,0)),0) electricity_usage,COALESCE(SUM(GREATEST(u.water_current-u.water_previous,0)),0) water_usage,COALESCE(SUM(u.electricity_amount),0) electricity_cost,COALESCE(SUM(u.water_amount),0) water_cost,COUNT(DISTINCT r.id) measured_rooms FROM utility_readings u JOIN contracts c ON c.id=u.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE "+where;
        String trend="SELECT DATE_FORMAT(MIN(u.billing_period),'%m/%Y') label,SUM(GREATEST(u.electricity_current-u.electricity_previous,0)) value,SUM(GREATEST(u.water_current-u.water_previous,0)) secondary_value,'USAGE' category FROM utility_readings u JOIN contracts c ON c.id=u.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE "+where+" GROUP BY YEAR(u.billing_period),MONTH(u.billing_period) ORDER BY YEAR(u.billing_period),MONTH(u.billing_period)";
        String rows="SELECT p.name property_name,r.code room_code,u.billing_period,u.electricity_previous,u.electricity_current,GREATEST(u.electricity_current-u.electricity_previous,0) electricity_usage,u.electricity_unit_price,u.electricity_amount,u.water_previous,u.water_current,GREATEST(u.water_current-u.water_previous,0) water_usage,u.water_unit_price,u.water_amount FROM utility_readings u JOIN contracts c ON c.id=u.contract_id JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id WHERE "+where+" ORDER BY u.billing_period DESC,p.name,r.code LIMIT 200";
        Map<String,Object> p=params(userId,ids,start,end);return data("UTILITIES",ids,start,end,decimals(one(metrics,p)),points(trend,p),List.of(),list(rows,p));
    }

    public ReportData maintenance(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String f=propertyFilter(ids,"p");String sc=scope(role,"p");String where=" m.created_at>=:startDate AND m.created_at<:endExclusive AND "+sc+f;
        String metrics="SELECT COUNT(*) total_requests,SUM(m.status NOT IN ('RESOLVED','REJECTED','CANCELLED')) open_requests,SUM(m.status='RESOLVED') resolved_requests,SUM(m.sla_due_at<NOW() AND m.status NOT IN ('RESOLVED','CANCELLED')) overdue_requests,COALESCE(SUM(m.actual_cost),0) total_cost,COALESCE(AVG(CASE WHEN m.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE,m.created_at,m.resolved_at)/60 END),0) average_resolution_hours FROM maintenance_requests m JOIN properties p ON p.id=m.property_id WHERE "+where;
        String breakdown="SELECT m.issue_type label,COUNT(*) value,SUM(m.actual_cost) secondary_value,'ISSUE_TYPE' category FROM maintenance_requests m JOIN properties p ON p.id=m.property_id WHERE "+where+" GROUP BY m.issue_type ORDER BY value DESC";
        String rows="SELECT m.code request_code,p.name property_name,r.code room_code,m.title,m.issue_type,m.priority,u.full_name assignee_name,m.actual_cost,m.created_at,m.resolved_at,m.status FROM maintenance_requests m JOIN properties p ON p.id=m.property_id LEFT JOIN rooms r ON r.id=m.room_id LEFT JOIN users u ON u.id=m.assigned_to WHERE "+where+" ORDER BY m.created_at DESC LIMIT 200";
        Map<String,Object> p=params(userId,ids,start,end);return data("MAINTENANCE",ids,start,end,decimals(one(metrics,p)),List.of(),points(breakdown,p),list(rows,p));
    }

    public ReportData assets(long userId, RoleCode role, List<Long> ids, LocalDate start, LocalDate end) {
        String f=propertyFilter(ids,"p");String sc=scope(role,"p");
        String metrics="SELECT COALESCE(SUM(a.quantity),0) total_assets,COALESCE(SUM(CASE WHEN a.condition_status='GOOD' THEN a.quantity ELSE 0 END),0) good_assets,COALESCE(SUM(CASE WHEN a.condition_status IN ('NEEDS_MAINTENANCE','MAINTENANCE') THEN a.quantity ELSE 0 END),0) maintenance_assets,COALESCE(SUM(CASE WHEN a.condition_status IN ('BROKEN','DAMAGED') THEN a.quantity ELSE 0 END),0) damaged_assets FROM room_assets a JOIN rooms r ON r.id=a.room_id JOIN properties p ON p.id=r.property_id WHERE "+sc+f;
        String breakdown="SELECT a.condition_status label,SUM(a.quantity) value,NULL secondary_value,'CONDITION' category FROM room_assets a JOIN rooms r ON r.id=a.room_id JOIN properties p ON p.id=r.property_id WHERE "+sc+f+" GROUP BY a.condition_status ORDER BY value DESC";
        String rows="SELECT a.id,a.name,p.name property_name,r.code room_code,a.quantity,a.condition_status,a.note,(SELECT COUNT(*) FROM maintenance_requests m WHERE m.asset_id=a.id) repair_count,(SELECT COALESCE(SUM(m.actual_cost),0) FROM maintenance_requests m WHERE m.asset_id=a.id) repair_cost FROM room_assets a JOIN rooms r ON r.id=a.room_id JOIN properties p ON p.id=r.property_id WHERE "+sc+f+" ORDER BY p.name,r.code,a.name LIMIT 200";
        Map<String,Object> p=params(userId,ids,start,end);return data("ASSETS",ids,start,end,decimals(one(metrics,p)),List.of(),points(breakdown,p),list(rows,p));
    }

    public long saveExport(long userId, String reportType, String format, Object filters, List<String> columns,
                           String fileName, byte[] content) {
        String filterJson=toJson(filters),columnJson=toJson(columns);
        var keys=new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.sql("INSERT INTO report_export_jobs(requested_by,report_type,format,filter_json,selected_columns,status,file_name,content_type,file_size,file_content,expires_at,started_at,completed_at) VALUES(:user,:type,:format,:filters,:columns,'COMPLETED',:name,'text/csv;charset=UTF-8',:size,:content,DATE_ADD(NOW(),INTERVAL 7 DAY),NOW(),NOW())")
                .param("user",userId).param("type",reportType).param("format",format).param("filters",filterJson)
                .param("columns",columnJson).param("name",fileName).param("size",content.length).param("content",content)
                .update(keys,"id");
        return keys.getKey().longValue();
    }

    public List<ExportJob> exports(long userId) {
        return jdbc.sql("SELECT id,report_type,format,status,file_name,file_size,expires_at,created_at,completed_at,error_message FROM report_export_jobs WHERE requested_by=:user ORDER BY created_at DESC LIMIT 100")
                .param("user",userId).query(this::exportJob).list();
    }
    public Optional<ExportJob> export(long userId,long id){return jdbc.sql("SELECT id,report_type,format,status,file_name,file_size,expires_at,created_at,completed_at,error_message FROM report_export_jobs WHERE id=:id AND requested_by=:user").param("id",id).param("user",userId).query(this::exportJob).optional();}
    public Optional<byte[]> exportContent(long userId,long id){return jdbc.sql("SELECT file_content FROM report_export_jobs WHERE id=:id AND requested_by=:user AND status='COMPLETED' AND expires_at>NOW()").param("id",id).param("user",userId).query((r,n)->r.getBytes(1)).optional();}

    private ExportJob exportJob(ResultSet r,int n)throws SQLException{Number size=(Number)r.getObject("file_size");return new ExportJob(r.getLong("id"),r.getString("report_type"),r.getString("format"),r.getString("status"),r.getString("file_name"),size==null?null:size.longValue(),dateTime(r,"expires_at"),dateTime(r,"created_at"),dateTime(r,"completed_at"),r.getString("error_message"));}
    private ReportData data(String type,List<Long>ids,LocalDate start,LocalDate end,Map<String,BigDecimal>summary,List<ChartPoint>trend,List<ChartPoint>breakdown,List<Map<String,Object>>rows){return new ReportData(type,new Scope(ids==null?List.of():ids,start,end),summary,trend,breakdown,rows,LocalDateTime.now());}
    private Map<String,Object> one(String sql,Map<String,Object>params){return jdbc.sql(sql).params(params).query(this::map).single();}
    private List<Map<String,Object>> list(String sql,Map<String,Object>params){return jdbc.sql(sql).params(params).query(this::map).list();}
    private List<ChartPoint> points(String sql,Map<String,Object>params){return jdbc.sql(sql).params(params).query((r,n)->new ChartPoint(r.getString("label"),money(r,"value"),has(r,"secondary_value")?money(r,"secondary_value"):null,has(r,"category")?r.getString("category"):null)).list();}
    private Map<String,Object> map(ResultSet r,int n)throws SQLException{Map<String,Object>out=new LinkedHashMap<>();ResultSetMetaData m=r.getMetaData();for(int i=1;i<=m.getColumnCount();i++)out.put(camel(m.getColumnLabel(i)),r.getObject(i));return out;}
    private Map<String,BigDecimal> decimals(Map<String,Object>source){Map<String,BigDecimal>out=new LinkedHashMap<>();source.forEach((k,v)->out.put(k,v==null?BigDecimal.ZERO:v instanceof BigDecimal b?b:new BigDecimal(v.toString())));return out;}
    private BigDecimal percent(BigDecimal value,BigDecimal total){return total==null||total.signum()==0?BigDecimal.ZERO:value.multiply(BigDecimal.valueOf(100)).divide(total,2,java.math.RoundingMode.HALF_UP);}
    private BigDecimal money(ResultSet r,String c)throws SQLException{BigDecimal x=r.getBigDecimal(c);return x==null?BigDecimal.ZERO:x;}
    private boolean has(ResultSet r,String c){try{r.findColumn(c);return true;}catch(SQLException e){return false;}}
    private LocalDateTime dateTime(ResultSet r,String c)throws SQLException{var t=r.getTimestamp(c);return t==null?null:t.toLocalDateTime();}
    private String camel(String value){StringBuilder b=new StringBuilder();boolean up=false;for(char c:value.toCharArray()){if(c=='_'){up=true;}else{b.append(up?Character.toUpperCase(c):Character.toLowerCase(c));up=false;}}return b.toString();}
    private String toJson(Object value){try{return json.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalArgumentException("Không thể lưu bộ lọc xuất báo cáo.",e);}}
}
