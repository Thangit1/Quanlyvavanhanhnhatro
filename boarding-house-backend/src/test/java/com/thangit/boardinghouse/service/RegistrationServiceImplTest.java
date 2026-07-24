package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.Role;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.domain.auth.User;
import com.thangit.boardinghouse.dto.request.auth.RegisterRequest;
import com.thangit.boardinghouse.repository.RoleRepository;
import com.thangit.boardinghouse.repository.UserRepository;
import com.thangit.boardinghouse.service.impl.RegistrationServiceImpl;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class RegistrationServiceImplTest {
    @Test
    void createsOnlyTenantAndHashesPassword() {
        UserRepository users = mock(UserRepository.class);
        RoleRepository roles = mock(RoleRepository.class);
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
        Role tenant = new Role();
        ReflectionTestUtils.setField(tenant, "code", RoleCode.TENANT.name());
        when(roles.findByCode("TENANT")).thenReturn(Optional.of(tenant));
        when(users.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        RegistrationService service = new RegistrationServiceImpl(users, roles, encoder);

        service.registerTenant(new RegisterRequest(" Nguyễn Văn A ", " Guest@Gmail.com ", "0912345678",
                "guest123", "guest123", true));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(users).saveAndFlush(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getEmail()).isEqualTo("guest@gmail.com");
        assertThat(saved.getRoles()).extracting(Role::getCode).containsExactly("TENANT");
        assertThat(saved.getPasswordHash()).isNotEqualTo("guest123");
        assertThat(encoder.matches("guest123", saved.getPasswordHash())).isTrue();
    }

    @Test
    void rejectsMismatchedPasswordBeforeWriting() {
        UserRepository users = mock(UserRepository.class);
        RegistrationService service = new RegistrationServiceImpl(
                users, mock(RoleRepository.class), new BCryptPasswordEncoder(4));

        assertThatThrownBy(() -> service.registerTenant(new RegisterRequest(
                "Nguyễn Văn A", "guest@gmail.com", "", "guest123", "different1", true)))
                .isInstanceOf(AuthException.class);
        verifyNoInteractions(users);
    }
}
