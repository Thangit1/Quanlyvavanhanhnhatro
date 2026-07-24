import { apiClient, ApiEnvelope } from "@/services/api-client";
import type { AdminDashboardData, TenantHomeData } from "@/types/dashboard";

export const dashboardService = {
  tenantHome: () => apiClient.get<ApiEnvelope<TenantHomeData>>("/tenant/home").then((r) => r.data.data),
  admin: (propertyId?: number, period = "MONTH") =>
    apiClient.get<ApiEnvelope<AdminDashboardData>>("/admin/dashboard", {
      params: { propertyId, period },
    }).then((r) => r.data.data),
};
