import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  Account,
  Asset,
  CalendarItem,
  Dashboard,
  MaterialCatalog,
  MaterialRequestRow,
  NotificationRow,
  Performance,
  PreventivePlan,
  TaskDetail,
  TaskFilters,
  TaskPage,
  TaskRow,
} from "@/types/technician";
const base = "/technician";
const data = <T>(promise: Promise<{ data: ApiEnvelope<T> }>) =>
  promise.then((x) => x.data.data);
export const technicianService = {
  dashboard: () =>
    data(apiClient.get<ApiEnvelope<Dashboard>>(`${base}/dashboard`)),
  tasks: (params: TaskFilters) =>
    data(apiClient.get<ApiEnvelope<TaskPage>>(`${base}/tasks`, { params })),
  emergency: () =>
    data(apiClient.get<ApiEnvelope<TaskRow[]>>(`${base}/emergency`)),
  detail: (id: number) =>
    data(apiClient.get<ApiEnvelope<TaskDetail>>(`${base}/tasks/${id}`)),
  action: (id: number, action: string, payload: object) =>
    data(
      apiClient.post<
        ApiEnvelope<{
          taskId: number;
          status: string;
          version: number;
          message: string;
        }>
      >(`${base}/tasks/${id}/${action}`, payload),
    ),
  checklist: (id: number, payload: object) =>
    data(
      apiClient.put<ApiEnvelope<object>>(
        `${base}/tasks/${id}/checklist`,
        payload,
      ),
    ),
  upload: async (
    id: number,
    version: number,
    type: string,
    file: File,
    caption?: string,
  ) => {
    const body = new FormData();
    body.append("file", file);
    body.append("version", String(version));
    body.append("type", type);
    if (caption) body.append("caption", caption);
    return data(
      apiClient.post<ApiEnvelope<object>>(
        `${base}/tasks/${id}/attachments`,
        body,
        { headers: { "Content-Type": "multipart/form-data" } },
      ),
    );
  },
  calendar: (params: { from?: string; to?: string }) =>
    data(
      apiClient.get<ApiEnvelope<CalendarItem[]>>(`${base}/calendar`, {
        params,
      }),
    ),
  preventive: () =>
    data(
      apiClient.get<ApiEnvelope<PreventivePlan[]>>(
        `${base}/preventive-maintenance`,
      ),
    ),
  assets: () => data(apiClient.get<ApiEnvelope<Asset[]>>(`${base}/assets`)),
  asset: (id: number) =>
    data(apiClient.get<ApiEnvelope<Asset>>(`${base}/assets/${id}`)),
  materials: () =>
    data(apiClient.get<ApiEnvelope<MaterialCatalog[]>>(`${base}/materials`)),
  materialRequests: () =>
    data(
      apiClient.get<ApiEnvelope<MaterialRequestRow[]>>(
        `${base}/material-requests`,
      ),
    ),
  receiveMaterial: (id: number, version: number) =>
    data(
      apiClient.post<ApiEnvelope<void>>(
        `${base}/material-requests/${id}/receive`,
        null,
        { params: { version } },
      ),
    ),
  notifications: () =>
    data(
      apiClient.get<ApiEnvelope<NotificationRow[]>>(`${base}/notifications`),
    ),
  markRead: (id: number) =>
    data(apiClient.post<ApiEnvelope<void>>(`${base}/notifications/${id}/read`)),
  performance: () =>
    data(apiClient.get<ApiEnvelope<Performance>>(`${base}/performance`)),
  account: () => data(apiClient.get<ApiEnvelope<Account>>(`${base}/account`)),
  updateProfile: (payload: object) =>
    data(
      apiClient.put<ApiEnvelope<Account>>(`${base}/account/profile`, payload),
    ),
  updatePreferences: (payload: object) =>
    data(
      apiClient.put<ApiEnvelope<Account>>(
        `${base}/account/preferences`,
        payload,
      ),
    ),
  changePassword: (payload: object) =>
    data(
      apiClient.post<ApiEnvelope<void>>(`${base}/account/password`, payload),
    ),
  revokeSession: (id: number) =>
    data(apiClient.delete<ApiEnvelope<void>>(`${base}/account/sessions/${id}`)),
};
