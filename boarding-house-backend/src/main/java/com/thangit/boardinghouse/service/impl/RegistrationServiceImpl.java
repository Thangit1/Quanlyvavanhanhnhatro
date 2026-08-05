package com.thangit.boardinghouse.service.impl;

import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.Role;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.domain.auth.User;
import com.thangit.boardinghouse.dto.request.auth.RegisterRequest;
import com.thangit.boardinghouse.dto.response.auth.RegisterResponse;
import com.thangit.boardinghouse.repository.RoleRepository;
import com.thangit.boardinghouse.repository.UserRepository;
import com.thangit.boardinghouse.service.RegistrationService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Locale;

@Service
public class RegistrationServiceImpl implements RegistrationService {
    private final UserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwordEncoder;
    private final JdbcClient jdbc;

    @Autowired
    public RegistrationServiceImpl(UserRepository users, RoleRepository roles, PasswordEncoder passwordEncoder, JdbcClient jdbc) {
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
    }

    public RegistrationServiceImpl(UserRepository users, RoleRepository roles, PasswordEncoder passwordEncoder) {
        this(users, roles, passwordEncoder, null);
    }

    @Override
    @Transactional
    public RegisterResponse registerTenant(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String phone = request.phone() == null || request.phone().isBlank() ? null : request.phone().trim();
        if (!request.password().equals(request.confirmPassword())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "PASSWORD_CONFIRMATION_MISMATCH",
                    "Mật khẩu xác nhận không khớp.");
        }
        if (users.existsByEmailIgnoreCase(email)) {
            throw new AuthException(HttpStatus.CONFLICT, "EMAIL_ALREADY_EXISTS", "Email đã được sử dụng.");
        }
        if (phone != null && users.existsByPhone(phone)) {
            throw new AuthException(HttpStatus.CONFLICT, "PHONE_ALREADY_EXISTS", "Số điện thoại đã được sử dụng.");
        }
        Role tenantRole = roles.findByCode(RoleCode.TENANT.name()).orElseThrow(() ->
                new AuthException(HttpStatus.INTERNAL_SERVER_ERROR, "TENANT_ROLE_NOT_CONFIGURED",
                        "Vai trò khách thuê chưa được cấu hình."));
        User user = User.registeredTenant(
                request.fullName().trim(), email, phone, passwordEncoder.encode(request.password()), tenantRole);
        try {
            User saved = users.saveAndFlush(user);
            if (jdbc != null && saved.getId() != null) jdbc.sql("""
                    INSERT INTO tenant_profiles(tenant_code,user_id,full_name,phone,email,status,profile_status)
                    VALUES(:code,:userId,:fullName,:phone,:email,'ACTIVE','INCOMPLETE')
                    """).param("code","NT%06d".formatted(saved.getId())).param("userId",saved.getId())
                    .param("fullName",saved.getFullName()).param("phone",phone==null?"UNSET-"+saved.getId():phone)
                    .param("email",email).update();
            return new RegisterResponse(saved.getId(), saved.getFullName(), saved.getEmail(), RoleCode.TENANT);
        } catch (DataIntegrityViolationException exception) {
            throw new AuthException(HttpStatus.CONFLICT, "ACCOUNT_ALREADY_EXISTS",
                    "Email hoặc số điện thoại đã được sử dụng.");
        }
    }
}
