"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantInvoiceService,
  type InvoiceQuery,
} from "@/services/tenant-invoice.service";
import type { ReviewPayload } from "@/types/tenant-invoice";
export const useInvoiceSummary = (enabled: boolean) =>
  useQuery({
    queryKey: ["tenant-invoice-summary"],
    queryFn: ({ signal }) => tenantInvoiceService.summary(signal),
    enabled,
    retry: 1,
  });
export const useTenantInvoices = (enabled: boolean, q: InvoiceQuery) =>
  useQuery({
    queryKey: ["tenant-invoices", q],
    queryFn: ({ signal }) => tenantInvoiceService.list(q, signal),
    enabled,
    retry: 1,
  });
export const useTenantInvoice = (enabled: boolean, id: number) =>
  useQuery({
    queryKey: ["tenant-invoice", id],
    queryFn: ({ signal }) => tenantInvoiceService.detail(id, signal),
    enabled: enabled && id > 0,
    retry: 1,
  });
export function useInvoiceActions(id: number) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tenant-invoice", id] });
    void qc.invalidateQueries({ queryKey: ["tenant-invoices"] });
    void qc.invalidateQueries({ queryKey: ["tenant-invoice-summary"] });
  };
  return {
    session: useMutation({
      mutationFn: (p: {
        amount: number;
        paymentMethod: string;
        idempotencyKey: string;
      }) =>
        tenantInvoiceService.createSession(
          id,
          p.amount,
          p.paymentMethod,
          p.idempotencyKey,
        ),
    }),
    proof: useMutation({
      mutationFn: (p: Parameters<typeof tenantInvoiceService.submitProof>[1]) =>
        tenantInvoiceService.submitProof(id, p),
      onSuccess: refresh,
    }),
    review: useMutation({
      mutationFn: (p: ReviewPayload) => tenantInvoiceService.review(id, p),
      onSuccess: refresh,
    }),
  };
}
export const useTenantPayments = (enabled: boolean, page: number) =>
  useQuery({
    queryKey: ["tenant-payments", page],
    queryFn: ({ signal }) => tenantInvoiceService.payments(page, 10, signal),
    enabled,
    retry: 1,
  });
