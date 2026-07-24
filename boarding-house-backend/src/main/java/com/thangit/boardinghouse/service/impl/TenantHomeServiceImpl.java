package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.tenant.TenantHomeResponse;
import com.thangit.boardinghouse.dto.response.tenant.TenantHomeResponse.*;
import com.thangit.boardinghouse.repository.TenantHomeRepository;
import com.thangit.boardinghouse.repository.TenantHomeRepository.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.TenantHomeService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

@Service
public class TenantHomeServiceImpl implements TenantHomeService {
    private static final DateTimeFormatter PERIOD = DateTimeFormatter.ofPattern("MM/yyyy");
    private final TenantHomeRepository repository;
    public TenantHomeServiceImpl(TenantHomeRepository repository) { this.repository = repository; }

    @Override @Transactional(readOnly = true)
    public TenantHomeResponse getHome(AuthenticatedUser principal) {
        if (principal.activeRole() != RoleCode.TENANT) throw new AuthException(
                HttpStatus.FORBIDDEN, "ROLE_NOT_ALLOWED", "Bạn không có quyền truy cập trang này.");
        UserRow user = repository.findUser(principal.id()).orElseThrow(() -> new AuthException(
                HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Không tìm thấy thông tin tài khoản."));
        RentalRow rental = repository.findActiveRental(principal.id()).orElse(null);
        if (rental == null) return new TenantHomeResponse(
                new TenantUser(user.id(), user.fullName(), user.avatarUrl(), user.unreadCount()),
                null, null, null, null, repository.findRecentMaintenance(principal.id()).stream().map(this::maintenance).toList(),
                repository.findRecentNotifications(principal.id()).stream().map(this::notification).toList(), java.util.List.of());

        Invoice invoice = repository.findCurrentInvoice(rental.contractId()).map(this::invoice).orElse(null);
        UtilityUsage utilities = repository.findCurrentUtility(rental.contractId()).map(this::utilities).orElse(null);
        return new TenantHomeResponse(
                new TenantUser(user.id(), user.fullName(), user.avatarUrl(), user.unreadCount()),
                new Rental(rental.propertyName(), rental.propertyAddress(), rental.buildingName(), rental.floorName(),
                        rental.roomId(), rental.roomCode(), rental.area(), rental.occupantCount(),
                        rental.monthlyRent(), rental.imageUrl()),
                new Contract(rental.contractId(), rental.contractCode(), rental.startDate(), rental.endDate(),
                        rental.depositAmount(), Math.max(0, ChronoUnit.DAYS.between(java.time.LocalDate.now(), rental.endDate())),
                        rental.contractStatus()),
                invoice, utilities,
                repository.findRecentMaintenance(principal.id()).stream().map(this::maintenance).toList(),
                repository.findRecentNotifications(principal.id()).stream().map(this::notification).toList(),
                repository.findUtilityHistory(rental.contractId()).stream()
                        .map(row -> new UtilityHistory(row.period().format(PERIOD), row.electricityUsage(), row.waterUsage())).toList());
    }

    private Invoice invoice(InvoiceRow row) {
        return new Invoice(row.id(), row.code(), row.billingPeriod().format(PERIOD), row.totalAmount(),
                row.paidAmount(), row.remainingAmount(), row.dueDate(), row.daysUntilDue(), row.status(), row.paidAt());
    }
    private UtilityUsage utilities(UtilityRow row) {
        return new UtilityUsage(
                utility(row.electricityPrevious(), row.electricityCurrent(), row.electricityUnitPrice(), row.electricityAmount()),
                utility(row.waterPrevious(), row.waterCurrent(), row.waterUnitPrice(), row.waterAmount()));
    }
    private Utility utility(BigDecimal previous, BigDecimal current, BigDecimal price, BigDecimal amount) {
        BigDecimal usage = previous == null || current == null ? null : current.subtract(previous);
        return new Utility(previous, current, usage, price, amount);
    }
    private MaintenanceRequest maintenance(MaintenanceRow row) {
        return new MaintenanceRequest(row.id(), row.code(), row.title(), row.issueType(), row.priority(),
                row.status(), row.assigneeName(), row.createdAt());
    }
    private Notification notification(NotificationRow row) {
        return new Notification(row.id(), row.title(), row.content(), row.type(), row.readAt() != null, row.createdAt());
    }
}
