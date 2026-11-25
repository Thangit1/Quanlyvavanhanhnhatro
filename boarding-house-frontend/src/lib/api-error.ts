import axios from "axios";

type ApiFailure = {
  message?: string;
  code?: string;
  errorCode?: string;
  errors?: Array<{ field?: string; message?: string }>;
};

export function apiErrorMessage(
  error: unknown,
  fallback = "Không thể xử lý yêu cầu. Vui lòng thử lại.",
) {
  if (!axios.isAxiosError<ApiFailure>(error)) return fallback;
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT")
    return "Yêu cầu quá thời gian chờ. Kiểm tra kết nối rồi thử lại.";
  if (!error.response)
    return "Không thể kết nối backend. Kiểm tra kết nối và trạng thái máy chủ.";
  const body = error.response?.data;
  const fieldMessages = (Array.isArray(body?.errors) ? body.errors : [])
    .map((item) =>
      typeof item?.message === "string" ? item.message.trim() : "",
    )
    .filter((message): message is string => Boolean(message));
  if (fieldMessages?.length) return fieldMessages.join(" · ");
  if (
    error.response.status === 404 &&
    (body?.errorCode ?? body?.code) === "RESOURCE_NOT_FOUND"
  )
    return "Backend đang chạy không hỗ trợ đường dẫn API này. Kiểm tra phiên bản backend và cấu hình kết nối.";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message) return message;
  return (
    (
      {
        401: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
        403: "Bạn không có quyền thực hiện thao tác này.",
        404: "Không tìm thấy tài nguyên được yêu cầu.",
        500: "Backend gặp lỗi xử lý. Vui lòng thử lại sau.",
      } as Record<number, string>
    )[error.response.status] || fallback
  );
}

export function normalizeAdminCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

export function contractCreationLoadError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    // Older servers bind "creation-options" to the numeric /{contractId} route.
    if (status === 400 || status === 404)
      return "Backend chưa hỗ trợ dữ liệu tạo hợp đồng trực tiếp. Cần cập nhật backend và hoàn tất migration trước khi sử dụng.";
    if (!error.response)
      return "Không thể kết nối backend. Vui lòng kiểm tra backend đã khởi động thành công.";
  }
  return apiErrorMessage(
    error,
    "Không thể tải dữ liệu tạo hợp đồng. Vui lòng thử lại.",
  );
}
