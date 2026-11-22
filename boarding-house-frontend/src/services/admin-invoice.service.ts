import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  BulkInvoicePayload,
  BulkPreview,
  InvoiceDetail,
  InvoiceFilters,
  InvoiceOptions,
  InvoicePayload,
  InvoiceRow,
  InvoiceSummary,
  Page,
} from "@/types/admin-invoice";
export const adminInvoiceService = {
  preview: async (payload: InvoicePayload) =>
    (
      await apiClient.post<
        ApiEnvelope<import("@/types/admin-invoice").InvoicePlan>
      >("/admin/invoices/preview", payload)
    ).data.data,
  print: async (id: number) => {
    const { data } = await apiClient.get<Blob>(`/admin/invoices/${id}/print`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    };
    frame.src = url;
    document.body.append(frame);
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 120000);
  },
  summary: async (
    params: Pick<InvoiceFilters, "propertyId" | "billingPeriod">,
    signal?: AbortSignal,
  ) => {
    const { data } = await apiClient.get<ApiEnvelope<InvoiceSummary>>(
      "/admin/invoices/summary",
      { params, signal },
    );
    return data.data;
  },
  options: async (signal?: AbortSignal) => {
    const { data } = await apiClient.get<ApiEnvelope<InvoiceOptions>>(
      "/admin/invoices/options",
      { signal },
    );
    return data.data;
  },
  list: async (params: InvoiceFilters, signal?: AbortSignal) => {
    const { data } = await apiClient.get<ApiEnvelope<Page<InvoiceRow>>>(
      "/admin/invoices",
      { params, signal },
    );
    return data.data;
  },
  detail: async (id: number, signal?: AbortSignal) => {
    const { data } = await apiClient.get<ApiEnvelope<InvoiceDetail>>(
      `/admin/invoices/${id}`,
      { signal },
    );
    return data.data;
  },
  create: async (payload: InvoicePayload) => {
    const { data } = await apiClient.post<
      ApiEnvelope<{ id: number; invoiceCode: string; status: string }>
    >("/admin/invoices", payload);
    return data.data;
  },
  bulkPreview: async (payload: BulkInvoicePayload) => {
    const { data } = await apiClient.post<ApiEnvelope<BulkPreview[]>>(
      "/admin/invoices/bulk-preview",
      payload,
    );
    return data.data;
  },
  bulkGenerate: async (payload: BulkInvoicePayload) => {
    const { data } = await apiClient.post<
      ApiEnvelope<{
        created: { id: number; invoiceCode: string; status: string }[];
        skipped: BulkPreview[];
      }>
    >("/admin/invoices/bulk-generate", payload);
    return data.data;
  },
  issue: async (id: number, version: number) => {
    const { data } = await apiClient.post<ApiEnvelope<InvoiceDetail>>(
      `/admin/invoices/${id}/issue`,
      null,
      { params: { version } },
    );
    return data.data;
  },
  payment: async (
    id: number,
    payload: {
      amount: number;
      paymentMethod: string;
      paidAt: string;
      referenceCode?: string;
      note?: string;
      version: number;
    },
    idempotencyKey: string,
  ) => {
    const { data } = await apiClient.post<ApiEnvelope<InvoiceDetail>>(
      `/admin/invoices/${id}/payments`,
      payload,
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data.data;
  },
  adjust: async (
    id: number,
    payload: {
      adjustmentType: string;
      amount: number;
      reason: string;
      version: number;
    },
  ) => {
    const { data } = await apiClient.post<ApiEnvelope<InvoiceDetail>>(
      `/admin/invoices/${id}/adjustments`,
      payload,
    );
    return data.data;
  },
  cancel: async (id: number, payload: { reason: string; version: number }) => {
    const { data } = await apiClient.post<ApiEnvelope<InvoiceDetail>>(
      `/admin/invoices/${id}/cancel`,
      payload,
    );
    return data.data;
  },
  remind: async (
    id: number,
    payload: { channel: string; message?: string },
  ) => {
    const { data } = await apiClient.post<ApiEnvelope<InvoiceDetail>>(
      `/admin/invoices/${id}/reminders`,
      payload,
    );
    return data.data;
  },
  download: async (id: number, code: string) => {
    const { data } = await apiClient.get<Blob>(`/admin/invoices/${id}/pdf`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${code}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
  export: async (params: InvoiceFilters & { format?: "csv" | "xlsx" }) => {
    const { data } = await apiClient.get<Blob>("/admin/invoices/export", {
      params,
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = params.format === "xlsx" ? "hoa-don.xlsx" : "hoa-don.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
};
