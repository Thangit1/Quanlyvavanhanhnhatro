package com.thangit.boardinghouse.common.validation;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class VietnamPhonesTest {
    @Test
    void acceptsSupportedVietnamMobileNumbers() {
        List.of(
                "0912345678",
                "0987654321",
                "0321234567",
                "+84912345678",
                "+84321234567"
        ).forEach(phone -> assertThat(VietnamPhones.isValid(phone)).as(phone).isTrue());
    }

    @Test
    void rejectsInvalidNumbersAndCharacters() {
        List.of(
                "0123456789",
                "091234567",
                "09123456789",
                "091234567890",
                "0123456789909966969696969666",
                "abcdefghij",
                "09123abcde",
                "+840912345678",
                "++84912345678",
                "0912 345 678"
        ).forEach(phone -> assertThat(VietnamPhones.isValid(phone)).as(phone).isFalse());
    }

    @Test
    void returnsBothStoredFormatsForLoginLookup() {
        assertThat(VietnamPhones.aliases("0912345678"))
                .containsExactly("0912345678", "+84912345678");
        assertThat(VietnamPhones.aliases("+84912345678"))
                .containsExactly("0912345678", "+84912345678");
    }
}
