"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantAccountService as service } from "@/services/tenant-account.service";
import type {
  AccountPreferences,
  UpdateProfilePayload,
} from "@/types/tenant-account";
export const useAccountOverview = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-account-overview"],
    queryFn: ({ signal }) => service.overview(signal),
    enabled,
    retry: 1,
  });
export const useTenantProfile = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-account-profile"],
    queryFn: ({ signal }) => service.profile(signal),
    enabled,
    retry: 1,
  });
export const useProfileRequests = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-profile-requests"],
    queryFn: ({ signal }) => service.profileUpdateRequests(signal),
    enabled,
    retry: 1,
  });
export const useTenantDocuments = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-account-documents"],
    queryFn: ({ signal }) => service.documents(signal),
    enabled,
    retry: 1,
  });
export const useTenantSessions = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-account-sessions"],
    queryFn: ({ signal }) => service.sessions(signal),
    enabled,
    retry: 1,
  });
export const useAccountPreferences = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-account-preferences"],
    queryFn: ({ signal }) => service.preferences(signal),
    enabled,
    retry: 1,
  });
export const useAccountActivity = (enabled: boolean, page: number) =>
  useQuery({
    queryKey: ["tenant-account-activity", page],
    queryFn: ({ signal }) => service.activity(page, 20, signal),
    enabled,
    retry: 1,
  });
export const useAccountSupport = (enabled = true) =>
  useQuery({
    queryKey: ["tenant-account-support"],
    queryFn: ({ signal }) => service.supportInfo(signal),
    enabled,
    retry: 1,
  });
export function useAccountActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tenant-account-overview"] });
    void qc.invalidateQueries({ queryKey: ["tenant-account-profile"] });
    void qc.invalidateQueries({ queryKey: ["tenant-account-activity"] });
  };
  return {
    updateProfile: useMutation({
      mutationFn: (x: UpdateProfilePayload) => service.updateProfile(x),
      onSuccess: refresh,
    }),
    uploadAvatar: useMutation({
      mutationFn: (x: { file: File; onProgress?: (n: number) => void }) =>
        service.uploadAvatar(x.file, x.onProgress),
      onSuccess: refresh,
    }),
    deleteAvatar: useMutation({
      mutationFn: () => service.deleteAvatar(),
      onSuccess: refresh,
    }),
    requestUpdate: useMutation({
      mutationFn: service.createProfileUpdateRequest,
      onSuccess: () => {
        refresh();
        void qc.invalidateQueries({ queryKey: ["tenant-profile-requests"] });
      },
    }),
    uploadDocument: useMutation({
      mutationFn: service.uploadDocument,
      onSuccess: () => {
        refresh();
        void qc.invalidateQueries({ queryKey: ["tenant-account-documents"] });
      },
    }),
    changePassword: useMutation({
      mutationFn: service.changePassword,
      onSuccess: refresh,
    }),
    revokeSession: useMutation({
      mutationFn: service.revokeSession,
      onSuccess: () =>
        void qc.invalidateQueries({ queryKey: ["tenant-account-sessions"] }),
    }),
    revokeAll: useMutation({
      mutationFn: service.revokeAllSessions,
      onSuccess: () =>
        void qc.invalidateQueries({ queryKey: ["tenant-account-sessions"] }),
    }),
    updatePreferences: useMutation({
      mutationFn: (x: AccountPreferences) => service.updatePreferences(x),
      onSuccess: (data) =>
        qc.setQueryData(["tenant-account-preferences"], data),
    }),
    support: useMutation({
      mutationFn: service.createSupportRequest,
      onSuccess: refresh,
    }),
  };
}
