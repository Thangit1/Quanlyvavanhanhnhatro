import { apiClient, ApiEnvelope } from "@/services/api-client";
import type {
  AccountantAccount,
  AccountantDashboard,
  AccountantResource,
  ApiPage,
} from "@/types/accountant";

const unwrap = <T>(p: Promise<{ data: ApiEnvelope<T> }>) =>
  p.then((r) => r.data.data);
const params = (scope?: {
  propertyId?: number;
  period?: string;
  status?: string;
  keyword?: string;
  page?: number;
  size?: number;
}) => scope;
export const accountantService = {
  dashboard: (scope?: { propertyId?: number; period?: string }) =>
    unwrap<AccountantDashboard>(
      apiClient.get("/accountant/dashboard", { params: scope }),
    ),
  resource: (
    resource: AccountantResource,
    scope?: Record<string, string | number | undefined>,
  ) =>
    unwrap<ApiPage | Record<string, unknown>>(
      apiClient.get(`/accountant/${resource}`, { params: params(scope) }),
    ),
  detail: (resource: string, id: number) =>
    unwrap<Record<string, unknown>>(
      apiClient.get(`/accountant/${resource}/${id}`),
    ),
  action: (
    resource: string,
    id: number,
    action: string,
    payload: object,
    key?: string,
  ) =>
    unwrap<Record<string, unknown>>(
      apiClient.post(`/accountant/${resource}/${id}/${action}`, payload, {
        headers: key ? { "Idempotency-Key": key } : undefined,
      }),
    ),
  createPayment: (payload: object) =>
    unwrap<Record<string, unknown>>(
      apiClient.post("/accountant/payments", payload, {
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }),
    ),
  createVoucher: (payload: object) =>
    unwrap<Record<string, unknown>>(
      apiClient.post("/accountant/payment-vouchers", payload),
    ),
  depositTransaction: (id: number, payload: object) =>
    unwrap<Record<string, unknown>>(
      apiClient.post(`/accountant/deposits/${id}/transactions`, payload),
    ),
  account: () =>
    unwrap<AccountantAccount>(apiClient.get("/accountant/account")),
  notifications: () =>
    unwrap<Record<string, unknown>[]>(
      apiClient.get("/accountant/notifications"),
    ),
};
