"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantNotificationService as service } from "@/services/tenant-notification.service";
import type {
  NotificationPreferences,
  NotificationQuery,
} from "@/types/tenant-notification";
export const useUnreadNotifications = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-notification-unread"],
    queryFn: ({ signal }) => service.unreadCount(signal),
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
export const useRecentNotifications = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-notification-recent"],
    queryFn: ({ signal }) => service.recent(8, signal),
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
export const useNotificationSummary = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-notification-summary"],
    queryFn: ({ signal }) => service.summary(signal),
    enabled,
    retry: 1,
  });
export const useTenantNotifications = (
  enabled: boolean,
  query: NotificationQuery,
) =>
  useQuery({
    queryKey: ["tenant-notifications", query],
    queryFn: ({ signal }) => service.list(query, signal),
    enabled,
    retry: 1,
  });
export function useTenantNotification(enabled: boolean, id: number) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["tenant-notification", id],
    queryFn: async ({ signal }) => {
      const data = await service.detail(id, signal);
      void qc.invalidateQueries({ queryKey: ["tenant-notification-unread"] });
      void qc.invalidateQueries({ queryKey: ["tenant-notification-recent"] });
      void qc.invalidateQueries({ queryKey: ["tenant-notification-summary"] });
      return data;
    },
    enabled: enabled && id > 0,
    retry: 1,
  });
}
export const useNotificationPreferences = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-notification-preferences"],
    queryFn: ({ signal }) => service.preferences(signal),
    enabled,
    retry: 1,
  });
export function useNotificationActions(id?: number) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tenant-notification-unread"] });
    void qc.invalidateQueries({ queryKey: ["tenant-notification-recent"] });
    void qc.invalidateQueries({ queryKey: ["tenant-notifications"] });
    void qc.invalidateQueries({ queryKey: ["tenant-notification-summary"] });
    if (id)
      void qc.invalidateQueries({ queryKey: ["tenant-notification", id] });
  };
  return {
    read: useMutation({
      mutationFn: (target: number) => service.read(target),
      onSuccess: refresh,
    }),
    unread: useMutation({
      mutationFn: (target: number) => service.unread(target),
      onSuccess: refresh,
    }),
    archive: useMutation({
      mutationFn: (target: number) => service.archive(target),
      onSuccess: refresh,
    }),
    restore: useMutation({
      mutationFn: (target: number) => service.restore(target),
      onSuccess: refresh,
    }),
    acknowledge: useMutation({
      mutationFn: (target: number) => service.acknowledge(target),
      onSuccess: refresh,
    }),
    allRead: useMutation({
      mutationFn: () => service.markAllRead(),
      onSuccess: refresh,
    }),
    bulk: useMutation({
      mutationFn: (x: { ids: number[]; action: string }) =>
        service.bulk(x.ids, x.action),
      onSuccess: refresh,
    }),
  };
}
export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (x: NotificationPreferences) =>
      service.updatePreferences({
        inApp: x.inApp,
        email: x.email,
        categories: x.categories,
        digestMode: x.digestMode,
        quietHours: {
          enabled: x.quietHoursEnabled,
          start: x.quietHoursStart,
          end: x.quietHoursEnd,
        },
        version: x.version,
      }),
    onSuccess: (data) =>
      qc.setQueryData(["tenant-notification-preferences"], data),
  });
}
