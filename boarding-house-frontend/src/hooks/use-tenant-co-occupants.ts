"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantCoOccupantService as service } from "@/services/tenant-co-occupant.service";
import type { CreateCoOccupant } from "@/types/tenant-co-occupant";
export const useCoOccupantOverview = (enabled = true) =>
  useQuery({
    queryKey: ["co-occupant-overview"],
    queryFn: ({ signal }) => service.overview(signal),
    enabled,
    retry: 1,
  });
export const useCoOccupants = (enabled = true, page = 0) =>
  useQuery({
    queryKey: ["co-occupants", page],
    queryFn: ({ signal }) => service.occupants(page, 10, signal),
    enabled,
    retry: 1,
  });
export const useCoOccupant = (enabled: boolean, id: number) =>
  useQuery({
    queryKey: ["co-occupant", id],
    queryFn: ({ signal }) => service.occupant(id, signal),
    enabled: enabled && id > 0,
    retry: 1,
  });
export const useCoOccupantRequests = (
  enabled = true,
  status?: string,
  page = 0,
) =>
  useQuery({
    queryKey: ["co-occupant-requests", status, page],
    queryFn: ({ signal }) => service.requests(status, page, 10, signal),
    enabled,
    retry: 1,
  });
export const useCoOccupantRequest = (enabled: boolean, id: number) =>
  useQuery({
    queryKey: ["co-occupant-request", id],
    queryFn: ({ signal }) => service.request(id, signal),
    enabled: enabled && id > 0,
    retry: 1,
  });
export const useCoOccupantHistory = (enabled = true, page = 0) =>
  useQuery({
    queryKey: ["co-occupant-history", page],
    queryFn: ({ signal }) => service.history(page, 10, signal),
    enabled,
    retry: 1,
  });
export const useCreateCoOccupant = () =>
  useMutation({
    mutationFn: async (x: {
      payload: CreateCoOccupant;
      key: string;
      files: { type: string; file: File }[];
    }) => {
      const created = await service.create(x.payload, x.key);
      for (const item of x.files)
        await service.upload(created.id, item.type, [item.file]);
      return created;
    },
  });
export function useCoOccupantActions(id: number) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["co-occupant-request", id] });
    void qc.invalidateQueries({ queryKey: ["co-occupant-requests"] });
    void qc.invalidateQueries({ queryKey: ["co-occupant-overview"] });
  };
  return {
    additional: useMutation({
      mutationFn: (p: { content: string; version: number }) =>
        service.additional(id, p),
      onSuccess: refresh,
    }),
    cancel: useMutation({
      mutationFn: (p: { reason: string; note?: string; version: number }) =>
        service.cancel(id, p),
      onSuccess: refresh,
    }),
    upload: useMutation({
      mutationFn: (p: { type: string; files: File[] }) =>
        service.upload(id, p.type, p.files),
      onSuccess: refresh,
    }),
  };
}
