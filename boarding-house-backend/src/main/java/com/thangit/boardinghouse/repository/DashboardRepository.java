package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.dashboard.DashboardResponse.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Repository
public class DashboardRepository {
    private final JdbcClient jdbc;
    public DashboardRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    private String scope(RoleCode role) {
        return role == RoleCode.OWNER
                ? "p.owner_id=:userId"
                : "EXISTS (SELECT 1 FROM property_managers pm WHERE pm.property_id=p.id AND pm.manager_id=:userId)";
    }
    private String financeScope(RoleCode role){return scope(role)+(role==RoleCode.MANAGER?" AND EXISTS(SELECT 1 FROM manager_property_capabilities mc WHERE mc.property_id=p.id AND mc.manager_id=:userId AND mc.capability='FINANCE_READ')":"");}
    private String propertyFilter() { return "(:propertyId IS NULL OR p.id=:propertyId)"; }
    private JdbcClient.StatementSpec scoped(String sql, Long userId, Long propertyId) {
        return jdbc.sql(sql).param("userId", userId).param("propertyId", propertyId);
    }

    public List<PropertyOption> properties(Long userId, RoleCode role) {
        return jdbc.sql("SELECT p.id,p.name FROM properties p WHERE p.status='ACTIVE' AND " + scope(role) + " ORDER BY p.name")
                .param("userId", userId).query((rs, n) -> new PropertyOption(rs.getLong("id"), rs.getString("name"))).list();
    }

    public boolean canAccess(Long userId, RoleCode role, Long propertyId) {
        return jdbc.sql("SELECT COUNT(*) FROM properties p WHERE p.id=:propertyId AND " + scope(role))
                .param("userId", userId).param("propertyId", propertyId).query(Long.class).single() > 0;
    }

    public Map<String, Object> summary(Long userId, RoleCode role, Long propertyId,
                                       LocalDate periodStart, LocalDate periodEnd, LocalDate previousStart) {
        String sql = """
                SELECT COUNT(DISTINCT p.id) total_properties, COUNT(DISTINCT r.id) total_rooms,
                  COUNT(DISTINCT CASE WHEN r.status IN ('OCCUPIED','NOTICE') THEN r.id END) occupied_rooms,
                  COUNT(DISTINCT CASE WHEN r.status IN ('VACANT','READY') THEN r.id END) vacant_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='RESERVED' THEN r.id END) reserved_rooms,
                  COUNT(DISTINCT CASE WHEN r.status='MAINTENANCE' THEN r.id END) maintenance_rooms,
                  COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END)
                    FROM payments py JOIN invoices i2 ON i2.id=py.invoice_id JOIN contracts c2 ON c2.id=i2.contract_id
                    JOIN rooms r2 ON r2.id=c2.room_id JOIN properties p2 ON p2.id=r2.property_id
                    WHERE py.status='CONFIRMED' AND py.transaction_type IN ('PAYMENT','REFUND')
                    AND py.paid_at>=:periodStart AND py.paid_at<:periodEnd
                    AND p2.id IN (SELECT px.id FROM properties px WHERE %s AND (:propertyId IS NULL OR px.id=:propertyId))),0) current_revenue,
                  COALESCE((SELECT SUM(CASE WHEN py.transaction_type='REFUND' THEN -py.amount ELSE py.amount END)
                    FROM payments py JOIN invoices i2 ON i2.id=py.invoice_id JOIN contracts c2 ON c2.id=i2.contract_id
                    JOIN rooms r2 ON r2.id=c2.room_id JOIN properties p2 ON p2.id=r2.property_id
                    WHERE py.status='CONFIRMED' AND py.transaction_type IN ('PAYMENT','REFUND')
                    AND py.paid_at>=:previousStart AND py.paid_at<:periodStart
                    AND p2.id IN (SELECT px.id FROM properties px WHERE %s AND (:propertyId IS NULL OR px.id=:propertyId))),0) previous_revenue,
                  COALESCE((SELECT SUM(i2.remaining_amount)
                    FROM invoices i2 JOIN contracts c2 ON c2.id=i2.contract_id JOIN rooms r2 ON r2.id=c2.room_id
                    JOIN properties p2 ON p2.id=r2.property_id WHERE i2.status NOT IN ('PAID','DRAFT','PENDING_REVIEW','CANCELLED')
                    AND p2.id IN (SELECT px.id FROM properties px WHERE %s AND (:propertyId IS NULL OR px.id=:propertyId))),0) debt,
                  (SELECT COUNT(*) FROM contracts c2 JOIN rooms r2 ON r2.id=c2.room_id JOIN properties p2 ON p2.id=r2.property_id
                    WHERE c2.status='ACTIVE' AND c2.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)
                    AND p2.id IN (SELECT px.id FROM properties px WHERE %s AND (:propertyId IS NULL OR px.id=:propertyId))) expiring,
                  (SELECT COUNT(*) FROM maintenance_requests m JOIN properties p2 ON p2.id=m.property_id
                    WHERE m.status NOT IN ('RESOLVED','REJECTED','CANCELLED')
                    AND p2.id IN (SELECT px.id FROM properties px WHERE %s AND (:propertyId IS NULL OR px.id=:propertyId))) open_maintenance
                FROM properties p LEFT JOIN rooms r ON r.property_id=p.id
                WHERE %s AND %s
                """.formatted(financeScope(role).replace("p.", "px."), financeScope(role).replace("p.", "px."),
                financeScope(role).replace("p.", "px."), scope(role).replace("p.", "px."),
                scope(role).replace("p.", "px."), scope(role), propertyFilter());
        return scoped(sql, userId, propertyId)
                .param("periodStart", periodStart).param("periodEnd", periodEnd).param("previousStart", previousStart)
                .query((rs, n) -> {
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("totalProperties", rs.getLong("total_properties"));
            result.put("totalRooms", rs.getLong("total_rooms"));
            result.put("occupiedRooms", rs.getLong("occupied_rooms"));
            result.put("vacantRooms", rs.getLong("vacant_rooms"));
            result.put("reservedRooms", rs.getLong("reserved_rooms"));
            result.put("maintenanceRooms", rs.getLong("maintenance_rooms"));
            result.put("currentRevenue", rs.getBigDecimal("current_revenue"));
            result.put("previousRevenue", rs.getBigDecimal("previous_revenue"));
            result.put("debt", rs.getBigDecimal("debt"));
            result.put("expiring", rs.getLong("expiring"));
            result.put("openMaintenance", rs.getLong("open_maintenance"));
            return result;
        }).single();
    }

    public List<RoomStatus> roomStatuses(Long userId, RoleCode role, Long propertyId) {
        return scoped("SELECT r.status,COUNT(*) count FROM rooms r JOIN properties p ON p.id=r.property_id WHERE "
                + scope(role) + " AND " + propertyFilter() + " GROUP BY r.status", userId, propertyId)
                .query((rs, n) -> new RoomStatus(rs.getString("status"), rs.getLong("count"))).list();
    }

    public List<RevenuePoint> revenueHistory(Long userId, RoleCode role, Long propertyId, int months) {
        String sql="""
          SELECT DATE_FORMAT(months.period,'%%m/%%Y') period,
           COALESCE((SELECT SUM(CASE WHEN py.transaction_type='PAYMENT' THEN py.amount WHEN py.transaction_type='REFUND' THEN -py.amount ELSE 0 END)
            FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN properties p ON p.id=i.property_id
            WHERE py.status='CONFIRMED' AND py.transaction_type IN ('PAYMENT','REFUND')
             AND py.paid_at>=months.period AND py.paid_at<DATE_ADD(months.period,INTERVAL 1 MONTH) AND %s AND %s),0) revenue,
           COALESCE((SELECT SUM(e.amount) FROM expenses e JOIN properties p ON p.id=e.property_id
            WHERE e.status IN ('CONFIRMED','APPROVED') AND e.expense_date>=months.period
             AND e.expense_date<DATE_ADD(months.period,INTERVAL 1 MONTH) AND %s AND %s),0) expense,
           COALESCE((SELECT SUM(i.remaining_amount) FROM invoices i JOIN properties p ON p.id=i.property_id
            WHERE i.status NOT IN ('DRAFT','PENDING_REVIEW','CANCELLED') AND i.billing_period=months.period AND %s AND %s),0) debt
          FROM (SELECT DATE_SUB(DATE_FORMAT(CURRENT_DATE,'%%Y-%%m-01'),INTERVAL seq MONTH) period
           FROM (SELECT 0 seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
            UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11) s
           WHERE seq<:months) months ORDER BY months.period
          """.formatted(financeScope(role),propertyFilter(),financeScope(role),propertyFilter(),financeScope(role),propertyFilter());
        return scoped(sql,userId,propertyId).param("months",months).query((rs,n)->new RevenuePoint(rs.getString("period"),rs.getBigDecimal("revenue"),rs.getBigDecimal("expense"),rs.getBigDecimal("debt"))).list();
    }

    public List<RoomItem> rooms(Long userId, RoleCode role, Long propertyId) {
        String sql = """
                SELECT r.id,p.name property_name,r.building_name,r.floor_name,r.code room_code,r.status,
                       u.full_name tenant_name,c.end_date,
                       COALESCE(SUM(CASE WHEN i.status NOT IN ('PAID','DRAFT','PENDING_REVIEW','CANCELLED') AND %s THEN i.remaining_amount ELSE 0 END),0) debt,
                       EXISTS(SELECT 1 FROM maintenance_requests m WHERE m.room_id=r.id AND m.status NOT IN ('RESOLVED','REJECTED','CANCELLED')) has_maintenance
                FROM rooms r JOIN properties p ON p.id=r.property_id
                LEFT JOIN contracts c ON c.room_id=r.id AND c.status IN ('ACTIVE','EXPIRING','EXPIRED','TERMINATION_REQUESTED') AND c.operational_ended_at IS NULL
                LEFT JOIN users u ON u.id=c.tenant_id LEFT JOIN invoices i ON i.contract_id=c.id
                WHERE %s AND %s GROUP BY r.id,p.name,r.building_name,r.floor_name,r.code,r.status,u.full_name,c.end_date
                ORDER BY p.name,r.building_name,r.floor_name,r.code LIMIT 100
                """.formatted(financeScope(role),scope(role),propertyFilter());
        return scoped(sql, userId, propertyId).query((rs, n) -> new RoomItem(
                rs.getLong("id"), rs.getString("property_name"), rs.getString("building_name"),
                rs.getString("floor_name"), rs.getString("room_code"), rs.getString("tenant_name"),
                rs.getString("status"), rs.getObject("end_date", LocalDate.class), rs.getBigDecimal("debt"),
                rs.getBoolean("has_maintenance"))).list();
    }

    public List<OverdueInvoice> overdueInvoices(Long userId, RoleCode role, Long propertyId) {
        String sql = """
                SELECT i.id,i.code,r.code room_code,u.full_name tenant_name,i.billing_period,
                       i.remaining_amount remaining,i.due_date,
                       DATEDIFF(CURRENT_DATE,i.due_date) overdue_days,i.status
                FROM invoices i JOIN contracts c ON c.id=i.contract_id JOIN rooms r ON r.id=c.room_id
                JOIN properties p ON p.id=r.property_id JOIN users u ON u.id=c.tenant_id
                WHERE i.status NOT IN ('PAID','DRAFT','PENDING_REVIEW','CANCELLED') AND i.remaining_amount>0 AND i.due_date<CURRENT_DATE AND %s AND %s
                ORDER BY overdue_days DESC,remaining DESC LIMIT 5
                """.formatted(financeScope(role), propertyFilter());
        return scoped(sql, userId, propertyId).query((rs, n) -> new OverdueInvoice(
                rs.getLong("id"), rs.getString("code"), rs.getString("room_code"), rs.getString("tenant_name"),
                formatPeriod(rs.getObject("billing_period", LocalDate.class)), rs.getBigDecimal("remaining"),
                rs.getObject("due_date", LocalDate.class), rs.getLong("overdue_days"), rs.getString("status"))).list();
    }

    public List<ExpiringContract> expiringContracts(Long userId, RoleCode role, Long propertyId) {
        String sql = """
                SELECT c.id,c.code,r.code room_code,u.full_name tenant_name,c.end_date,
                       DATEDIFF(c.end_date,CURRENT_DATE) days_remaining,c.status
                FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
                JOIN users u ON u.id=c.tenant_id WHERE c.status='ACTIVE'
                AND c.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY) AND %s AND %s
                ORDER BY c.end_date LIMIT 5
                """.formatted(financeScope(role), propertyFilter());
        return scoped(sql, userId, propertyId).query((rs, n) -> new ExpiringContract(
                rs.getLong("id"), rs.getString("code"), rs.getString("room_code"), rs.getString("tenant_name"),
                rs.getObject("end_date", LocalDate.class), rs.getLong("days_remaining"), rs.getString("status"))).list();
    }

    public List<MaintenanceItem> maintenance(Long userId, RoleCode role, Long propertyId) {
        String sql = """
                SELECT m.id,m.code,p.name property_name,r.code room_code,m.title,m.issue_type,m.priority,
                       u.full_name assignee_name,TIMESTAMPDIFF(HOUR,m.created_at,CURRENT_TIMESTAMP) waiting_hours,m.status
                FROM maintenance_requests m JOIN properties p ON p.id=m.property_id
                LEFT JOIN rooms r ON r.id=m.room_id LEFT JOIN users u ON u.id=m.assigned_to
                WHERE m.status NOT IN ('RESOLVED','REJECTED','CANCELLED') AND %s AND %s
                ORDER BY FIELD(m.priority,'URGENT','HIGH','NORMAL','LOW'),m.created_at LIMIT 5
                """.formatted(scope(role), propertyFilter());
        return scoped(sql, userId, propertyId).query((rs, n) -> new MaintenanceItem(
                rs.getLong("id"), rs.getString("code"), rs.getString("property_name"), rs.getString("room_code"),
                rs.getString("title"), rs.getString("issue_type"), rs.getString("priority"),
                rs.getString("assignee_name"), rs.getLong("waiting_hours"), rs.getString("status"))).list();
    }

    public List<RecentActivity> activities(Long userId, RoleCode role, Long propertyId) {
        String sql = """
                SELECT a.id,a.activity_type,a.description,u.full_name actor_name,a.target_url,a.created_at
                FROM operational_activities a JOIN properties p ON p.id=a.property_id
                LEFT JOIN users u ON u.id=a.actor_id WHERE %s AND %s
                ORDER BY a.created_at DESC LIMIT 8
                """.formatted(scope(role), propertyFilter());
        return scoped(sql, userId, propertyId).query((rs, n) -> new RecentActivity(
                rs.getLong("id"), rs.getString("activity_type"), rs.getString("description"),
                rs.getString("actor_name"), rs.getString("target_url"),
                rs.getObject("created_at", LocalDateTime.class))).list();
    }

    private static String formatPeriod(LocalDate value) {
        return value == null ? null : "%02d/%d".formatted(value.getMonthValue(), value.getYear());
    }
}
