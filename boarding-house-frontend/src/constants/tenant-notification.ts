import {
  Bell,
  CircleAlert,
  CircleCheck,
  CreditCard,
  FileText,
  House,
  Megaphone,
  ReceiptText,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
export const notificationCategories = {
  INVOICE: "Hóa đơn",
  PAYMENT: "Thanh toán",
  DEBT_REMINDER: "Nhắc công nợ",
  CONTRACT: "Hợp đồng",
  MAINTENANCE: "Sửa chữa",
  CO_OCCUPANT: "Người ở cùng",
  UTILITY: "Điện nước",
  ROOM: "Phòng trọ",
  ANNOUNCEMENT: "Thông báo chung",
  SECURITY: "Bảo mật",
  EMERGENCY: "Khẩn cấp",
  SYSTEM: "Hệ thống",
  OTHER: "Khác",
} as const;
export const notificationSeverities = {
  INFO: "Thông tin",
  SUCCESS: "Thành công",
  WARNING: "Cảnh báo",
  URGENT: "Khẩn cấp",
} as const;
export const categoryIcon = (category: string) =>
  ({
    INVOICE: ReceiptText,
    PAYMENT: CreditCard,
    DEBT_REMINDER: CircleAlert,
    CONTRACT: FileText,
    MAINTENANCE: Wrench,
    CO_OCCUPANT: Users,
    UTILITY: Zap,
    ROOM: House,
    ANNOUNCEMENT: Megaphone,
    SECURITY: ShieldCheck,
    EMERGENCY: TriangleAlert,
    SYSTEM: Settings,
    OTHER: Bell,
  })[category] ?? Bell;
export const severityIcon = (severity: string) =>
  severity === "SUCCESS"
    ? CircleCheck
    : severity === "URGENT"
      ? TriangleAlert
      : severity === "WARNING"
        ? CircleAlert
        : Bell;
export function safeNotificationRoute(
  actionType?: string,
  reference?: { type: string; id: number },
) {
  if (!actionType) return null;
  const id = reference?.id;
  switch (actionType) {
    case "VIEW_INVOICE":
      return id ? `/tenant/invoices/${id}` : null;
    case "PAY_INVOICE":
      return id ? `/tenant/invoices/${id}/payment` : null;
    case "VIEW_CONTRACT":
      return id ? `/tenant/contracts/${id}` : null;
    case "VIEW_MAINTENANCE":
    case "CONFIRM_MAINTENANCE_SCHEDULE":
    case "RATE_MAINTENANCE":
      return id ? `/tenant/maintenance/${id}` : null;
    case "VIEW_CO_OCCUPANT_REQUEST":
    case "ADD_CO_OCCUPANT_INFORMATION":
      return id ? `/tenant/co-occupants/requests/${id}` : null;
    case "VIEW_UTILITIES":
      return "/tenant/utilities";
    case "VIEW_ROOM":
      return "/tenant/room";
    case "VIEW_NOTIFICATION":
      return id ? `/tenant/notifications/${id}` : null;
    default:
      return null;
  }
}
export function relativeNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ thời gian";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 172800) return "Hôm qua";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
