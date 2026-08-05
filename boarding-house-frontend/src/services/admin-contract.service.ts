import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  AdminContractDetail,
  AdminContractFilters,
  AdminContractListData,
} from "@/types/admin-contract";

export const adminContractService = {
  async list(filters: AdminContractFilters, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiEnvelope<AdminContractListData>>(
      "/admin/contracts",
      { params: filters, signal },
    );
    return data.data;
  },

  async detail(contractId: number, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiEnvelope<AdminContractDetail>>(
      `/admin/contracts/${contractId}`,
      { signal },
    );
    return data.data;
  },

  async exportCsv(filters: AdminContractFilters) {
    const { data } = await apiClient.get<Blob>("/admin/contracts/export", {
      params: filters,
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "danh-sach-hop-dong.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
