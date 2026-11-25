package com.thangit.boardinghouse.dto.request.auth;

import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.common.validation.VietnamPhones;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "Vui lòng nhập email hoặc số điện thoại.")
        @Size(max = 255, message = "Email hoặc số điện thoại không hợp lệ.")
        @Pattern(regexp = VietnamPhones.EMAIL_OR_PHONE_REGEX,
                message = "Email hoặc số điện thoại không hợp lệ.") String email,
        @NotBlank(message = "Vui lòng nhập mật khẩu.") String password,
        @NotNull(message = "Vui lòng chọn vai trò truy cập.") RoleCode requestedRole
) {}
