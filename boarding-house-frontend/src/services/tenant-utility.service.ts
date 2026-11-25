import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type { TenantUtilityData } from "@/types/tenant-utility";

export const tenantUtilityService = {
  getUtilities: (contractId?: number, period?: string) =>
    apiClient
      .get<ApiEnvelope<TenantUtilityData>>("/tenant/utilities", {
        params: { contractId, period },
      })
      .then((response) => response.data.data),
};
