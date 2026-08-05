"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantMaintenanceService,
  type MaintenanceQuery,
} from "@/services/tenant-maintenance.service";
import type { CreateMaintenance } from "@/types/tenant-maintenance";
export const useMaintenanceSummary = (enabled: boolean) =>
  useQuery({
    queryKey: ["tenant-maintenance-summary"],
    queryFn: ({ signal }) => tenantMaintenanceService.summary(signal),
    enabled,
    retry: 1,
  });
export const useMaintenanceLocations = (enabled: boolean) =>
  useQuery({
    queryKey: ["tenant-maintenance-locations"],
    queryFn: ({ signal }) => tenantMaintenanceService.locations(signal),
    enabled,
    retry: 1,
  });
export const useTenantMaintenance = (enabled: boolean, q: MaintenanceQuery) =>
  useQuery({
    queryKey: ["tenant-maintenance", q],
    queryFn: ({ signal }) => tenantMaintenanceService.list(q, signal),
    enabled,
    retry: 1,
  });
export const useTenantMaintenanceDetail = (enabled: boolean, id: number) =>
  useQuery({
    queryKey: ["tenant-maintenance-detail", id],
    queryFn: ({ signal }) => tenantMaintenanceService.detail(id, signal),
    enabled: enabled && id > 0,
    retry: 1,
  });
export function useCreateMaintenance() {
  return useMutation({
    mutationFn: (x: {
      payload: CreateMaintenance;
      key: string;
      files: File[];
    }) =>
      tenantMaintenanceService
        .create(x.payload, x.key)
        .then(async (created) => {
          if (x.files.length)
            await tenantMaintenanceService.upload(
              created.id,
              x.files,
              "OVERVIEW",
            );
          return created;
        }),
  });
}
export function useMaintenanceActions(id: number) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tenant-maintenance-detail", id] });
    void qc.invalidateQueries({ queryKey: ["tenant-maintenance"] });
    void qc.invalidateQueries({ queryKey: ["tenant-maintenance-summary"] });
  };
  return {
    message: useMutation({
      mutationFn: (content: string) =>
        tenantMaintenanceService.message(id, content),
      onSuccess: refresh,
    }),
    additional: useMutation({
      mutationFn: (p: {
        content: string;
        contactPhone?: string;
        version: number;
      }) => tenantMaintenanceService.additional(id, p),
      onSuccess: refresh,
    }),
    schedule: useMutation({
      mutationFn: (p: {
        response: string;
        preferredStart?: string;
        note?: string;
        version: number;
      }) => tenantMaintenanceService.schedule(id, p),
      onSuccess: refresh,
    }),
    cancel: useMutation({
      mutationFn: (p: { reason: string; note?: string; version: number }) =>
        tenantMaintenanceService.cancel(id, p),
      onSuccess: refresh,
    }),
    feedback: useMutation({
      mutationFn: (p: {
        result: string;
        rating: number;
        staffAttitudeRating?: number;
        resolutionTimeRating?: number;
        comment?: string;
        assetWorking: boolean;
        version: number;
      }) => tenantMaintenanceService.feedback(id, p),
      onSuccess: refresh,
    }),
    reopen: useMutation({
      mutationFn: (p: {
        reason: string;
        recurringAt?: string;
        currentPriority: string;
        preferredServiceTime?: string;
        version: number;
      }) => tenantMaintenanceService.reopen(id, p),
      onSuccess: refresh,
    }),
    upload: useMutation({
      mutationFn: (files: File[]) => tenantMaintenanceService.upload(id, files),
      onSuccess: refresh,
    }),
  };
}
