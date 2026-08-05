export interface PropertyOption {
  id: number;
  name: string;
}
export interface RoomOption {
  id: number;
  propertyId: number;
  code: string;
  buildingName: string | null;
  floorName: string | null;
  monthlyRent: number;
  capacity: number;
  status: string;
}
export interface TenantSummary {
  total: number;
  active: number;
  expiringContracts: number;
  overdueDebt: number;
  movedOut: number;
  temporaryRegistered: number;
  temporaryPending: number;
  noAccount: number;
}
export interface TenantRow {
  id: number;
  tenantCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  propertyName: string;
  roomCode: string | null;
  buildingName: string | null;
  residenceRole: string;
  status: string;
  contractCode: string | null;
  contractEndDate: string | null;
  outstandingDebt: number;
  temporaryResidenceStatus: string;
  hasAccount: boolean;
  accountStatus: string | null;
}
export interface TenantPage {
  items: TenantRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface TenantListData {
  properties: PropertyOption[];
  rooms: RoomOption[];
  summary: TenantSummary;
  page: TenantPage;
}
export interface Residence {
  id: number;
  propertyId: number;
  propertyName: string;
  roomId: number | null;
  roomCode: string | null;
  buildingName: string | null;
  contractId: number | null;
  contractCode: string | null;
  residenceRole: string;
  status: string;
  moveInDate: string;
  moveOutDate: string | null;
  note: string | null;
}
export interface ContractItem {
  id: number;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
  depositAmount: number;
  outstandingDebt: number;
}
export interface InvoiceItem {
  id: number;
  code: string;
  billingPeriod: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  status: string;
}
export interface TemporaryResidenceItem {
  propertyId: number;
  propertyName: string;
  registrationCode: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  status: string;
  note: string | null;
}
export interface DocumentItem {
  id: number;
  documentType: string;
  originalName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}
export interface ActivityItem {
  id: number;
  action: string;
  description: string;
  actorName: string | null;
  createdAt: string;
}
export interface TenantDetail {
  id: number;
  tenantCode: string;
  userId: number | null;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string;
  email: string | null;
  avatarUrl: string | null;
  permanentAddress: string | null;
  occupation: string | null;
  workplace: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  identityType: string | null;
  maskedIdentityNumber: string | null;
  identityIssuedDate: string | null;
  identityIssuedPlace: string | null;
  note: string | null;
  status: string;
  hasAccount: boolean;
  accountStatus: string | null;
  residences: Residence[];
  contracts: ContractItem[];
  invoices: InvoiceItem[];
  temporaryResidences: TemporaryResidenceItem[];
  documents: DocumentItem[];
  activities: ActivityItem[];
}
export interface SaveTenantPayload {
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  phone: string;
  email?: string;
  permanentAddress?: string;
  occupation?: string;
  workplace?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  identityType?: string;
  identityNumber?: string;
  identityIssuedDate?: string;
  identityIssuedPlace?: string;
  note?: string;
  propertyId?: number;
  roomId?: number;
  contractId?: number;
  moveInDate?: string;
  residenceRole?: string;
}
export interface TenantFilters {
  propertyId?: number;
  roomId?: number;
  status?: string;
  temporaryStatus?: string;
  accountStatus?: string;
  keyword?: string;
  sort?: string;
  direction?: string;
  page?: number;
  size?: number;
}
