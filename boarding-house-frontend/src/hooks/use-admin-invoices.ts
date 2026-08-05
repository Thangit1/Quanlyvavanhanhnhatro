"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminInvoiceService } from "@/services/admin-invoice.service";
import type {
  BulkInvoicePayload,
  InvoiceFilters,
  InvoicePayload,
} from "@/types/admin-invoice";
export function useInvoiceData(filters: InvoiceFilters) {
  const summary = useQuery({
    queryKey: ["invoice-summary", filters.propertyId, filters.billingPeriod],
    queryFn: () => adminInvoiceService.summary(filters),
  });
  const list = useQuery({
    queryKey: ["admin-invoices", filters],
    queryFn: () => adminInvoiceService.list(filters),
    placeholderData: (p) => p,
  });
  const options = useQuery({
    queryKey: ["invoice-options"],
    queryFn: adminInvoiceService.options,
    staleTime: 60_000,
  });
  return { summary, list, options };
}
export function useInvoiceDetail(id: number) {
  return useQuery({
    queryKey: ["admin-invoice", id],
    queryFn: () => adminInvoiceService.detail(id),
    enabled: id > 0,
  });
}
export function useInvoiceMutations(id?: number) {
  const qc = useQueryClient();
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-invoices"] });
    await qc.invalidateQueries({ queryKey: ["invoice-summary"] });
    if (id) await qc.invalidateQueries({ queryKey: ["admin-invoice", id] });
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
      }) => adminInvoiceService.payment(id!, p),
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
