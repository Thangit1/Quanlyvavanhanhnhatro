package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.AccountStatus;
import com.thangit.boardinghouse.repository.AdminTenantRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AdminTenantServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminTenantServiceImplTest {
    private final AdminTenantRepository repository = mock(AdminTenantRepository.class);
    private final AdminTenantService service =
            new AdminTenantServiceImpl(repository, mock(PasswordEncoder.class));

    @Test
    void tenantCannotReadAdministrativeTenantData() {
        assertThatThrownBy(() -> service.detail(
                new AuthenticatedUser(7L, "tenant@example.com", RoleCode.TENANT), 9L))
                .isInstanceOf(AuthException.class)
                .extracting(error -> ((AuthException) error).code())
                .isEqualTo("TENANT_ACCESS_DENIED");
        verifyNoInteractions(repository);
    }

    @Test
    void managerCannotReadTenantOutsideAssignedProperties() {
        when(repository.canAccessTenant(3L, RoleCode.MANAGER, 9L)).thenReturn(false);
        assertThatThrownBy(() -> service.detail(
                new AuthenticatedUser(3L, "manager@example.com", RoleCode.MANAGER), 9L))
                .isInstanceOf(AuthException.class)
                .extracting(error -> ((AuthException) error).code())
                .isEqualTo("TENANT_ACCESS_DENIED");
    }

    @Test
    void accountantHasReadOnlyAccess() {
        assertThatThrownBy(() -> service.updateAccountStatus(
                new AuthenticatedUser(4L, "accountant@example.com", RoleCode.ACCOUNTANT),
                9L, new AccountStatus("LOCKED")))
                .isInstanceOf(AuthException.class)
                .extracting(error -> ((AuthException) error).code())
                .isEqualTo("TENANT_ACCESS_DENIED");
        verifyNoInteractions(repository);
    }
}
