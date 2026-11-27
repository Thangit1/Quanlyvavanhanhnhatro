package com.thangit.boardinghouse.dto.request.auth;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
public record ForgotPasswordRequest(
        @NotBlank(message = "Vui lòng nhập email.") @Email(message = "Email không đúng định dạng.") @jakarta.validation.constraints.Size(max=255) String email) {}
