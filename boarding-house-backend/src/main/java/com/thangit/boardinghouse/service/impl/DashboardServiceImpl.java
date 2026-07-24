package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.response.dashboard.DashboardResponse;
import com.thangit.boardinghouse.dto.response.dashboard.DashboardResponse.*;
import com.thangit.boardinghouse.repository.DashboardRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.DashboardService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Service
public class DashboardServiceImpl implements DashboardService {
    private final DashboardRepository repository;
    public DashboardServiceImpl(DashboardRepository repository) { this.repository = repository; }

    @Override @Transactional(readOnly = true)
    public DashboardResponse getDashboard(AuthenticatedUser principal, Long propertyId, String period) {
        RoleCode role = principal.activeRole();
        if (role != RoleCode.OWNER && role != RoleCode.MANAGER) throw new AuthException(
                HttpStatus.FORBIDDEN, "ROLE_NOT_ALLOWED", "Bạn không có quyền truy cập dashboard quản trị.");
        if (propertyId != null && !repository.canAccess(principal.id(), role, propertyId)) throw new AuthException(
                HttpStatus.FORBIDDEN, "PROPERTY_ACCESS_DENIED", "Bạn không có quyền truy cập khu trọ đã chọn.");

        String normalizedPeriod = period == null ? "MONTH" : period.toUpperCase(Locale.ROOT);
        LocalDate today = LocalDate.now();
        LocalDate periodStart;
        LocalDate periodEnd;
        LocalDate previousStart;
        int historyMonths;
        switch (normalizedPeriod) {
            case "MONTH" -> {
                periodStart = today.withDayOfMonth(1); periodEnd = periodStart.plusMonths(1);
                previousStart = periodStart.minusMonths(1); historyMonths = 6;
            }
            case "QUARTER" -> {
                int firstMonth = ((today.getMonthValue() - 1) / 3) * 3 + 1;
                periodStart = LocalDate.of(today.getYear(), firstMonth, 1); periodEnd = periodStart.plusMonths(3);
                previousStart = periodStart.minusMonths(3); historyMonths = 6;
            }
            case "YEAR" -> {
                periodStart = LocalDate.of(today.getYear(), 1, 1); periodEnd = periodStart.plusYears(1);
                previousStart = periodStart.minusYears(1); historyMonths = 12;
            }
            default -> throw new AuthException(HttpStatus.BAD_REQUEST, "DASHBOARD_PERIOD_INVALID",
                    "Kỳ thống kê chỉ nhận MONTH, QUARTER hoặc YEAR.");
        }
        Map<String, Object> values = repository.summary(
                principal.id(), role, propertyId, periodStart, periodEnd, previousStart);
        long totalRooms = number(values, "totalRooms").longValue();
        long occupied = number(values, "occupiedRooms").longValue();
        BigDecimal current = decimal(values, "currentRevenue");
        BigDecimal previous = decimal(values, "previousRevenue");
        BigDecimal occupancy = totalRooms == 0 ? BigDecimal.ZERO :
                BigDecimal.valueOf(occupied * 100.0 / totalRooms).setScale(1, RoundingMode.HALF_UP);
        BigDecimal change = previous.signum() == 0 ? BigDecimal.ZERO :
                current.subtract(previous).multiply(BigDecimal.valueOf(100)).divide(previous, 2, RoundingMode.HALF_UP);
        Summary summary = new Summary(number(values, "totalProperties").longValue(), totalRooms, occupied,
                number(values, "vacantRooms").longValue(), number(values, "reservedRooms").longValue(),
                number(values, "maintenanceRooms").longValue(), occupancy, current, previous, change,
                decimal(values, "debt"), number(values, "expiring").longValue(),
                number(values, "openMaintenance").longValue());

        List<OverdueInvoice> overdue = repository.overdueInvoices(principal.id(), role, propertyId);
        List<ExpiringContract> expiring = repository.expiringContracts(principal.id(), role, propertyId);
        List<MaintenanceItem> maintenance = repository.maintenance(principal.id(), role, propertyId);
        List<OperationalAlert> alerts = new ArrayList<>();
        if (!overdue.isEmpty()) alerts.add(new OperationalAlert("OVERDUE_INVOICES", "IMPORTANT",
                "Hóa đơn quá hạn", "Có %d hóa đơn quá hạn cần xử lý.".formatted(overdue.size()), "/admin/invoices"));
        if (!expiring.isEmpty()) alerts.add(new OperationalAlert("EXPIRING_CONTRACTS", "ATTENTION",
                "Hợp đồng sắp hết hạn", "Có %d hợp đồng hết hạn trong 30 ngày.".formatted(expiring.size()), "/admin/contracts"));
        long urgent = maintenance.stream().filter(item -> "URGENT".equals(item.priority())).count();
        if (urgent > 0) alerts.add(new OperationalAlert("URGENT_MAINTENANCE", "URGENT",
                "Sửa chữa khẩn cấp", "Có %d yêu cầu khẩn cấp chưa hoàn thành.".formatted(urgent), "/admin/maintenance"));

        return new DashboardResponse(repository.properties(principal.id(), role), summary,
                repository.roomStatuses(principal.id(), role, propertyId),
                mergeRevenue(repository.revenueHistory(principal.id(), role, propertyId, historyMonths)),
                repository.rooms(principal.id(), role, propertyId), overdue, expiring, maintenance, alerts,
                repository.activities(principal.id(), role, propertyId), List.of());
    }

    private List<RevenuePoint> mergeRevenue(List<RevenuePoint> rows) {
        Map<String, BigDecimal[]> grouped = new LinkedHashMap<>();
        for (RevenuePoint row : rows) {
            BigDecimal[] totals = grouped.computeIfAbsent(row.period(), ignored ->
                    new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO});
            totals[0] = totals[0].add(zero(row.revenue()));
            totals[1] = totals[1].add(zero(row.expense()));
            totals[2] = totals[2].add(zero(row.outstandingDebt()));
        }
        return grouped.entrySet().stream().map(entry -> new RevenuePoint(entry.getKey(),
                entry.getValue()[0], entry.getValue()[1], entry.getValue()[2])).toList();
    }
    private Number number(Map<String, Object> map, String key) { return (Number) map.get(key); }
    private BigDecimal decimal(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value instanceof BigDecimal decimal ? decimal : new BigDecimal(value.toString());
    }
    private BigDecimal zero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
}
