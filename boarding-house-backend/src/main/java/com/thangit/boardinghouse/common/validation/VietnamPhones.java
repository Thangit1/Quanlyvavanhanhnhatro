package com.thangit.boardinghouse.common.validation;

import java.util.List;
import java.util.regex.Pattern;

public final class VietnamPhones {
    public static final String REGEX = "^(?:\\+84|0)(?:3|5|7|8|9)\\d{8}$";
    public static final String OPTIONAL_REGEX = "^(?:$|(?:\\+84|0)(?:3|5|7|8|9)\\d{8})$";
    public static final String EMAIL_OR_PHONE_REGEX =
            "^(?:[^\\s@]+@[^\\s@]+\\.[^\\s@]+|(?:\\+84|0)(?:3|5|7|8|9)\\d{8})$";
    public static final String INVALID_MESSAGE = "Số điện thoại không hợp lệ.";

    private static final Pattern PATTERN = Pattern.compile(REGEX);

    private VietnamPhones() {}

    public static boolean isValid(String value) {
        return value != null && PATTERN.matcher(value.trim()).matches();
    }

    public static List<String> aliases(String value) {
        String phone = value.trim();
        String domestic = phone.startsWith("+84") ? "0" + phone.substring(3) : phone;
        return List.of(domestic, "+84" + domestic.substring(1));
    }
}
