package com.thangit.boardinghouse.dto.response.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public final class AdminReportResponses {
    private AdminReportResponses() {}

    public record PropertyOption(long id, String name) {}
    public record Scope(List<Long> propertyIds, LocalDate startDate, LocalDate endDate) {}
    public record ChartPoint(String label, BigDecimal value, BigDecimal secondaryValue, String category) {}
    public record Alert(String code, String severity, String title, String description, String actionUrl) {}
    public record Overview(
            Scope scope,
            List<PropertyOption> availableProperties,
            Map<String, BigDecimal> summary,
            Map<String, BigDecimal> comparison,
            List<ChartPoint> roomStatus,
            List<ChartPoint> revenueTrend,
            List<Alert> operationalAlerts,
            LocalDateTime updatedAt) {}
    public record ReportData(
            String reportType,
            Scope scope,
            Map<String, BigDecimal> summary,
            List<ChartPoint> trend,
            List<ChartPoint> breakdown,
            List<Map<String, Object>> details,
            LocalDateTime updatedAt) {}
    public record ExportJob(
            long id, String reportType, String format, String status, String fileName,
            Long fileSize, LocalDateTime expiresAt, LocalDateTime createdAt,
            LocalDateTime completedAt, String errorMessage) {}
}
