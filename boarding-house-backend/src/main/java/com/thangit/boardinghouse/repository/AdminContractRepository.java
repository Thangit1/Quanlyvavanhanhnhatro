package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.contract.AdminContractResponses.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AdminContractRepository {
    private final JdbcClient jdbc;

    public AdminContractRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private String propertyScope(RoleCode role, String alias) {
        return role == RoleCode.OWNER
                ? alias + ".owner_id=:userId"
                : "EXISTS (SELECT 1 FROM property_managers pm WHERE pm.property_id=" + alias
                    + ".id AND pm.manager_id=:userId)";
    }

    private String effectiveStatus(String alias) {
        return "CASE WHEN " + alias + ".status='ACTIVE' AND " + alias
                + ".end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) "
                + "THEN 'EXPIRING' WHEN " + alias + ".status='ACTIVE' AND " + alias
                + ".end_date<CURRENT_DATE THEN 'EXPIRED' ELSE " + alias + ".status END";
    }

    public List<PropertyOption> properties(long userId, RoleCode role) {
        return jdbc.sql("SELECT p.id,p.name FROM properties p WHERE p.status='ACTIVE' AND "
                        + propertyScope(role, "p") + " ORDER BY p.name")
                .param("userId", userId)
                .query((rs, row) -> new PropertyOption(rs.getLong("id"), rs.getString("name"))).list();
    }

    public Summary summary(long userId, RoleCode role) {
        String status = effectiveStatus("c");
        return jdbc.sql("""
                SELECT COUNT(*) total,
                  SUM(CASE WHEN %s='ACTIVE' THEN 1 ELSE 0 END) active_count,
                  SUM(CASE WHEN %s='EXPIRING' THEN 1 ELSE 0 END) expiring_count,
                  SUM(CASE WHEN %s='PENDING_CONFIRMATION' THEN 1 ELSE 0 END) pending_count,
                  SUM(CASE WHEN %s='TERMINATION_REQUESTED' THEN 1 ELSE 0 END) termination_count,
                  SUM(CASE WHEN %s IN ('EXPIRED','TERMINATED','CANCELLED') THEN 1 ELSE 0 END) ended_count
                FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
                WHERE %s
                """.formatted(status, status, status, status, status, propertyScope(role, "p")))
                .param("userId", userId).query((rs, row) -> new Summary(
                        rs.getLong("total"), rs.getLong("active_count"), rs.getLong("expiring_count"),
                        rs.getLong("pending_count"), rs.getLong("termination_count"),
                        rs.getLong("ended_count"))).single();
    }

    private record QueryParts(String where, Map<String, Object> params) {}

    private QueryParts filters(long userId, RoleCode role, Long propertyId, String requestedStatus,
                               String keyword) {
        StringBuilder where = new StringBuilder(propertyScope(role, "p"));
        Map<String, Object> params = new HashMap<>();
        params.put("userId", userId);
        if (propertyId != null) {
            where.append(" AND p.id=:propertyId");
            params.put("propertyId", propertyId);
        }
        if (requestedStatus != null && !requestedStatus.isBlank()) {
            where.append(" AND ").append(effectiveStatus("c")).append("=:status");
            params.put("status", requestedStatus.toUpperCase());
        }
        if (keyword != null && !keyword.isBlank()) {
            where.append("""
                     AND (LOWER(c.code) LIKE :keyword OR LOWER(COALESCE(tp.tenant_code,'')) LIKE :keyword
                     OR LOWER(COALESCE(tp.full_name,u.full_name,'')) LIKE :keyword
                     OR LOWER(COALESCE(tp.phone,u.phone,'')) LIKE :keyword
                     OR LOWER(p.name) LIKE :keyword OR LOWER(r.code) LIKE :keyword)
                    """);
            params.put("keyword", "%" + keyword.trim().toLowerCase() + "%");
        }
        return new QueryParts(where.toString(), params);
    }

    public Page<ContractRow> list(long userId, RoleCode role, Long propertyId, String status,
                                  String keyword, String sort, String direction, int page, int size) {
        QueryParts parts = filters(userId, role, propertyId, status, keyword);
        String sortColumn = switch (sort == null ? "" : sort) {
            case "startDate" -> "c.start_date";
            case "contractCode" -> "c.code";
            case "monthlyRent" -> "r.monthly_rent";
            default -> "c.end_date";
        };
        String sortDirection = "desc".equalsIgnoreCase(direction) ? "DESC" : "ASC";
        String joins = """
                FROM contracts c
                JOIN rooms r ON r.id=c.room_id
                JOIN properties p ON p.id=r.property_id
                JOIN users u ON u.id=c.tenant_id
                LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id
                """;
        long total = jdbc.sql("SELECT COUNT(*) " + joins + " WHERE " + parts.where())
                .params(parts.params()).query(Long.class).single();
        Map<String, Object> params = new HashMap<>(parts.params());
        params.put("limit", size);
        params.put("offset", page * size);
        List<ContractRow> rows = jdbc.sql("""
                SELECT c.id,c.code,COALESCE(tp.id,c.tenant_id) tenant_profile_id,
                  COALESCE(tp.tenant_code,CONCAT('TK',LPAD(c.tenant_id,6,'0'))) tenant_code,
                  COALESCE(tp.full_name,u.full_name) tenant_name,COALESCE(tp.phone,u.phone) tenant_phone,
                  p.id property_id,p.name property_name,r.id room_id,r.code room_code,c.start_date,c.end_date,
                  r.monthly_rent,c.deposit_amount,%s effective_status,c.updated_at,
                  EXISTS(SELECT 1 FROM contract_documents d WHERE d.contract_id=c.id) has_document
                %s WHERE %s ORDER BY %s %s LIMIT :limit OFFSET :offset
                """.formatted(effectiveStatus("c"), joins, parts.where(), sortColumn, sortDirection))
                .params(params).query((rs, row) -> mapRow(rs)).list();
        return new Page<>(rows, page, size, total, (int) Math.ceil(total / (double) size));
    }

    public Optional<ContractDetail> detail(long userId, RoleCode role, long contractId) {
        return jdbc.sql("""
                SELECT c.id,c.code,COALESCE(tp.id,c.tenant_id) tenant_profile_id,
                  COALESCE(tp.tenant_code,CONCAT('TK',LPAD(c.tenant_id,6,'0'))) tenant_code,
                  COALESCE(tp.full_name,u.full_name) tenant_name,COALESCE(tp.phone,u.phone) tenant_phone,
                  COALESCE(tp.email,u.email) tenant_email,tp.identity_number,
                  p.id property_id,p.name property_name,p.address property_address,
                  r.id room_id,r.code room_code,r.building_name,r.floor_name,r.room_type,r.monthly_rent,
                  c.start_date,c.end_date,c.deposit_amount,%s effective_status,c.updated_at,c.contract_type,
                  c.created_at,c.signed_at,c.payment_cycle,c.payment_due_day,c.notice_period_days,
                  c.reservation_amount,c.management_fee,c.fixed_service_fee,c.discount_amount,c.occupant_count,
                  (SELECT COUNT(*) FROM contract_documents d WHERE d.contract_id=c.id) document_count,
                  EXISTS(SELECT 1 FROM contract_documents d WHERE d.contract_id=c.id) has_document,
                  NULL note
                FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
                JOIN users u ON u.id=c.tenant_id LEFT JOIN tenant_profiles tp ON tp.id=c.tenant_profile_id
                WHERE c.id=:contractId AND %s
                """.formatted(effectiveStatus("c"), propertyScope(role, "p")))
                .param("userId", userId).param("contractId", contractId)
                .query((rs, row) -> new ContractDetail(
                        rs.getLong("id"), rs.getString("code"), rs.getLong("tenant_profile_id"),
                        rs.getString("tenant_code"), rs.getString("tenant_name"), rs.getString("tenant_phone"),
                        rs.getLong("property_id"), rs.getString("property_name"), rs.getLong("room_id"),
                        rs.getString("room_code"), rs.getObject("start_date", LocalDate.class),
                        rs.getObject("end_date", LocalDate.class), rs.getBigDecimal("monthly_rent"),
                        rs.getBigDecimal("deposit_amount"), remaining(rs), rs.getString("effective_status"),
                        rs.getBoolean("has_document"), rs.getTimestamp("updated_at").toLocalDateTime(),
                        rs.getString("contract_type"), rs.getTimestamp("created_at").toLocalDateTime(),
                        rs.getTimestamp("signed_at") == null ? null : rs.getTimestamp("signed_at").toLocalDateTime(),
                        rs.getString("payment_cycle"), rs.getInt("payment_due_day"),
                        rs.getInt("notice_period_days"), rs.getString("property_address"),
                        rs.getString("building_name"), rs.getString("floor_name"), rs.getString("room_type"),
                        rs.getString("tenant_email"), mask(rs.getString("identity_number")),
                        rs.getBigDecimal("reservation_amount"), rs.getBigDecimal("management_fee"),
                        rs.getBigDecimal("fixed_service_fee"), rs.getBigDecimal("discount_amount"),
                        rs.getInt("occupant_count"), rs.getInt("document_count"), rs.getString("note")))
                .optional();
    }

    private ContractRow mapRow(ResultSet rs) throws SQLException {
        return new ContractRow(rs.getLong("id"), rs.getString("code"), rs.getLong("tenant_profile_id"),
                rs.getString("tenant_code"), rs.getString("tenant_name"), rs.getString("tenant_phone"),
                rs.getLong("property_id"), rs.getString("property_name"), rs.getLong("room_id"),
                rs.getString("room_code"), rs.getObject("start_date", LocalDate.class),
                rs.getObject("end_date", LocalDate.class), rs.getBigDecimal("monthly_rent"),
                rs.getBigDecimal("deposit_amount"), remaining(rs), rs.getString("effective_status"),
                rs.getBoolean("has_document"), rs.getTimestamp("updated_at").toLocalDateTime());
    }

    private long remaining(ResultSet rs) throws SQLException {
        return java.time.temporal.ChronoUnit.DAYS.between(
                LocalDate.now(), rs.getObject("end_date", LocalDate.class));
    }

    private String mask(String value) {
        if (value == null || value.isBlank()) return null;
        int visibleFrom = Math.max(0, value.length() - 4);
        return "*".repeat(visibleFrom) + value.substring(visibleFrom);
    }
}
