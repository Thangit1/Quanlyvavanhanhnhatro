package com.thangit.boardinghouse.repository;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.UpdateAi;
import com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.UpdateBilling;
import com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.UpdateProperty;
import com.thangit.boardinghouse.dto.response.setting.AdminSettingResponses.*;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AdminSettingRepository {
    private final JdbcClient jdbc;

    public AdminSettingRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private String propertyScope(RoleCode role, String alias) {
        return role == RoleCode.OWNER
                ? alias + ".owner_id=:userId"
                : "EXISTS (SELECT 1 FROM property_managers pm WHERE pm.property_id=" + alias
                    + ".id AND pm.manager_id=:userId)";
    }

    public long ownerId(long userId, RoleCode role) {
        if (role == RoleCode.OWNER) return userId;
        return jdbc.sql("""
                SELECT p.owner_id FROM properties p JOIN property_managers pm ON pm.property_id=p.id
                WHERE pm.manager_id=:userId ORDER BY p.id LIMIT 1
                """).param("userId", userId).query(Long.class).optional().orElse(userId);
    }

    public boolean canAccessProperty(long userId, RoleCode role, long propertyId) {
        return jdbc.sql("SELECT COUNT(*) FROM properties p WHERE p.id=:propertyId AND "
                        + propertyScope(role, "p"))
                .param("userId", userId).param("propertyId", propertyId)
                .query(Long.class).single() > 0;
    }

    public List<PropertyOption> properties(long userId, RoleCode role) {
        return jdbc.sql("SELECT p.id,p.name FROM properties p WHERE " + propertyScope(role, "p")
                        + " ORDER BY p.name")
                .param("userId", userId)
                .query((rs, row) -> new PropertyOption(rs.getLong("id"), rs.getString("name"))).list();
    }

    public Map<String, Object> group(long ownerId, String group) {
        Map<String, Object> values = new LinkedHashMap<>();
        jdbc.sql("""
                SELECT setting_key,setting_value,value_type FROM system_settings
                WHERE owner_id=:ownerId AND setting_group=:group AND is_sensitive=FALSE
                ORDER BY setting_key
                """).param("ownerId", ownerId).param("group", group)
                .query((rs, row) -> {
                    values.put(rs.getString("setting_key"), typedValue(rs));
                    return 1;
                }).list();
        return values;
    }

    public void saveGroup(long ownerId, String group, Map<String, Object> values, long actorId) {
        values.forEach((key, value) -> jdbc.sql("""
                INSERT INTO system_settings(owner_id,setting_group,setting_key,setting_value,value_type,updated_by)
                VALUES(:ownerId,:group,:key,:value,:type,:actorId)
                ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),value_type=VALUES(value_type),
                  updated_by=VALUES(updated_by),updated_at=CURRENT_TIMESTAMP(6)
                """).param("ownerId", ownerId).param("group", group).param("key", key)
                .param("value", value == null ? "" : String.valueOf(value))
                .param("type", typeOf(value)).param("actorId", actorId).update());
    }

    public Optional<PropertySetting> property(long userId, RoleCode role, long propertyId) {
        return jdbc.sql("""
                SELECT p.id,p.name,p.code,p.address,s.manager_name,s.manager_phone,s.manager_email,s.working_hours,
                  COALESCE(s.billing_day,1) billing_day,COALESCE(s.payment_due_day,5) payment_due_day,
                  COALESCE(s.meter_reading_day,28) meter_reading_day,
                  COALESCE(s.default_maximum_occupants,3) default_maximum_occupants,
                  s.quiet_hours_start,s.quiet_hours_end,COALESCE(s.allow_pets,FALSE) allow_pets,
                  COALESCE(s.allow_visitors,TRUE) allow_visitors,s.visitor_rules,s.vehicle_rules,
                  s.house_rules,s.emergency_contact
                FROM properties p LEFT JOIN property_settings s ON s.property_id=p.id
                WHERE p.id=:propertyId AND %s
                """.formatted(propertyScope(role, "p")))
                .param("userId", userId).param("propertyId", propertyId)
                .query((rs, row) -> new PropertySetting(rs.getLong("id"), rs.getString("name"),
                        rs.getString("code"), rs.getString("address"), rs.getString("manager_name"),
                        rs.getString("manager_phone"), rs.getString("manager_email"),
                        rs.getString("working_hours"), rs.getInt("billing_day"),
                        rs.getInt("payment_due_day"), rs.getInt("meter_reading_day"),
                        rs.getInt("default_maximum_occupants"), time(rs, "quiet_hours_start"),
                        time(rs, "quiet_hours_end"), rs.getBoolean("allow_pets"),
                        rs.getBoolean("allow_visitors"), rs.getString("visitor_rules"),
                        rs.getString("vehicle_rules"), rs.getString("house_rules"),
                        rs.getString("emergency_contact"))).optional();
    }

    public void updateProperty(long propertyId, UpdateProperty request, long actorId) {
        jdbc.sql("UPDATE properties SET name=:name WHERE id=:id")
                .param("name", request.propertyName().trim()).param("id", propertyId).update();
        jdbc.sql("""
                INSERT INTO property_settings(property_id,manager_name,manager_phone,manager_email,working_hours,
                  billing_day,payment_due_day,meter_reading_day,default_maximum_occupants,quiet_hours_start,
                  quiet_hours_end,allow_pets,allow_visitors,visitor_rules,vehicle_rules,house_rules,
                  emergency_contact,updated_by)
                VALUES(:propertyId,:managerName,:managerPhone,:managerEmail,:workingHours,:billingDay,:paymentDueDay,
                  :meterReadingDay,:maximumOccupants,:quietStart,:quietEnd,:allowPets,:allowVisitors,:visitorRules,
                  :vehicleRules,:houseRules,:emergencyContact,:actorId)
                ON DUPLICATE KEY UPDATE manager_name=VALUES(manager_name),manager_phone=VALUES(manager_phone),
                  manager_email=VALUES(manager_email),working_hours=VALUES(working_hours),
                  billing_day=VALUES(billing_day),payment_due_day=VALUES(payment_due_day),
                  meter_reading_day=VALUES(meter_reading_day),
                  default_maximum_occupants=VALUES(default_maximum_occupants),
                  quiet_hours_start=VALUES(quiet_hours_start),quiet_hours_end=VALUES(quiet_hours_end),
                  allow_pets=VALUES(allow_pets),allow_visitors=VALUES(allow_visitors),
                  visitor_rules=VALUES(visitor_rules),vehicle_rules=VALUES(vehicle_rules),
                  house_rules=VALUES(house_rules),emergency_contact=VALUES(emergency_contact),
                  updated_by=VALUES(updated_by),updated_at=CURRENT_TIMESTAMP(6)
                """).param("propertyId", propertyId).param("managerName", blank(request.managerName()))
                .param("managerPhone", blank(request.managerPhone())).param("managerEmail", blank(request.managerEmail()))
                .param("workingHours", blank(request.workingHours())).param("billingDay", request.billingDay())
                .param("paymentDueDay", request.paymentDueDay()).param("meterReadingDay", request.meterReadingDay())
                .param("maximumOccupants", request.defaultMaximumOccupants())
                .param("quietStart", request.quietHoursStart()).param("quietEnd", request.quietHoursEnd())
                .param("allowPets", request.allowPets()).param("allowVisitors", request.allowVisitors())
                .param("visitorRules", blank(request.visitorRules())).param("vehicleRules", blank(request.vehicleRules()))
                .param("houseRules", blank(request.houseRules())).param("emergencyContact", blank(request.emergencyContact()))
                .param("actorId", actorId).update();
    }

    public Billing billing(long ownerId) {
        return jdbc.sql("SELECT * FROM billing_settings WHERE owner_id=:ownerId")
                .param("ownerId", ownerId).query((rs, row) -> new Billing(
                        rs.getBoolean("auto_generate_invoices"), rs.getInt("invoice_generation_day"),
                        rs.getInt("default_due_day"), rs.getBoolean("allow_partial_payment"),
                        rs.getBoolean("carry_forward_debt"), rs.getBoolean("late_fee_enabled"),
                        rs.getString("late_fee_type"), rs.getBigDecimal("late_fee_value"),
                        csvNumbers(rs.getString("reminder_days_before_due")),
                        csvNumbers(rs.getString("reminder_days_after_due")),
                        rs.getBoolean("require_cancellation_reason"))).optional()
                .orElse(new Billing(false, 1, 5, true, true, false, "FIXED", BigDecimal.ZERO,
                        List.of(3, 1), List.of(1, 3, 7), true));
    }

    public void updateBilling(long ownerId, UpdateBilling r, long actorId) {
        jdbc.sql("""
                INSERT INTO billing_settings(owner_id,auto_generate_invoices,invoice_generation_day,default_due_day,
                  allow_partial_payment,carry_forward_debt,late_fee_enabled,late_fee_type,late_fee_value,
                  reminder_days_before_due,reminder_days_after_due,require_cancellation_reason,updated_by)
                VALUES(:ownerId,:autoGenerate,:generationDay,:dueDay,:partial,:carryDebt,:lateEnabled,:lateType,
                  :lateValue,:beforeDue,:afterDue,:cancellationReason,:actorId)
                ON DUPLICATE KEY UPDATE auto_generate_invoices=VALUES(auto_generate_invoices),
                  invoice_generation_day=VALUES(invoice_generation_day),default_due_day=VALUES(default_due_day),
                  allow_partial_payment=VALUES(allow_partial_payment),carry_forward_debt=VALUES(carry_forward_debt),
                  late_fee_enabled=VALUES(late_fee_enabled),late_fee_type=VALUES(late_fee_type),
                  late_fee_value=VALUES(late_fee_value),reminder_days_before_due=VALUES(reminder_days_before_due),
                  reminder_days_after_due=VALUES(reminder_days_after_due),
                  require_cancellation_reason=VALUES(require_cancellation_reason),updated_by=VALUES(updated_by),
                  updated_at=CURRENT_TIMESTAMP(6)
                """).param("ownerId", ownerId).param("autoGenerate", r.autoGenerateInvoices())
                .param("generationDay", r.invoiceGenerationDay()).param("dueDay", r.defaultDueDay())
                .param("partial", r.allowPartialPayment()).param("carryDebt", r.carryForwardDebt())
                .param("lateEnabled", r.lateFeeEnabled()).param("lateType", r.lateFeeType())
                .param("lateValue", r.lateFeeValue()).param("beforeDue", join(r.reminderDaysBeforeDue()))
                .param("afterDue", join(r.reminderDaysAfterDue()))
                .param("cancellationReason", r.requireCancellationReason()).param("actorId", actorId).update();
    }

    public Ai ai(long ownerId, boolean configured) {
        return jdbc.sql("SELECT * FROM ai_settings WHERE owner_id=:ownerId").param("ownerId", ownerId)
                .query((rs, row) -> mapAi(rs, configured)).optional()
                .orElse(new Ai(null, null, false, configured, configured ? "CONFIGURED" : "NOT_CONFIGURED",
                        new AiFeatures(false, false, false, false, false), 10000, "vi", 30,
                        false, 30, true));
    }

    public void updateAi(long ownerId, UpdateAi r, long actorId) {
        com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.AiFeatures f = r.features() == null
                ? new com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.AiFeatures(
                        false, false, false, false, false)
                : r.features();
        jdbc.sql("""
                INSERT INTO ai_settings(owner_id,provider,model,enabled,tenant_chatbot,invoice_explanation,
                  contract_explanation,maintenance_classification,utility_anomaly_detection,monthly_request_limit,
                  response_language,request_timeout_seconds,store_conversation_history,history_retention_days,
                  require_action_confirmation,updated_by)
                VALUES(:ownerId,:provider,:model,:enabled,:tenantChatbot,:invoiceExplanation,:contractExplanation,
                  :maintenanceClassification,:utilityAnomaly,:requestLimit,:language,:timeout,:storeHistory,
                  :retentionDays,:requireConfirmation,:actorId)
                ON DUPLICATE KEY UPDATE provider=VALUES(provider),model=VALUES(model),enabled=VALUES(enabled),
                  tenant_chatbot=VALUES(tenant_chatbot),invoice_explanation=VALUES(invoice_explanation),
                  contract_explanation=VALUES(contract_explanation),maintenance_classification=VALUES(maintenance_classification),
                  utility_anomaly_detection=VALUES(utility_anomaly_detection),monthly_request_limit=VALUES(monthly_request_limit),
                  response_language=VALUES(response_language),request_timeout_seconds=VALUES(request_timeout_seconds),
                  store_conversation_history=VALUES(store_conversation_history),history_retention_days=VALUES(history_retention_days),
                  require_action_confirmation=VALUES(require_action_confirmation),updated_by=VALUES(updated_by),
                  updated_at=CURRENT_TIMESTAMP(6)
                """).param("ownerId", ownerId).param("provider", blank(r.provider())).param("model", blank(r.model()))
                .param("enabled", r.enabled()).param("tenantChatbot", f.tenantChatbot())
                .param("invoiceExplanation", f.invoiceExplanation()).param("contractExplanation", f.contractExplanation())
                .param("maintenanceClassification", f.maintenanceClassification())
                .param("utilityAnomaly", f.utilityAnomalyDetection()).param("requestLimit", r.monthlyRequestLimit())
                .param("language", r.responseLanguage()).param("timeout", r.requestTimeoutSeconds())
                .param("storeHistory", r.storeConversationHistory()).param("retentionDays", r.historyRetentionDays())
                .param("requireConfirmation", r.requireActionConfirmation()).param("actorId", actorId).update();
    }

    public void audit(long userId, String group, String scopeType, Long scopeId,
                      String oldValue, String newValue) {
        jdbc.sql("""
                INSERT INTO setting_audit_logs(user_id,setting_group,scope_type,scope_id,action,old_value,new_value,result)
                VALUES(:userId,:group,:scopeType,:scopeId,'UPDATED',:oldValue,:newValue,'SUCCESS')
                """).param("userId", userId).param("group", group).param("scopeType", scopeType)
                .param("scopeId", scopeId).param("oldValue", oldValue).param("newValue", newValue).update();
    }

    public AuditPage auditLogs(long ownerId, String group, int page, int size) {
        String filter = group == null || group.isBlank() ? "" : " AND a.setting_group=:group";
        String scope = "(a.user_id=:ownerId OR EXISTS (SELECT 1 FROM properties p WHERE p.owner_id=:ownerId AND a.scope_type='PROPERTY' AND a.scope_id=p.id))";
        JdbcClient.StatementSpec count = jdbc.sql("SELECT COUNT(*) FROM setting_audit_logs a WHERE " + scope + filter)
                .param("ownerId", ownerId);
        if (!filter.isEmpty()) count = count.param("group", group);
        long total = count.query(Long.class).single();
        JdbcClient.StatementSpec query = jdbc.sql("""
                SELECT a.*,u.full_name user_name FROM setting_audit_logs a JOIN users u ON u.id=a.user_id
                WHERE %s %s ORDER BY a.created_at DESC LIMIT :size OFFSET :offset
                """.formatted(scope, filter)).param("ownerId", ownerId).param("size", size).param("offset", page * size);
        if (!filter.isEmpty()) query = query.param("group", group);
        List<AuditLog> rows = query.query((rs, row) -> new AuditLog(rs.getLong("id"), rs.getLong("user_id"),
                rs.getString("user_name"), rs.getString("setting_group"), rs.getString("scope_type"),
                nullableLong(rs, "scope_id"), rs.getString("action"), rs.getString("old_value"),
                rs.getString("new_value"), rs.getString("result"), rs.getString("ip_address"),
                rs.getString("user_agent"), rs.getObject("created_at", LocalDateTime.class))).list();
        return new AuditPage(rows, page, size, total, (int) Math.ceil(total / (double) size));
    }

    public Optional<AuditLog> lastAudit(long ownerId) {
        return auditLogs(ownerId, null, 0, 1).content().stream().findFirst();
    }

    private Object typedValue(ResultSet rs) throws SQLException {
        String value = rs.getString("setting_value");
        return switch (rs.getString("value_type")) {
            case "BOOLEAN" -> Boolean.parseBoolean(value);
            case "NUMBER" -> value == null || value.isBlank() ? 0 : new BigDecimal(value);
            default -> value;
        };
    }

    private String typeOf(Object value) {
        if (value instanceof Boolean) return "BOOLEAN";
        if (value instanceof Number) return "NUMBER";
        return "STRING";
    }

    private Ai mapAi(ResultSet rs, boolean configured) throws SQLException {
        return new Ai(rs.getString("provider"), rs.getString("model"), rs.getBoolean("enabled"),
                configured, configured ? "CONFIGURED" : "NOT_CONFIGURED",
                new AiFeatures(rs.getBoolean("tenant_chatbot"), rs.getBoolean("invoice_explanation"),
                        rs.getBoolean("contract_explanation"), rs.getBoolean("maintenance_classification"),
                        rs.getBoolean("utility_anomaly_detection")), rs.getInt("monthly_request_limit"),
                rs.getString("response_language"), rs.getInt("request_timeout_seconds"),
                rs.getBoolean("store_conversation_history"), rs.getInt("history_retention_days"),
                rs.getBoolean("require_action_confirmation"));
    }

    private static LocalTime time(ResultSet rs, String key) throws SQLException {
        java.sql.Time value = rs.getTime(key);
        return value == null ? null : value.toLocalTime();
    }
    private static String blank(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static String join(List<Integer> values) { return values == null ? "" : values.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(",")); }
    private static List<Integer> csvNumbers(String value) { return value == null || value.isBlank() ? List.of() : java.util.Arrays.stream(value.split(",")).map(String::trim).filter(v -> !v.isBlank()).map(Integer::valueOf).toList(); }
    private static Long nullableLong(ResultSet rs, String key) throws SQLException { Object value = rs.getObject(key); return value == null ? null : ((Number) value).longValue(); }
}
