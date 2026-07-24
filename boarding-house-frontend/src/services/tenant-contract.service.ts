import type { AxiosRequestConfig } from "axios";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  ContractDetail, ContractPage, ExtensionPayload, RequestCreated, TerminationPayload,
} from "@/types/tenant-contract";

export interface ContractQuery { status?: string; page?: number; size?: number; sort?: string }

export const tenantContractService = {
  getContracts: (params: ContractQuery = {}, signal?: AbortSignal) =>
    apiClient.get<ApiEnvelope<ContractPage>>("/tenant/contracts", { params, signal })
      .then(({ data }) => data.data),
  getContractDetail: (contractId: number, signal?: AbortSignal) =>
    apiClient.get<ApiEnvelope<ContractDetail>>(`/tenant/contracts/${contractId}`, { signal })
      .then(({ data }) => data.data),
  createExtensionRequest: (contractId: number, payload: ExtensionPayload) =>
    apiClient.post<ApiEnvelope<RequestCreated>>(`/tenant/contracts/${contractId}/extension-requests`, payload)
      .then(({ data }) => data.data),
  createTerminationRequest: (contractId: number, payload: TerminationPayload) =>
    apiClient.post<ApiEnvelope<RequestCreated>>(`/tenant/contracts/${contractId}/termination-requests`, payload)
      .then(({ data }) => data.data),
  downloadContract: (contractId: number, config?: AxiosRequestConfig) =>
    apiClient.get<Blob>(`/tenant/contracts/${contractId}/document`, {
      ...config, responseType: "blob", headers: { Accept: "application/pdf,application/octet-stream" },
    }),
};
