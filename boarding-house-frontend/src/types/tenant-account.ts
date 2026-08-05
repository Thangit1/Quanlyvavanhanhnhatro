export type AccountProfile = {
  id: number;
  tenantCode: string;
  fullName: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  occupation?: string;
  workplace?: string;
  profileStatus: string;
  completionPercent: number;
  missingFields: string[];
  version: number;
};
export type TenantAccountOverview = {
  account: {
    id: number;
    username: string;
    email: string;
    emailVerified: boolean;
    phone?: string;
    phoneVerified: boolean;
    status: string;
    role: string;
    createdAt: string;
    lastLoginAt?: string;
  };
  profile: AccountProfile;
  residence?: {
    propertyId: number;
    propertyName: string;
    address: string;
    buildingName?: string;
    floorName?: string;
    roomId?: number;
    roomCode?: string;
    residenceRole: string;
    residenceStatus: string;
    moveInDate: string;
    temporaryResidenceStatus: string;
  };
  contract?: {
    id: number;
    contractCode: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  security: {
    twoFactorSupported: boolean;
    twoFactorEnabled: boolean;
    activeSessionCount: number;
    passwordChangedAt?: string;
    currentDevice: string;
  };
  pendingActions: {
    documentCount: number;
    profileUpdateRequestCount: number;
    temporaryResidenceActionCount: number;
  };
  permissions: {
    canEditProfile: boolean;
    canChangePassword: boolean;
    canManageSessions: boolean;
    canUploadDocuments: boolean;
    canRequestAccountDeactivation: boolean;
  };
};
export type TenantProfile = {
  profile: AccountProfile;
  phone?: string;
  contactEmail?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  permanentAddress?: string;
  emergencyContact: {
    fullName?: string;
    relationship?: string;
    phone?: string;
    address?: string;
  };
  accountStatus: string;
  residenceRole?: string;
  roomCode?: string;
  contractCode?: string;
  temporaryResidenceStatus?: string;
  residenceStartDate?: string;
};
export type UpdateProfilePayload = {
  occupation?: string;
  workplace?: string;
  phone?: string;
  contactEmail?: string;
  addressDetail?: string;
  emergencyContact: {
    fullName?: string;
    relationship?: string;
    phone?: string;
    address?: string;
  };
  version: number;
};
export type ProfileUpdateRequest = {
  id: number;
  status: string;
  reason: string;
  note?: string;
  publicResponse?: string;
  createdAt: string;
  reviewedAt?: string;
};
export type TenantDocument = {
  id: number;
  documentType: string;
  maskedNumber?: string;
  originalName: string;
  contentType: string;
  fileSize: number;
  issueDate?: string;
  expiresAt?: string;
  verificationStatus: string;
  publicNote?: string;
  documentSide: string;
  uploadedAt: string;
  version: number;
};
export type TenantSession = {
  id: number;
  deviceName: string;
  browser: string;
  operatingSystem: string;
  maskedIpAddress: string;
  currentSession: boolean;
  active: boolean;
  createdAt: string;
  lastActiveAt: string;
};
export type AccountPreferences = {
  language: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  reducedMotion: boolean;
  version: number;
};
export type AccountActivity = {
  id: number;
  action: string;
  description: string;
  createdAt: string;
  targetUrl?: string;
};
export type AccountPage<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type SupportInfo = {
  phone?: string;
  email?: string;
  workingHours: string;
  attachmentSupported: boolean;
};
