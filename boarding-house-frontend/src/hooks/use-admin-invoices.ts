"use client";
import { useScopedQuery } from "./use-scoped-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminInvoiceService } from "@/services/admin-invoice.service";
import type {
  BulkInvoicePayload,
  InvoiceFilters,
  InvoicePayload,
} from "@/types/admin-invoice";
export function useInvoiceData(filters: InvoiceFilters) {
  const summary = useScopedQuery({
    queryKey: ["invoice-summary", filters.propertyId, filters.billingPeriod],
    queryFn: ({ signal }) => adminInvoiceService.summary(filters, signal),
  });
  const list = useScopedQuery({
    queryKey: ["admin-invoices", filters],
    queryFn: ({ signal }) => adminInvoiceService.list(filters, signal),
  });
  const options = useScopedQuery({
    queryKey: ["invoice-options"],
    queryFn: ({ signal }) => adminInvoiceService.options(signal),
    staleTime: 60_000,
  });
  return { summary, list, options };
}
export function useInvoiceDetail(id: number) {
  return useScopedQuery({
    queryKey: ["admin-invoice", id],
    queryFn: ({ signal }) => adminInvoiceService.detail(id, signal),
    enabled: id > 0,
  });
}
export function useInvoiceMutations(id?: number) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries();
  };
  return {
    create: useMutation({
      mutationFn: (p: InvoicePayload) => adminInvoiceService.create(p),
      onSuccess: refresh,
    }),
    preview: useMutation({
      mutationFn: (p: BulkInvoicePayload) => adminInvoiceService.bulkPreview(p),
    }),
    bulk: useMutation({
      mutationFn: (p: BulkInvoicePayload) =>
        adminInvoiceService.bulkGenerate(p),
      onSuccess: refresh,
    }),
    issue: useMutation({
      mutationFn: (v: number) => adminInvoiceService.issue(id!, v),
      onSuccess: refresh,
    }),
    payment: useMutation({
      mutationFn: (p: {
        amount: number;
        paymentMethod: string;
        paidAt: string;
        referenceCode?: string;
        note?: string;
        version: number;
        idempotencyKey: string;
      }) => {
        const { idempotencyKey, ...payload } = p;
        return adminInvoiceService.payment(id!, payload, idempotencyKey);
      },
      onSuccess: refresh,
    }),
    adjust: useMutation({
      mutationFn: (p: {
        adjustmentType: string;
        amount: number;
        reason: string;
        version: number;
      }) => adminInvoiceService.adjust(id!, p),
      onSuccess: refresh,
    }),
    cancel: useMutation({
      mutationFn: (p: { reason: string; version: number }) =>
        adminInvoiceService.cancel(id!, p),
      onSuccess: refresh,
    }),
    remind: useMutation({
      mutationFn: (p: { channel: string; message?: string }) =>
        adminInvoiceService.remind(id!, p),
      onSuccess: refresh,
    }),
  };
}
