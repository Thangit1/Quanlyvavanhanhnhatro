import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type { SaveTenantPayload, TenantDetail, TenantFilters, TenantListData } from "@/types/admin-tenant";

export const adminTenantService = {
  async list(filters: TenantFilters) {
    const { data } = await apiClient.get<ApiEnvelope<TenantListData>>("/admin/tenants", { params: filters });
    return data.data;
  },
  async detail(id: number) {
    const { data } = await apiClient.get<ApiEnvelope<TenantDetail>>(`/admin/tenants/${id}`);
    return data.data;
  },
  async create(payload: SaveTenantPayload) {
    const { data } = await apiClient.post<ApiEnvelope<{ id: number; tenantCode: string }>>("/admin/tenants", payload);
    return data.data;
  },
  async update(id: number, payload: SaveTenantPayload) {
    const { data } = await apiClient.put<ApiEnvelope<TenantDetail>>(`/admin/tenants/${id}`, payload);
    return data.data;
  },
  async transfer(id: number, payload: { toRoomId: number; transferDate: string; reason?: string }) {
    await apiClient.post(`/admin/tenants/${id}/room-transfers`, payload);
  },
  async moveOut(id: number, payload: { moveOutDate: string; reason?: string; closeContract: boolean }) {
    await apiClient.post(`/admin/tenants/${id}/move-out`, payload);
  },
  async saveTemporary(id: number, payload: { propertyId: number; registrationCode?: string;
    registeredAt?: string; expiresAt?: string; status: string; note?: string }) {
    await apiClient.put(`/admin/tenants/${id}/temporary-residence`, payload);
  },
  async createAccount(id: number, payload: { email: string; temporaryPassword: string }) {
    await apiClient.post(`/admin/tenants/${id}/account`, payload);
  },
  async accountStatus(id: number, status: "ACTIVE" | "LOCKED" | "INACTIVE") {
    await apiClient.patch(`/admin/tenants/${id}/account/status`, { status });
  },
  async uploadDocument(id: number, documentType: string, file: File) {
    const body = new FormData(); body.append("file", file);
    await apiClient.post(`/admin/tenants/${id}/documents`, body, {
      params: { documentType }, headers: { "Content-Type": "multipart/form-data" },
    });
  },
  async downloadDocument(tenantId: number, documentId: number, filename: string) {
    const { data } = await apiClient.get<Blob>(`/admin/tenants/${tenantId}/documents/${documentId}`, { responseType: "blob" });
    const url = URL.createObjectURL(data); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  },
  async exportCsv(filters: Pick<TenantFilters, "propertyId" | "keyword">) {
    const { data } = await apiClient.get<Blob>("/admin/tenants/export", { params: filters, responseType: "blob" });
    const url = URL.createObjectURL(data); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "danh-sach-nguoi-thue.csv"; anchor.click(); URL.revokeObjectURL(url);
  },
};
