import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  AccountActivity,
  AccountPage,
  AccountPreferences,
  ProfileUpdateRequest,
  SupportInfo,
  TenantAccountOverview,
  TenantDocument,
  TenantProfile,
  TenantSession,
  UpdateProfilePayload,
} from "@/types/tenant-account";
const data = <T>(r: { data: ApiEnvelope<T> }) => r.data.data;
export const tenantAccountService = {
  overview: async (signal?: AbortSignal) =>
    data(
      await apiClient.get<ApiEnvelope<TenantAccountOverview>>(
        "/tenant/account/overview",
        { signal },
      ),
    ),
  profile: async (signal?: AbortSignal) =>
    data(
      await apiClient.get<ApiEnvelope<TenantProfile>>(
        "/tenant/account/profile",
        { signal },
      ),
    ),
  updateProfile: async (payload: UpdateProfilePayload) =>
    data(
      await apiClient.put<
        ApiEnvelope<{ profile: TenantProfile; pendingVerification: boolean }>
      >("/tenant/account/profile", payload),
    ),
  uploadAvatar: async (file: File, onProgress?: (percent: number) => void) =>
    data(
      await apiClient.post<ApiEnvelope<string>>(
        "/tenant/account/avatar",
        form({ file }),
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) =>
            onProgress?.(e.total ? Math.round((e.loaded * 100) / e.total) : 0),
        },
      ),
    ),
  avatar: async (signal?: AbortSignal) =>
    URL.createObjectURL(
      (
        await apiClient.get("/tenant/account/avatar/content", {
          responseType: "blob",
          signal,
        })
      ).data,
    ),
  deleteAvatar: () => apiClient.delete("/tenant/account/avatar"),
  createProfileUpdateRequest: (payload: {
    fieldChanges: Record<string, { oldValue?: string; newValue: string }>;
    reason: string;
    note?: string;
  }) => apiClient.post("/tenant/account/profile-update-requests", payload),
  profileUpdateRequests: async (signal?: AbortSignal) =>
    data(
      await apiClient.get<ApiEnvelope<ProfileUpdateRequest[]>>(
        "/tenant/account/profile-update-requests",
        { signal },
      ),
    ),
  documents: async (signal?: AbortSignal) =>
    data(
      await apiClient.get<ApiEnvelope<TenantDocument[]>>(
        "/tenant/account/documents",
        { signal },
      ),
    ),
  uploadDocument: (payload: Record<string, string | File>) =>
    apiClient.post("/tenant/account/documents", form(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  replaceDocument: (id: number, payload: Record<string, string | File>) =>
    apiClient.post(
      `/tenant/account/documents/${id}/replacement`,
      form(payload),
      { headers: { "Content-Type": "multipart/form-data" } },
    ),
  downloadDocument: async (id: number) => {
    const response = await apiClient.get(
      `/tenant/account/documents/${id}/download`,
      { responseType: "blob" },
    );
    return URL.createObjectURL(response.data);
  },
  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    logoutOtherSessions: boolean;
  }) => apiClient.post("/tenant/account/change-password", payload),
  sessions: async (signal?: AbortSignal) =>
    data(
      await apiClient.get<ApiEnvelope<TenantSession[]>>(
        "/tenant/account/sessions",
        { signal },
      ),
    ),
  revokeSession: (id: number) =>
    apiClient.delete(`/tenant/account/sessions/${id}`),
  revokeAllSessions: (keepCurrentSession: boolean) =>
    apiClient.post("/tenant/account/sessions/revoke-all", {
      keepCurrentSession,
    }),
  preferences: async (signal?: AbortSignal) =>
    data(
      await apiClient.get<ApiEnvelope<AccountPreferences>>(
        "/tenant/account/preferences",
        { signal },
      ),
    ),
  updatePreferences: async (payload: AccountPreferences) =>
    data(
      await apiClient.put<ApiEnvelope<AccountPreferences>>(
        "/tenant/account/preferences",
        payload,
      ),
    ),
  activity: async (page = 0, size = 20, signal?: AbortSignal) =>
    data(
      await apiClient.get<ApiEnvelope<AccountPage<AccountActivity>>>(
        "/tenant/account/activity",
        { params: { page, size }, signal },
      ),
    ),
  supportInfo: async (signal?: AbortSignal) =>
    data(
      await apiClient.get<ApiEnvelope<SupportInfo>>("/tenant/account/support", {
        signal,
      }),
    ),
  createSupportRequest: (payload: Record<string, string | File>) =>
    apiClient.post("/tenant/account/support", form(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};
function form(value: Record<string, string | File>) {
  const body = new FormData();
  Object.entries(value).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") body.append(k, v);
  });
  return body;
}
