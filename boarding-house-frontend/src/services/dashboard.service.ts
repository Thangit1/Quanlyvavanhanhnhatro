import { apiClient, ApiEnvelope } from "@/services/api-client";
import type { AdminDashboardData, TenantHomeData } from "@/types/dashboard";

export const dashboardService = {
  tenantHome: (signal?: AbortSignal) =>
    apiClient
      .get<ApiEnvelope<TenantHomeData>>("/tenant/home", { signal })
      .then((r) => r.data.data),
  admin: (propertyId?: number, period = "MONTH", signal?: AbortSignal) =>
    apiClient
      .get<ApiEnvelope<AdminDashboardData>>("/admin/dashboard", {
        params: { propertyId, period },
        signal,
      })
      .then((r) => r.data.data),
};
