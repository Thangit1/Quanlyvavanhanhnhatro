package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.utility.TenantUtilityResponse;
import com.thangit.boardinghouse.dto.response.utility.TenantUtilityResponse.*;
import com.thangit.boardinghouse.repository.TenantUtilityRepository;
import com.thangit.boardinghouse.repository.TenantUtilityRepository.ContractRoomRow;
import com.thangit.boardinghouse.repository.TenantUtilityRepository.ReadingRow;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantUtilityService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class TenantUtilityServiceImpl implements TenantUtilityService {
    private final TenantUtilityRepository repository;

    public TenantUtilityServiceImpl(TenantUtilityRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public TenantUtilityResponse getUtilities(AuthenticatedUser principal, Long contractId, LocalDate period) {
        tenant(principal);
        List<ContractRoomRow> contracts = repository.findActiveContractRooms(principal.id());
        List<RoomOption> rooms = contracts.stream()
                .map(row -> new RoomOption(row.contractId(), row.roomId(), row.roomCode(), row.propertyName()))
                .toList();
        if (contracts.isEmpty()) {
            return new TenantUtilityResponse(rooms, null, period, start(period), end(period), null, null, List.of());
        }

        ContractRoomRow selected = contractId == null
                ? contracts.getFirst()
                : contracts.stream().filter(row -> row.contractId().equals(contractId)).findFirst()
                    .orElseThrow(() -> new AuthException(HttpStatus.FORBIDDEN, "TENANT_UTILITY_ACCESS_DENIED",
                            "Bạn không có quyền xem dữ liệu điện nước của phòng này."));

        List<ReadingRow> rows = repository.findReadings(principal.id(), selected.contractId());
        LocalDate selectedPeriod = period != null ? period.withDayOfMonth(1)
                : rows.isEmpty() ? null : rows.getFirst().period().withDayOfMonth(1);
        ReadingRow selectedRow = selectedPeriod == null ? null : rows.stream()
                .filter(row -> row.period().withDayOfMonth(1).equals(selectedPeriod))
                .findFirst().orElse(null);

        return new TenantUtilityResponse(
                rooms,
                selected.contractId(),
                selectedPeriod,
                start(selectedPeriod),
                end(selectedPeriod),
                new RoomInfo(selected.roomId(), selected.roomCode(), selected.propertyName(), selected.propertyAddress()),
                selectedRow == null ? null : reading(selectedRow),
                rows.stream().map(this::history).toList());
    }

    private Reading reading(ReadingRow row) {
        Utility electricity = utility(row.electricityPrevious(), row.electricityCurrent(),
                row.electricityUnitPrice(), row.electricityAmount(),row.electricityConsumption());
        Utility water = utility(row.waterPrevious(), row.waterCurrent(), row.waterUnitPrice(), row.waterAmount(),row.waterConsumption());
        InvoiceLink invoice = row.invoiceId() == null ? null
                : new InvoiceLink(row.invoiceId(), row.invoiceCode(), row.invoiceStatus());
        String status = invoice != null ? "INVOICED"
                : electricity.complete() || water.complete() ? "RECORDED" : "PENDING";
        BigDecimal total = electricity.valid() && water.valid()
                && electricity.amount() != null && water.amount() != null
                ? electricity.amount().add(water.amount()) : null;
        return new Reading(row.id(), status, electricity, water, total, invoice);
    }

    private HistoryItem history(ReadingRow row) {
        Utility electricity = utility(row.electricityPrevious(), row.electricityCurrent(),
                row.electricityUnitPrice(), row.electricityAmount(),row.electricityConsumption());
        Utility water = utility(row.waterPrevious(), row.waterCurrent(), row.waterUnitPrice(), row.waterAmount(),row.waterConsumption());
        return new HistoryItem(row.period(), electricity.usage(), electricity.valid() ? electricity.amount() : null,
                water.usage(), water.valid() ? water.amount() : null,
                electricity.valid(), water.valid(), row.invoiceId());
    }

    private Utility utility(BigDecimal previous, BigDecimal current, BigDecimal unitPrice, BigDecimal amount,BigDecimal consumption) {
        boolean complete = previous != null && current != null;
        boolean valid = consumption!=null?consumption.signum()>=0:!complete || current.compareTo(previous) >= 0;
        BigDecimal usage = consumption!=null?consumption:complete && valid ? current.subtract(previous) : null;
        return new Utility(previous, current, usage, unitPrice, valid ? amount : null, complete, valid);
    }

    private static LocalDate start(LocalDate period) {
        return period == null ? null : period.withDayOfMonth(1);
    }

    private static LocalDate end(LocalDate period) {
        return period == null ? null : period.withDayOfMonth(period.lengthOfMonth());
    }

    private static void tenant(AuthenticatedUser principal) {
        if (principal == null || principal.activeRole() != RoleCode.TENANT) {
            throw new AuthException(HttpStatus.FORBIDDEN, "TENANT_UTILITY_ACCESS_DENIED",
                    "Bạn không có quyền truy cập dữ liệu điện nước người thuê.");
        }
    }
}
