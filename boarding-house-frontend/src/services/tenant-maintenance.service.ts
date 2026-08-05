import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  ActionResult,
  AvailableLocation,
  CreateMaintenance,
  MaintenanceDetail,
  MaintenanceMessage,
  MaintenanceRow,
  MaintenanceSummary,
  Page,
} from "@/types/tenant-maintenance";
export type MaintenanceQuery = {
  status?: string;
  keyword?: string;
  category?: string;
  priority?: string;
  roomId?: number;
  startDate?: string;
  endDate?: string;
  sort?: string;
  page: number;
  size: number;
};
const params = (x: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(x).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );
export const tenantMaintenanceService = {
  summary: async (signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<MaintenanceSummary>>(
        "/tenant/maintenance/summary",
        { signal },
      )
    ).data.data,
  locations: async (signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<AvailableLocation[]>>(
        "/tenant/maintenance/available-locations",
        { signal },
      )
    ).data.data,
  list: async (q: MaintenanceQuery, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<Page<MaintenanceRow>>>(
        "/tenant/maintenance",
        { params: params(q), signal },
      )
    ).data.data,
  detail: async (id: number, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<MaintenanceDetail>>(
        `/tenant/maintenance/${id}`,
        { signal },
      )
    ).data.data,
  create: async (payload: CreateMaintenance, key: string) =>
    (
      await apiClient.post<
        ApiEnvelope<{ id: number; requestCode: string; status: string }>
      >("/tenant/maintenance", payload, { headers: { "Idempotency-Key": key } })
    ).data.data,
  upload: async (
    id: number,
    files: File[],
    attachmentType = "ADDITIONAL",
    caption = "",
  ) => {
    const data = new FormData();
    files.forEach((f) => data.append("files", f));
    data.append("attachmentType", attachmentType);
    if (caption) data.append("caption", caption);
    return (
      await apiClient.post(`/tenant/maintenance/${id}/attachments`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data.data;
  },
  messages: async (id: number, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<MaintenanceMessage[]>>(
        `/tenant/maintenance/${id}/messages`,
        { signal },
      )
    ).data.data,
  message: async (id: number, content: string) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceMessage>>(
        `/tenant/maintenance/${id}/messages`,
        { content },
      )
    ).data.data,
  additional: (
    id: number,
    payload: { content: string; contactPhone?: string; version: number },
  ) =>
    apiClient.post(`/tenant/maintenance/${id}/additional-information`, payload),
  schedule: (
    id: number,
    payload: {
      response: string;
      preferredStart?: string;
      note?: string;
      version: number;
    },
  ) =>
    apiClient.post<ApiEnvelope<ActionResult>>(
      `/tenant/maintenance/${id}/schedule-responses`,
      payload,
    ),
  cancel: (
    id: number,
    payload: { reason: string; note?: string; version: number },
  ) =>
    apiClient.post<ApiEnvelope<ActionResult>>(
      `/tenant/maintenance/${id}/cancel`,
      payload,
    ),
  feedback: (
    id: number,
    payload: {
      result: string;
      rating: number;
      staffAttitudeRating?: number;
      resolutionTimeRating?: number;
      comment?: string;
      assetWorking: boolean;
      version: number;
    },
  ) =>
    apiClient.post<ApiEnvelope<ActionResult>>(
      `/tenant/maintenance/${id}/feedback`,
      payload,
    ),
  reopen: (
    id: number,
    payload: {
      reason: string;
      recurringAt?: string;
      currentPriority: string;
      preferredServiceTime?: string;
      version: number;
    },
  ) =>
    apiClient.post<ApiEnvelope<ActionResult>>(
      `/tenant/maintenance/${id}/reopen`,
      payload,
    ),
  attachmentUrl: (id: number) =>
    `${apiClient.defaults.baseURL}/tenant/maintenance/attachments/${id}`,
  attachment: (id: number) =>
    apiClient.get<Blob>(`/tenant/maintenance/attachments/${id}`, {
      responseType: "blob",
    }),
  aiAvailability: async (signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<{ available: boolean; reason: string }>>(
        "/tenant/maintenance/ai-availability",
        { signal },
      )
    ).data.data,
};
