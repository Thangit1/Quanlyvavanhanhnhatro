package com.thangit.boardinghouse.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class TenantHomeRepository {
    private final JdbcClient jdbc;
    public TenantHomeRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Optional<UserRow> findUser(Long userId) {
        return jdbc.sql("""
                SELECT u.id, u.full_name, u.avatar_url,
                       (SELECT COUNT(*) FROM notifications n WHERE n.user_id=u.id AND n.read_at IS NULL) unread_count
                FROM users u WHERE u.id=:userId AND u.status='ACTIVE'
                """).param("userId", userId).query((rs, n) -> new UserRow(
                rs.getLong("id"), rs.getString("full_name"), rs.getString("avatar_url"),
                rs.getLong("unread_count"))).optional();
    }

    public Optional<RentalRow> findActiveRental(Long userId) {
        return jdbc.sql("""
                SELECT c.id contract_id, c.code contract_code, c.start_date, c.end_date, c.deposit_amount,
                       c.occupant_count, c.status contract_status, r.id room_id, r.code room_code, r.area,
                       r.monthly_rent, r.image_url, r.building_name, r.floor_name,
                       p.name property_name, p.address property_address
                FROM contracts c
                JOIN rooms r ON r.id=c.room_id
                JOIN properties p ON p.id=r.property_id
                WHERE c.tenant_id=:userId AND c.status='ACTIVE'
                  AND c.start_date<=CURRENT_DATE AND c.end_date>=CURRENT_DATE
                ORDER BY c.start_date DESC LIMIT 1
                """).param("userId", userId).query((rs, n) -> new RentalRow(
                rs.getLong("contract_id"), rs.getString("contract_code"),
                rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class),
                rs.getBigDecimal("deposit_amount"), rs.getInt("occupant_count"), rs.getString("contract_status"),
                rs.getLong("room_id"), rs.getString("room_code"), rs.getBigDecimal("area"),
                rs.getBigDecimal("monthly_rent"), rs.getString("image_url"), rs.getString("building_name"),
                rs.getString("floor_name"), rs.getString("property_name"), rs.getString("property_address"))).optional();
    }

    public Optional<InvoiceRow> findCurrentInvoice(Long contractId) {
        return jdbc.sql("""
                SELECT id, code, billing_period, total_amount, paid_amount,
                       GREATEST(total_amount-paid_amount,0) remaining_amount,
                       due_date, DATEDIFF(due_date,CURRENT_DATE) days_until_due, status, paid_at
                FROM invoices
                WHERE contract_id=:contractId AND status<>'CANCELLED'
                ORDER BY billing_period DESC LIMIT 1
                """).param("contractId", contractId).query((rs, n) -> new InvoiceRow(
                rs.getLong("id"), rs.getString("code"), rs.getObject("billing_period", LocalDate.class),
                rs.getBigDecimal("total_amount"), rs.getBigDecimal("paid_amount"),
                rs.getBigDecimal("remaining_amount"), rs.getObject("due_date", LocalDate.class),
                rs.getLong("days_until_due"), rs.getString("status"),
                rs.getObject("paid_at", LocalDateTime.class))).optional();
    }

    public Optional<UtilityRow> findCurrentUtility(Long contractId) {
        return jdbc.sql("""
                SELECT * FROM utility_readings WHERE contract_id=:contractId
                ORDER BY billing_period DESC LIMIT 1
                """).param("contractId", contractId).query((rs, n) -> new UtilityRow(
                rs.getObject("billing_period", LocalDate.class),
                rs.getBigDecimal("electricity_previous"), rs.getBigDecimal("electricity_current"),
                rs.getBigDecimal("electricity_unit_price"), rs.getBigDecimal("electricity_amount"),
                rs.getBigDecimal("water_previous"), rs.getBigDecimal("water_current"),
                rs.getBigDecimal("water_unit_price"), rs.getBigDecimal("water_amount"))).optional();
    }

    public List<UtilityHistoryRow> findUtilityHistory(Long contractId) {
        return jdbc.sql("""
                SELECT billing_period,
                       electricity_current-electricity_previous electricity_usage,
                       water_current-water_previous water_usage
                FROM utility_readings WHERE contract_id=:contractId
                ORDER BY billing_period DESC LIMIT 6
                """).param("contractId", contractId).query((rs, n) -> new UtilityHistoryRow(
                rs.getObject("billing_period", LocalDate.class), rs.getBigDecimal("electricity_usage"),
                rs.getBigDecimal("water_usage"))).list();
    }

    public List<MaintenanceRow> findRecentMaintenance(Long userId) {
        return jdbc.sql("""
                SELECT m.id,m.code,m.title,m.issue_type,m.priority,m.status,m.created_at,u.full_name assignee_name
                FROM maintenance_requests m LEFT JOIN users u ON u.id=m.assigned_to
                WHERE m.tenant_id=:userId ORDER BY m.created_at DESC LIMIT 5
                """).param("userId", userId).query((rs, n) -> new MaintenanceRow(
                rs.getLong("id"), rs.getString("code"), rs.getString("title"), rs.getString("issue_type"),
                rs.getString("priority"), rs.getString("status"), rs.getString("assignee_name"),
                rs.getObject("created_at", LocalDateTime.class))).list();
    }

    public List<NotificationRow> findRecentNotifications(Long userId) {
        return jdbc.sql("""
                SELECT id,title,content,type,read_at,created_at FROM notifications
                WHERE user_id=:userId ORDER BY created_at DESC LIMIT 5
                """).param("userId", userId).query((rs, n) -> new NotificationRow(
                rs.getLong("id"), rs.getString("title"), rs.getString("content"), rs.getString("type"),
                rs.getObject("read_at", LocalDateTime.class), rs.getObject("created_at", LocalDateTime.class))).list();
    }

    public record UserRow(Long id, String fullName, String avatarUrl, long unreadCount) {}
    public record RentalRow(Long contractId, String contractCode, LocalDate startDate, LocalDate endDate,
                            BigDecimal depositAmount, int occupantCount, String contractStatus, Long roomId,
                            String roomCode, BigDecimal area, BigDecimal monthlyRent, String imageUrl,
                            String buildingName, String floorName, String propertyName, String propertyAddress) {}
    public record InvoiceRow(Long id, String code, LocalDate billingPeriod, BigDecimal totalAmount,
                             BigDecimal paidAmount, BigDecimal remainingAmount, LocalDate dueDate,
                             long daysUntilDue, String status, LocalDateTime paidAt) {}
    public record UtilityRow(LocalDate period, BigDecimal electricityPrevious, BigDecimal electricityCurrent,
                             BigDecimal electricityUnitPrice, BigDecimal electricityAmount,
                             BigDecimal waterPrevious, BigDecimal waterCurrent,
                             BigDecimal waterUnitPrice, BigDecimal waterAmount) {}
    public record UtilityHistoryRow(LocalDate period, BigDecimal electricityUsage, BigDecimal waterUsage) {}
    public record MaintenanceRow(Long id, String code, String title, String issueType, String priority,
                                 String status, String assigneeName, LocalDateTime createdAt) {}
    public record NotificationRow(Long id, String title, String content, String type,
                                  LocalDateTime readAt, LocalDateTime createdAt) {}
}
