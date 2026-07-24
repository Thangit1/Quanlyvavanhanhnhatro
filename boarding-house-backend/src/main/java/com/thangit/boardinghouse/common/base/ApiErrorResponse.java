package com.thangit.boardinghouse.common.base;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

public record ApiErrorResponse(
        boolean success,
        String message,
        String errorCode,
        List<FieldError> errors,
        OffsetDateTime timestamp
) {
    public static ApiErrorResponse of(String message, String errorCode, List<FieldError> errors) {
        return new ApiErrorResponse(false, message, errorCode, errors, OffsetDateTime.now(ZoneOffset.UTC));
    }

    public record FieldError(String field, String message) {
    }
}
