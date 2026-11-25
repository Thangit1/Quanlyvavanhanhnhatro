export const accountStatusLabels: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  INACTIVE: "Ngừng hoạt động",
};
export const profileStatusLabels: Record<string, string> = {
  INCOMPLETE: "Chưa hoàn thiện",
  PENDING_VERIFICATION: "Chờ xác minh",
  VERIFIED: "Đã xác minh",
  NEED_MORE_INFORMATION: "Cần bổ sung",
  REJECTED: "Chưa được chấp nhận",
};
export const residenceStatusLabels: Record<string, string> = {
  ACTIVE: "Đang cư trú",
  MOVED_OUT: "Đã rời phòng",
  REPRESENTATIVE: "Người đại diện",
  OCCUPANT: "Người ở cùng",
  DEPENDENT: "Người phụ thuộc",
  NOT_DECLARED: "Chưa khai báo",
  PENDING: "Đang xử lý",
  REGISTERED: "Đã khai báo",
  DECLARED: "Đã khai báo",
  NEED_MORE_INFORMATION: "Cần bổ sung",
  REJECTED: "Chưa được chấp nhận",
  EXPIRED: "Đã hết hiệu lực",
  NOT_APPLICABLE: "Không áp dụng",
};
export const documentLabels: Record<string, string> = {
  IDENTITY_CARD: "Căn cước công dân",
  PASSPORT: "Hộ chiếu",
  BIRTH_CERTIFICATE: "Giấy khai sinh",
  TEMPORARY_RESIDENCE: "Giấy tạm trú",
  OTHER: "Giấy tờ khác",
  NOT_SUBMITTED: "Chưa gửi",
  PENDING: "Chờ xác minh",
  VERIFIED: "Đã xác minh",
  NEED_REPLACEMENT: "Cần thay thế",
  REJECTED: "Chưa được chấp nhận",
  EXPIRED: "Đã hết hạn",
};
export const activityLabels: Record<string, string> = {
  PROFILE_UPDATED: "Cập nhật hồ sơ",
  PROFILE_UPDATE_REQUESTED: "Gửi yêu cầu cập nhật",
  AVATAR_UPDATED: "Đổi ảnh đại diện",
  AVATAR_DELETED: "Xóa ảnh đại diện",
  DOCUMENT_UPLOADED: "Tải lên giấy tờ",
  PASSWORD_CHANGED: "Đổi mật khẩu",
  SESSION_REVOKED: "Thu hồi phiên",
  SESSIONS_REVOKED: "Thu hồi các phiên",
  PREFERENCES_UPDATED: "Cập nhật tùy chọn",
  SUPPORT_REQUESTED: "Gửi yêu cầu hỗ trợ",
};
export const label = (map: Record<string, string>, value?: string) =>
  value ? (map[value] ?? value) : "Chưa cập nhật";
export function accountDate(value?: string, withTime = false) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat(
    "vi-VN",
    withTime
      ? { dateStyle: "short", timeStyle: "short" }
      : { dateStyle: "short" },
  ).format(date);
}
export function phone(value?: string) {
  if (!value) return "Chưa cập nhật";
  const x = value.replace(/\D/g, "");
  return x.length === 10
    ? `${x.slice(0, 4)} ${x.slice(4, 7)} ${x.slice(7)}`
    : value;
}
