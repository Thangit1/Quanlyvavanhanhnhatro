export type ContractStatus =
  | "PENDING_CONFIRMATION"
  | "ACTIVE"
  | "EXPIRING"
  | "EXPIRED"
  | "TERMINATION_REQUESTED"
  | "TERMINATED"
  | "CANCELLED";

export interface ContractSummary {
  id: number;
  contractCode: string;
  propertyName: string;
  propertyAddress: string;
  roomCode: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  daysRemaining: number;
  tenantRole: string;
  status: ContractStatus;
  hasDocument: boolean;
  canRequestExtension: boolean;
  canRequestTermination: boolean;
}
export interface ContractPage {
  content: ContractSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface ContractRequestInfo {
  id: number;
  status: string;
  requestedDate: string;
  note: string | null;
  createdAt: string;
}
export interface ContractDetail {
  id: number;
  contractCode: string;
  contractType: string;
  status: ContractStatus;
  createdAt: string;
  signedAt: string | null;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  paymentCycle: string;
  paymentDueDay: number;
  noticePeriodDays: number;
  property: {
    id: number;
    name: string;
    address: string;
    buildingName: string | null;
    floorName: string | null;
  };
  room: {
    id: number;
    roomCode: string;
    roomType: string | null;
    area: number | null;
    maximumOccupants: number;
    currentOccupants: number;
    imageUrl: string | null;
    status: string;
  };
  landlord: {
    fullName: string;
    phone: string | null;
    email: string;
    address: string;
  };
  tenant: {
    fullName: string;
    phone: string | null;
    email: string;
    maskedIdentityNumber: string | null;
    role: string;
  };
  financial: {
    monthlyRent: number;
    depositAmount: number;
    reservationAmount: number;
    managementFee: number;
    fixedServiceFee: number;
    discountAmount: number;
  };
  utilityRates: RateInfo[];
  services: ServiceInfo[];
  occupants: OccupantInfo[];
  assets: AssetInfo[];
  terms: TermInfo[];
  documents: DocumentInfo[];
  history: HistoryInfo[];
  extensionRequest: ContractRequestInfo | null;
  terminationRequest: ContractRequestInfo | null;
  permissions: {
    canDownload: boolean;
    canPrint: boolean;
    canRequestExtension: boolean;
    canRequestTermination: boolean;
  };
}
export interface RateInfo {
  id: number;
  code: string;
  name: string;
  calculationMethod: string;
  unitPrice: number;
  unit: string;
  effectiveDate: string;
}
export interface ServiceInfo {
  id: number;
  code: string;
  name: string;
  calculationMethod: string;
  unitPrice: number;
  billingCycle: string;
  effectiveDate: string;
}
export interface OccupantInfo {
  id: number;
  fullName: string;
  relationship: string | null;
  moveInDate: string;
  residenceStatus: string;
  temporaryResidenceStatus: string;
  maskedIdentityNumber: string | null;
}
export interface AssetInfo {
  id: number;
  name: string;
  quantity: number;
  handoverCondition: string;
  note: string | null;
  imageUrl: string | null;
}
export interface TermInfo {
  id: number;
  title: string;
  content: string;
  displayOrder: number;
}
export interface DocumentInfo {
  id: number;
  originalName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string | null;
  downloadable: boolean;
}
export interface HistoryInfo {
  id: number;
  eventType: string;
  description: string;
  actorName: string | null;
  note: string | null;
  occurredAt: string;
}
export interface ExtensionPayload {
  requestedEndDate: string;
  note?: string;
}
export interface TerminationPayload {
  expectedMoveOutDate: string;
  reason: string;
  note?: string;
  contactPhone: string;
}
export interface RequestCreated {
  id: number;
  status: string;
  message: string;
}
