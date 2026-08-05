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
  summary: async (
    params: Pick<InvoiceFilters, "propertyId" | "billingPeriod">,
  ) => {
    const { data } = await apiClient.get<ApiEnvelope<InvoiceSummary>>(
      "/admin/invoices/summary",
      { params },
    );
    return data.data;
  },
  options: async () => {
    const { data } = await apiClient.get<ApiEnvelope<InvoiceOptions>>(
      "/admin/invoices/options",
    );
    return data.data;
  },
  list: async (params: InvoiceFilters) => {
    const { data } = await apiClient.get<ApiEnvelope<Page<InvoiceRow>>>(
      "/admin/invoices",
      { params },
    );
    return data.data;
  },
  detail: async (id: number) => {
    const { data } = await apiClient.get<ApiEnvelope<InvoiceDetail>>(
      `/admin/invoices/${id}`,
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
  ) => {
    const { data } = await apiClient.post<ApiEnvelope<InvoiceDetail>>(
      `/admin/invoices/${id}/payments`,
      payload,
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
  export: async (
    params: Pick<InvoiceFilters, "propertyId" | "billingPeriod" | "status">,
  ) => {
    const { data } = await apiClient.get<Blob>("/admin/invoices/export", {
      params,
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hoa-don.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
};
