package com.thangit.boardinghouse.service;
import com.thangit.boardinghouse.dto.response.dashboard.DashboardResponse;
import com.thangit.boardinghouse.security.AuthenticatedUser;
public interface DashboardService {
    DashboardResponse getDashboard(AuthenticatedUser principal, Long propertyId, String period);
}
