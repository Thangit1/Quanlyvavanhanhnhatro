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

    @Test void moveOutCannotBypassFinancialSettlement() {
        var p=new AuthenticatedUser(1L,"owner@example.com",RoleCode.OWNER);
        when(repository.canAccessTenant(1L,RoleCode.OWNER,9L)).thenReturn(true);
        when(repository.activeResidence(9L)).thenReturn(java.util.Optional.of(java.util.Map.of("id",10L,"contract_id",11L,"room_id",12L)));
        assertThatThrownBy(()->service.moveOut(p,9L,new com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.MoveOut(java.time.LocalDate.now(),"Trả phòng",true)))
                .isInstanceOf(AuthException.class).extracting(e->((AuthException)e).code()).isEqualTo("LIFECYCLE_SETTLEMENT_REQUIRED");
        verify(repository,never()).moveOut(anyLong(),anyLong(),any(),any(),any(),any(),anyBoolean(),anyLong());
    }

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
