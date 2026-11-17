"use client";
import { useScopedQuery } from "./use-scoped-query";

import { adminContractService } from "@/services/admin-contract.service";
import type { AdminContractFilters } from "@/types/admin-contract";

export function useAdminContracts(filters: AdminContractFilters) {
  return useScopedQuery({
    queryKey: ["admin-contracts", filters],
    queryFn: ({ signal }) => adminContractService.list(filters, signal),
    staleTime: 20_000,
  });
}

export function useAdminContract(contractId: number) {
  return useScopedQuery({
    queryKey: ["admin-contract", contractId],
    queryFn: ({ signal }) => adminContractService.detail(contractId, signal),
    enabled: Number.isInteger(contractId) && contractId > 0,
  });
}
