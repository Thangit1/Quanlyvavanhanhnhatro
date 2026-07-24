export function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value)) + "đ";
}
export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", withTime
    ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
}

const labels: Record<string, string> = {
  VACANT: "Phòng trống", RESERVED: "Đang giữ chỗ", OCCUPIED: "Đang thuê",
  MAINTENANCE: "Đang sửa chữa", INACTIVE: "Ngừng sử dụng", UNPAID: "Chưa thanh toán",
  PARTIALLY_PAID: "Thanh toán một phần", PAID: "Đã thanh toán", OVERDUE: "Quá hạn",
  CANCELLED: "Đã hủy", ACTIVE: "Đang hiệu lực", EXPIRED: "Đã hết hạn",
  PENDING_CONFIRMATION: "Chờ xác nhận", EXPIRING: "Sắp hết hạn",
  TERMINATION_REQUESTED: "Đang yêu cầu chấm dứt", TERMINATED: "Đã chấm dứt",
  NEW: "Mới tiếp nhận", ASSIGNED: "Đã phân công", IN_PROGRESS: "Đang xử lý",
  WAITING_PARTS: "Chờ linh kiện", COMPLETED: "Đã hoàn thành",
  URGENT: "Khẩn cấp", HIGH: "Cao", NORMAL: "Bình thường", LOW: "Thấp",
  IMPORTANT: "Quan trọng", ATTENTION: "Cần chú ý", INFO: "Thông tin",
  METER: "Theo công tơ", PER_PERSON: "Theo người", FIXED: "Cố định",
  MONTHLY: "Hàng tháng", NOT_DECLARED: "Chưa khai báo", DECLARED: "Đã khai báo",
  APPROVED: "Đã phê duyệt", PENDING: "Đang chờ xử lý", REPRESENTATIVE: "Người đại diện thuê",
};
export function statusLabel(value: string | null | undefined) { return value ? labels[value] ?? value : "—"; }
