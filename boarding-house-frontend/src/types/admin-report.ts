export interface ReportFilters {
  propertyIds?: number[];
  startDate: string;
  endDate: string;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
}
export interface PropertyOption {
  id: number;
  name: string;
}
export interface ReportScope {
  propertyIds: number[];
  startDate: string;
  endDate: string;
}
export interface ChartPoint {
  label: string;
  value: number;
  secondaryValue: number | null;
  category: string | null;
}
export interface ReportAlert {
  code: string;
  severity: string;
  title: string;
  description: string;
  actionUrl: string;
}
export interface ReportOverview {
  scope: ReportScope;
  availableProperties: PropertyOption[];
  summary: Record<string, number>;
  comparison: Record<string, number>;
  roomStatus: ChartPoint[];
  revenueTrend: ChartPoint[];
  operationalAlerts: ReportAlert[];
  updatedAt: string;
}
export interface ReportData {
  reportType: string;
  scope: ReportScope;
  summary: Record<string, number>;
  trend: ChartPoint[];
  breakdown: ChartPoint[];
  details: Array<Record<string, unknown>>;
  updatedAt: string;
}
export interface ExportJob {
  id: number;
  reportType: string;
  format: string;
  status: string;
  fileName: string | null;
  fileSize: number | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}
