export type SettingSection =
  | "overview"
  | "general"
  | "profile"
  | "organization"
  | "properties"
  | "rental"
  | "contracts"
  | "billing"
  | "utilities"
  | "payments"
  | "notifications"
  | "security"
  | "ai"
  | "integrations"
  | "audit-logs";

export interface SettingPermissions {
  canEditGeneral: boolean;
  canEditBilling: boolean;
  canEditSecurity: boolean;
  canManageIntegrations: boolean;
  canManageBackup: boolean;
  canViewAuditLogs: boolean;
  canEditProperty: boolean;
}
export interface PropertyOption {
  id: number;
  name: string;
}
export interface SettingOverview {
  systemName: string;
  logoUrl: string | null;
  defaultLanguage: string;
  timezone: string;
  currency: string;
  configuredIntegrations: Record<string, boolean>;
  security: Record<string, boolean>;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
  permissions: SettingPermissions;
  properties: PropertyOption[];
}
export interface GeneralSettings {
  systemName: string;
  supportEmail: string;
  supportPhone: string;
  defaultLanguage: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  logoUrl: string | null;
}
export interface GroupSettings {
  group: string;
  values: Record<string, unknown>;
  editable: boolean;
}
export interface PropertySettings {
  propertyId: number;
  propertyName: string;
  propertyCode: string;
  address: string;
  managerName: string | null;
  managerPhone: string | null;
  managerEmail: string | null;
  workingHours: string | null;
  billingDay: number;
  paymentDueDay: number;
  meterReadingDay: number;
  defaultMaximumOccupants: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  allowPets: boolean;
  allowVisitors: boolean;
  visitorRules: string | null;
  vehicleRules: string | null;
  houseRules: string | null;
  emergencyContact: string | null;
}
export interface BillingSettings {
  autoGenerateInvoices: boolean;
  invoiceGenerationDay: number;
  defaultDueDay: number;
  allowPartialPayment: boolean;
  carryForwardDebt: boolean;
  lateFeeEnabled: boolean;
  lateFeeType: string;
  lateFeeValue: number;
  reminderDaysBeforeDue: number[];
  reminderDaysAfterDue: number[];
  requireCancellationReason: boolean;
}
export interface AiSettings {
  provider: string | null;
  model: string | null;
  enabled: boolean;
  configured: boolean;
  connectionStatus: string;
  features: Record<string, boolean>;
  monthlyRequestLimit: number;
  responseLanguage: string;
  requestTimeoutSeconds: number;
  storeConversationHistory: boolean;
  historyRetentionDays: number;
  requireActionConfirmation: boolean;
}
export interface AuditLog {
  id: number;
  userId: number;
  userName: string;
  settingGroup: string;
  scopeType: string;
  scopeId: number | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  result: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
export interface AuditPage {
  content: AuditLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface ConnectionTest {
  connected: boolean;
  message: string;
}
export type SettingData =
  | GeneralSettings
  | GroupSettings
  | PropertySettings
  | BillingSettings
  | AiSettings;
