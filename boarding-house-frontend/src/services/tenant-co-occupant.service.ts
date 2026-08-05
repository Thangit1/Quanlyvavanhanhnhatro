import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  CreateCoOccupant,
  OccupantDetail,
  OccupantRow,
  Overview,
  Page,
  RequestDetail,
  RequestRow,
  ResidencePeriod,
} from "@/types/tenant-co-occupant";

export const tenantCoOccupantService = {
  overview: async (signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<Overview>>(
        "/tenant/co-occupants/overview",
        { signal },
      )
    ).data.data,
  occupants: async (page = 0, size = 10, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<Page<OccupantRow>>>(
        "/tenant/co-occupants",
        { params: { page, size }, signal },
      )
    ).data.data,
  occupant: async (id: number, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<OccupantDetail>>(
        `/tenant/co-occupants/${id}`,
        { signal },
      )
    ).data.data,
  requests: async (
    status: string | undefined,
    page = 0,
    size = 10,
    signal?: AbortSignal,
  ) =>
    (
      await apiClient.get<ApiEnvelope<Page<RequestRow>>>(
        "/tenant/co-occupants/requests",
        { params: { status: status || undefined, page, size }, signal },
      )
    ).data.data,
  request: async (id: number, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<RequestDetail>>(
        `/tenant/co-occupants/requests/${id}`,
        { signal },
      )
    ).data.data,
  history: async (page = 0, size = 10, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<Page<ResidencePeriod>>>(
        "/tenant/co-occupants/history",
        { params: { page, size }, signal },
      )
    ).data.data,
  create: async (payload: CreateCoOccupant, key: string) =>
    (
      await apiClient.post<
        ApiEnvelope<{ id: number; requestCode: string; status: string }>
      >("/tenant/co-occupants/requests", payload, {
        headers: { "Idempotency-Key": key },
      })
    ).data.data,
  upload: async (id: number, documentType: string, files: File[]) => {
    const data = new FormData();
    files.forEach((file) => data.append("files", file));
    data.append("documentType", documentType);
    return (
      await apiClient.post(
        `/tenant/co-occupants/requests/${id}/documents`,
        data,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
    ).data.data;
  },
  additional: (id: number, payload: { content: string; version: number }) =>
    apiClient.post(
      `/tenant/co-occupants/requests/${id}/additional-information`,
      payload,
    ),
  cancel: (
    id: number,
    payload: { reason: string; note?: string; version: number },
  ) => apiClient.post(`/tenant/co-occupants/requests/${id}/cancel`, payload),
  moveOut: async (
    id: number,
    payload: {
      expectedMoveOutDate: string;
      reason: string;
      note?: string;
      contactPhone: string;
    },
    key: string,
  ) =>
    (
      await apiClient.post<
        ApiEnvelope<{ id: number; requestCode: string; status: string }>
      >(`/tenant/co-occupants/${id}/move-out-requests`, payload, {
        headers: { "Idempotency-Key": key },
      })
    ).data.data,
  download: (id: number) =>
    apiClient.get<Blob>(`/tenant/co-occupants/documents/${id}`, {
      responseType: "blob",
    }),
};
