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
