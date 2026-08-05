package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.*;
import com.thangit.boardinghouse.dto.response.setting.AdminSettingResponses.*;
import com.thangit.boardinghouse.repository.AdminSettingRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminSettingService;
import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSettingServiceImpl implements AdminSettingService {
    private static final Set<String> GROUPS = Set.of("profile", "organization", "rental", "contracts",
            "utilities", "payments", "notifications", "security", "integrations");
    private static final Set<String> OWNER_ONLY = Set.of("organization", "rental", "contracts", "utilities",
            "payments", "notifications", "security", "integrations");
    private static final Set<String> CURRENCIES = Set.of("VND", "USD");
    private final AdminSettingRepository repository;
    private final boolean aiSecretConfigured;

    public AdminSettingServiceImpl(AdminSettingRepository repository,
            @Value("${AI_API_KEY:${GOOGLE_API_KEY:}}") String aiApiKey) {
        this.repository = repository;
        this.aiSecretConfigured = aiApiKey != null && !aiApiKey.isBlank();
    }

    @Override
    @Transactional(readOnly = true)
    public Overview overview(AuthenticatedUser principal) {
        requireRead(principal);
        long ownerId = ownerId(principal);
        General general = general(principal);
        Ai ai = repository.ai(ownerId, aiSecretConfigured);
        Map<String, Object> integrations = repository.group(ownerId, "integrations");
        Map<String, Object> securityGroup = repository.group(ownerId, "security");
        AuditLog last = repository.lastAudit(ownerId).orElse(null);
        boolean owner = principal.activeRole() == RoleCode.OWNER;
        return new Overview(general.systemName(), general.logoUrl(), general.defaultLanguage(),
                general.timezone(), general.currency(), Map.of(
                    "email", bool(integrations, "emailEnabled"),
                    "payment", bool(integrations, "paymentEnabled"),
                    "ai", ai.configured(), "webPush", bool(integrations, "webPushEnabled")),
                Map.of("twoFactorEnabled", bool(securityGroup, "twoFactorEnabled"),
                        "passwordPolicyConfigured", true),
                last == null ? null : last.createdAt(), last == null ? null : last.userName(),
                new Permissions(owner, owner, owner, owner, owner, owner, true),
                repository.properties(principal.id(), principal.activeRole()));
    }

    @Override
    @Transactional(readOnly = true)
    public General general(AuthenticatedUser principal) {
        requireRead(principal);
        Map<String, Object> values = repository.group(ownerId(principal), "general");
        return new General(text(values, "systemName", "SmartHome AI"),
                text(values, "supportEmail", ""), text(values, "supportPhone", ""),
                text(values, "defaultLanguage", "vi"), text(values, "timezone", "Asia/Ho_Chi_Minh"),
                text(values, "currency", "VND"), text(values, "dateFormat", "dd/MM/yyyy"),
                text(values, "timeFormat", "HH:mm"), text(values, "logoUrl", null));
    }

    @Override
    @Transactional
    public General updateGeneral(AuthenticatedUser principal, UpdateGeneral request) {
        requireOwner(principal);
        if (!ZoneId.getAvailableZoneIds().contains(request.timezone()))
            throw badRequest("TIMEZONE_INVALID", "Múi giờ không hợp lệ.");
        if (!CURRENCIES.contains(request.currency()))
            throw badRequest("CURRENCY_INVALID", "Đơn vị tiền tệ không được hỗ trợ.");
        long ownerId = ownerId(principal);
        General old = general(principal);
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("systemName", request.systemName().trim());
        values.put("supportEmail", clean(request.supportEmail()));
        values.put("supportPhone", clean(request.supportPhone()));
        values.put("defaultLanguage", request.defaultLanguage());
        values.put("timezone", request.timezone());
        values.put("currency", request.currency());
        values.put("dateFormat", request.dateFormat());
        values.put("timeFormat", request.timeFormat());
        repository.saveGroup(ownerId, "general", values, principal.id());
        General updated = general(principal);
        repository.audit(principal.id(), "general", "SYSTEM", ownerId, json(old), json(updated));
        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public GroupSettings group(AuthenticatedUser principal, String group) {
        requireRead(principal);
        validateGroup(group);
        boolean editable = principal.activeRole() == RoleCode.OWNER || "profile".equals(group);
        return new GroupSettings(group, repository.group(groupScopeId(principal, group), group), editable);
    }

    @Override
    @Transactional
    public GroupSettings updateGroup(AuthenticatedUser principal, String group, UpdateGroup request) {
        requireRead(principal);
        validateGroup(group);
        if (OWNER_ONLY.contains(group)) requireOwner(principal);
        Map<String, Object> values = sanitize(request.values());
        long ownerId = groupScopeId(principal, group);
        Map<String, Object> old = repository.group(ownerId, group);
        repository.saveGroup(ownerId, group, values, principal.id());
        Map<String, Object> updated = repository.group(ownerId, group);
        repository.audit(principal.id(), group, "SYSTEM", ownerId, json(old), json(updated));
        return new GroupSettings(group, updated, true);
    }

    @Override
    @Transactional(readOnly = true)
    public PropertySetting property(AuthenticatedUser principal, long propertyId) {
        requireRead(principal);
        requireProperty(principal, propertyId);
        return repository.property(principal.id(), principal.activeRole(), propertyId)
                .orElseThrow(() -> notFound("Không tìm thấy khu trọ."));
    }

    @Override
    @Transactional
    public PropertySetting updateProperty(AuthenticatedUser principal, long propertyId, UpdateProperty request) {
        requireRead(principal);
        requireProperty(principal, propertyId);
        if (request.quietHoursStart() != null && request.quietHoursEnd() != null
                && request.quietHoursStart().equals(request.quietHoursEnd()))
            throw badRequest("QUIET_HOURS_INVALID", "Giờ yên tĩnh bắt đầu và kết thúc phải khác nhau.");
        PropertySetting old = property(principal, propertyId);
        repository.updateProperty(propertyId, request, principal.id());
        PropertySetting updated = property(principal, propertyId);
        repository.audit(principal.id(), "properties", "PROPERTY", propertyId, json(old), json(updated));
        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public Billing billing(AuthenticatedUser principal) {
        requireOwner(principal);
        return repository.billing(ownerId(principal));
    }

    @Override
    @Transactional
    public Billing updateBilling(AuthenticatedUser principal, UpdateBilling request) {
        requireOwner(principal);
        validateBilling(request);
        long ownerId = ownerId(principal);
        Billing old = repository.billing(ownerId);
        repository.updateBilling(ownerId, request, principal.id());
        Billing updated = repository.billing(ownerId);
        repository.audit(principal.id(), "billing", "SYSTEM", ownerId, json(old), json(updated));
        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public Ai ai(AuthenticatedUser principal) {
        requireOwner(principal);
        return repository.ai(ownerId(principal), aiSecretConfigured);
    }

    @Override
    @Transactional
    public Ai updateAi(AuthenticatedUser principal, UpdateAi request) {
        requireOwner(principal);
        if (request.apiKey() != null && !request.apiKey().isBlank())
            throw badRequest("AI_SECRET_ENV_REQUIRED", "API key phải được cấu hình bằng biến môi trường của máy chủ.");
        if (request.enabled() && (request.provider() == null || request.provider().isBlank()
                || request.model() == null || request.model().isBlank()))
            throw badRequest("AI_CONFIGURATION_INCOMPLETE", "Vui lòng chọn nhà cung cấp và mô hình AI.");
        long ownerId = ownerId(principal);
        Ai old = repository.ai(ownerId, aiSecretConfigured);
        repository.updateAi(ownerId, request, principal.id());
        Ai updated = repository.ai(ownerId, aiSecretConfigured);
        repository.audit(principal.id(), "ai", "SYSTEM", ownerId, json(old), json(updated));
        return updated;
    }

    @Override
    @Transactional(readOnly = true)
    public ConnectionTest testAi(AuthenticatedUser principal) {
        requireOwner(principal);
        Ai current = ai(principal);
        boolean connected = aiSecretConfigured && current.provider() != null && current.model() != null;
        return new ConnectionTest(connected, connected ? "Cấu hình AI đã sẵn sàng."
                : "Thiếu API key trên máy chủ, nhà cung cấp hoặc mô hình.");
    }

    @Override
    @Transactional(readOnly = true)
    public AuditPage auditLogs(AuthenticatedUser principal, String group, int page, int size) {
        requireOwner(principal);
        return repository.auditLogs(ownerId(principal), group, Math.max(0, page),
                Math.min(Math.max(size, 10), 100));
    }

    private void validateBilling(UpdateBilling r) {
        if (r.lateFeeValue() == null || r.lateFeeValue().compareTo(BigDecimal.ZERO) < 0)
            throw badRequest("LATE_FEE_INVALID", "Phí chậm thanh toán không được âm.");
        if (r.lateFeeEnabled() && !Set.of("FIXED", "PERCENT", "PER_DAY").contains(r.lateFeeType()))
            throw badRequest("LATE_FEE_TYPE_INVALID", "Cách tính phí chậm thanh toán không hợp lệ.");
        if (r.lateFeeEnabled() && "PERCENT".equals(r.lateFeeType())
                && r.lateFeeValue().compareTo(BigDecimal.valueOf(100)) > 0)
            throw badRequest("LATE_FEE_PERCENT_INVALID", "Phần trăm phí chậm không được vượt quá 100%.");
        if (hasDuplicates(r.reminderDaysBeforeDue()) || hasDuplicates(r.reminderDaysAfterDue()))
            throw badRequest("REMINDER_DUPLICATED", "Danh sách ngày nhắc không được trùng nhau.");
    }

    private Map<String, Object> sanitize(Map<String, Object> input) {
        if (input == null) return Map.of();
        if (input.size() > 100) throw badRequest("SETTINGS_TOO_LARGE", "Nhóm cấu hình có quá nhiều trường.");
        Map<String, Object> clean = new LinkedHashMap<>();
        input.forEach((key, value) -> {
            if (!key.matches("[A-Za-z][A-Za-z0-9]{1,99}"))
                throw badRequest("SETTING_KEY_INVALID", "Tên trường cấu hình không hợp lệ.");
            String lower = key.toLowerCase();
            if (lower.contains("secret") || lower.contains("password") || lower.contains("apikey") || lower.contains("token"))
                throw badRequest("SENSITIVE_SETTING_REJECTED", "Không gửi dữ liệu bí mật qua API cấu hình chung.");
            if (!(value == null || value instanceof String || value instanceof Number || value instanceof Boolean))
                throw badRequest("SETTING_VALUE_INVALID", "Giá trị cấu hình không hợp lệ.");
            if (value instanceof String text && text.length() > 10000)
                throw badRequest("SETTING_VALUE_TOO_LONG", "Giá trị cấu hình quá dài.");
            clean.put(key, value);
        });
        return clean;
    }

    private long ownerId(AuthenticatedUser principal) { return repository.ownerId(principal.id(), principal.activeRole()); }
    private long groupScopeId(AuthenticatedUser principal, String group) {
        return "profile".equals(group) ? principal.id() : ownerId(principal);
    }
    private void requireRead(AuthenticatedUser principal) {
        if (principal == null || !List.of(RoleCode.OWNER, RoleCode.MANAGER).contains(principal.activeRole()))
            throw forbidden("Bạn không có quyền truy cập cài đặt quản trị.");
    }
    private void requireOwner(AuthenticatedUser principal) {
        requireRead(principal);
        if (principal.activeRole() != RoleCode.OWNER)
            throw forbidden("Chỉ chủ nhà được thay đổi cấu hình này.");
    }
    private void requireProperty(AuthenticatedUser principal, long propertyId) {
        if (!repository.canAccessProperty(principal.id(), principal.activeRole(), propertyId))
            throw forbidden("Bạn không có quyền truy cập khu trọ đã chọn.");
    }
    private void validateGroup(String group) { if (!GROUPS.contains(group)) throw notFound("Nhóm cài đặt không tồn tại."); }
    private boolean hasDuplicates(List<Integer> values) { return values != null && values.size() != Set.copyOf(values).size(); }
    private boolean bool(Map<String, Object> map, String key) { return Boolean.TRUE.equals(map.get(key)); }
    private String text(Map<String, Object> map, String key, String fallback) { Object value = map.get(key); return value == null ? fallback : value.toString(); }
    private String clean(String value) { return value == null ? "" : value.trim(); }
    private String json(Object value) {
        if (value == null) return "{}";
        return value.toString();
    }
    private AuthException badRequest(String code, String message) { return new AuthException(HttpStatus.BAD_REQUEST, code, message); }
    private AuthException forbidden(String message) { return new AuthException(HttpStatus.FORBIDDEN, "SETTING_ACCESS_DENIED", message); }
    private AuthException notFound(String message) { return new AuthException(HttpStatus.NOT_FOUND, "SETTING_NOT_FOUND", message); }
}
