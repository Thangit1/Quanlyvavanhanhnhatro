import {
  AirVent,
  Armchair,
  Building,
  Flame,
  HousePlug,
  LockKeyhole,
  ShieldAlert,
  ShowerHead,
  Sparkles,
  Wifi,
  Wrench,
} from "lucide-react";
export const categories = [
  ["ELECTRICAL", "Điện", "Mất điện, ổ cắm, đèn hoặc có mùi khét", HousePlug],
  ["WATER", "Nước", "Mất nước, rò rỉ, tắc nghẽn", ShowerHead],
  ["INTERNET", "Internet", "Mất kết nối hoặc mạng chậm", Wifi],
  [
    "AIR_CONDITIONER",
    "Điều hòa",
    "Không lạnh, chảy nước hoặc tiếng ồn",
    AirVent,
  ],
  ["WATER_HEATER", "Bình nóng lạnh", "Không lên nguồn hoặc không nóng", Flame],
  ["DOOR_LOCK", "Cửa và khóa", "Khóa, cửa hoặc bản lề gặp vấn đề", LockKeyhole],
  ["FURNITURE", "Nội thất", "Giường, tủ, bàn ghế", Armchair],
  ["APPLIANCE", "Thiết bị điện", "Quạt, bếp hoặc thiết bị khác", Wrench],
  ["STRUCTURE", "Kết cấu", "Tường, trần, nền hoặc mái", Building],
  ["LEAKAGE", "Thấm dột", "Nước thấm từ tường, trần hoặc mái", ShowerHead],
  ["SANITATION", "Vệ sinh", "Khu vệ sinh hoặc mùi bất thường", Sparkles],
  ["SECURITY", "An ninh", "Nguy cơ mất an toàn", ShieldAlert],
  [
    "FIRE_SAFETY",
    "Phòng cháy chữa cháy",
    "Khói, cháy hoặc thiết bị PCCC",
    Flame,
  ],
  ["COMMON_AREA", "Khu vực chung", "Hành lang, cầu thang, bãi xe", Building],
  ["ELEVATOR", "Thang máy", "Sự cố vận hành thang máy", Building],
  ["OTHER", "Khác", "Vấn đề chưa thuộc nhóm trên", Wrench],
] as const;
export const statusLabels: Record<string, string> = {
  SUBMITTED: "Đã gửi",
  RECEIVED: "Đã tiếp nhận",
  NEW: "Đã gửi",
  TRIAGED: "Đã tiếp nhận",
  NEED_MORE_INFORMATION: "Cần bổ sung thông tin",
  ASSIGNED: "Đã phân công",
  SCHEDULED: "Đã lên lịch",
  IN_PROGRESS: "Đang xử lý",
  WAITING_TENANT: "Chờ bạn phản hồi",
  WAITING_PARTS: "Chờ vật tư",
  COMPLETED: "Nhân viên đã hoàn thành",
  INSPECTION_PENDING: "Chờ bạn xác nhận",
  RESOLVED: "Đã xử lý",
  REOPENED: "Đã mở lại",
  REJECTED: "Không tiếp nhận",
  CANCELLED: "Đã hủy",
};
export const priorityLabels: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};
export const areaLabels: Record<string, string> = {
  ROOM: "Phòng đang ở",
  BATHROOM: "Nhà vệ sinh",
  BALCONY: "Ban công",
  KITCHEN: "Khu bếp",
  HALLWAY: "Hành lang",
  STAIRS: "Cầu thang",
  PARKING: "Khu để xe",
  GATE: "Cổng",
  COMMON_OTHER: "Khu vực chung khác",
};
export const issueQuestions: Record<string, string[]> = {
  ELECTRICAL: [
    "Mất điện toàn phòng hay chỉ một thiết bị?",
    "Aptomat có bị ngắt không?",
    "Có tia lửa, khói hoặc mùi khét không?",
  ],
  WATER: [
    "Mất nước hay rò rỉ?",
    "Vị trí rò nước ở đâu?",
    "Nước chảy mạnh hay nhỏ giọt?",
  ],
  AIR_CONDITIONER: [
    "Thiết bị có lên nguồn không?",
    "Có lạnh, chảy nước hoặc phát tiếng ồn không?",
  ],
  INTERNET: [
    "Tất cả thiết bị đều mất mạng hay chỉ một thiết bị?",
    "Đèn tín hiệu modem đang hiển thị thế nào?",
  ],
};
export function categoryInfo(code: string) {
  return categories.find((x) => x[0] === code);
}
