import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  InvoiceDetail,
  InvoiceRow,
  InvoiceSummary,
  Page,
  Payment,
  PaymentDetail,
  PaymentProof,
  PaymentSession,
  ReviewPayload,
} from "@/types/tenant-invoice";
export type InvoiceQuery = {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  size: number;
  sort?: string;
};
const clean = (value: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([, v]) => v !== "" && v !== undefined && v !== null,
    ),
  );
export const tenantInvoiceService = {
  summary: async (signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<InvoiceSummary>>(
        "/tenant/invoices/summary",
        { signal },
      )
    ).data.data,
  list: async (params: InvoiceQuery, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<Page<InvoiceRow>>>("/tenant/invoices", {
        params: clean(params),
        signal,
      })
    ).data.data,
  detail: async (id: number, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<InvoiceDetail>>(
        `/tenant/invoices/${id}`,
        { signal },
      )
    ).data.data,
  createSession: async (
    id: number,
    amount: number,
    paymentMethod: string,
    idempotencyKey: string,
  ) =>
    (
      await apiClient.post<ApiEnvelope<PaymentSession>>(
        `/tenant/invoices/${id}/payment-session`,
        { amount, paymentMethod },
        { headers: { "Idempotency-Key": idempotencyKey } },
      )
    ).data.data,
  submitProof: async (
    id: number,
    payload: {
      sessionId: number;
      amount: number;
      transferredAt: string;
      bankName?: string;
      transactionReference?: string;
      note?: string;
      file: File;
    },
  ) => {
    const f = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined) f.append(k, v instanceof File ? v : String(v));
    });
    return (
      await apiClient.post<ApiEnvelope<PaymentProof>>(
        `/tenant/invoices/${id}/payment-proofs`,
        f,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
    ).data.data;
  },
  review: async (id: number, payload: ReviewPayload) =>
    (await apiClient.post(`/tenant/invoices/${id}/review-requests`, payload))
      .data.data,
  document: (id: number) =>
    apiClient.get<Blob>(`/tenant/invoices/${id}/document`, {
      responseType: "blob",
    }),
  payments: async (page = 0, size = 10, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<Page<Payment>>>("/tenant/payments", {
        params: { page, size },
        signal,
      })
    ).data.data,
  payment: async (id: number, signal?: AbortSignal) =>
    (
      await apiClient.get<ApiEnvelope<PaymentDetail>>(
        `/tenant/payments/${id}`,
        { signal },
      )
    ).data.data,
  receipt: (id: number) =>
    apiClient.get<Blob>(`/tenant/payments/${id}/receipt`, {
      responseType: "blob",
    }),
};
