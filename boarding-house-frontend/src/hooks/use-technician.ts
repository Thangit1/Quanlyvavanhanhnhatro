"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { technicianService as api } from "@/services/technician.service";
import type { TaskFilters } from "@/types/technician";
const poll = 30_000;
export const useTechnicianDashboard = () =>
  useQuery({
    queryKey: ["technician-dashboard"],
    queryFn: api.dashboard,
    refetchInterval: poll,
  });
export const useTechnicianTasks = (filters: TaskFilters) =>
  useQuery({
    queryKey: ["technician-tasks", filters],
    queryFn: () => api.tasks(filters),
    placeholderData: (p) => p,
    refetchInterval: poll,
  });
export const useEmergencyTasks = () =>
  useQuery({
    queryKey: ["technician-emergency"],
    queryFn: api.emergency,
    refetchInterval: 15_000,
  });
export const useTechnicianTask = (id: number) =>
  useQuery({
    queryKey: ["technician-task", id],
    queryFn: () => api.detail(id),
    enabled: id > 0,
    refetchInterval: poll,
  });
export function useTaskMutations(id: number) {
  const qc = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["technician-task", id] }),
      qc.invalidateQueries({ queryKey: ["technician-tasks"] }),
      qc.invalidateQueries({ queryKey: ["technician-dashboard"] }),
      qc.invalidateQueries({ queryKey: ["technician-emergency"] }),
    ]);
  };
  return {
    action: useMutation({
      mutationFn: ({ action, payload }: { action: string; payload: object }) =>
        api.action(id, action, payload),
      onSuccess: refresh,
    }),
    checklist: useMutation({
      mutationFn: (payload: object) => api.checklist(id, payload),
      onSuccess: refresh,
    }),
    upload: useMutation({
      mutationFn: ({
        version,
        type,
        file,
        caption,
      }: {
        version: number;
        type: string;
        file: File;
        caption?: string;
      }) => api.upload(id, version, type, file, caption),
      onSuccess: refresh,
    }),
  };
}
export const useTechnicianCalendar = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["technician-calendar", from, to],
    queryFn: () => api.calendar({ from, to }),
    refetchInterval: poll,
  });
export const usePreventivePlans = () =>
  useQuery({
    queryKey: ["technician-preventive"],
    queryFn: api.preventive,
    refetchInterval: poll,
  });
export const useTechnicianAssets = () =>
  useQuery({
    queryKey: ["technician-assets"],
    queryFn: api.assets,
    staleTime: 60_000,
  });
export const useTechnicianAsset = (id: number) =>
  useQuery({
    queryKey: ["technician-asset", id],
    queryFn: () => api.asset(id),
    enabled: id > 0,
  });
export const useTechnicianMaterials = () =>
  useQuery({
    queryKey: ["technician-materials"],
    queryFn: api.materials,
    refetchInterval: poll,
  });
export const useMaterialRequests = () =>
  useQuery({
    queryKey: ["technician-material-requests"],
    queryFn: api.materialRequests,
    refetchInterval: poll,
  });
export const useTechnicianNotifications = () =>
  useQuery({
    queryKey: ["technician-notifications"],
    queryFn: api.notifications,
    refetchInterval: poll,
  });
export const useTechnicianPerformance = () =>
  useQuery({
    queryKey: ["technician-performance"],
    queryFn: api.performance,
    refetchInterval: 60_000,
  });
export const useTechnicianAccount = () =>
  useQuery({ queryKey: ["technician-account"], queryFn: api.account });
export function useAccountMutations() {
  const qc = useQueryClient();
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["technician-account"] });
  return {
    profile: useMutation({ mutationFn: api.updateProfile, onSuccess: refresh }),
    preferences: useMutation({
      mutationFn: api.updatePreferences,
      onSuccess: refresh,
    }),
    password: useMutation({ mutationFn: api.changePassword }),
    revoke: useMutation({ mutationFn: api.revokeSession, onSuccess: refresh }),
  };
}
