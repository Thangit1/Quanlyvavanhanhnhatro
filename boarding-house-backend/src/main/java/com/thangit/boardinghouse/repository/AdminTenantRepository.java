package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.SaveTenant;
import com.thangit.boardinghouse.dto.response.tenant.AdminTenantResponses.*;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class AdminTenantRepository {
    private final JdbcClient jdbc;
    public AdminTenantRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    private String propertyScope(RoleCode role, String alias) {
        return switch (role) {
            case OWNER -> alias + ".owner_id=:userId";
            case ACCOUNTANT -> "EXISTS (SELECT 1 FROM accountant_property_assignments apa WHERE apa.property_id="
                    + alias + ".id AND apa.accountant_id=:userId)";
            default -> "EXISTS (SELECT 1 FROM property_managers pm WHERE pm.property_id=" + alias
                    + ".id AND pm.manager_id=:userId)";
        };
    }

    public boolean canAccessProperty(long userId, RoleCode role, long propertyId) {
        return jdbc.sql("SELECT COUNT(*) FROM properties p WHERE p.id=:propertyId AND " + propertyScope(role, "p"))
                .param("userId", userId).param("propertyId", propertyId).query(Long.class).single() > 0;
    }

    public boolean canAccessTenant(long userId, RoleCode role, long tenantId) {
        return jdbc.sql("""
                SELECT COUNT(*) FROM tenant_residences tr
                JOIN properties p ON p.id=tr.property_id
                WHERE tr.id=(SELECT tr2.id FROM tenant_residences tr2
                  WHERE tr2.tenant_profile_id=:tenantId
                  ORDER BY (tr2.status='ACTIVE') DESC,tr2.id DESC LIMIT 1) AND %s
                """.formatted(propertyScope(role, "p")))
                .param("userId", userId).param("tenantId", tenantId).query(Long.class).single() > 0;
    }

    public List<PropertyOption> properties(long userId, RoleCode role) {
        return jdbc.sql("SELECT p.id,p.name FROM properties p WHERE p.status='ACTIVE' AND "
                        + propertyScope(role, "p") + " ORDER BY p.name")
                .param("userId", userId)
                .query((rs, n) -> new PropertyOption(rs.getLong("id"), rs.getString("name"))).list();
    }

    public List<RoomOption> rooms(long userId, RoleCode role, Long propertyId) {
        return jdbc.sql("""
                SELECT r.id,r.property_id,r.code,r.building_name,r.floor_name,r.monthly_rent,r.capacity,r.status
                FROM rooms r JOIN properties p ON p.id=r.property_id
                WHERE %s AND (:propertyId IS NULL OR p.id=:propertyId)
                ORDER BY p.name,r.building_name,r.floor_name,r.code
                """.formatted(propertyScope(role, "p")))
                .param("userId", userId).param("propertyId", propertyId)
                .query((rs, n) -> new RoomOption(rs.getLong("id"), rs.getLong("property_id"),
                        rs.getString("code"), rs.getString("building_name"), rs.getString("floor_name"),
                        rs.getBigDecimal("monthly_rent"), rs.getInt("capacity"), rs.getString("status"))).list();
    }

    private record QueryParts(String where, Map<String, Object> params) {}
    private QueryParts filters(long userId, RoleCode role, Long propertyId, Long roomId, String status,
                               String temporaryStatus, String accountStatus, String keyword,
                               String debtStatus, String contractStatus) {
        StringBuilder where = new StringBuilder(propertyScope(role, "p"));
        Map<String, Object> params = new HashMap<>();
        params.put("userId", userId);
        if (propertyId != null) { where.append(" AND p.id=:propertyId"); params.put("propertyId", propertyId); }
        if (roomId != null) { where.append(" AND r.id=:roomId"); params.put("roomId", roomId); }
        if (status != null && !status.isBlank()) {
            switch (status.toUpperCase()) {
                case "ACTIVE" -> where.append(" AND tr.status='ACTIVE' AND c.status IN ('ACTIVE','EXPIRING')");
                case "PENDING" -> where.append(" AND c.status IN ('DRAFT','PENDING_CONFIRMATION')");
                case "NOTICE" -> where.append(" AND (r.status='NOTICE' OR EXISTS (SELECT 1 FROM rental_checkouts rc WHERE rc.contract_id=c.id AND rc.status IN ('REQUESTED','INSPECTING')))");
                case "EXPIRED" -> where.append(" AND (c.status='EXPIRED' OR (c.end_date<CURRENT_DATE AND c.status NOT IN ('TERMINATED','CANCELLED'))) ");
                case "CHECKED_OUT" -> where.append(" AND tr.status='MOVED_OUT'");
                case "INACTIVE" -> where.append(" AND tp.status='INACTIVE'");
                default -> { }
            }
        }
        if (temporaryStatus != null && !temporaryStatus.isBlank()) {
            where.append(" AND COALESCE(tpr.status,'NOT_DECLARED')=:temporaryStatus");
            params.put("temporaryStatus", temporaryStatus.toUpperCase());
        }
        if (accountStatus != null && !accountStatus.isBlank()) {
            if ("NO_ACCOUNT".equalsIgnoreCase(accountStatus)) where.append(" AND tp.user_id IS NULL");
            else {
                where.append(" AND u.status=:accountStatus");
                params.put("accountStatus", accountStatus.toUpperCase());
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            where.append("""
                     AND (LOWER(tp.full_name) LIKE :keyword OR LOWER(tp.tenant_code) LIKE :keyword
                     OR LOWER(tp.phone) LIKE :keyword OR LOWER(COALESCE(tp.email,'')) LIKE :keyword
                     OR LOWER(COALESCE(tp.identity_number,'')) LIKE :keyword
                     OR LOWER(COALESCE(r.code,'')) LIKE :keyword OR LOWER(COALESCE(c.code,'')) LIKE :keyword)
                    """);
            params.put("keyword", "%" + keyword.trim().toLowerCase() + "%");
        }
        if (debtStatus != null && !debtStatus.isBlank()) {
            String debt = "COALESCE((SELECT SUM(GREATEST(ix.total_amount-ix.paid_amount,0)) FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id WHERE (cx.tenant_profile_id=tp.id OR cx.tenant_id=tp.user_id) AND ix.status<>'CANCELLED'),0)";
            switch (debtStatus.toUpperCase()) {
                case "NO_DEBT" -> where.append(" AND ").append(debt).append("=0");
                case "WITH_DEBT" -> where.append(" AND ").append(debt).append(">0");
                case "OVERDUE" -> where.append(" AND EXISTS (SELECT 1 FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id WHERE (cx.tenant_profile_id=tp.id OR cx.tenant_id=tp.user_id) AND ix.status<>'CANCELLED' AND ix.due_date<CURRENT_DATE AND ix.paid_amount<ix.total_amount)");
                default -> { }
            }
        }
        if (contractStatus != null && !contractStatus.isBlank()) {
            switch (contractStatus.toUpperCase()) {
                case "ACTIVE" -> where.append(" AND c.status IN ('ACTIVE','EXPIRING') AND c.end_date>CURRENT_DATE");
                case "EXPIRING" -> where.append(" AND c.status IN ('ACTIVE','EXPIRING') AND c.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)");
                case "EXPIRED" -> where.append(" AND (c.status='EXPIRED' OR c.end_date<CURRENT_DATE)");
                default -> { }
            }
        }
        return new QueryParts(where.toString(), params);
    }

    public Summary summary(long userId, RoleCode role, Long propertyId) {
        return jdbc.sql("""
                SELECT COUNT(DISTINCT tp.id) total,
                  COUNT(DISTINCT CASE WHEN tp.status='ACTIVE' AND tr.status='ACTIVE' THEN tp.id END) active_count,
                  COUNT(DISTINCT CASE WHEN c.status IN ('ACTIVE','EXPIRING')
                    AND c.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY) THEN tp.id END) expiring,
                  COUNT(DISTINCT CASE WHEN EXISTS(SELECT 1 FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id
                    WHERE (cx.tenant_profile_id=tp.id OR cx.tenant_id=tp.user_id) AND ix.status<>'CANCELLED'
                    AND ix.due_date<CURRENT_DATE AND ix.paid_amount<ix.total_amount) THEN tp.id END) overdue,
                  COUNT(DISTINCT CASE WHEN tp.status='MOVED_OUT' OR tr.status='MOVED_OUT' THEN tp.id END) moved_out,
                  COUNT(DISTINCT CASE WHEN tpr.status='REGISTERED' THEN tp.id END) temp_registered,
                  COUNT(DISTINCT CASE WHEN COALESCE(tpr.status,'NOT_DECLARED') IN ('NOT_DECLARED','PENDING') THEN tp.id END) temp_pending,
                  COUNT(DISTINCT CASE WHEN tp.user_id IS NULL THEN tp.id END) no_account,
                  COUNT(DISTINCT CASE WHEN EXISTS(SELECT 1 FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id
                    WHERE (cx.tenant_profile_id=tp.id OR cx.tenant_id=tp.user_id) AND ix.status<>'CANCELLED'
                    AND ix.paid_amount<ix.total_amount) THEN tp.id END) debtors,
                  COUNT(DISTINCT CASE WHEN c.status IN ('DRAFT','PENDING_CONFIRMATION') THEN tp.id END) pending_checkin
                FROM tenant_profiles tp
                JOIN tenant_residences tr ON tr.tenant_profile_id=tp.id
                JOIN properties p ON p.id=tr.property_id
                LEFT JOIN contracts c ON c.id=(SELECT c2.id FROM contracts c2
                    WHERE c2.tenant_profile_id=tp.id OR c2.tenant_id=tp.user_id
                    ORDER BY (c2.status IN ('ACTIVE','EXPIRING','PENDING_CONFIRMATION','DRAFT')) DESC,c2.id DESC LIMIT 1)
                LEFT JOIN temporary_residence_records tpr ON tpr.tenant_profile_id=tp.id AND tpr.property_id=p.id
                WHERE %s AND (:propertyId IS NULL OR p.id=:propertyId)
                """.formatted(propertyScope(role, "p")))
                .param("userId", userId).param("propertyId", propertyId)
                .query((rs, n) -> new Summary(rs.getLong("total"), rs.getLong("active_count"),
                        rs.getLong("expiring"), rs.getLong("overdue"), rs.getLong("moved_out"),
                        rs.getLong("temp_registered"), rs.getLong("temp_pending"), rs.getLong("no_account"),
                        rs.getLong("debtors"), rs.getLong("pending_checkin"))).single();
    }

    public Page<TenantRow> list(long userId, RoleCode role, Long propertyId, Long roomId, String status,
                                String temporaryStatus, String accountStatus, String keyword,
                                String debtStatus, String contractStatus, String sort, String direction,
                                int page, int size) {
        QueryParts parts = filters(userId, role, propertyId, roomId, status, temporaryStatus,
                accountStatus, keyword, debtStatus, contractStatus);
        String sortColumn = switch (sort == null ? "" : sort) {
            case "tenantCode" -> "tp.tenant_code";
            case "phone" -> "tp.phone";
            case "roomCode" -> "r.code";
            case "contractEndDate" -> "c.end_date";
            case "outstandingDebt" -> "outstanding_debt";
            case "status" -> "tp.status";
            default -> "tp.full_name";
        };
        String sortDirection = "desc".equalsIgnoreCase(direction) ? "DESC" : "ASC";
        String joins = """
                FROM tenant_profiles tp
                JOIN tenant_residences tr ON tr.id=(
                    SELECT tr2.id FROM tenant_residences tr2 WHERE tr2.tenant_profile_id=tp.id
                    ORDER BY (tr2.status='ACTIVE') DESC,tr2.id DESC LIMIT 1)
                LEFT JOIN contracts c ON c.id=(SELECT c2.id FROM contracts c2
                    WHERE c2.tenant_profile_id=tp.id OR c2.tenant_id=tp.user_id
                    ORDER BY (c2.status IN ('ACTIVE','EXPIRING','PENDING_CONFIRMATION','DRAFT')) DESC,c2.id DESC LIMIT 1)
                LEFT JOIN rooms r ON r.id=COALESCE(c.room_id,tr.room_id)
                JOIN properties p ON p.id=COALESCE(r.property_id,tr.property_id)
                LEFT JOIN users u ON u.id=tp.user_id
                LEFT JOIN temporary_residence_records tpr ON tpr.tenant_profile_id=tp.id AND tpr.property_id=p.id
                """;
        long total = jdbc.sql("SELECT COUNT(*) " + joins + " WHERE " + parts.where())
                .params(parts.params()).query(Long.class).single();
        Map<String, Object> params = new HashMap<>(parts.params());
        params.put("limit", size); params.put("offset", page * size);
        List<TenantRow> rows = jdbc.sql("""
                SELECT tp.id,tp.tenant_code,tp.full_name,tp.phone,tp.email,tp.avatar_url,p.name property_name,
                  r.code room_code,r.building_name,tr.residence_role,
                  CASE WHEN tp.status='INACTIVE' THEN 'INACTIVE'
                    WHEN r.status='NOTICE' OR EXISTS(SELECT 1 FROM rental_checkouts rc WHERE rc.contract_id=c.id AND rc.status IN ('REQUESTED','INSPECTING')) THEN 'NOTICE'
                    WHEN c.status IN ('DRAFT','PENDING_CONFIRMATION') THEN 'PENDING'
                    WHEN c.status='EXPIRED' OR (c.end_date<CURRENT_DATE AND c.status NOT IN ('TERMINATED','CANCELLED')) THEN 'EXPIRED'
                    WHEN tr.status='ACTIVE' AND c.status IN ('ACTIVE','EXPIRING') THEN 'ACTIVE'
                    WHEN tr.status='MOVED_OUT' OR c.status='TERMINATED' THEN 'CHECKED_OUT'
                    ELSE 'INACTIVE' END lifecycle_status,
                  c.code contract_code,c.end_date,tr.move_in_date,
                  COALESCE((SELECT SUM(GREATEST(ix.total_amount-ix.paid_amount,0)) FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id
                    WHERE (cx.tenant_profile_id=tp.id OR cx.tenant_id=tp.user_id) AND ix.status<>'CANCELLED'),0) outstanding_debt,
                  CASE WHEN EXISTS(SELECT 1 FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id WHERE (cx.tenant_profile_id=tp.id OR cx.tenant_id=tp.user_id) AND ix.status<>'CANCELLED' AND ix.due_date<CURRENT_DATE AND ix.paid_amount<ix.total_amount) THEN 'OVERDUE'
                    WHEN EXISTS(SELECT 1 FROM invoices ix JOIN contracts cx ON cx.id=ix.contract_id WHERE (cx.tenant_profile_id=tp.id OR cx.tenant_id=tp.user_id) AND ix.status<>'CANCELLED' AND ix.paid_amount<ix.total_amount) THEN 'WITH_DEBT'
                    ELSE 'NO_DEBT' END financial_status,
                  COALESCE(tpr.status,'NOT_DECLARED') temporary_status,
                  (tp.user_id IS NOT NULL) has_account,u.status account_status
                %s WHERE %s ORDER BY %s %s LIMIT :limit OFFSET :offset
                """.formatted(joins, parts.where(), sortColumn, sortDirection))
                .params(params).query((rs, n) -> new TenantRow(rs.getLong("id"), rs.getString("tenant_code"),
                        rs.getString("full_name"), rs.getString("phone"), rs.getString("email"),
                        rs.getString("avatar_url"), rs.getString("property_name"), rs.getString("room_code"),
                        rs.getString("building_name"), rs.getString("residence_role"), rs.getString("lifecycle_status"),
                        rs.getString("contract_code"), nullableDate(rs, "end_date"),
                        nullableDate(rs, "move_in_date"), rs.getBigDecimal("outstanding_debt"),
                        rs.getString("financial_status"), rs.getString("temporary_status"),
                        rs.getBoolean("has_account"), rs.getString("account_status"))).list();
        return new Page<>(rows, page, size, total, (int) Math.ceil(total / (double) size));
    }

    public long createProfile(SaveTenant request, long actorId) {
        GeneratedKeyHolder keys = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO tenant_profiles(tenant_code,full_name,date_of_birth,gender,phone,email,
                  permanent_address,hometown,occupation,workplace,emergency_contact_name,emergency_contact_phone,
                  identity_type,identity_number,identity_issued_date,identity_issued_place,note,created_by)
                VALUES('PENDING',:fullName,:dateOfBirth,:gender,:phone,:email,:address,:hometown,:occupation,:workplace,
                  :emergencyName,:emergencyPhone,:identityType,:identityNumber,:identityIssuedDate,
                  :identityIssuedPlace,:note,:actorId)
                """).param("fullName", request.fullName().trim()).param("dateOfBirth", request.dateOfBirth())
                .param("gender", blank(request.gender())).param("phone", request.phone().trim())
                .param("email", blank(request.email())).param("address", blank(request.permanentAddress()))
                .param("hometown", blank(request.hometown()))
                .param("occupation", blank(request.occupation())).param("workplace", blank(request.workplace()))
                .param("emergencyName", blank(request.emergencyContactName()))
                .param("emergencyPhone", blank(request.emergencyContactPhone()))
                .param("identityType", blank(request.identityType())).param("identityNumber", blank(request.identityNumber()))
                .param("identityIssuedDate", request.identityIssuedDate())
                .param("identityIssuedPlace", blank(request.identityIssuedPlace())).param("note", blank(request.note()))
                .param("actorId", actorId).update(keys, "id");
        long id = keys.getKey().longValue();
        jdbc.sql("UPDATE tenant_profiles SET tenant_code=:code WHERE id=:id")
                .param("code", "NT%06d".formatted(id)).param("id", id).update();
        return id;
    }

    public void createResidence(long tenantId, long propertyId, Long roomId, Long contractId,
                                LocalDate moveIn, String role, long actorId) {
        jdbc.sql("""
                INSERT INTO tenant_residences(tenant_profile_id,property_id,room_id,contract_id,
                  residence_role,status,move_in_date,created_by)
                VALUES(:tenantId,:propertyId,:roomId,:contractId,:role,'ACTIVE',:moveIn,:actorId)
                """).param("tenantId", tenantId).param("propertyId", propertyId).param("roomId", roomId)
                .param("contractId", contractId).param("role", role == null ? "REPRESENTATIVE" : role)
                .param("moveIn", moveIn == null ? LocalDate.now() : moveIn).param("actorId", actorId).update();
        if (roomId != null) jdbc.sql("UPDATE rooms SET status='OCCUPIED' WHERE id=:roomId")
                .param("roomId", roomId).update();
    }

    public void updateProfile(long id, SaveTenant r) {
        jdbc.sql("""
                UPDATE tenant_profiles SET full_name=:fullName,date_of_birth=:dob,gender=:gender,phone=:phone,
                  email=:email,permanent_address=:address,hometown=:hometown,occupation=:occupation,workplace=:workplace,
                  emergency_contact_name=:emergencyName,emergency_contact_phone=:emergencyPhone,
                  identity_type=:identityType,identity_number=COALESCE(:identityNumber,identity_number),
                  identity_issued_date=:identityIssuedDate,identity_issued_place=:identityIssuedPlace,note=:note
                WHERE id=:id
                """).param("id", id).param("fullName", r.fullName().trim()).param("dob", r.dateOfBirth())
                .param("gender", blank(r.gender())).param("phone", r.phone().trim()).param("email", blank(r.email()))
                .param("address", blank(r.permanentAddress())).param("occupation", blank(r.occupation()))
                .param("hometown", blank(r.hometown()))
                .param("workplace", blank(r.workplace())).param("emergencyName", blank(r.emergencyContactName()))
                .param("emergencyPhone", blank(r.emergencyContactPhone())).param("identityType", blank(r.identityType()))
                .param("identityNumber", blank(r.identityNumber())).param("identityIssuedDate", r.identityIssuedDate())
                .param("identityIssuedPlace", blank(r.identityIssuedPlace())).param("note", blank(r.note())).update();
    }

    public Optional<Map<String, Object>> profile(long id) {
        return jdbc.sql("""
                SELECT tp.*,u.status account_status,
                  CASE WHEN tp.status='INACTIVE' THEN 'INACTIVE'
                    WHEN EXISTS(SELECT 1 FROM rental_checkouts rc JOIN contracts c3 ON c3.id=rc.contract_id WHERE (c3.tenant_profile_id=tp.id OR c3.tenant_id=tp.user_id) AND rc.status IN ('REQUESTED','INSPECTING')) THEN 'NOTICE'
                    WHEN EXISTS(SELECT 1 FROM contracts c3 WHERE (c3.tenant_profile_id=tp.id OR c3.tenant_id=tp.user_id) AND c3.status IN ('DRAFT','PENDING_CONFIRMATION')) THEN 'PENDING'
                    WHEN EXISTS(SELECT 1 FROM contracts c3 WHERE (c3.tenant_profile_id=tp.id OR c3.tenant_id=tp.user_id) AND (c3.status='EXPIRED' OR (c3.end_date<CURRENT_DATE AND c3.status NOT IN ('TERMINATED','CANCELLED')))) THEN 'EXPIRED'
                    WHEN EXISTS(SELECT 1 FROM contracts c3 WHERE (c3.tenant_profile_id=tp.id OR c3.tenant_id=tp.user_id) AND c3.status IN ('ACTIVE','EXPIRING')) THEN 'ACTIVE'
                    WHEN EXISTS(SELECT 1 FROM tenant_residences tr3 WHERE tr3.tenant_profile_id=tp.id AND tr3.status='MOVED_OUT') THEN 'CHECKED_OUT'
                    ELSE 'INACTIVE' END resident_status
                FROM tenant_profiles tp
                LEFT JOIN users u ON u.id=tp.user_id WHERE tp.id=:id
                """).param("id", id).query(AdminTenantRepository::mapRow).optional();
    }

    public List<Residence> residences(long id) {
        return jdbc.sql("""
                SELECT tr.id,tr.property_id,p.name property_name,tr.room_id,r.code room_code,r.building_name,
                  tr.contract_id,c.code contract_code,tr.residence_role,tr.status,tr.move_in_date,tr.move_out_date,tr.note
                FROM tenant_residences tr JOIN properties p ON p.id=tr.property_id
                LEFT JOIN rooms r ON r.id=tr.room_id LEFT JOIN contracts c ON c.id=tr.contract_id
                WHERE tr.tenant_profile_id=:id ORDER BY tr.move_in_date DESC,tr.id DESC
                """).param("id", id).query((rs, n) -> new Residence(rs.getLong("id"), rs.getLong("property_id"),
                        rs.getString("property_name"), nullableLong(rs, "room_id"), rs.getString("room_code"),
                        rs.getString("building_name"), nullableLong(rs, "contract_id"), rs.getString("contract_code"),
                        rs.getString("residence_role"), rs.getString("status"), rs.getObject("move_in_date", LocalDate.class),
                        nullableDate(rs, "move_out_date"), rs.getString("note"))).list();
    }

    public List<ContractItem> contracts(long id) {
        return jdbc.sql("""
                SELECT c.id,c.code,p.name property_name,r.code room_code,c.status,c.start_date,c.end_date,
                  r.monthly_rent,c.deposit_amount,c.payment_cycle,DATEDIFF(c.end_date,CURRENT_DATE) days_to_expiry,
                  COALESCE(SUM(CASE WHEN i.status<>'CANCELLED' THEN GREATEST(i.total_amount-i.paid_amount,0) ELSE 0 END),0) debt
                FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
                LEFT JOIN invoices i ON i.contract_id=c.id
                WHERE c.tenant_profile_id=:id OR c.tenant_id=(SELECT user_id FROM tenant_profiles WHERE id=:id)
                GROUP BY c.id,c.code,p.name,r.code,c.status,c.start_date,c.end_date,r.monthly_rent,
                  c.deposit_amount,c.payment_cycle ORDER BY c.start_date DESC
                """).param("id", id).query((rs, n) -> new ContractItem(rs.getLong("id"), rs.getString("code"),
                        rs.getString("property_name"), rs.getString("room_code"), rs.getString("status"),
                        rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class),
                        rs.getBigDecimal("monthly_rent"), rs.getBigDecimal("deposit_amount"),
                        rs.getString("payment_cycle"), rs.getBigDecimal("debt"), rs.getLong("days_to_expiry"))).list();
    }

    public List<InvoiceItem> invoices(long id) {
        return jdbc.sql("""
                SELECT i.id,i.code,i.billing_period,i.total_amount,i.paid_amount,i.due_date,i.status,
                  COALESCE(SUM(CASE WHEN ii.item_type='ROOM_RENT' THEN ii.amount ELSE 0 END),0) room_amount,
                  COALESCE(SUM(CASE WHEN ii.item_type<>'ROOM_RENT' THEN ii.amount ELSE 0 END),0) service_amount
                FROM invoices i JOIN contracts c ON c.id=i.contract_id
                LEFT JOIN invoice_items ii ON ii.invoice_id=i.id
                WHERE c.tenant_profile_id=:id OR c.tenant_id=(SELECT user_id FROM tenant_profiles WHERE id=:id)
                GROUP BY i.id,i.code,i.billing_period,i.total_amount,i.paid_amount,i.due_date,i.status
                ORDER BY i.billing_period DESC LIMIT 100
                """).param("id", id).query((rs, n) -> new InvoiceItem(rs.getLong("id"), rs.getString("code"),
                        rs.getObject("billing_period", LocalDate.class), rs.getBigDecimal("total_amount"),
                        rs.getBigDecimal("paid_amount"), rs.getBigDecimal("room_amount"),
                        rs.getBigDecimal("service_amount"), rs.getObject("due_date", LocalDate.class),
                        rs.getString("status"))).list();
    }

    public FinancialSummary financial(long id) {
        return jdbc.sql("""
                SELECT COALESCE(SUM(CASE WHEN i.status<>'CANCELLED' THEN i.total_amount ELSE 0 END),0) total_invoiced,
                  COALESCE(SUM(CASE WHEN i.status<>'CANCELLED' THEN i.paid_amount ELSE 0 END),0) total_paid,
                  COALESCE(SUM(CASE WHEN i.status<>'CANCELLED' THEN GREATEST(i.total_amount-i.paid_amount,0) ELSE 0 END),0) outstanding,
                  COALESCE(SUM(CASE WHEN i.status<>'CANCELLED' AND i.due_date<CURRENT_DATE THEN GREATEST(i.total_amount-i.paid_amount,0) ELSE 0 END),0) overdue,
                  COALESCE((SELECT SUM(CASE WHEN c2.status IN ('ACTIVE','EXPIRING','PENDING_CONFIRMATION') THEN c2.deposit_amount ELSE 0 END)
                    FROM contracts c2 WHERE c2.tenant_profile_id=:id OR c2.tenant_id=(SELECT user_id FROM tenant_profiles WHERE id=:id)),0) deposit_held
                FROM contracts c LEFT JOIN invoices i ON i.contract_id=c.id
                WHERE c.tenant_profile_id=:id OR c.tenant_id=(SELECT user_id FROM tenant_profiles WHERE id=:id)
                """).param("id", id).query((rs, n) -> new FinancialSummary(rs.getBigDecimal("total_invoiced"),
                        rs.getBigDecimal("total_paid"), rs.getBigDecimal("outstanding"),
                        rs.getBigDecimal("overdue"), rs.getBigDecimal("deposit_held"))).single();
    }

    public List<PaymentItem> payments(long id) {
        return jdbc.sql("""
                SELECT py.id,py.receipt_code,i.code invoice_code,py.amount,py.payment_method,
                  py.reference_code,py.status,py.paid_at
                FROM payments py JOIN invoices i ON i.id=py.invoice_id JOIN contracts c ON c.id=i.contract_id
                WHERE c.tenant_profile_id=:id OR c.tenant_id=(SELECT user_id FROM tenant_profiles WHERE id=:id)
                ORDER BY py.paid_at DESC LIMIT 100
                """).param("id", id).query((rs, n) -> new PaymentItem(rs.getLong("id"),
                        rs.getString("receipt_code"), rs.getString("invoice_code"), rs.getBigDecimal("amount"),
                        rs.getString("payment_method"), rs.getString("reference_code"), rs.getString("status"),
                        rs.getObject("paid_at", LocalDateTime.class))).list();
    }

    public List<UtilityItem> utilityReadings(long id) {
        return jdbc.sql("""
                SELECT ur.id,ur.billing_period,ur.electricity_previous,ur.electricity_current,
                  GREATEST(COALESCE(ur.electricity_current,0)-COALESCE(ur.electricity_previous,0),0) electricity_consumption,
                  ur.electricity_amount,ur.water_previous,ur.water_current,
                  GREATEST(COALESCE(ur.water_current,0)-COALESCE(ur.water_previous,0),0) water_consumption,ur.water_amount
                FROM utility_readings ur JOIN contracts c ON c.id=ur.contract_id
                WHERE c.tenant_profile_id=:id OR c.tenant_id=(SELECT user_id FROM tenant_profiles WHERE id=:id)
                ORDER BY ur.billing_period DESC LIMIT 100
                """).param("id", id).query((rs, n) -> new UtilityItem(rs.getLong("id"),
                        rs.getObject("billing_period", LocalDate.class), rs.getBigDecimal("electricity_previous"),
                        rs.getBigDecimal("electricity_current"), rs.getBigDecimal("electricity_consumption"),
                        rs.getBigDecimal("electricity_amount"), rs.getBigDecimal("water_previous"),
                        rs.getBigDecimal("water_current"), rs.getBigDecimal("water_consumption"),
                        rs.getBigDecimal("water_amount"))).list();
    }

    public List<CoResidentItem> coResidents(long id) {
        return jdbc.sql("""
                SELECT other.id,other.tenant_code,other.full_name,other.phone,otr.relationship,
                  otr.residence_role,otr.move_in_date,otr.status
                FROM tenant_residences mine JOIN tenant_residences otr
                  ON otr.room_id=mine.room_id AND otr.id<>mine.id AND otr.status='ACTIVE'
                JOIN tenant_profiles other ON other.id=otr.tenant_profile_id
                WHERE mine.tenant_profile_id=:id AND mine.status='ACTIVE'
                ORDER BY other.full_name
                """).param("id", id).query((rs, n) -> new CoResidentItem(rs.getLong("id"),
                        rs.getString("tenant_code"), rs.getString("full_name"), rs.getString("phone"),
                        rs.getString("relationship"), rs.getString("residence_role"),
                        rs.getObject("move_in_date", LocalDate.class), rs.getString("status"))).list();
    }

    public List<MaintenanceItem> maintenanceRequests(long id) {
        return jdbc.sql("""
                SELECT m.id,m.code,m.title,m.issue_type,m.priority,m.status,m.created_at
                FROM maintenance_requests m JOIN tenant_profiles tp ON tp.user_id=m.tenant_id
                WHERE tp.id=:id ORDER BY m.created_at DESC LIMIT 100
                """).param("id", id).query((rs, n) -> new MaintenanceItem(rs.getLong("id"),
                        rs.getString("code"), rs.getString("title"), rs.getString("issue_type"),
                        rs.getString("priority"), rs.getString("status"),
                        rs.getObject("created_at", LocalDateTime.class))).list();
    }

    public List<TemporaryResidenceItem> temporaryResidences(long id) {
        return jdbc.sql("""
                SELECT t.property_id,p.name property_name,t.registration_code,t.registered_at,t.expires_at,t.status,t.note
                FROM temporary_residence_records t JOIN properties p ON p.id=t.property_id
                WHERE t.tenant_profile_id=:id ORDER BY t.updated_at DESC
                """).param("id", id).query((rs, n) -> new TemporaryResidenceItem(rs.getLong("property_id"),
                        rs.getString("property_name"), rs.getString("registration_code"),
                        nullableDate(rs, "registered_at"), nullableDate(rs, "expires_at"),
                        rs.getString("status"), rs.getString("note"))).list();
    }

    public List<DocumentItem> documents(long id) {
        return jdbc.sql("""
                SELECT id,document_type,original_name,content_type,file_size,uploaded_at
                FROM tenant_documents WHERE tenant_profile_id=:id ORDER BY uploaded_at DESC
                """).param("id", id).query((rs, n) -> new DocumentItem(rs.getLong("id"),
                        rs.getString("document_type"), rs.getString("original_name"), rs.getString("content_type"),
                        rs.getLong("file_size"), rs.getObject("uploaded_at", LocalDateTime.class))).list();
    }

    public List<ActivityItem> activities(long id) {
        return jdbc.sql("""
                SELECT a.id,a.action,a.description,u.full_name actor_name,a.created_at
                FROM tenant_activity_logs a LEFT JOIN users u ON u.id=a.actor_id
                WHERE a.tenant_profile_id=:id ORDER BY a.created_at DESC LIMIT 100
                """).param("id", id).query((rs, n) -> new ActivityItem(rs.getLong("id"),
                        rs.getString("action"), rs.getString("description"), rs.getString("actor_name"),
                        rs.getObject("created_at", LocalDateTime.class))).list();
    }

    public Optional<Map<String, Object>> activeResidence(long tenantId) {
        return jdbc.sql("""
                SELECT tr.*,r.property_id room_property_id,r.status room_status FROM tenant_residences tr
                LEFT JOIN rooms r ON r.id=tr.room_id
                WHERE tr.tenant_profile_id=:tenantId AND tr.status='ACTIVE' ORDER BY tr.id DESC LIMIT 1
                """).param("tenantId", tenantId).query(AdminTenantRepository::mapRow).optional();
    }

    public Map<String, Object> room(long roomId) {
        return jdbc.sql("SELECT id,property_id,status FROM rooms WHERE id=:id")
                .param("id", roomId).query(AdminTenantRepository::mapRow).optional().orElse(Map.of());
    }

    public void transfer(long tenantId, long residenceId, Long fromRoomId, long toRoomId,
                         LocalDate date, String reason, long actorId) {
        jdbc.sql("UPDATE tenant_residences SET status='TRANSFERRED',move_out_date=:date,note=:reason WHERE id=:id")
                .param("date", date).param("reason", blank(reason)).param("id", residenceId).update();
        releaseRoomIfEmpty(fromRoomId);
        Map<String, Object> room = room(toRoomId);
        createResidence(tenantId, ((Number) room.get("property_id")).longValue(), toRoomId, null, date,
                "REPRESENTATIVE", actorId);
        jdbc.sql("""
                INSERT INTO tenant_room_transfers(tenant_profile_id,from_residence_id,from_room_id,to_room_id,
                  transfer_date,reason,created_by)
                VALUES(:tenantId,:residenceId,:fromRoom,:toRoom,:date,:reason,:actorId)
                """).param("tenantId", tenantId).param("residenceId", residenceId).param("fromRoom", fromRoomId)
                .param("toRoom", toRoomId).param("date", date).param("reason", blank(reason))
                .param("actorId", actorId).update();
    }

    public void moveOut(long tenantId, long residenceId, Long roomId, Long contractId,
                        LocalDate date, String reason, boolean closeContract) {
        jdbc.sql("UPDATE tenant_residences SET status='MOVED_OUT',move_out_date=:date,note=:reason WHERE id=:id")
                .param("date", date).param("reason", blank(reason)).param("id", residenceId).update();
        jdbc.sql("UPDATE tenant_profiles SET status='MOVED_OUT' WHERE id=:id")
                .param("id", tenantId).update();
        releaseRoomIfEmpty(roomId);
        if (closeContract && contractId != null) jdbc.sql("""
                UPDATE contracts SET status='TERMINATED',end_date=LEAST(end_date,:date) WHERE id=:id
                """).param("date", date).param("id", contractId).update();
    }

    public void upsertTemporary(long tenantId, long propertyId, String code, LocalDate registeredAt,
                                LocalDate expiresAt, String status, String note, long actorId) {
        jdbc.sql("""
                INSERT INTO temporary_residence_records(tenant_profile_id,property_id,registration_code,
                  registered_at,expires_at,status,note,updated_by)
                VALUES(:tenantId,:propertyId,:code,:registeredAt,:expiresAt,:status,:note,:actorId)
                ON DUPLICATE KEY UPDATE registration_code=VALUES(registration_code),registered_at=VALUES(registered_at),
                  expires_at=VALUES(expires_at),status=VALUES(status),note=VALUES(note),updated_by=VALUES(updated_by)
                """).param("tenantId", tenantId).param("propertyId", propertyId).param("code", blank(code))
                .param("registeredAt", registeredAt).param("expiresAt", expiresAt).param("status", status)
                .param("note", blank(note)).param("actorId", actorId).update();
    }

    public void addDocument(long tenantId, String type, String name, String contentType,
                            byte[] bytes, long actorId) {
        jdbc.sql("""
                INSERT INTO tenant_documents(tenant_profile_id,document_type,original_name,content_type,
                  file_size,file_content,uploaded_by) VALUES(:tenantId,:type,:name,:contentType,:size,:content,:actorId)
                """).param("tenantId", tenantId).param("type", type).param("name", name)
                .param("contentType", contentType).param("size", bytes.length).param("content", bytes)
                .param("actorId", actorId).update();
    }

    public Optional<Map<String, Object>> document(long tenantId, long documentId) {
        return jdbc.sql("""
                SELECT id,original_name,content_type,file_content FROM tenant_documents
                WHERE tenant_profile_id=:tenantId AND id=:documentId
                """).param("tenantId", tenantId).param("documentId", documentId)
                .query(AdminTenantRepository::mapRow).optional();
    }

    public void addActivity(long tenantId, long actorId, String action, String description) {
        jdbc.sql("""
                INSERT INTO tenant_activity_logs(tenant_profile_id,actor_id,action,description)
                VALUES(:tenantId,:actorId,:action,:description)
                """).param("tenantId", tenantId).param("actorId", actorId).param("action", action)
                .param("description", description).update();
    }

    public boolean profilePhoneExists(String phone, Long excludedId) {
        return jdbc.sql("SELECT COUNT(*) FROM tenant_profiles WHERE phone=:phone AND (:id IS NULL OR id<>:id)")
                .param("phone", phone).param("id", excludedId).query(Long.class).single() > 0;
    }

    public boolean profileEmailExists(String email, Long excludedId) {
        return jdbc.sql("SELECT COUNT(*) FROM tenant_profiles WHERE LOWER(email)=LOWER(:email) AND (:id IS NULL OR id<>:id)")
                .param("email", email).param("id", excludedId).query(Long.class).single() > 0;
    }

    public boolean profileIdentityExists(String identityNumber, Long excludedId) {
        return jdbc.sql("SELECT COUNT(*) FROM tenant_profiles WHERE identity_number=:identity AND (:id IS NULL OR id<>:id)")
                .param("identity", identityNumber).param("id", excludedId).query(Long.class).single() > 0;
    }

    public boolean emailExists(String email) {
        return jdbc.sql("SELECT COUNT(*) FROM users WHERE LOWER(email)=LOWER(:email)")
                .param("email", email).query(Long.class).single() > 0;
    }

    public long createAccount(long tenantId, String email, String passwordHash) {
        GeneratedKeyHolder keys = new GeneratedKeyHolder();
        Map<String, Object> profile = profile(tenantId).orElseThrow();
        jdbc.sql("""
                INSERT INTO users(email,password_hash,full_name,phone,status,must_change_password)
                VALUES(:email,:password,:fullName,NULL,'ACTIVE',TRUE)
                """).param("email", email.toLowerCase()).param("password", passwordHash)
                .param("fullName", profile.get("full_name")).update(keys, "id");
        long userId = keys.getKey().longValue();
        jdbc.sql("""
                INSERT INTO user_roles(user_id,role_id) SELECT :userId,id FROM roles WHERE code='TENANT'
                """).param("userId", userId).update();
        jdbc.sql("UPDATE tenant_profiles SET user_id=:userId,email=:email WHERE id=:tenantId")
                .param("userId", userId).param("email", email.toLowerCase()).param("tenantId", tenantId).update();
        return userId;
    }

    public void updateAccountStatus(long tenantId, String status) {
        jdbc.sql("""
                UPDATE users u JOIN tenant_profiles tp ON tp.user_id=u.id
                SET u.status=:status,u.locked_until=NULL,u.failed_login_attempts=0 WHERE tp.id=:tenantId
                """).param("status", status).param("tenantId", tenantId).update();
    }

    public List<TenantRow> exportRows(long userId, RoleCode role, Long propertyId, String keyword) {
        return list(userId, role, propertyId, null, null, null, null, keyword, null, null,
                "fullName", "asc", 0, 10_000).items();
    }

    private void releaseRoomIfEmpty(Long roomId) {
        if (roomId == null) return;
        jdbc.sql("""
                UPDATE rooms r SET r.status='VACANT' WHERE r.id=:roomId
                  AND NOT EXISTS (SELECT 1 FROM tenant_residences tr
                    WHERE tr.room_id=r.id AND tr.status='ACTIVE')
                """).param("roomId", roomId).update();
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        return value == null ? null : ((Number) value).longValue();
    }
    private static LocalDate nullableDate(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, LocalDate.class);
    }
    private static Map<String, Object> mapRow(ResultSet rs, int rowNumber) throws SQLException {
        Map<String, Object> values = new HashMap<>();
        var metadata = rs.getMetaData();
        for (int index = 1; index <= metadata.getColumnCount(); index++)
            values.put(metadata.getColumnLabel(index), rs.getObject(index));
        return values;
    }
}
