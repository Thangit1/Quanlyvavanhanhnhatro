import axios from "axios";

export function authErrorMessage(error: unknown): string {
  if (axios.isCancel(error))
    return "Yêu cầu đã bị hủy do phiên đăng nhập thay đổi. Vui lòng thử lại.";
  if (!axios.isAxiosError(error))
    return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
  if (!error.response)
    return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.";
  const body = error.response.data as
    { errorCode?: string; message?: string } | undefined;
  if (body?.errorCode === "PASSWORD_RECOVERY_UNAVAILABLE")
    return (
      body.message ||
      "Dịch vụ khôi phục mật khẩu hiện chưa sẵn sàng. Vui lòng thử lại sau."
    );
  if (body?.errorCode === "PASSWORD_RESET_TOKEN_INVALID")
    return "Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.";
  if (
    body?.errorCode === "PASSWORD_RECOVERY_RATE_LIMITED" ||
    error.response.status === 429
  )
    return "Có quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.";
  return (
    body?.message ||
    `Máy chủ trả về lỗi ${error.response.status}. Vui lòng thử lại sau.`
  );
}
