export type NotificationPage<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  unreadCount: number;
};
export type NotificationSummary = {
  totalUnread: number;
  requiresActionCount: number;
  invoiceNotificationCount: number;
  maintenanceNotificationCount: number;
  currentMonthNotificationCount: number;
};
export type NotificationPermissions = {
  canMarkRead: boolean;
  canMarkUnread: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canAcknowledge: boolean;
  canOpenReference: boolean;
};
export type NotificationReference = { type: string; id: number };
export type NotificationAction = {
  type: string;
  label: string;
  primary: boolean;
};
export type TenantNotification = {
  id: number;
  notificationCode: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
  archived: boolean;
  requiresAction: boolean;
  requiresAcknowledgement: boolean;
  place?: { propertyName?: string; roomCode?: string };
  reference?: NotificationReference;
  primaryAction?: NotificationAction;
  permissions: NotificationPermissions;
};
export type NotificationDetail = Omit<
  TenantNotification,
  "summary" | "primaryAction"
> & {
  content: string;
  acknowledgedAt?: string;
  expiresAt?: string;
  actions: NotificationAction[];
  version: number;
};
export type NotificationQuery = {
  keyword?: string;
  category?: string;
  severity?: string;
  readStatus?: string;
  requiresAction?: boolean;
  archived?: boolean;
  startDate?: string;
  endDate?: string;
  sort?: string;
  page: number;
  size: number;
};
export type NotificationPreferences = {
  inApp: boolean;
  email: boolean;
  availableChannels: string[];
  categories: Record<string, boolean>;
  digestMode: string;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  version: number;
};
