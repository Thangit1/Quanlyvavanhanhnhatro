import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  MaintenanceCalendarItem,
  MaintenanceDetail,
  MaintenanceFilters,
  MaintenanceMaterial,
  MaintenanceOptions,
  MaintenancePage,
  MaintenancePayload,
  MaintenancePlan,
  MaintenanceReport,
  MaintenanceRow,
  MaintenanceSummary,
} from "@/types/admin-maintenance";
const base = "/admin/maintenance";
export const adminMaintenanceService = {
  summary: async (params: { propertyId?: number }) =>
    (
      await apiClient.get<ApiEnvelope<MaintenanceSummary>>(`${base}/summary`, {
        params,
      })
    ).data.data,
  options: async () =>
    (await apiClient.get<ApiEnvelope<MaintenanceOptions>>(`${base}/options`))
      .data.data,
  list: async (params: MaintenanceFilters) =>
    (
      await apiClient.get<ApiEnvelope<MaintenancePage<MaintenanceRow>>>(base, {
        params,
      })
    ).data.data,
  detail: async (id: number) =>
    (await apiClient.get<ApiEnvelope<MaintenanceDetail>>(`${base}/${id}`)).data
      .data,
  create: async (payload: MaintenancePayload) =>
    (
      await apiClient.post<
        ApiEnvelope<{ id: number; requestCode: string; status: string }>
      >(base, payload)
    ).data.data,
  triage: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/triage`,
        payload,
      )
    ).data.data,
  assign: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/assign`,
        payload,
      )
    ).data.data,
  schedule: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/schedule`,
        payload,
      )
    ).data.data,
  start: async (id: number, version: number) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/start`,
        null,
        { params: { version } },
      )
    ).data.data,
  workLog: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/work-logs`,
        payload,
      )
    ).data.data,
  material: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/materials`,
        payload,
      )
    ).data.data,
  cost: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/costs`,
        payload,
      )
    ).data.data,
  complete: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/complete`,
        payload,
      )
    ).data.data,
  inspect: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/inspect`,
        payload,
      )
    ).data.data,
  reopen: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/reopen`,
        payload,
      )
    ).data.data,
  cancel: async (id: number, payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceDetail>>(
        `${base}/${id}/cancel`,
        payload,
      )
    ).data.data,
  calendar: async (params: { from?: string; to?: string }) =>
    (
      await apiClient.get<ApiEnvelope<MaintenanceCalendarItem[]>>(
        `${base}/calendar`,
        { params },
      )
    ).data.data,
  plans: async () =>
    (await apiClient.get<ApiEnvelope<MaintenancePlan[]>>(`${base}/plans`)).data
      .data,
  createPlan: async (payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenancePlan>>(
        `${base}/plans`,
        payload,
      )
    ).data.data,
  materials: async () =>
    (
      await apiClient.get<ApiEnvelope<MaintenanceMaterial[]>>(
        `${base}/materials`,
      )
    ).data.data,
  createMaterial: async (payload: object) =>
    (
      await apiClient.post<ApiEnvelope<MaintenanceMaterial>>(
        `${base}/materials`,
        payload,
      )
    ).data.data,
  report: async () =>
    (await apiClient.get<ApiEnvelope<MaintenanceReport>>(`${base}/reports`))
      .data.data,
  export: async (params: { propertyId?: number; status?: string }) => {
    const { data } = await apiClient.get<Blob>(`${base}/export`, {
      params,
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bao-tri.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
};
