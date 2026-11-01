package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.contract.AdminContractResponses.*;
import com.thangit.boardinghouse.repository.AdminContractRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.AdminContractService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminContractServiceImpl implements AdminContractService {
    private final AdminContractRepository repository;
    private com.thangit.boardinghouse.service.ContractChangeService changes;
    @org.springframework.beans.factory.annotation.Autowired public void setContractChanges(com.thangit.boardinghouse.service.ContractChangeService service){this.changes=service;}

    private final com.thangit.boardinghouse.service.RoomLifecycleGuard rooms;
    private final com.thangit.boardinghouse.service.ContractOnboardingService onboarding;
    public AdminContractServiceImpl(AdminContractRepository repository,com.thangit.boardinghouse.service.RoomLifecycleGuard rooms,com.thangit.boardinghouse.service.ContractOnboardingService onboarding) {
        this.onboarding=onboarding;
        this.repository = repository;
        this.rooms=rooms;
    }
    @Override @Transactional
    public void approveExtension(AuthenticatedUser principal,long contractId,long requestId,String reason){requireRole(principal);changes.legacyOffer(principal,contractId,requestId,reason);}
    @Override @Transactional(readOnly=true)
    public java.util.List<java.util.Map<String,Object>> extensions(AuthenticatedUser principal,long contractId){requireRole(principal);return rooms.extensions(principal,contractId);}

    @Override
    @Transactional(readOnly = true)
    public ContractList list(AuthenticatedUser principal, Long propertyId, String status, String keyword,
                             String sort, String direction, int page, int size) {
        requireRole(principal);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 10), 100);
        return new ContractList(repository.summary(principal.id(), principal.activeRole()),
                repository.properties(principal.id(), principal.activeRole()),
                repository.list(principal.id(), principal.activeRole(), propertyId, status, keyword,
                        sort, direction, safePage, safeSize));
    }

    @Override
    @Transactional(readOnly = true)
    public ContractDetail detail(AuthenticatedUser principal, long contractId) {
        requireRole(principal);
        return repository.detail(principal.id(), principal.activeRole(), contractId)
                .orElseThrow(() -> new AuthException(HttpStatus.NOT_FOUND, "CONTRACT_NOT_FOUND",
                        "Không tìm thấy hợp đồng hoặc bạn không có quyền truy cập."));
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportCsv(AuthenticatedUser principal, Long propertyId, String status, String keyword,
                            String sort, String direction) {
        requireRole(principal);
        repository.requireExport(principal,propertyId);
        StringBuilder csv = new StringBuilder("\uFEFFMã hợp đồng,Khách thuê,Điện thoại,Nhà trọ,Phòng,"
                + "Ngày bắt đầu,Ngày kết thúc,Tiền thuê,Tiền cọc,Trạng thái\n");
        for (ContractRow row : repository.list(principal.id(), principal.activeRole(), propertyId, status,
                keyword, sort, direction, 0, 10_000).content()) {
            csv.append(csv(row.contractCode())).append(',').append(csv(row.tenantName())).append(',')
                    .append(csv(row.tenantPhone())).append(',').append(csv(row.propertyName())).append(',')
                    .append(csv(row.roomCode())).append(',').append(row.startDate()).append(',')
                    .append(row.endDate()).append(',').append(row.monthlyRent()).append(',')
                    .append(row.depositAmount()).append(',').append(csv(row.status())).append('\n');
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private void requireRole(AuthenticatedUser principal) {
        if (principal == null || !List.of(RoleCode.OWNER, RoleCode.MANAGER).contains(principal.activeRole())) {
            throw new AuthException(HttpStatus.FORBIDDEN, "CONTRACT_ACCESS_DENIED",
                    "Bạn không có quyền truy cập hợp đồng quản trị.");
        }
    }

    private String csv(String value) {
        if (value == null) return "";
        return com.thangit.boardinghouse.common.validation.CsvCells.quote(value);
    }
}
