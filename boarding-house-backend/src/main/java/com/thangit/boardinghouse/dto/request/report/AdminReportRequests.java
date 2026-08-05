package com.thangit.boardinghouse.dto.request.report;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class AdminReportRequests {
    private AdminReportRequests() {}

    public record ExportRequest(
            @NotBlank String reportType,
            @NotBlank String format,
            List<Long> propertyIds,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            Map<String, Object> filters,
            List<String> columns,
            boolean includeCharts) {}
}
