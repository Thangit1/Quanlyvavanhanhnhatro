package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.*;
import com.thangit.boardinghouse.dto.response.tenant.AdminTenantResponses.*;
import com.thangit.boardinghouse.repository.AdminTenantRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminTenantService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AdminTenantServiceImpl implements AdminTenantService {
    private static final long MAX_DOCUMENT_SIZE = 5L * 1024 * 1024;
    private static final List<String> ALLOWED_TYPES = List.of("application/pdf", "image/jpeg", "image/png");
    private final AdminTenantRepository repository;
    private final PasswordEncoder passwordEncoder;

    public AdminTenantServiceImpl(AdminTenantRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override @Transactional(readOnly = true)
    public TenantList list(AuthenticatedUser principal, Long propertyId, Long roomId, String status,
                           String temporaryStatus, String accountStatus, String keyword,
                           String sort, String direction, int page, int size) {
        requireReadRole(principal);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 10), 100);
        if (propertyId != null) requireProperty(principal, propertyId);
        return new TenantList(repository.properties(principal.id(), principal.activeRole()),
                repository.rooms(principal.id(), principal.activeRole(), propertyId),
                repository.summary(principal.id(), principal.activeRole(), propertyId),
                repository.list(principal.id(), principal.activeRole(), propertyId, roomId, status,
                        temporaryStatus, accountStatus, keyword, sort, direction, safePage, safeSize));
    }

    @Override @Transactional(readOnly = true)
    public TenantDetail detail(AuthenticatedUser principal, long tenantId) {
        requireTenant(principal, tenantId, false);
        Map<String, Object> p = repository.profile(tenantId).orElseThrow(() -> notFound("Không tìm thấy người thuê."));
        return new TenantDetail(number(p, "id"), string(p, "tenant_code"), nullableNumber(p, "user_id"),
                string(p, "full_name"), date(p, "date_of_birth"), string(p, "gender"), string(p, "phone"),
                string(p, "email"), string(p, "avatar_url"), string(p, "permanent_address"),
                string(p, "occupation"), string(p, "workplace"), string(p, "emergency_contact_name"),
                string(p, "emergency_contact_phone"), string(p, "identity_type"),
                maskIdentity(string(p, "identity_number")), date(p, "identity_issued_date"),
                string(p, "identity_issued_place"), string(p, "note"), string(p, "status"),
                p.get("user_id") != null, string(p, "account_status"), repository.residences(tenantId),
                repository.contracts(tenantId), repository.invoices(tenantId),
                repository.temporaryResidences(tenantId), repository.documents(tenantId),
                repository.activities(tenantId));
    }

    @Override @Transactional
    public CreatedTenant create(AuthenticatedUser principal, SaveTenant request) {
        requireWriteRole(principal);
        if (request.propertyId() == null) throw badRequest("PROPERTY_REQUIRED", "Vui lòng chọn nhà trọ.");
        requireProperty(principal, request.propertyId());
        validateRoom(request.propertyId(), request.roomId());
        validateProfile(request, null);
        long id = repository.createProfile(request, principal.id());
        repository.createResidence(id, request.propertyId(), request.roomId(), request.contractId(),
                request.moveInDate(), normalizeResidenceRole(request.residenceRole()), principal.id());
        repository.addActivity(id, principal.id(), "CREATED", "Đã tạo hồ sơ người thuê.");
        return new CreatedTenant(id, "NT%06d".formatted(id));
    }

    @Override @Transactional
    public TenantDetail update(AuthenticatedUser principal, long tenantId, SaveTenant request) {
        requireTenant(principal, tenantId, true);
        validateProfile(request, tenantId);
        repository.updateProfile(tenantId, request);
        repository.addActivity(tenantId, principal.id(), "UPDATED", "Đã cập nhật thông tin hồ sơ.");
        return detail(principal, tenantId);
    }

    @Override @Transactional
    public void transfer(AuthenticatedUser principal, long tenantId, TransferRoom request) {
        requireTenant(principal, tenantId, true);
        Map<String, Object> current = repository.activeResidence(tenantId)
                .orElseThrow(() -> badRequest("NO_ACTIVE_RESIDENCE", "Người thuê không có phòng đang ở."));
        Map<String, Object> room = repository.room(request.toRoomId());
        if (room.isEmpty()) throw notFound("Không tìm thấy phòng chuyển đến.");
        long propertyId = number(room, "property_id");
        requireProperty(principal, propertyId);
        if (!"VACANT".equals(string(room, "status")) && !"RESERVED".equals(string(room, "status")))
            throw badRequest("ROOM_NOT_AVAILABLE", "Phòng chuyển đến hiện không sẵn sàng.");
        Long fromRoom = nullableNumber(current, "room_id");
        if (fromRoom != null && fromRoom.equals(request.toRoomId()))
            throw badRequest("SAME_ROOM", "Phòng mới phải khác phòng hiện tại.");
        repository.transfer(tenantId, number(current, "id"), fromRoom, request.toRoomId(),
                request.transferDate(), request.reason(), principal.id());
        repository.addActivity(tenantId, principal.id(), "ROOM_TRANSFERRED",
                "Đã chuyển phòng vào ngày " + request.transferDate() + ".");
    }

    @Override @Transactional
    public void moveOut(AuthenticatedUser principal, long tenantId, MoveOut request) {
        requireTenant(principal, tenantId, true);
        Map<String, Object> current = repository.activeResidence(tenantId)
                .orElseThrow(() -> badRequest("NO_ACTIVE_RESIDENCE", "Người thuê không có lượt cư trú đang hoạt động."));
        repository.moveOut(tenantId, number(current, "id"), nullableNumber(current, "room_id"),
                nullableNumber(current, "contract_id"), request.moveOutDate(), request.reason(), request.closeContract());
        repository.addActivity(tenantId, principal.id(), "MOVED_OUT",
                "Đã xác nhận rời phòng ngày " + request.moveOutDate() + ".");
    }

    @Override @Transactional
    public void saveTemporaryResidence(AuthenticatedUser principal, long tenantId, TemporaryResidence request) {
        requireTenant(principal, tenantId, true);
        requireProperty(principal, request.propertyId());
        if (request.registeredAt() != null && request.expiresAt() != null
                && request.expiresAt().isBefore(request.registeredAt()))
            throw badRequest("TEMPORARY_DATE_INVALID", "Ngày hết hạn phải sau ngày đăng ký.");
        repository.upsertTemporary(tenantId, request.propertyId(), request.registrationCode(),
                request.registeredAt(), request.expiresAt(), request.status(), request.note(), principal.id());
        repository.addActivity(tenantId, principal.id(), "TEMPORARY_RESIDENCE_UPDATED",
                "Đã cập nhật trạng thái tạm trú: " + request.status() + ".");
    }

    @Override @Transactional
    public void createAccount(AuthenticatedUser principal, long tenantId, CreateAccount request) {
        requireTenant(principal, tenantId, true);
        Map<String, Object> profile = repository.profile(tenantId).orElseThrow();
        if (profile.get("user_id") != null) throw badRequest("ACCOUNT_EXISTS", "Người thuê đã có tài khoản.");
        if (repository.emailExists(request.email())) throw badRequest("EMAIL_EXISTS", "Email đã được sử dụng.");
        if (!strongEnough(request.temporaryPassword()))
            throw badRequest("PASSWORD_WEAK", "Mật khẩu cần có chữ hoa, chữ thường và chữ số.");
        repository.createAccount(tenantId, request.email(), passwordEncoder.encode(request.temporaryPassword()));
        repository.addActivity(tenantId, principal.id(), "ACCOUNT_CREATED", "Đã tạo tài khoản đăng nhập.");
    }

    @Override @Transactional
    public void updateAccountStatus(AuthenticatedUser principal, long tenantId, AccountStatus request) {
        requireTenant(principal, tenantId, true);
        Map<String, Object> profile = repository.profile(tenantId).orElseThrow();
        if (profile.get("user_id") == null) throw badRequest("ACCOUNT_NOT_FOUND", "Người thuê chưa có tài khoản.");
        repository.updateAccountStatus(tenantId, request.status());
        repository.addActivity(tenantId, principal.id(), "ACCOUNT_STATUS_CHANGED",
                "Đã chuyển trạng thái tài khoản thành " + request.status() + ".");
    }

    @Override @Transactional
    public void uploadDocument(AuthenticatedUser principal, long tenantId, String documentType, MultipartFile file) {
        requireTenant(principal, tenantId, true);
        if (file.isEmpty() || file.getSize() > MAX_DOCUMENT_SIZE)
            throw badRequest("DOCUMENT_SIZE_INVALID", "Tệp phải có dung lượng từ 1 byte đến 5 MB.");
        if (!ALLOWED_TYPES.contains(file.getContentType()))
            throw badRequest("DOCUMENT_TYPE_INVALID", "Chỉ chấp nhận PDF, JPG hoặc PNG.");
        String safeName = file.getOriginalFilename() == null ? "document" :
                file.getOriginalFilename().replaceAll("[\\\\/\\r\\n]", "_");
        try {
            repository.addDocument(tenantId, documentType == null ? "OTHER" : documentType.toUpperCase(),
                    safeName, file.getContentType(), file.getBytes(), principal.id());
        } catch (IOException exception) {
            throw badRequest("DOCUMENT_READ_ERROR", "Không thể đọc tệp tải lên.");
        }
        repository.addActivity(tenantId, principal.id(), "DOCUMENT_UPLOADED", "Đã tải lên giấy tờ " + safeName + ".");
    }

    @Override @Transactional(readOnly = true)
    public Map<String, Object> downloadDocument(AuthenticatedUser principal, long tenantId, long documentId) {
        requireTenant(principal, tenantId, false);
        return repository.document(tenantId, documentId).orElseThrow(() -> notFound("Không tìm thấy giấy tờ."));
    }

    @Override @Transactional(readOnly = true)
    public byte[] exportCsv(AuthenticatedUser principal, Long propertyId, String keyword) {
        requireReadRole(principal);
        if (propertyId != null) requireProperty(principal, propertyId);
        StringBuilder csv = new StringBuilder("\uFEFFMã người thuê,Họ tên,Điện thoại,Email,Nhà trọ,Phòng,Trạng thái,Tạm trú,Công nợ\n");
        for (TenantRow row : repository.exportRows(principal.id(), principal.activeRole(), propertyId, keyword)) {
            csv.append(csv(row.tenantCode())).append(',').append(csv(row.fullName())).append(',')
                    .append(csv(row.phone())).append(',').append(csv(row.email())).append(',')
                    .append(csv(row.propertyName())).append(',').append(csv(row.roomCode())).append(',')
                    .append(csv(row.status())).append(',').append(csv(row.temporaryResidenceStatus())).append(',')
                    .append(row.outstandingDebt() == null ? "0" : row.outstandingDebt().toPlainString()).append('\n');
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private void requireReadRole(AuthenticatedUser principal) {
        if (!List.of(RoleCode.OWNER, RoleCode.MANAGER, RoleCode.ACCOUNTANT).contains(principal.activeRole()))
            throw forbidden("Bạn không có quyền xem danh sách người thuê.");
    }
    private void requireWriteRole(AuthenticatedUser principal) {
        if (!List.of(RoleCode.OWNER, RoleCode.MANAGER).contains(principal.activeRole()))
            throw forbidden("Bạn không có quyền thay đổi hồ sơ người thuê.");
    }
    private void requireTenant(AuthenticatedUser principal, long tenantId, boolean write) {
        if (write) requireWriteRole(principal); else requireReadRole(principal);
        if (!repository.canAccessTenant(principal.id(), principal.activeRole(), tenantId))
            throw forbidden("Bạn không có quyền truy cập người thuê này.");
    }
    private void requireProperty(AuthenticatedUser principal, long propertyId) {
        if (!repository.canAccessProperty(principal.id(), principal.activeRole(), propertyId))
            throw forbidden("Bạn không có quyền truy cập nhà trọ đã chọn.");
    }
    private void validateProfile(SaveTenant request, Long excludedId) {
        if (repository.profilePhoneExists(request.phone().trim(), excludedId))
            throw badRequest("PHONE_EXISTS", "Số điện thoại đã tồn tại trong hồ sơ người thuê.");
        if (request.dateOfBirth() != null && request.dateOfBirth().isAfter(LocalDate.now()))
            throw badRequest("DATE_OF_BIRTH_INVALID", "Ngày sinh không được ở tương lai.");
    }
    private void validateRoom(long propertyId, Long roomId) {
        if (roomId == null) return;
        Map<String, Object> room = repository.room(roomId);
        if (room.isEmpty() || number(room, "property_id") != propertyId)
            throw badRequest("ROOM_PROPERTY_MISMATCH", "Phòng không thuộc nhà trọ đã chọn.");
    }
    private String normalizeResidenceRole(String role) {
        return List.of("REPRESENTATIVE", "OCCUPANT", "DEPENDENT").contains(role) ? role : "REPRESENTATIVE";
    }
    private boolean strongEnough(String value) {
        return value.chars().anyMatch(Character::isUpperCase)
                && value.chars().anyMatch(Character::isLowerCase)
                && value.chars().anyMatch(Character::isDigit);
    }
    private String maskIdentity(String value) {
        if (value == null || value.isBlank()) return null;
        return "•".repeat(Math.max(0, value.length() - 4)) + value.substring(Math.max(0, value.length() - 4));
    }
    private static String csv(String value) {
        if (value == null) return "";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
    private static String string(Map<String, Object> map, String key) {
        Object value = map.get(key); return value == null ? null : value.toString();
    }
    private static long number(Map<String, Object> map, String key) {
        return ((Number) map.get(key)).longValue();
    }
    private static Long nullableNumber(Map<String, Object> map, String key) {
        Object value = map.get(key); return value == null ? null : ((Number) value).longValue();
    }
    private static LocalDate date(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) return null;
        return value instanceof LocalDate localDate ? localDate : ((Date) value).toLocalDate();
    }
    private AuthException badRequest(String code, String message) {
        return new AuthException(HttpStatus.BAD_REQUEST, code, message);
    }
    private AuthException forbidden(String message) {
        return new AuthException(HttpStatus.FORBIDDEN, "TENANT_ACCESS_DENIED", message);
    }
    private AuthException notFound(String message) {
        return new AuthException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", message);
    }
}
