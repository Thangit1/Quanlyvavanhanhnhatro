package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.contract.ExtensionRequest;
import com.thangit.boardinghouse.dto.request.contract.TerminationRequest;
import com.thangit.boardinghouse.dto.response.contract.TenantContractResponses.*;
import com.thangit.boardinghouse.repository.TenantContractRepository;
import com.thangit.boardinghouse.repository.TenantContractRepository.ContractBase;
import com.thangit.boardinghouse.repository.TenantContractRepository.DocumentFile;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantContractService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Set;

@Service
public class TenantContractServiceImpl implements TenantContractService {
    private static final Set<String> STATUSES = Set.of(
            "PENDING_CONFIRMATION", "ACTIVE", "EXPIRING", "EXPIRED",
            "TERMINATION_REQUESTED", "TERMINATED", "CANCELLED");
    private final TenantContractRepository repository;

    public TenantContractServiceImpl(TenantContractRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public ContractPage getContracts(AuthenticatedUser principal, String status, int page, int size, String sort) {
        requireTenant(principal);
        if (page < 0 || size < 1 || size > 50) throw badRequest("PAGINATION_INVALID", "Thông tin phân trang không hợp lệ.");
        String normalizedStatus = normalizeStatus(status);
        String safeSort = Set.of("startDate,asc", "startDate,desc", "endDate,asc", "endDate,desc")
                .contains(sort) ? sort : "endDate,desc";
        long total = repository.countContracts(principal.id(), normalizedStatus);
        return new ContractPage(repository.findContracts(principal.id(), normalizedStatus, page, size, safeSort),
                page, size, total, (int) Math.ceil((double) total / size));
    }

    @Override
    @Transactional(readOnly = true)
    public ContractDetail getContract(AuthenticatedUser principal, Long contractId) {
        requireTenant(principal);
        ContractBase base = owned(principal.id(), contractId);
        var documents = repository.documents(contractId);
        var extension = repository.pendingExtension(contractId).orElse(null);
        var termination = repository.pendingTermination(contractId).orElse(null);
        String status = TenantContractRepository.effectiveStatus(base.status(), base.endDate());
        boolean active = "ACTIVE".equals(status) || "EXPIRING".equals(status);
        boolean downloadable = documents.stream().anyMatch(DocumentInfo::downloadable);
        return new ContractDetail(
                base.id(), base.code(), base.contractType(), status, base.createdAt(), base.signedAt(),
                base.startDate(), base.endDate(), Math.max(0, ChronoUnit.DAYS.between(LocalDate.now(), base.endDate())),
                base.paymentCycle(), base.paymentDueDay(), base.noticePeriodDays(),
                new PropertyInfo(base.propertyId(), base.propertyName(), base.propertyAddress(),
                        base.buildingName(), base.floorName()),
                new RoomInfo(base.roomId(), base.roomCode(), base.roomType(), base.area(), base.capacity(),
                        base.occupantCount(), base.imageUrl(), base.roomStatus()),
                new PartyInfo(base.landlordName(), base.landlordPhone(), base.landlordEmail(), base.propertyAddress()),
                new TenantPartyInfo(base.tenantName(), base.tenantPhone(), base.tenantEmail(), null, "REPRESENTATIVE"),
                new FinancialInfo(base.monthlyRent(), base.depositAmount(), base.reservationAmount(),
                        base.managementFee(), base.fixedServiceFee(), base.discountAmount()),
                repository.utilityRates(contractId), repository.services(contractId),
                repository.occupants(contractId), repository.assets(contractId), repository.terms(contractId),
                documents, repository.history(contractId), extension, termination,
                new Permissions(downloadable, downloadable, active && extension == null,
                        active && termination == null));
    }

    @Override
    @Transactional
    public RequestCreated requestExtension(AuthenticatedUser principal, Long contractId, ExtensionRequest request) {
        requireTenant(principal);
        ContractBase contract = owned(principal.id(), contractId);
        requireActionable(contract);
        if (!request.requestedEndDate().isAfter(contract.endDate())) throw badRequest(
                "EXTENSION_DATE_INVALID", "Ngày kết thúc mới phải sau ngày kết thúc hiện tại.");
        if (repository.pendingExtension(contractId).isPresent()) throw new AuthException(
                HttpStatus.CONFLICT, "EXTENSION_REQUEST_PENDING", "Hợp đồng đã có yêu cầu gia hạn đang chờ xử lý.");
        repository.createExtension(contractId, principal.id(), request.requestedEndDate(), clean(request.note()));
        repository.addHistory(contractId, "EXTENSION_REQUESTED", "Khách thuê đã gửi yêu cầu gia hạn.",
                contract.tenantName(), clean(request.note()));
        RequestInfo created = repository.pendingExtension(contractId).orElseThrow();
        return new RequestCreated(created.id(), created.status(), "Yêu cầu gia hạn đã được gửi thành công.");
    }

    @Override
    @Transactional
    public RequestCreated requestTermination(AuthenticatedUser principal, Long contractId, TerminationRequest request) {
        requireTenant(principal);
        ContractBase contract = owned(principal.id(), contractId);
        requireActionable(contract);
        LocalDate earliest = LocalDate.now().plusDays(contract.noticePeriodDays());
        if (request.expectedMoveOutDate().isBefore(earliest)) throw badRequest(
                "NOTICE_PERIOD_NOT_MET", "Ngày trả phòng phải đáp ứng thời gian báo trước %d ngày."
                        .formatted(contract.noticePeriodDays()));
        if (repository.pendingTermination(contractId).isPresent()) throw new AuthException(
                HttpStatus.CONFLICT, "TERMINATION_REQUEST_PENDING", "Hợp đồng đã có yêu cầu trả phòng đang chờ xử lý.");
        repository.createTermination(contractId, principal.id(), request.expectedMoveOutDate(),
                request.reason().trim(), clean(request.note()), request.contactPhone().trim());
        repository.addHistory(contractId, "TERMINATION_REQUESTED", "Khách thuê đã gửi yêu cầu trả phòng.",
                contract.tenantName(), clean(request.note()));
        RequestInfo created = repository.pendingTermination(contractId).orElseThrow();
        return new RequestCreated(created.id(), created.status(), "Yêu cầu trả phòng đã được gửi thành công.");
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentFile downloadDocument(AuthenticatedUser principal, Long contractId) {
        requireTenant(principal);
        owned(principal.id(), contractId);
        return repository.primaryDocument(principal.id(), contractId).orElseThrow(() ->
                new AuthException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "Không tìm thấy tệp hợp đồng."));
    }

    private ContractBase owned(Long tenantId, Long contractId) {
        return repository.findContract(tenantId, contractId).orElseThrow(() -> {
            if (repository.existsContract(contractId)) return new AuthException(
                    HttpStatus.FORBIDDEN, "CONTRACT_ACCESS_DENIED", "Bạn không có quyền xem hợp đồng này.");
            return new AuthException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND", "Không tìm thấy hợp đồng.");
        });
    }
    private void requireActionable(ContractBase contract) {
        String status = TenantContractRepository.effectiveStatus(contract.status(), contract.endDate());
        if (!"ACTIVE".equals(status) && !"EXPIRING".equals(status)) throw badRequest(
                "CONTRACT_NOT_ACTIONABLE", "Hợp đồng hiện không cho phép gửi yêu cầu này.");
    }
    private void requireTenant(AuthenticatedUser principal) {
        if (principal == null || principal.activeRole() != RoleCode.TENANT) throw new AuthException(
                HttpStatus.FORBIDDEN, "ROLE_NOT_ALLOWED", "Chỉ khách thuê được truy cập hợp đồng này.");
    }
    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) return null;
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(normalized)) throw badRequest("CONTRACT_STATUS_INVALID", "Trạng thái hợp đồng không hợp lệ.");
        return normalized;
    }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private AuthException badRequest(String code, String message) {
        return new AuthException(HttpStatus.BAD_REQUEST, code, message);
    }
}
