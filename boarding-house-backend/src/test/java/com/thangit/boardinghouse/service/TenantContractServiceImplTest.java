package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.TenantContractRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.TenantContractServiceImpl;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class TenantContractServiceImplTest {
    @Test
    void managerCannotUseTenantContractApi() {
        TenantContractRepository repository = mock(TenantContractRepository.class);
        TenantContractService service = new TenantContractServiceImpl(repository);

        assertThatThrownBy(() -> service.getContracts(
                new AuthenticatedUser(1L, "manager@example.com", RoleCode.MANAGER),
                null, 0, 10, "endDate,desc"))
                .isInstanceOf(AuthException.class)
                .extracting(error -> ((AuthException) error).code())
                .isEqualTo("ROLE_NOT_ALLOWED");
        verifyNoInteractions(repository);
    }

    @Test
    void tenantCannotReadAnotherTenantsContractByChangingUrlId() {
        TenantContractRepository repository = mock(TenantContractRepository.class);
        when(repository.findContract(7L, 99L)).thenReturn(Optional.empty());
        when(repository.existsContract(99L)).thenReturn(true);
        TenantContractService service = new TenantContractServiceImpl(repository);

        assertThatThrownBy(() -> service.getContract(
                new AuthenticatedUser(7L, "tenant@example.com", RoleCode.TENANT), 99L))
                .isInstanceOf(AuthException.class)
                .satisfies(error -> {
                    AuthException auth = (AuthException) error;
                    assertThat(auth.code()).isEqualTo("CONTRACT_ACCESS_DENIED");
                    assertThat(auth.status().value()).isEqualTo(403);
                });
    }

    @Test
    void calculatesEffectiveExpiryStatusWithoutTrustingClient() {
        assertThat(TenantContractRepository.effectiveStatus("ACTIVE", LocalDate.now().plusDays(20)))
                .isEqualTo("EXPIRING");
        assertThat(TenantContractRepository.effectiveStatus("ACTIVE", LocalDate.now().minusDays(1)))
                .isEqualTo("EXPIRED");
        assertThat(TenantContractRepository.effectiveStatus("TERMINATED", LocalDate.now().plusDays(20)))
                .isEqualTo("TERMINATED");
    }
}
