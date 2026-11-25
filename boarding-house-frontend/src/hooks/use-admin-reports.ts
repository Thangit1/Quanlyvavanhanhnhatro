"use client";
import { useScopedQuery } from "./use-scoped-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminReportService as api } from "@/services/admin-report.service";
import type { ReportFilters } from "@/types/admin-report";

export const useReportOverview = (filters: ReportFilters) =>
  useScopedQuery({
    queryKey: ["report-overview", filters],
    queryFn: ({ signal }) => api.overview(filters, signal),
  });
export const useReportData = (type: string, filters: ReportFilters) =>
  useScopedQuery({
    queryKey: ["report", type, filters],
    queryFn: ({ signal }) => api.report(type, filters, signal),
  });
export const useReportExports = () =>
  useScopedQuery({ queryKey: ["report-exports"], queryFn: api.exports });
export function useCreateReportExport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      filters,
      columns,
    }: {
      type: string;
      filters: ReportFilters;
      columns?: string[];
    }) => api.createExport(type, filters, columns),
    onSuccess: () => client.invalidateQueries({ queryKey: ["report-exports"] }),
  });
}
