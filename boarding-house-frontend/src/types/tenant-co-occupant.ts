export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type Overview = {
  room: {
    id: number;
    propertyName: string;
    address: string;
    buildingName?: string;
    floorName?: string;
    roomCode: string;
    roomType?: string;
    area?: number;
    currentOccupantCount: number;
    maximumOccupants: number;
    availableSlots: number;
    capacityStatus: string;
    status: string;
  };
  contract: {
    id: number;
    code: string;
    endDate: string;
    status: string;
    representativeName: string;
  };
  summary: {
    activeOccupantCount: number;
    representativeCount: number;
    coOccupantCount: number;
    pendingRequestCount: number;
    temporaryResidencePendingCount: number;
  };
  permissions: {
    canCreateOccupantRequest: boolean;
    canViewHistory: boolean;
    createDisabledReason?: string;
  };
};
export type OccupantPermissions = {
  canViewDetail: boolean;
  canRequestMoveOut: boolean;
  canAddDocuments: boolean;
};
export type OccupantRow = {
  id: number;
  tenantCode: string;
  fullName: string;
  avatarUrl?: string;
  residenceRole: string;
  moveInDate: string;
  maskedPhone?: string;
  relationship?: string;
  residenceStatus: string;
  temporaryResidenceStatus: string;
  accountStatus: string;
  profileCompleted: boolean;
  permissions: OccupantPermissions;
};
export type ResidencePeriod = {
  id: number;
  propertyName: string;
  roomCode: string;
  residenceRole: string;
  moveInDate: string;
  moveOutDate?: string;
  status: string;
  relationship?: string;
};
export type OccupantDetail = OccupantRow & {
  dateOfBirth?: string;
  gender?: string;
  maskedEmail?: string;
  occupation?: string;
  workplace?: string;
  temporaryResidence: {
    status: string;
    registeredAt?: string;
    completedAt?: string;
    expiresAt?: string;
    publicNote?: string;
  };
  history: ResidencePeriod[];
};
export type RequestPermissions = {
  canCancel: boolean;
  canUpdate: boolean;
  canSubmitAdditionalInformation: boolean;
};
export type RequestRow = {
  id: number;
  requestCode: string;
  personName: string;
  requestType: string;
  status: string;
  informationRequest?: string;
  submittedAt: string;
  updatedAt: string;
  permissions: RequestPermissions;
};
export type DocumentInfo = {
  id: number;
  documentType: string;
  originalName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  downloadable: boolean;
};
export type RequestDetail = {
  id: number;
  requestCode: string;
  requestType: string;
  status: string;
  version: number;
  submittedAt: string;
  updatedAt: string;
  person: {
    fullName: string;
    dateOfBirth?: string;
    gender?: string;
    maskedPhone?: string;
    maskedEmail?: string;
    relationship?: string;
    occupation?: string;
    workplace?: string;
    maskedIdentityNumber?: string;
    identityType?: string;
  };
  residence: {
    propertyName: string;
    roomCode: string;
    expectedMoveInDate?: string;
    expectedMoveOutDate?: string;
    reason: string;
    note?: string;
  };
  documents: DocumentInfo[];
  temporaryResidence: { status: string };
  informationRequest?: { message: string; deadline?: string };
  publicFeedback?: string;
  publicTimeline: {
    id: number;
    eventType: string;
    description: string;
    actorName?: string;
    occurredAt: string;
  }[];
  permissions: RequestPermissions;
};
export type CreateCoOccupant = {
  fullName: string;
  dateOfBirth: string;
  gender?: string;
  phone: string;
  email?: string;
  permanentAddress: string;
  hometown?: string;
  nationality?: string;
  occupation?: string;
  workplace?: string;
  relationship: string;
  emergencyContact?: { fullName: string; phone: string; relationship: string };
  identityDocument: {
    type: string;
    number: string;
    issuedDate?: string;
    expiresDate?: string;
    issuedPlace?: string;
  };
  expectedMoveInDate: string;
  expectedMoveOutDate?: string;
  previousAddress?: string;
  reason: string;
  note?: string;
  requestAccount: boolean;
};
