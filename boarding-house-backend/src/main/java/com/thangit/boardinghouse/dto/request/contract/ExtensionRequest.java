package com.thangit.boardinghouse.dto.request.contract;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ExtensionRequest(
        @NotNull(message = "Vui lòng chọn ngày kết thúc mong muốn.")
        @Future(message = "Ngày kết thúc mong muốn phải ở tương lai.")
        LocalDate requestedEndDate,
        @Size(max = 1000, message = "Ghi chú không được vượt quá 1000 ký tự.")
        String note
) {}
