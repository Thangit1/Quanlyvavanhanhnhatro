import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  NotificationDetail,
  NotificationPage,
  NotificationPreferences,
  NotificationQuery,
  NotificationSummary,
  TenantNotification,
} from "@/types/tenant-notification";
const clean = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );
export const tenantNotificationService = {
  summary: async (signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<NotificationSummary>>(
        "/tenant/notifications/summary",
        { signal },
      )
    ).data.data,
  unreadCount: async (signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<{ unreadCount: number }>>(
        "/tenant/notifications/unread-count",
        { signal },
      )
    ).data.data,
  recent: async (limit = 8, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<TenantNotification[]>>(
        "/tenant/notifications/recent",
        { params: { limit }, signal },
      )
    ).data.data,
  list: async (query: NotificationQuery, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<NotificationPage<TenantNotification>>>(
        "/tenant/notifications",
        { params: clean(query), signal },
      )
    ).data.data,
  detail: async (id: number, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<NotificationDetail>>(
        `/tenant/notifications/${id}`,
        { signal },
      )
    ).data.data,
  read: (id: number) => apiClient.patch(`/tenant/notifications/${id}/read`),
  unread: (id: number) => apiClient.patch(`/tenant/notifications/${id}/unread`),
  markAllRead: () => apiClient.post("/tenant/notifications/mark-all-read"),
  archive: (id: number) =>
    apiClient.patch(`/tenant/notifications/${id}/archive`),
  restore: (id: number) =>
    apiClient.patch(`/tenant/notifications/${id}/restore`),
  acknowledge: (id: number) =>
    apiClient.post(`/tenant/notifications/${id}/acknowledge`),
  bulk: (notificationIds: number[], action: string) =>
    apiClient.post("/tenant/notifications/bulk-actions", {
      notificationIds,
      action,
    }),
  preferences: async (signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<NotificationPreferences>>(
        "/tenant/notification-preferences",
        { signal },
      )
    ).data.data,
  updatePreferences: async (value: {
    inApp: boolean;
    email: boolean;
    categories: Record<string, boolean>;
    digestMode: string;
    quietHours: { enabled: boolean; start?: string; end?: string };
    version: number;
  }) =>
    (
      await apiClient.put<ApiEnvelope<NotificationPreferences>>(
        "/tenant/notification-preferences",
        value,
      )
    ).data.data,
};
