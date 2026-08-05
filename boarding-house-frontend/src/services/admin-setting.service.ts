import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  AiSettings,
  AuditPage,
  BillingSettings,
  ConnectionTest,
  GeneralSettings,
  GroupSettings,
  PropertySettings,
  SettingOverview,
} from "@/types/admin-setting";

export const adminSettingService = {
  overview: (signal?: AbortSignal) =>
    apiClient
      .get<ApiEnvelope<SettingOverview>>("/admin/settings/overview", { signal })
      .then(({ data }) => data.data),
  general: (signal?: AbortSignal) =>
    apiClient
      .get<ApiEnvelope<GeneralSettings>>("/admin/settings/general", { signal })
      .then(({ data }) => data.data),
  updateGeneral: (payload: Record<string, unknown>) =>
    apiClient
      .put<ApiEnvelope<GeneralSettings>>("/admin/settings/general", payload)
      .then(({ data }) => data.data),
  group: (group: string, signal?: AbortSignal) =>
    apiClient
      .get<ApiEnvelope<GroupSettings>>(`/admin/settings/${group}`, { signal })
      .then(({ data }) => data.data),
  updateGroup: (group: string, values: Record<string, unknown>) =>
    apiClient
      .put<ApiEnvelope<GroupSettings>>(`/admin/settings/${group}`, { values })
      .then(({ data }) => data.data),
  property: (propertyId: number, signal?: AbortSignal) =>
    apiClient
      .get<ApiEnvelope<PropertySettings>>(
        `/admin/settings/properties/${propertyId}`,
        { signal },
      )
      .then(({ data }) => data.data),
  updateProperty: (propertyId: number, payload: Record<string, unknown>) =>
    apiClient
      .put<ApiEnvelope<PropertySettings>>(
        `/admin/settings/properties/${propertyId}`,
        payload,
      )
      .then(({ data }) => data.data),
  billing: (signal?: AbortSignal) =>
    apiClient
      .get<ApiEnvelope<BillingSettings>>("/admin/settings/billing", { signal })
      .then(({ data }) => data.data),
  updateBilling: (payload: Record<string, unknown>) =>
    apiClient
      .put<ApiEnvelope<BillingSettings>>("/admin/settings/billing", payload)
      .then(({ data }) => data.data),
  ai: (signal?: AbortSignal) =>
    apiClient
      .get<ApiEnvelope<AiSettings>>("/admin/settings/ai", { signal })
      .then(({ data }) => data.data),
  updateAi: (payload: Record<string, unknown>) =>
    apiClient
      .put<ApiEnvelope<AiSettings>>("/admin/settings/ai", payload)
      .then(({ data }) => data.data),
  testAi: () =>
    apiClient
      .post<ApiEnvelope<ConnectionTest>>("/admin/settings/ai/test-connection")
      .then(({ data }) => data.data),
  auditLogs: (
    params: { group?: string; page?: number; size?: number },
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<ApiEnvelope<AuditPage>>("/admin/settings/audit-logs", {
        params,
        signal,
      })
      .then(({ data }) => data.data),
};
