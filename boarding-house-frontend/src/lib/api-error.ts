import axios from "axios";

type ApiFailure = {
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
};

export function apiErrorMessage(
  error: unknown,
  fallback = "Không thể xử lý yêu cầu. Vui lòng thử lại.",
) {
  if (!axios.isAxiosError<ApiFailure>(error)) return fallback;
  const body = error.response?.data;
  const fieldMessages = body?.errors
    ?.map((item) => item.message?.trim())
    .filter((message): message is string => Boolean(message));
  if (fieldMessages?.length) return fieldMessages.join(" · ");
  return body?.message?.trim() || fallback;
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
