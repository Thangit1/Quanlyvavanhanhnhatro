"use client";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboard.service";

export function useTenantHome(enabled: boolean) {
  return useQuery({
    queryKey: ["tenant-home"],
    queryFn: dashboardService.tenantHome,
    enabled,
    retry: 1,
  });
}
export function useAdminDashboard(
  enabled: boolean,
  propertyId?: number,
  period = "MONTH",
) {
  return useQuery({
    queryKey: ["admin-dashboard", propertyId, period],
    queryFn: () => dashboardService.admin(propertyId, period),
    enabled,
    retry: 1,
  });
}
