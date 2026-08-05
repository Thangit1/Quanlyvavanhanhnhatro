import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  ExportJob,
  ReportData,
  ReportFilters,
  ReportOverview,
} from "@/types/admin-report";

const base = "/admin/reports";
const params = (filters: ReportFilters) => ({
  ...filters,
  propertyIds: filters.propertyIds?.length
    ? filters.propertyIds.join(",")
    : undefined,
});
const getReport = async (type: string, filters: ReportFilters) =>
  (
    await apiClient.get<ApiEnvelope<ReportData>>(`${base}/${type}`, {
      params: params(filters),
    })
  ).data.data;
export const adminReportService = {
  overview: async (filters: ReportFilters) =>
    (
      await apiClient.get<ApiEnvelope<ReportOverview>>(`${base}/overview`, {
        params: params(filters),
      })
    ).data.data,
  report: getReport,
  occupancy: (filters: ReportFilters) => getReport("occupancy", filters),
  revenue: (filters: ReportFilters) => getReport("revenue", filters),
  expenses: (filters: ReportFilters) => getReport("expenses", filters),
  profit: (filters: ReportFilters) => getReport("profit", filters),
  debt: (filters: ReportFilters) => getReport("debt", filters),
  invoices: (filters: ReportFilters) => getReport("invoices", filters),
  payments: (filters: ReportFilters) => getReport("payments", filters),
  contracts: (filters: ReportFilters) => getReport("contracts", filters),
  tenants: (filters: ReportFilters) => getReport("tenants", filters),
  utilities: (filters: ReportFilters) => getReport("utilities", filters),
  maintenance: (filters: ReportFilters) => getReport("maintenance", filters),
  assets: (filters: ReportFilters) => getReport("assets", filters),
  compareProperties: (filters: ReportFilters) =>
    getReport("operations", filters),
  createExport: async (
    reportType: string,
    filters: ReportFilters,
    columns?: string[],
  ) =>
    (
      await apiClient.post<ApiEnvelope<ExportJob>>(`${base}/exports`, {
        reportType: reportType.toUpperCase(),
        format: "CSV",
        propertyIds: filters.propertyIds ?? [],
        startDate: filters.startDate,
        endDate: filters.endDate,
        filters: {},
        columns: columns ?? [],
        includeCharts: false,
      })
    ).data.data,
  exports: async () =>
    (await apiClient.get<ApiEnvelope<ExportJob[]>>(`${base}/exports`)).data
      .data,
  download: async (job: ExportJob) => {
    const response = await apiClient.get<Blob>(
      `${base}/exports/${job.id}/download`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = job.fileName ?? `bao-cao-${job.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
