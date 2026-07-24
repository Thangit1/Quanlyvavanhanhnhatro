package com.thangit.boardinghouse.dto.request.auth;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LoginRequest(
        @NotBlank(message = "Vui lòng nhập email.")
        @Email(message = "Email không đúng định dạng.") String email,
        @NotBlank(message = "Vui lòng nhập mật khẩu.") String password,
        @NotNull(message = "Vui lòng chọn vai trò truy cập.") RoleCode requestedRole
) {}
