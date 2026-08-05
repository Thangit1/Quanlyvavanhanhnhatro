package com.thangit.boardinghouse.dto.response.property;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminPropertyResponses {
    private AdminPropertyResponses() {}

    public record Page<T>(List<T> items, int page, int size, long totalElements, int totalPages) {}
    public record Manager(Long id, String fullName) {}
    public record PropertySummary(long totalProperties, long activeProperties, long totalRooms,
                                  long occupiedRooms, long vacantRooms, long maintenanceRooms) {}
    public record PropertyRow(Long id, String propertyCode, String name, String type, String address,
                              String thumbnailUrl, Manager manager, long buildingCount, long floorCount,
                              long totalRooms, long occupiedRooms, long vacantRooms, long reservedRooms,
                              long maintenanceRooms, double occupancyRate, BigDecimal currentRevenue,
                              BigDecimal outstandingDebt, String status, long version) {}
    public record PropertyList(PropertySummary summary, Page<PropertyRow> page) {}
    public record Floor(Long id, String code, String name, Integer floorNumber, int displayOrder,
                        long totalRooms, long occupiedRooms) {}
    public record Building(Long id, String code, String name, int displayOrder, List<Floor> floors) {}
    public record PropertyDetail(Long id, String propertyCode, String name, String type, String description,
                                 String address, String phone, String email, LocalDate operationStartDate,
                                 String thumbnailUrl, Manager manager, String status, long version,
                                 long totalRooms, long occupiedRooms, long vacantRooms, long reservedRooms,
                                 long maintenanceRooms, double occupancyRate, BigDecimal currentRevenue,
                                 BigDecimal outstandingDebt, List<Building> buildings,
                                 List<Activity> activities) {}
    public record Option(Long id, String label, Long parentId) {}
    public record PropertyOptions(List<Option> properties, List<Option> buildings, List<Option> floors,
                                  List<Amenity> amenities) {}
    public record Amenity(Long id, String code, String name, String icon) {}
    public record Created(Long id, String code) {}

    public record RoomSummary(long totalRooms, long occupiedRooms, long vacantRooms,
                              long reservedRooms, long maintenanceRooms, long inactiveRooms) {}
    public record Tenant(Long id, String fullName, String phone, boolean representative) {}
    public record Contract(Long id, String code, LocalDate startDate, LocalDate endDate, String status) {}
    public record RoomRow(Long id, String roomCode, String name, String thumbnailUrl, Long propertyId,
                          String propertyName, Long buildingId, String buildingName, Long floorId,
                          String floorName, String roomType, BigDecimal area, BigDecimal monthlyRent,
                          BigDecimal depositAmount, int maxOccupants, long currentOccupants,
                          Tenant representativeTenant, Contract currentContract, BigDecimal outstandingDebt,
                          long openMaintenanceCount, String status, long version, LocalDateTime updatedAt) {}
    public record RoomList(RoomSummary summary, Page<RoomRow> page) {}
    public record Asset(Long id, String name, int quantity, String conditionStatus, String note) {}
    public record Meter(Long id, String meterType, String meterCode, BigDecimal currentReading,
                        LocalDate readingDate, String status) {}
    public record History(Long id, String type, String fromValue, String toValue, String reason,
                          String actorName, LocalDate effectiveDate, LocalDateTime createdAt) {}
    public record Activity(Long id, String type, String description, String actorName, LocalDateTime createdAt) {}
    public record RoomDetail(RoomRow room, String description, List<Tenant> occupants, List<Amenity> amenities,
                             List<Asset> assets, List<Meter> meters, List<String> images,
                             List<History> priceHistory, List<History> statusHistory,
                             List<Activity> activities, boolean canEdit, boolean canChangePrice,
                             boolean canChangeStatus) {}
}
