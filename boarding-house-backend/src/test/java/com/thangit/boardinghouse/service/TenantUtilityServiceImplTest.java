package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.TenantUtilityRepository;
import com.thangit.boardinghouse.repository.TenantUtilityRepository.ContractRoomRow;
import com.thangit.boardinghouse.repository.TenantUtilityRepository.ReadingRow;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.TenantUtilityServiceImpl;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class TenantUtilityServiceImplTest {
    @Test
    void rejectsNonTenantBeforeQueryingData() {
        TenantUtilityRepository repository = mock(TenantUtilityRepository.class);
        TenantUtilityService service = new TenantUtilityServiceImpl(repository);

        assertThatThrownBy(() -> service.getUtilities(
                new AuthenticatedUser(1L, "manager@example.com", RoleCode.MANAGER), null, null))
                .isInstanceOf(AuthException.class)
                .extracting(error -> ((AuthException) error).code())
                .isEqualTo("TENANT_UTILITY_ACCESS_DENIED");
        verifyNoInteractions(repository);
    }

    @Test
    void rejectsContractThatDoesNotBelongToTenant() {
        TenantUtilityRepository repository = mock(TenantUtilityRepository.class);
        when(repository.findActiveContractRooms(7L)).thenReturn(List.of(
                new ContractRoomRow(10L, 20L, "302", "SmartHome Cầu Giấy", "Cầu Giấy")));
        TenantUtilityService service = new TenantUtilityServiceImpl(repository);

        assertThatThrownBy(() -> service.getUtilities(tenant(), 99L, null))
                .isInstanceOf(AuthException.class)
                .satisfies(error -> {
                    AuthException auth = (AuthException) error;
                    assertThat(auth.code()).isEqualTo("TENANT_UTILITY_ACCESS_DENIED");
                    assertThat(auth.status().value()).isEqualTo(403);
                });
        verify(repository, never()).findReadings(anyLong(), anyLong());
    }

    @Test
    void keepsBackendAmountsAndHidesNegativeUsage() {
        TenantUtilityRepository repository = mock(TenantUtilityRepository.class);
        ContractRoomRow room = new ContractRoomRow(10L, 20L, "302", "SmartHome Cầu Giấy", "Cầu Giấy");
        LocalDate period = LocalDate.of(2026, 9, 1);
        ReadingRow row = new ReadingRow(30L, period,
                decimal("1370"), decimal("1250"), decimal("3500"), decimal("420000"),
                decimal("120"), decimal("128"), decimal("20000"), decimal("160000"),
                40L, "HD-000040", "UNPAID");
        when(repository.findActiveContractRooms(7L)).thenReturn(List.of(room));
        when(repository.findReadings(7L, 10L)).thenReturn(List.of(row));
        TenantUtilityService service = new TenantUtilityServiceImpl(repository);

        var result = service.getUtilities(tenant(), 10L, period);

        assertThat(result.reading().electricity().valid()).isFalse();
        assertThat(result.reading().electricity().usage()).isNull();
        assertThat(result.reading().electricity().amount()).isNull();
        assertThat(result.reading().water().usage()).isEqualByComparingTo("8");
        assertThat(result.reading().water().amount()).isEqualByComparingTo("160000");
        assertThat(result.reading().totalAmount()).isNull();
        assertThat(result.reading().invoice().id()).isEqualTo(40L);
        assertThat(result.reading().status()).isEqualTo("INVOICED");
    }

    private static AuthenticatedUser tenant() {
        return new AuthenticatedUser(7L, "tenant@example.com", RoleCode.TENANT);
    }

    private static BigDecimal decimal(String value) {
        return new BigDecimal(value);
    }
}
