package com.thangit.boardinghouse.dto.request.auth;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "Vui lòng nhập họ và tên.")
        @Size(max = 150, message = "Họ và tên không được vượt quá 150 ký tự.")
        String fullName,

        @NotBlank(message = "Vui lòng nhập email.")
        @Email(message = "Email không đúng định dạng.")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự.")
        String email,

        @Pattern(regexp = "^$|^[0-9+]{9,15}$", message = "Số điện thoại không đúng định dạng.")
        String phone,

        @NotBlank(message = "Vui lòng nhập mật khẩu.")
        @Size(min = 8, max = 72, message = "Mật khẩu phải có từ 8 đến 72 ký tự.")
        @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
                message = "Mật khẩu phải chứa ít nhất một chữ cái và một chữ số.")
        String password,

        @NotBlank(message = "Vui lòng xác nhận mật khẩu.")
        String confirmPassword,

        @NotNull(message = "Bạn cần xác nhận điều khoản sử dụng.")
        @AssertTrue(message = "Bạn cần đồng ý với điều khoản sử dụng.")
        Boolean acceptedTerms
) {}
