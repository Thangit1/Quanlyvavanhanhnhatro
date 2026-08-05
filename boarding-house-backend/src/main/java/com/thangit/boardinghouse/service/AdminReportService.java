package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.report.AdminReportRequests.ExportRequest;
import com.thangit.boardinghouse.dto.response.report.AdminReportResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.List;

public interface AdminReportService {
    Overview overview(AuthenticatedUser principal, List<Long> propertyIds, LocalDate startDate, LocalDate endDate,
                      LocalDate comparisonStartDate, LocalDate comparisonEndDate);
    ReportData report(AuthenticatedUser principal, String type, List<Long> propertyIds,
                      LocalDate startDate, LocalDate endDate);
    ExportJob createExport(AuthenticatedUser principal, ExportRequest request);
    List<ExportJob> exports(AuthenticatedUser principal);
    ExportJob export(AuthenticatedUser principal, long id);
    byte[] download(AuthenticatedUser principal, long id);
}
