import { apiClient, ApiEnvelope } from "@/services/api-client";
import type {
  AuthUser,
  LoginData,
  LoginPayload,
  RegisterData,
  RegisterPayload,
} from "@/types/auth";
export const authService = {
  login: (payload: LoginPayload) =>
    apiClient
      .post<ApiEnvelope<LoginData>>("/auth/login", payload)
      .then((r) => r.data),
  register: (payload: RegisterPayload) =>
    apiClient
      .post<ApiEnvelope<RegisterData>>("/auth/register", payload)
      .then((r) => r.data),
  me: () =>
    apiClient.get<ApiEnvelope<AuthUser>>("/auth/me").then((r) => r.data.data),
  logout: (token?: string | null) =>
    apiClient.post<ApiEnvelope<null>>(
      "/auth/logout",
      undefined,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    ),
  forgotPassword: (email: string) =>
    apiClient
      .post<ApiEnvelope<null>>("/auth/forgot-password", { email })
      .then((r) => r.data),
  resetPassword: (
    token: string,
    newPassword: string,
    confirmPassword: string,
  ) =>
    apiClient
      .post<ApiEnvelope<null>>("/auth/reset-password", {
        token,
        newPassword,
        confirmPassword,
      })
      .then((r) => r.data),
};
