package com.thangit.boardinghouse.dto.request.contract;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record TerminationRequest(
        @NotNull(message = "Vui lòng chọn ngày dự kiến trả phòng.")
        @FutureOrPresent(message = "Ngày trả phòng không được ở quá khứ.")
        LocalDate expectedMoveOutDate,
        @NotBlank(message = "Vui lòng nhập lý do trả phòng.")
        @Size(max = 300, message = "Lý do không được vượt quá 300 ký tự.")
        String reason,
        @Size(max = 1000, message = "Ghi chú không được vượt quá 1000 ký tự.")
        String note,
        @NotBlank(message = "Vui lòng nhập số điện thoại liên hệ.")
        @Pattern(regexp = "^[0-9+]{9,15}$", message = "Số điện thoại không đúng định dạng.")
        String contactPhone
) {}
