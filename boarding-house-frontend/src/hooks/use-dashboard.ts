"use client";
import { useScopedQuery } from "./use-scoped-query";

import { dashboardService } from "@/services/dashboard.service";

export function useTenantHome(enabled: boolean) {
  return useScopedQuery({
    queryKey: ["tenant-home"],
    queryFn: ({ signal }) => dashboardService.tenantHome(signal),
    enabled,
    retry: 1,
  });
}
export function useAdminDashboard(
  enabled: boolean,
  propertyId?: number,
  period = "MONTH",
) {
  return useScopedQuery({
    queryKey: ["admin-dashboard", propertyId, period],
    queryFn: ({ signal }) => dashboardService.admin(propertyId, period, signal),
    enabled,
    retry: 1,
  });
}
