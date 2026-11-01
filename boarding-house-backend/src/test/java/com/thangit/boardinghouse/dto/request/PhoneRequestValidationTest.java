package com.thangit.boardinghouse.dto.request;

import com.thangit.boardinghouse.dto.request.auth.RegisterRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PhoneRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsAnOverlongPhoneSentDirectlyToRegistrationApi() {
        RegisterRequest request = new RegisterRequest(
                "Nguyễn Văn A",
                "tenant@example.com",
                "0123456789909966969696969666",
                "password1",
                "password1",
                true
        );

        assertThat(validator.validate(request))
                .anySatisfy(violation -> {
                    assertThat(violation.getPropertyPath().toString()).isEqualTo("phone");
                    assertThat(violation.getMessage()).isEqualTo("Số điện thoại không hợp lệ.");
                });
    }

    @Test
    void acceptsBothSupportedFormatsInRegistrationRequest() {
        for (String phone : new String[]{"0337813143", "0912345678", "+84912345678"}) {
            RegisterRequest request = new RegisterRequest(
                    "Nguyễn Văn A",
                    "tenant@example.com",
                    phone,
                    "password1",
                    "password1",
                    true
            );
            assertThat(validator.validate(request)).isEmpty();
        }
    }

    @Test
    void requiresPhoneForTenantRegistration() {
        RegisterRequest request = new RegisterRequest(
                "Nguyễn Văn A", "tenant@example.com", "",
                "password1", "password1", true
        );

        assertThat(validator.validate(request))
                .anySatisfy(violation -> {
                    assertThat(violation.getPropertyPath().toString()).isEqualTo("phone");
                    assertThat(violation.getMessage()).isEqualTo("Số điện thoại là bắt buộc.");
                });
    }

    @Test
    void rejectsInvalidTenantRegistrationPhones() {
        for (String phone : new String[]{
                "033781314", "03378131437", "0123456789",
                "abcdefghij", "09123abcde"
        }) {
            RegisterRequest request = new RegisterRequest(
                    "Nguyễn Văn A", "tenant@example.com", phone,
                    "password1", "password1", true
            );
            assertThat(validator.validate(request)).as(phone).isNotEmpty();
        }
    }
}
