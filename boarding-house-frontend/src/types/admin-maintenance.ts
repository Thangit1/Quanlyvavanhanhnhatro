export type MaintenanceOption = {
  id: number;
  name: string;
  parentId?: number;
  detail?: string;
};
export type MaintenanceSummary = {
  openRequests: number;
  newRequests: number;
  urgentRequests: number;
  unassignedRequests: number;
  inProgressRequests: number;
  overdueRequests: number;
  inspectionPendingRequests: number;
  monthlyCost: number;
  averageResolutionHours: number;
  onTimeRate: number;
};
export type MaintenanceOptions = {
  properties: MaintenanceOption[];
  buildings: MaintenanceOption[];
  floors: MaintenanceOption[];
  rooms: MaintenanceOption[];
  assets: MaintenanceOption[];
  technicians: MaintenanceOption[];
};
export type MaintenanceRow = {
  id: number;
  requestCode: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  safetyRisk: boolean;
  property: MaintenanceOption;
  room?: MaintenanceOption;
  reporter?: MaintenanceOption;
  assignee?: MaintenanceOption;
  createdAt: string;
  scheduledStart?: string;
  slaDueAt?: string;
  waitingHours: number;
  overdue: boolean;
  estimatedCost: number;
  actualCost: number;
  progressPercent: number;
  version: number;
};
export type MaintenancePage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
};
export type MaintenanceFilters = {
  propertyId?: number;
  roomId?: number;
  keyword?: string;
  category?: string;
  priority?: string;
  status?: string;
  overdue?: boolean;
  sort?: string;
  page: number;
  size: number;
};
export type MaintenancePayload = {
  propertyId: number;
  roomId?: number;
  assetId?: number;
  reporterId?: number;
  source: string;
  maintenanceType: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  safetyRisk: boolean;
  detectedAt?: string;
  preferredServiceTime?: string;
  estimatedCost: number;
  costResponsibility: string;
};
export type MaintenanceDetail = {
  request: MaintenanceRow;
  description: string;
  source: string;
  maintenanceType: string;
  asset?: MaintenanceOption;
  detectedAt?: string;
  preferredServiceTime?: string;
  diagnosis?: string;
  resolution?: string;
  costResponsibility: string;
  schedules: Array<{
    id: number;
    start: string;
    end: string;
    durationMinutes: number;
    tenantPresenceRequired: boolean;
    status: string;
  }>;
  workLogs: Array<{
    id: number;
    actionType: string;
    progressPercent: number;
    diagnosis?: string;
    workPerformed?: string;
    note?: string;
    startedAt?: string;
    endedAt?: string;
    actor: MaintenanceOption;
    createdAt: string;
  }>;
  materials: Array<{
    id: number;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  costs: Array<{
    id: number;
    laborCost: number;
    materialCost: number;
    externalServiceCost: number;
    otherCost: number;
    totalCost: number;
    responsibility: string;
    tenantShareAmount: number;
    approvalStatus: string;
    note?: string;
    createdAt: string;
  }>;
  inspections: Array<{
    id: number;
    result: string;
    rating?: number;
    comment?: string;
    assetWorking: boolean;
    costConfirmed: boolean;
    inspector: MaintenanceOption;
    inspectedAt: string;
  }>;
  history: Array<{
    id: number;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    description: string;
    actor: MaintenanceOption;
    createdAt: string;
  }>;
  permissions: Record<string, boolean>;
};
export type MaintenanceCalendarItem = {
  id: number;
  requestCode: string;
  title: string;
  priority: string;
  status: string;
  propertyName: string;
  roomCode?: string;
  assigneeName?: string;
  start: string;
  end: string;
};
export type MaintenancePlan = {
  id: number;
  propertyId: number;
  propertyName: string;
  name: string;
  assetCategory: string;
  frequencyType: string;
  frequencyInterval: number;
  startDate: string;
  endDate?: string;
  assignee?: MaintenanceOption;
  reminderDaysBefore: number;
  estimatedCost: number;
  status: string;
  nextRunDate: string;
};
export type MaintenanceMaterial = {
  id: number;
  propertyId: number;
  propertyName: string;
  code: string;
  name: string;
  unit: string;
  stockQuantity: number;
  minimumQuantity: number;
  unitPrice: number;
  status: string;
};
export type MaintenanceReport = {
  totalCost: number;
  ownerCost: number;
  tenantCost: number;
  resolvedRequests: number;
  averageHours: number;
  topCategories: MaintenanceOption[];
};
export const maintenanceStatuses: Record<string, string> = {
  NEW: "Mới tiếp nhận",
  TRIAGED: "Đã phân loại",
  ASSIGNED: "Đã phân công",
  SCHEDULED: "Đã lên lịch",
  IN_PROGRESS: "Đang xử lý",
  WAITING_TENANT: "Chờ khách thuê",
  WAITING_APPROVAL: "Chờ phê duyệt",
  WAITING_PARTS: "Chờ vật tư",
  ON_HOLD: "Tạm dừng",
  COMPLETED: "Đã hoàn thành",
  INSPECTION_PENDING: "Chờ nghiệm thu",
  RESOLVED: "Đã nghiệm thu",
  REOPENED: "Mở lại",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};
export const maintenancePriorities: Record<string, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};
export const maintenanceCategories: Record<string, string> = {
  ELECTRICAL: "Điện",
  WATER: "Nước",
  INTERNET: "Internet",
  AIR_CONDITIONER: "Điều hòa",
  WATER_HEATER: "Bình nóng lạnh",
  DOOR_LOCK: "Cửa và khóa",
  FURNITURE: "Nội thất",
  APPLIANCE: "Thiết bị điện",
  STRUCTURE: "Kết cấu",
  LEAKAGE: "Thấm dột",
  SANITATION: "Vệ sinh",
  SECURITY: "An ninh",
  FIRE_SAFETY: "Phòng cháy chữa cháy",
  COMMON_AREA: "Khu vực chung",
  ELEVATOR: "Thang máy",
  OTHER: "Khác",
};
