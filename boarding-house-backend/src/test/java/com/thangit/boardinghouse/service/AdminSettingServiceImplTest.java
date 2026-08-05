package com.thangit.boardinghouse.service;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.UpdateGeneral;
import com.thangit.boardinghouse.dto.request.setting.AdminSettingRequests.UpdateProperty;
import com.thangit.boardinghouse.repository.AdminSettingRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AdminSettingServiceImpl;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminSettingServiceImplTest {
    @Mock AdminSettingRepository repository;
    private AdminSettingServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new AdminSettingServiceImpl(repository, "");
    }

    @Test
    void ownerCanUpdateGeneralAndAuditIsWritten() {
        AuthenticatedUser owner = new AuthenticatedUser(7L, "owner@example.com", RoleCode.OWNER);
        when(repository.ownerId(7L, RoleCode.OWNER)).thenReturn(7L);
        when(repository.group(7L, "general")).thenReturn(Map.of());
        UpdateGeneral request = new UpdateGeneral("SmartHome AI", "support@example.com", "0912345678",
                "vi", "Asia/Ho_Chi_Minh", "VND", "dd/MM/yyyy", "HH:mm");

        service.updateGeneral(owner, request);

        verify(repository).saveGroup(org.mockito.ArgumentMatchers.eq(7L),
                org.mockito.ArgumentMatchers.eq("general"),
                org.mockito.ArgumentMatchers.argThat(values -> "SmartHome AI".equals(values.get("systemName"))
                        && "Asia/Ho_Chi_Minh".equals(values.get("timezone"))),
                org.mockito.ArgumentMatchers.eq(7L));
        verify(repository).audit(org.mockito.ArgumentMatchers.eq(7L), org.mockito.ArgumentMatchers.eq("general"),
                org.mockito.ArgumentMatchers.eq("SYSTEM"), org.mockito.ArgumentMatchers.eq(7L),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void managerCannotReadOwnerBillingSettings() {
        AuthenticatedUser manager = new AuthenticatedUser(8L, "manager@example.com", RoleCode.MANAGER);
        assertThrows(AuthException.class, () -> service.billing(manager));
    }

    @Test
    void managerCannotUpdatePropertyOutsideAssignedScope() {
        AuthenticatedUser manager = new AuthenticatedUser(8L, "manager@example.com", RoleCode.MANAGER);
        when(repository.canAccessProperty(8L, RoleCode.MANAGER, 99L)).thenReturn(false);
        UpdateProperty request = new UpdateProperty("Khu trọ", null, null, null, null,
                1, 5, 28, 3, null, null, false, true, null, null, null, null);
        assertThrows(AuthException.class, () -> service.updateProperty(manager, 99L, request));
    }
}
