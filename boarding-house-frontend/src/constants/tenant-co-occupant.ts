export const residenceRoleLabels: Record<string, string> = {
  REPRESENTATIVE: "Người đại diện thuê",
  CO_OCCUPANT: "Người ở cùng",
  DEPENDENT: "Người phụ thuộc",
  TEMPORARY_GUEST: "Khách lưu trú",
};
export const residenceStatusLabels: Record<string, string> = {
  PENDING_APPROVAL: "Chờ phê duyệt",
  NEED_MORE_INFORMATION: "Cần bổ sung hồ sơ",
  APPROVED: "Đã phê duyệt",
  ACTIVE: "Đang cư trú",
  MOVE_OUT_REQUESTED: "Đã yêu cầu chuyển đi",
  MOVING_OUT: "Đang làm thủ tục chuyển đi",
  MOVED_OUT: "Đã chuyển đi",
  REJECTED: "Bị từ chối",
  CANCELLED: "Đã hủy",
};
export const temporaryResidenceLabels: Record<string, string> = {
  NOT_DECLARED: "Chưa khai báo",
  PENDING: "Đang xử lý",
  DECLARED: "Đã khai báo",
  NEED_MORE_INFORMATION: "Cần bổ sung",
  REJECTED: "Không được chấp nhận",
  EXPIRED: "Đã hết hiệu lực",
  NOT_REQUIRED: "Không áp dụng",
};
export const requestStatusLabels: Record<string, string> = {
  DRAFT: "Chưa gửi",
  SUBMITTED: "Đã gửi",
  UNDER_REVIEW: "Đang kiểm tra",
  NEED_MORE_INFORMATION: "Cần bổ sung",
  APPROVED: "Đã phê duyệt",
  REJECTED: "Bị từ chối",
  CANCELLED: "Đã hủy",
  COMPLETED: "Đã hoàn tất",
};
export const requestTypeLabels: Record<string, string> = {
  ADD_CO_OCCUPANT: "Đăng ký người ở cùng",
  MOVE_OUT: "Yêu cầu chuyển đi",
};
export const label = (map: Record<string, string>, value?: string) =>
  value ? (map[value] ?? "Chưa xác định") : "Chưa cập nhật";
