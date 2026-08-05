"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminMaintenanceService as api } from "@/services/admin-maintenance.service";
import type {
  MaintenanceFilters,
  MaintenancePayload,
} from "@/types/admin-maintenance";
export function useMaintenanceData(filters: MaintenanceFilters) {
  return {
    summary: useQuery({
      queryKey: ["maintenance-summary", filters.propertyId],
      queryFn: () => api.summary(filters),
    }),
    list: useQuery({
      queryKey: ["admin-maintenance", filters],
      queryFn: () => api.list(filters),
      placeholderData: (p) => p,
    }),
    options: useQuery({
      queryKey: ["maintenance-options"],
      queryFn: api.options,
      staleTime: 60000,
    }),
  };
}
export function useMaintenanceDetail(id: number) {
  return useQuery({
    queryKey: ["maintenance-detail", id],
    queryFn: () => api.detail(id),
    enabled: id > 0,
  });
}
export function useMaintenanceMutations(id?: number) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-maintenance"] });
    await qc.invalidateQueries({ queryKey: ["maintenance-summary"] });
    await qc.invalidateQueries({ queryKey: ["maintenance-calendar"] });
    if (id)
      await qc.invalidateQueries({ queryKey: ["maintenance-detail", id] });
  };
  return {
    create: useMutation({
      mutationFn: (p: MaintenancePayload) => api.create(p),
      onSuccess: refresh,
    }),
    triage: useMutation({
      mutationFn: (p: object) => api.triage(id!, p),
      onSuccess: refresh,
    }),
    assign: useMutation({
      mutationFn: (p: object) => api.assign(id!, p),
      onSuccess: refresh,
    }),
    schedule: useMutation({
      mutationFn: (p: object) => api.schedule(id!, p),
      onSuccess: refresh,
    }),
    start: useMutation({
      mutationFn: (v: number) => api.start(id!, v),
      onSuccess: refresh,
    }),
    workLog: useMutation({
      mutationFn: (p: object) => api.workLog(id!, p),
      onSuccess: refresh,
    }),
    material: useMutation({
      mutationFn: (p: object) => api.material(id!, p),
      onSuccess: refresh,
    }),
    cost: useMutation({
      mutationFn: (p: object) => api.cost(id!, p),
      onSuccess: refresh,
    }),
    complete: useMutation({
      mutationFn: (p: object) => api.complete(id!, p),
      onSuccess: refresh,
    }),
    inspect: useMutation({
      mutationFn: (p: object) => api.inspect(id!, p),
      onSuccess: refresh,
    }),
    reopen: useMutation({
      mutationFn: (p: object) => api.reopen(id!, p),
      onSuccess: refresh,
    }),
    cancel: useMutation({
      mutationFn: (p: object) => api.cancel(id!, p),
      onSuccess: refresh,
    }),
  };
}
