"use client";

import { useQuery } from "@tanstack/react-query";
import { tenantUtilityService } from "@/services/tenant-utility.service";

export function useTenantUtilities(
  enabled: boolean,
  contractId?: number,
  period?: string,
) {
  return useQuery({
    queryKey: ["tenant-utilities", contractId, period],
    queryFn: () => tenantUtilityService.getUtilities(contractId, period),
    enabled,
    retry: 1,
  });
}
