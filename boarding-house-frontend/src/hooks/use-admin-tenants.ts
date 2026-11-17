"use client";
import { useScopedQuery } from "./use-scoped-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminTenantService } from "@/services/admin-tenant.service";
import type { SaveTenantPayload, TenantFilters } from "@/types/admin-tenant";

export function useAdminTenants(filters: TenantFilters, enabled = true) {
  return useScopedQuery({
    queryKey: ["admin-tenants", filters],
    queryFn: ({ signal }) => adminTenantService.list(filters, signal),
    enabled,
    staleTime: 20_000,
  });
}
export function useAdminTenant(id: number, enabled = true) {
  return useScopedQuery({
    queryKey: ["admin-tenant", id],
    queryFn: ({ signal }) => adminTenantService.detail(id, signal),
    enabled,
  });
}
export function useTenantMutations(id?: number) {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["admin-tenants"] });
    if (id) await client.invalidateQueries({ queryKey: ["admin-tenant"] });
  };
  return {
    create: useMutation({
      mutationFn: (payload: SaveTenantPayload) =>
        adminTenantService.create(payload),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (payload: SaveTenantPayload) =>
        adminTenantService.update(id!, payload),
      onSuccess: refresh,
    }),
    transfer: useMutation({
      mutationFn: (payload: {
        toRoomId: number;
        transferDate: string;
        reason?: string;
      }) => adminTenantService.transfer(id!, payload),
      onSuccess: refresh,
    }),
    moveOut: useMutation({
      mutationFn: (payload: {
        moveOutDate: string;
        reason?: string;
        closeContract: boolean;
      }) => adminTenantService.moveOut(id!, payload),
      onSuccess: refresh,
    }),
    temporary: useMutation({
      mutationFn: (payload: {
        propertyId: number;
        registrationCode?: string;
        registeredAt?: string;
        expiresAt?: string;
        status: string;
        note?: string;
      }) => adminTenantService.saveTemporary(id!, payload),
      onSuccess: refresh,
    }),
    account: useMutation({
      mutationFn: (payload: { email: string; temporaryPassword: string }) =>
        adminTenantService.createAccount(id!, payload),
      onSuccess: refresh,
    }),
    accountStatus: useMutation({
      mutationFn: (status: "ACTIVE" | "LOCKED" | "INACTIVE") =>
        adminTenantService.accountStatus(id!, status),
      onSuccess: refresh,
    }),
    upload: useMutation({
      mutationFn: ({ type, file }: { type: string; file: File }) =>
        adminTenantService.uploadDocument(id!, type, file),
      onSuccess: refresh,
    }),
  };
}
