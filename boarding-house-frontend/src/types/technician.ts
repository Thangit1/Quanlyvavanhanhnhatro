export type TaskStatus =
  | "NEW_ASSIGNMENT"
  | "ASSIGNED"
  | "ACCEPTED"
  | "DECLINED"
  | "SCHEDULED"
  | "TRAVELING"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "WAITING_TENANT"
  | "WAITING_PARTS"
  | "WAITING_APPROVAL"
  | "COMPLETED"
  | "INSPECTION_PENDING"
  | "RESOLVED"
  | "REOPENED"
  | "CANCELLED";
export interface Option {
  id: number;
  code?: string | null;
  name: string;
  detail?: string | null;
}
export interface TaskPermissions {
  canAccept: boolean;
  canDecline: boolean;
  canStartTravel: boolean;
  canCheckIn: boolean;
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canUpdateProgress: boolean;
  canAddDiagnosis: boolean;
  canRequestMaterial: boolean;
  canProposeCost: boolean;
  canAddAttachment: boolean;
  canComplete: boolean;
  canRequestTransfer: boolean;
}
export interface TaskRow {
  id: number;
  taskCode: string;
  requestCode: string;
  title: string;
  category: string;
  priority: string;
  taskType: string;
  assignmentRole: string;
  property: Option;
  room?: Option | null;
  asset?: Option | null;
  scheduledStart?: string | null;
  estimatedDurationMinutes: number;
  slaDueAt?: string | null;
  overdue: boolean;
  tenantPresenceRequired: boolean;
  status: TaskStatus;
  progressPercent: number;
  version: number;
  permissions: TaskPermissions;
}
export interface Technician {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  expertise?: string | null;
  workingArea?: string | null;
  workSchedule?: string | null;
  workingStatus: string;
  version: number;
}
export interface Dashboard {
  technician: Technician;
  summary: {
    todayTaskCount: number;
    inProgressTaskCount: number;
    urgentTaskCount: number;
    overdueTaskCount: number;
    waitingPartsTaskCount: number;
    inspectionPendingCount: number;
    completedThisMonthCount: number;
    onTimeCompletionRate: number;
  };
  currentTask?: TaskRow | null;
  nextTasks: TaskRow[];
  urgentTasks: TaskRow[];
  pendingActions: string[];
  recentNotifications: NotificationRow[];
  aiAvailable: boolean;
}
export interface TaskPage {
  content: TaskRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface TaskDetail {
  task: TaskRow;
  description: string;
  safetyRisk: boolean;
  tenantContact?: {
    fullName?: string;
    phone?: string;
    availableTime?: string;
    tenantPresenceRequired: boolean;
    accessNote?: string;
    petsPresent: boolean;
  };
  schedule?: ScheduleItem | null;
  diagnosis?: Diagnosis | null;
  checklist: ChecklistItem[];
  workLogs: WorkLog[];
  materials: MaterialUsage[];
  costs: Cost[];
  attachments: Attachment[];
  messages: MessageRow[];
  inspection?: Inspection | null;
  history: History[];
  permissions: TaskPermissions;
}
export interface ScheduleItem {
  id: number;
  start: string;
  end: string;
  durationMinutes: number;
  tenantPresenceRequired: boolean;
  status: string;
}
export interface Diagnosis {
  id: number;
  observedCondition: string;
  symptoms?: string;
  preliminaryCause?: string;
  rootCause?: string;
  damageLevel: string;
  assetUsable: boolean;
  safetyRisk: boolean;
  replacementRequired: boolean;
  supportRequired: boolean;
  externalVendorRequired: boolean;
  recommendedSolution: string;
  updatedAt: string;
}
export interface ChecklistItem {
  id: number;
  label: string;
  required: boolean;
  result?: string | null;
  note?: string | null;
  displayOrder: number;
}
export interface WorkLog {
  id: number;
  activityType: string;
  description: string;
  result?: string;
  progressPercent: number;
  durationMinutes: number;
  note?: string;
  createdAt: string;
}
export interface MaterialUsage {
  id: number;
  materialId?: number;
  code?: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  status: string;
  usedQuantity: number;
  returnedQuantity: number;
  createdAt: string;
}
export interface Cost {
  id: number;
  laborCost: number;
  materialCost: number;
  externalServiceCost: number;
  otherCost: number;
  totalCost: number;
  responsibility: string;
  approvalStatus: string;
  note?: string;
  createdAt: string;
}
export interface Attachment {
  id: number;
  type: string;
  name: string;
  mimeType: string;
  size: number;
  caption?: string;
  url: string;
  createdAt: string;
}
export interface MessageRow {
  id: number;
  senderName: string;
  senderRole: string;
  content: string;
  internal: boolean;
  createdAt: string;
}
export interface History {
  id: number;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  description: string;
  createdAt: string;
}
export interface Inspection {
  result: string;
  rating?: number;
  comment?: string;
  assetWorking: boolean;
  costConfirmed: boolean;
  inspectorName: string;
  inspectedAt: string;
}
export interface CalendarItem {
  id: number;
  taskCode: string;
  title: string;
  priority: string;
  status: TaskStatus;
  propertyName: string;
  roomCode?: string;
  start?: string;
  end?: string;
}
export interface PreventivePlan {
  id: number;
  propertyName: string;
  name: string;
  assetCategory: string;
  frequencyType: string;
  frequencyInterval: number;
  nextRunDate: string;
  status: string;
  estimatedCost: number;
}
export interface Asset {
  id: number;
  assetCode?: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  condition: string;
  propertyName: string;
  roomCode: string;
  installedAt?: string;
  warrantyExpiry?: string;
  lastMaintainedAt?: string;
  maintenanceCount: number;
}
export interface MaterialCatalog {
  id: number;
  code: string;
  name: string;
  unit: string;
  stockQuantity: number;
  minimumQuantity: number;
  unitPrice: number;
  propertyName: string;
  status: string;
}
export interface MaterialRequestRow {
  id: number;
  taskCode: string;
  taskTitle: string;
  urgency: string;
  status: string;
  neededAt?: string;
  note?: string;
  createdAt: string;
  items: MaterialUsage[];
  version: number;
}
export interface NotificationRow {
  id: number;
  title: string;
  content: string;
  type: string;
  read: boolean;
  createdAt: string;
}
export interface MetricPoint {
  label: string;
  value: number;
}
export interface Performance {
  assignedTasks: number;
  completedTasks: number;
  onTimeTasks: number;
  overdueTasks: number;
  firstPassTasks: number;
  reopenedTasks: number;
  averageResolutionHours: number;
  waitingPartsHours: number;
  urgentTasks: number;
  averageRating: number;
  trend: MetricPoint[];
  categories: MetricPoint[];
}
export interface Account {
  technician: Technician;
  costLimit: number;
  notifyAssignment: boolean;
  notifySchedule: boolean;
  notifyUrgent: boolean;
  notifyMaterial: boolean;
  sessions: {
    id: number;
    userAgent?: string;
    ipAddress?: string;
    createdAt: string;
    lastActiveAt: string;
    active: boolean;
  }[];
}
export interface TaskFilters {
  keyword?: string;
  status?: string;
  priority?: string;
  category?: string;
  propertyId?: number;
  scheduledFrom?: string;
  scheduledTo?: string;
  overdue?: boolean;
  taskType?: string;
  page?: number;
  size?: number;
  sort?: string;
}
