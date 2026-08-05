export type AdminContractStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "TERMINATION_REQUESTED"
  | "TERMINATED"
  | "CANCELLED";

export interface AdminContractSummary {
  total: number;
  active: number;
  expiring: number;
  pendingConfirmation: number;
  terminationRequested: number;
  ended: number;
}

export interface AdminContractPropertyOption {
  id: number;
  name: string;
}

export interface AdminContractRow {
  id: number;
  contractCode: string;
  tenantId: number;
  tenantCode: string;
  tenantName: string;
  tenantPhone: string | null;
  propertyId: number;
  propertyName: string;
  roomId: number;
  roomCode: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  daysRemaining: number;
  status: AdminContractStatus;
  hasDocument: boolean;
  updatedAt: string | null;
}

export interface AdminContractPage {
  content: AdminContractRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AdminContractListData {
  summary: AdminContractSummary;
  properties: AdminContractPropertyOption[];
  page: AdminContractPage;
}

export interface AdminContractFilters {
  keyword?: string;
  propertyId?: number;
  status?: AdminContractStatus;
  startDateFrom?: string;
  endDateTo?: string;
  sort?: string;
  direction?: "asc" | "desc";
  page?: number;
  size?: number;
}

export interface AdminContractDetail extends AdminContractRow {
  contractType: string;
  createdAt: string;
  signedAt: string | null;
  paymentCycle: string;
  paymentDueDay: number | null;
  noticePeriodDays: number | null;
  propertyAddress: string | null;
  buildingName: string | null;
  floorName: string | null;
  roomType: string | null;
  tenantEmail: string | null;
  maskedIdentityNumber: string | null;
  reservationAmount: number;
  managementFee: number;
  fixedServiceFee: number;
  discountAmount: number;
  occupantCount: number;
  documentCount: number;
  note: string | null;
}
