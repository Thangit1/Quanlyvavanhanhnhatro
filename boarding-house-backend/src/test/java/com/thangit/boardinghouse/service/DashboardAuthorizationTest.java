package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.DashboardRepository;
import com.thangit.boardinghouse.repository.TenantHomeRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.DashboardServiceImpl;
import com.thangit.boardinghouse.service.impl.TenantHomeServiceImpl;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DashboardAuthorizationTest {
    @Test
    void tenantCannotReadAdminDashboard() {
        DashboardServiceImpl service = new DashboardServiceImpl(mock(DashboardRepository.class));
        AuthException error = assertThrows(AuthException.class, () ->
                service.getDashboard(new AuthenticatedUser(10L, "tenant@example.com", RoleCode.TENANT), null, "MONTH"));
        assertEquals("ROLE_NOT_ALLOWED", error.code());
    }

    @Test
    void managerCannotReadUnassignedProperty() {
        DashboardRepository repository = mock(DashboardRepository.class);
        when(repository.canAccess(20L, RoleCode.MANAGER, 999L)).thenReturn(false);
        DashboardServiceImpl service = new DashboardServiceImpl(repository);
        AuthException error = assertThrows(AuthException.class, () ->
                service.getDashboard(new AuthenticatedUser(20L, "manager@example.com", RoleCode.MANAGER), 999L, "MONTH"));
        assertEquals("PROPERTY_ACCESS_DENIED", error.code());
    }

    @Test
    void ownerCannotUseTenantHomeEndpoint() {
        TenantHomeServiceImpl service = new TenantHomeServiceImpl(mock(TenantHomeRepository.class));
        AuthException error = assertThrows(AuthException.class, () ->
                service.getHome(new AuthenticatedUser(30L, "owner@example.com", RoleCode.OWNER)));
        assertEquals("ROLE_NOT_ALLOWED", error.code());
    }
}
