import { apiClient, type ApiEnvelope } from "./api-client";
export const managerCapabilities = {
  FINANCE_READ: "Xem tài chính, hóa đơn và công nợ",
  FINANCE_WRITE: "Ghi nhận nghiệp vụ tài chính",
  DEPOSIT_APPROVE: "Phê duyệt nghiệp vụ tiền cọc",
  CONTRACT_APPROVE: "Duyệt và xác nhận hợp đồng bên cho thuê",
  EXPORT: "Xuất báo cáo trong phạm vi được phép",
} as const;
export type ManagerCapability = keyof typeof managerCapabilities;
export type OwnerPropertyAccess = {
  assignments: {
    manager_id: number;
    full_name: string;
    status: string;
    has_manager_role: boolean;
  }[];
  capabilities: {
    manager_id: number;
    capability: ManagerCapability;
    source: string;
  }[];
  availableManagers: { id: number; full_name: string }[];
  properties: { id: number; name: string }[];
};
export const ownerAccessService = {
  async detail(propertyId: number, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<OwnerPropertyAccess>>(
        `/owner/access/properties/${propertyId}`,
        { signal },
      )
    ).data.data;
  },
  async assign(payload: {
    propertyIds: number[];
    userId: number;
    capabilities: ManagerCapability[];
    reason: string;
  }) {
    await apiClient.put("/owner/access/properties/managers", payload);
  },
  async revoke(propertyId: number, userId: number, reason: string) {
    await apiClient.post(
      `/owner/access/properties/${propertyId}/managers/${userId}/revoke`,
      { reason },
    );
  },
};
