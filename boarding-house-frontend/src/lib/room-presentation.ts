import type { RoomRow } from "@/types/admin-property";

export const roomStatuses = [
  "VACANT",
  "READY",
  "RESERVED",
  "OCCUPIED",
  "NOTICE",
  "CLEANING",
  "MAINTENANCE",
  "INACTIVE",
] as const;
export const roomStatusColors: Record<string, string> = {
  VACANT: "#10b981",
  READY: "#059669",
  RESERVED: "#f59e0b",
  OCCUPIED: "#2563eb",
  NOTICE: "#f59e0b",
  CLEANING: "#06b6d4",
  MAINTENANCE: "#ef4444",
  INACTIVE: "#94a3b8",
};
export function canStartRental(room: RoomRow) {
  return (
    ["VACANT", "READY"].includes(room.status) &&
    !room.currentContract &&
    room.currentOccupants === 0 &&
    room.openMaintenanceCount === 0
  );
}
export function expiringInDays(endDate?: string, now = new Date()) {
  if (!endDate) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const days = Math.round((end - today) / 86400000);
  return Number.isFinite(days) && days >= 0 && days <= 30 ? days : null;
}
export function previewRoomCodes(
  prefix: string,
  start: number,
  count: number,
  padding = 3,
) {
  if (
    !/^[A-Za-z0-9_-]{1,20}$/.test(prefix) ||
    !Number.isInteger(start) ||
    !Number.isInteger(count) ||
    start < 1 ||
    count < 1 ||
    count > 200 ||
    start + count - 1 > 999999
  )
    return [];
  return Array.from(
    { length: count },
    (_, i) =>
      `${prefix.toUpperCase()}${String(start + i).padStart(padding, "0")}`,
  );
}
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function roomsCsv(
  rows: RoomRow[],
  statusLabel: (status: string) => string,
) {
  const columns = [
    "Nhà trọ",
    "Dãy",
    "Tầng",
    "Số phòng",
    "Tên phòng",
    "Diện tích (m²)",
    "Sức chứa",
    "Giá thuê",
    "Trạng thái",
    "Người đại diện",
    "Hết hạn hợp đồng",
  ];
  return (
    "\uFEFF" +
    [
      columns,
      ...rows.map((r) => [
        r.propertyName,
        r.buildingName,
        r.floorName,
        r.roomCode,
        r.name,
        r.area,
        r.maxOccupants,
        r.monthlyRent,
        statusLabel(r.status),
        r.representativeTenant?.fullName,
        r.currentContract?.endDate,
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")
  );
}
