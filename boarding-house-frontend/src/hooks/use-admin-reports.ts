"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminReportService as api } from "@/services/admin-report.service";
import type { ReportFilters } from "@/types/admin-report";

export const useReportOverview = (filters: ReportFilters) =>
  useQuery({
    queryKey: ["report-overview", filters],
    queryFn: () => api.overview(filters),
  });
export const useReportData = (type: string, filters: ReportFilters) =>
  useQuery({
    queryKey: ["report", type, filters],
    queryFn: () => api.report(type, filters),
  });
export const useReportExports = () =>
  useQuery({ queryKey: ["report-exports"], queryFn: api.exports });
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
