package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.dto.request.maintenance.AdminMaintenanceRequests.*;
import com.thangit.boardinghouse.dto.response.maintenance.AdminMaintenanceResponses.*;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.List;

public interface AdminMaintenanceService {
    Summary summary(AuthenticatedUser principal, Long propertyId);
    Options options(AuthenticatedUser principal);
    Page<RequestRow> list(AuthenticatedUser principal, Long propertyId, Long roomId,
                          String keyword, String category, String priority, String status,
                          Boolean overdue, String sort, int page, int size);
    Detail detail(AuthenticatedUser principal, long id);
    Created create(AuthenticatedUser principal, CreateRequest request);
    Detail triage(AuthenticatedUser principal, long id, TriageRequest request);
    Detail assign(AuthenticatedUser principal, long id, AssignRequest request);
    Detail schedule(AuthenticatedUser principal, long id, ScheduleRequest request);
    Detail start(AuthenticatedUser principal, long id, long version);
    Detail workLog(AuthenticatedUser principal, long id, WorkLogRequest request);
    Detail addMaterial(AuthenticatedUser principal, long id, MaterialUsageRequest request);
    Detail submitCost(AuthenticatedUser principal, long id, CostRequest request);
    Detail complete(AuthenticatedUser principal, long id, CompleteRequest request);
    Detail inspect(AuthenticatedUser principal, long id, InspectionRequest request);
    Detail reopen(AuthenticatedUser principal, long id, ReasonRequest request);
    Detail cancel(AuthenticatedUser principal, long id, ReasonRequest request);
    List<CalendarItem> calendar(AuthenticatedUser principal, LocalDate from, LocalDate to);
    List<Plan> plans(AuthenticatedUser principal);
    Plan createPlan(AuthenticatedUser principal, PlanRequest request);
    List<Material> materials(AuthenticatedUser principal);
    Material createMaterial(AuthenticatedUser principal, MaterialRequest request);
    Report report(AuthenticatedUser principal);
    byte[] export(AuthenticatedUser principal, Long propertyId, String status);
}
