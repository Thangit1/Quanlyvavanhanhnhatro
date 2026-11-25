"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantContractService,
  type ContractQuery,
} from "@/services/tenant-contract.service";
import type {
  ExtensionPayload,
  TerminationPayload,
} from "@/types/tenant-contract";

export function useTenantContracts(enabled: boolean, params: ContractQuery) {
  return useQuery({
    queryKey: ["tenant-contracts", params],
    queryFn: ({ signal }) => tenantContractService.getContracts(params, signal),
    enabled,
    retry: 1,
  });
}
export function useTenantContract(enabled: boolean, contractId: number) {
  return useQuery({
    queryKey: ["tenant-contract", contractId],
    queryFn: ({ signal }) =>
      tenantContractService.getContractDetail(contractId, signal),
    enabled: enabled && Number.isSafeInteger(contractId) && contractId > 0,
    retry: 1,
  });
}
export function useExtensionRequest(contractId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExtensionPayload) =>
      tenantContractService.createExtensionRequest(contractId, payload),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["tenant-contract", contractId],
      });
      void client.invalidateQueries({ queryKey: ["tenant-contracts"] });
    },
  });
}
export function useTerminationRequest(contractId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: TerminationPayload) =>
      tenantContractService.createTerminationRequest(contractId, payload),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["tenant-contract", contractId],
      });
      void client.invalidateQueries({ queryKey: ["tenant-contracts"] });
    },
  });
}
