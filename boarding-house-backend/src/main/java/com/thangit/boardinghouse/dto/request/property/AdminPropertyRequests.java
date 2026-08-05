package com.thangit.boardinghouse.dto.request.property;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class AdminPropertyRequests {
    private AdminPropertyRequests() {}

    public record SaveProperty(
            @NotBlank @Size(max = 30) @Pattern(regexp = "^[A-Za-z0-9_-]+$") String code,
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Pattern(regexp = "BOARDING_HOUSE|APARTMENT|DORMITORY|OTHER") String type,
            @Size(max = 3000) String description,
            @NotBlank @Size(max = 500) String address,
            @Size(max = 20) String phone,
            @Email @Size(max = 255) String email,
            LocalDate operationStartDate,
            @Size(max = 500) String thumbnailUrl,
            Long managerId,
            Long version) {}

    public record SaveBuilding(
            @NotBlank @Size(max = 30) @Pattern(regexp = "^[A-Za-z0-9_-]+$") String code,
            @NotBlank @Size(max = 100) String name,
            @Min(0) Integer displayOrder) {}

    public record SaveFloor(
            @NotBlank @Size(max = 30) @Pattern(regexp = "^[A-Za-z0-9_-]+$") String code,
            @NotBlank @Size(max = 100) String name,
            Integer floorNumber,
            @Min(0) Integer displayOrder) {}

    public record SaveRoom(
            @NotNull Long propertyId,
            @NotNull Long buildingId,
            @NotNull Long floorId,
            @NotBlank @Size(max = 50) String code,
            @NotBlank @Size(max = 100) String name,
            @Size(max = 100) String roomType,
            @Size(max = 3000) String description,
            @DecimalMin("0.0") BigDecimal area,
            @NotNull @DecimalMin("0.0") BigDecimal monthlyRent,
            @DecimalMin("0.0") BigDecimal depositAmount,
            @NotNull @Min(1) @Max(100) Integer capacity,
            @Size(max = 500) String imageUrl,
            List<Long> amenityIds,
            @Valid List<SaveAsset> assets,
            Long version) {}

    public record SaveAsset(
            @NotBlank @Size(max = 150) String name,
            @NotNull @Min(1) Integer quantity,
            @NotBlank @Pattern(regexp = "GOOD|FAIR|DAMAGED|LOST") String conditionStatus,
            @Size(max = 500) String note) {}

    public record BulkCreateRooms(
            @NotNull Long propertyId,
            @NotNull Long buildingId,
            @NotNull Long floorId,
            @NotBlank @Size(max = 20) String prefix,
            @NotNull @Min(1) @Max(200) Integer fromNumber,
            @NotNull @Min(1) @Max(200) Integer toNumber,
            @Min(1) @Max(4) Integer padding,
            @Size(max = 100) String roomType,
            @DecimalMin("0.0") BigDecimal area,
            @NotNull @DecimalMin("0.0") BigDecimal monthlyRent,
            @DecimalMin("0.0") BigDecimal depositAmount,
            @NotNull @Min(1) @Max(100) Integer capacity) {}

    public record ChangePrice(
            @NotNull @DecimalMin("0.0") BigDecimal newPrice,
            @NotNull LocalDate effectiveDate,
            @Size(max = 500) String reason,
            Long version) {}

    public record ChangeStatus(
            @NotBlank @Pattern(regexp = "VACANT|RESERVED|OCCUPIED|MAINTENANCE|INACTIVE") String status,
            @Size(max = 500) String reason,
            Long version) {}
}
