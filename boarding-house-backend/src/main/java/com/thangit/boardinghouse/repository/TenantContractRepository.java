package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.dto.response.contract.TenantContractResponses.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public class TenantContractRepository {
    private final JdbcClient jdbc;

    public TenantContractRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ContractSummary> findContracts(Long tenantId, String status, int page, int size, String sort) {
        String statusFilter = statusFilter(status);
        String order = switch (sort) {
            case "startDate,asc" -> "c.start_date ASC";
            case "startDate,desc" -> "c.start_date DESC";
            case "endDate,asc" -> "c.end_date ASC";
            default -> "c.end_date DESC";
        };
        String sql = """
                SELECT c.id,c.code,p.name property_name,p.address property_address,r.code room_code,
                       c.start_date,c.end_date,r.monthly_rent,c.deposit_amount,c.status,
                       EXISTS(SELECT 1 FROM contract_documents d
                              WHERE d.contract_id=c.id AND d.tenant_visible=TRUE AND d.file_content IS NOT NULL) has_document,
                       EXISTS(SELECT 1 FROM contract_extension_requests er
                              WHERE er.contract_id=c.id AND er.status='PENDING') pending_extension,
                       EXISTS(SELECT 1 FROM contract_termination_requests tr
                              WHERE tr.contract_id=c.id AND tr.status='PENDING') pending_termination
                FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
                WHERE c.tenant_id=:tenantId AND c.status<>'DRAFT' %s
                ORDER BY %s LIMIT :size OFFSET :offset
                """.formatted(statusFilter, order);
        JdbcClient.StatementSpec statement = jdbc.sql(sql).param("tenantId", tenantId)
                .param("size", size).param("offset", page * size);
        if (status != null && !Set.of("ACTIVE", "EXPIRING", "EXPIRED").contains(status)) {
            statement = statement.param("status", status);
        }
        return statement.query((rs, row) -> {
            String contractStatus = effectiveStatus(
                    rs.getString("status"), rs.getObject("end_date", LocalDate.class));
            boolean pendingExtension = rs.getBoolean("pending_extension");
            boolean pendingTermination = rs.getBoolean("pending_termination");
            return new ContractSummary(
                    rs.getLong("id"), rs.getString("code"), rs.getString("property_name"),
                    rs.getString("property_address"), rs.getString("room_code"),
                    rs.getObject("start_date", LocalDate.class), rs.getObject("end_date", LocalDate.class),
                    rs.getBigDecimal("monthly_rent"), rs.getBigDecimal("deposit_amount"),
                    Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(
                            LocalDate.now(), rs.getObject("end_date", LocalDate.class))),
                    "REPRESENTATIVE", contractStatus, rs.getBoolean("has_document"),
                    canAct(contractStatus) && !pendingExtension,
                    canAct(contractStatus) && !pendingTermination);
        }).list();
    }

    public long countContracts(Long tenantId, String status) {
        String sql = "SELECT COUNT(*) FROM contracts c WHERE c.tenant_id=:tenantId AND c.status<>'DRAFT'"
                + statusFilter(status);
        JdbcClient.StatementSpec statement = jdbc.sql(sql).param("tenantId", tenantId);
        if (status != null && !Set.of("ACTIVE", "EXPIRING", "EXPIRED").contains(status)) {
            statement = statement.param("status", status);
        }
        return statement.query(Long.class).single();
    }

    public boolean existsContract(Long contractId) {
        return jdbc.sql("SELECT COUNT(*) FROM contracts WHERE id=:id")
                .param("id", contractId).query(Long.class).single() > 0;
    }

    public Optional<ContractBase> findContract(Long tenantId, Long contractId) {
        String sql = """
                SELECT c.id,c.code,c.contract_type,c.status,c.created_at,c.signed_at,c.start_date,c.end_date,
                       c.payment_cycle,c.payment_due_day,c.notice_period_days,c.deposit_amount,
                       c.reservation_amount,c.management_fee,c.fixed_service_fee,c.discount_amount,
                       p.id property_id,p.name property_name,p.address property_address,
                       r.building_name,r.floor_name,r.id room_id,r.code room_code,r.room_type,r.area,
                       r.capacity,r.status room_status,r.image_url,r.monthly_rent,c.occupant_count,
                       owner.full_name landlord_name,owner.phone landlord_phone,owner.email landlord_email,
                       tenant.full_name tenant_name,tenant.phone tenant_phone,tenant.email tenant_email
                FROM contracts c JOIN rooms r ON r.id=c.room_id JOIN properties p ON p.id=r.property_id
                JOIN users owner ON owner.id=p.owner_id JOIN users tenant ON tenant.id=c.tenant_id
                WHERE c.id=:contractId AND c.tenant_id=:tenantId AND c.status<>'DRAFT'
                """;
        return jdbc.sql(sql).param("tenantId", tenantId).param("contractId", contractId)
                .query((rs, row) -> new ContractBase(
                        rs.getLong("id"), rs.getString("code"), rs.getString("contract_type"),
                        rs.getString("status"), rs.getObject("created_at", LocalDateTime.class),
                        rs.getObject("signed_at", LocalDateTime.class), rs.getObject("start_date", LocalDate.class),
                        rs.getObject("end_date", LocalDate.class), rs.getString("payment_cycle"),
                        rs.getInt("payment_due_day"), rs.getInt("notice_period_days"),
                        rs.getBigDecimal("deposit_amount"), rs.getBigDecimal("reservation_amount"),
                        rs.getBigDecimal("management_fee"), rs.getBigDecimal("fixed_service_fee"),
                        rs.getBigDecimal("discount_amount"), rs.getLong("property_id"),
                        rs.getString("property_name"), rs.getString("property_address"),
                        rs.getString("building_name"), rs.getString("floor_name"), rs.getLong("room_id"),
                        rs.getString("room_code"), rs.getString("room_type"), rs.getBigDecimal("area"),
                        rs.getInt("capacity"), rs.getString("room_status"), rs.getString("image_url"),
                        rs.getBigDecimal("monthly_rent"), rs.getInt("occupant_count"),
                        rs.getString("landlord_name"), rs.getString("landlord_phone"),
                        rs.getString("landlord_email"), rs.getString("tenant_name"),
                        rs.getString("tenant_phone"), rs.getString("tenant_email"))).optional();
    }

    public List<RateInfo> utilityRates(Long contractId) {
        return jdbc.sql("""
                SELECT id,code,name,calculation_method,unit_price,unit,effective_date
                FROM contract_utility_rates WHERE contract_id=:id ORDER BY code
                """).param("id", contractId).query((rs, row) -> new RateInfo(
                rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                rs.getString("calculation_method"), rs.getBigDecimal("unit_price"),
                rs.getString("unit"), rs.getObject("effective_date", LocalDate.class))).list();
    }

    public List<ServiceInfo> services(Long contractId) {
        return jdbc.sql("""
                SELECT id,code,name,calculation_method,unit_price,billing_cycle,effective_date
                FROM contract_services WHERE contract_id=:id ORDER BY name
                """).param("id", contractId).query((rs, row) -> new ServiceInfo(
                rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                rs.getString("calculation_method"), rs.getBigDecimal("unit_price"),
                rs.getString("billing_cycle"), rs.getObject("effective_date", LocalDate.class))).list();
    }

    public List<OccupantInfo> occupants(Long contractId) {
        return jdbc.sql("""
                SELECT id,full_name,relationship,move_in_date,residence_status,
                       temporary_residence_status,identity_last_four
                FROM contract_occupants WHERE contract_id=:id ORDER BY move_in_date
                """).param("id", contractId).query((rs, row) -> new OccupantInfo(
                rs.getLong("id"), rs.getString("full_name"), rs.getString("relationship"),
                rs.getObject("move_in_date", LocalDate.class), rs.getString("residence_status"),
                rs.getString("temporary_residence_status"), mask(rs.getString("identity_last_four")))).list();
    }

    public List<AssetInfo> assets(Long contractId) {
        return jdbc.sql("""
                SELECT id,name,quantity,handover_condition,note,image_url
                FROM contract_assets WHERE contract_id=:id ORDER BY name
                """).param("id", contractId).query((rs, row) -> new AssetInfo(
                rs.getLong("id"), rs.getString("name"), rs.getInt("quantity"),
                rs.getString("handover_condition"), rs.getString("note"), rs.getString("image_url"))).list();
    }

    public List<TermInfo> terms(Long contractId) {
        return jdbc.sql("""
                SELECT id,title,content,display_order FROM contract_terms
                WHERE contract_id=:id ORDER BY display_order,id
                """).param("id", contractId).query((rs, row) -> new TermInfo(
                rs.getLong("id"), rs.getString("title"), rs.getString("content"),
                rs.getInt("display_order"))).list();
    }

    public List<DocumentInfo> documents(Long contractId) {
        return jdbc.sql("""
                SELECT d.id,d.original_name,d.content_type,d.file_size,d.uploaded_at,
                       u.full_name uploaded_by,d.file_content IS NOT NULL downloadable
                FROM contract_documents d LEFT JOIN users u ON u.id=d.uploaded_by
                WHERE d.contract_id=:id AND d.tenant_visible=TRUE ORDER BY d.uploaded_at DESC
                """).param("id", contractId).query((rs, row) -> new DocumentInfo(
                rs.getLong("id"), rs.getString("original_name"), rs.getString("content_type"),
                rs.getLong("file_size"), rs.getObject("uploaded_at", LocalDateTime.class),
                rs.getString("uploaded_by"), rs.getBoolean("downloadable"))).list();
    }

    public List<HistoryInfo> history(Long contractId) {
        return jdbc.sql("""
                SELECT id,event_type,description,actor_name,note,occurred_at FROM contract_history
                WHERE contract_id=:id AND tenant_visible=TRUE ORDER BY occurred_at DESC
                """).param("id", contractId).query((rs, row) -> new HistoryInfo(
                rs.getLong("id"), rs.getString("event_type"), rs.getString("description"),
                rs.getString("actor_name"), rs.getString("note"),
                rs.getObject("occurred_at", LocalDateTime.class))).list();
    }

    public Optional<RequestInfo> pendingExtension(Long contractId) {
        return jdbc.sql("""
                SELECT id,status,requested_end_date,note,created_at FROM contract_extension_requests
                WHERE contract_id=:id AND status='PENDING' ORDER BY created_at DESC LIMIT 1
                """).param("id", contractId).query((rs, row) -> new RequestInfo(
                rs.getLong("id"), rs.getString("status"),
                rs.getObject("requested_end_date", LocalDate.class), rs.getString("note"),
                rs.getObject("created_at", LocalDateTime.class))).optional();
    }

    public Optional<RequestInfo> pendingTermination(Long contractId) {
        return jdbc.sql("""
                SELECT id,status,expected_move_out_date,note,created_at FROM contract_termination_requests
                WHERE contract_id=:id AND status='PENDING' ORDER BY created_at DESC LIMIT 1
                """).param("id", contractId).query((rs, row) -> new RequestInfo(
                rs.getLong("id"), rs.getString("status"),
                rs.getObject("expected_move_out_date", LocalDate.class), rs.getString("note"),
                rs.getObject("created_at", LocalDateTime.class))).optional();
    }

    public long createExtension(Long contractId, Long tenantId, LocalDate requestedEndDate, String note) {
        return jdbc.sql("""
                INSERT INTO contract_extension_requests(contract_id,tenant_id,requested_end_date,note)
                VALUES(:contractId,:tenantId,:requestedEndDate,:note)
                """).param("contractId", contractId).param("tenantId", tenantId)
                .param("requestedEndDate", requestedEndDate).param("note", note)
                .update();
    }

    public long createTermination(Long contractId, Long tenantId, LocalDate expectedMoveOutDate,
                                  String reason, String note, String phone) {
        return jdbc.sql("""
                INSERT INTO contract_termination_requests(
                    contract_id,tenant_id,expected_move_out_date,reason,note,contact_phone)
                VALUES(:contractId,:tenantId,:date,:reason,:note,:phone)
                """).param("contractId", contractId).param("tenantId", tenantId).param("date", expectedMoveOutDate)
                .param("reason", reason).param("note", note).param("phone", phone).update();
    }

    public void addHistory(Long contractId, String eventType, String description, String actorName, String note) {
        jdbc.sql("""
                INSERT INTO contract_history(contract_id,event_type,description,actor_name,note,tenant_visible)
                VALUES(:contractId,:eventType,:description,:actorName,:note,TRUE)
                """).param("contractId", contractId).param("eventType", eventType)
                .param("description", description).param("actorName", actorName).param("note", note).update();
    }

    public Optional<DocumentFile> primaryDocument(Long tenantId, Long contractId) {
        return jdbc.sql("""
                SELECT d.original_name,d.content_type,d.file_content
                FROM contract_documents d JOIN contracts c ON c.id=d.contract_id
                WHERE d.contract_id=:contractId AND c.tenant_id=:tenantId
                  AND d.tenant_visible=TRUE AND d.file_content IS NOT NULL
                ORDER BY (d.content_type='application/pdf') DESC,d.uploaded_at DESC LIMIT 1
                """).param("contractId", contractId).param("tenantId", tenantId)
                .query((rs, row) -> new DocumentFile(
                        rs.getString("original_name"), rs.getString("content_type"),
                        rs.getBytes("file_content"))).optional();
    }

    private static boolean canAct(String status) {
        return "ACTIVE".equals(status) || "EXPIRING".equals(status);
    }
    private static String statusFilter(String status) {
        if (status == null) return "";
        return switch (status) {
            case "ACTIVE" -> " AND c.status='ACTIVE' AND c.end_date>DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)";
            case "EXPIRING" -> " AND c.status IN ('ACTIVE','EXPIRING') AND c.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)";
            case "EXPIRED" -> " AND ((c.status IN ('ACTIVE','EXPIRING') AND c.end_date<CURRENT_DATE) OR c.status='EXPIRED')";
            default -> " AND c.status=:status";
        };
    }
    public static String effectiveStatus(String status, LocalDate endDate) {
        if (!"ACTIVE".equals(status) && !"EXPIRING".equals(status)) return status;
        if (endDate.isBefore(LocalDate.now())) return "EXPIRED";
        if (!endDate.isAfter(LocalDate.now().plusDays(30))) return "EXPIRING";
        return "ACTIVE";
    }
    private static String mask(String lastFour) {
        return lastFour == null || lastFour.isBlank() ? null : "********" + lastFour;
    }

    public record ContractBase(
            Long id, String code, String contractType, String status, LocalDateTime createdAt,
            LocalDateTime signedAt, LocalDate startDate, LocalDate endDate, String paymentCycle,
            int paymentDueDay, int noticePeriodDays, BigDecimal depositAmount,
            BigDecimal reservationAmount, BigDecimal managementFee, BigDecimal fixedServiceFee,
            BigDecimal discountAmount, Long propertyId, String propertyName, String propertyAddress,
            String buildingName, String floorName, Long roomId, String roomCode, String roomType,
            BigDecimal area, int capacity, String roomStatus, String imageUrl, BigDecimal monthlyRent,
            int occupantCount, String landlordName, String landlordPhone, String landlordEmail,
            String tenantName, String tenantPhone, String tenantEmail
    ) {}
    public record DocumentFile(String fileName, String contentType, byte[] content) {}
}
