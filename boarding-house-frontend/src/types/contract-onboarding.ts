export type OnboardingRow = Record<string, string | number | boolean | null>;
export type HandoverDocument = {
  id: number;
  version: number;
  code: string;
  contentHash: string;
  createdAt: string;
  current: boolean;
  latest: boolean;
  integrityValid: boolean;
  liveHash: string;
  status: "SUPERSEDED" | "CHANGED" | "BOTH_CONFIRMED" | "WAITING_CONFIRMATION";
  changes: { key: string; label: string }[];
  confirmations: OnboardingRow[];
  snapshot: {
    schemaVersion: number | string;
    general: OnboardingRow;
    readings: OnboardingRow;
    keysCardsCount: number | string;
    assets: OnboardingRow[];
    meters: OnboardingRow[];
    utilities: OnboardingRow[];
  };
};
export type ConfirmationProgress = {
  stage: string;
  contentCurrent: boolean;
  ownParty: "TENANT" | "LANDLORD" | null;
  ownConfirmed: boolean;
  confirmedByCurrentActor: boolean;
  tenant: {
    confirmed: boolean;
    actorId?: number;
    actorName?: string;
    confirmedAt?: string;
  };
  landlord: {
    confirmed: boolean;
    actorId?: number;
    actorName?: string;
    confirmedAt?: string;
  };
  bothConfirmed: boolean;
  handoverConfirmed: boolean;
  checkinCompleted: boolean;
  canConfirm: boolean;
  canRevise: boolean;
  canVerifyIdentity: boolean;
  canManageHandover: boolean;
  canReadFinance: boolean;
  canWriteFinance: boolean;
  canApproveDeposit: boolean;
  canCreateInitialInvoice: boolean;
  canCompleteCheckin: boolean;
  checklist: { key: string; label: string; completed: boolean }[];
  completedCount: number;
};
export type OnboardingDetail = {
  handoverDocument?: HandoverDocument | null;
  handoverPolicy?: { maxKeysCards: number };
  handoverContextHash?: string;
  identityProfile?: {
    fields: { key: string; label: string; present: boolean }[];
    complete: boolean;
    canEdit: boolean;
    dataHash: string;
    full_name: string | null;
    date_of_birth: string | null;
    phone: string | null;
    identity_type: string | null;
    identity_number: string | null;
    permanent_address: string | null;
    verification: OnboardingRow | null;
  } | null;
  procedureSteps?: {
    key: string;
    label: string;
    status: string;
    description: string;
    completedAt: string | null;
    anchor: string;
  }[];
  nextAction?: string;
  financialSummary?: {
    rentEstimate: number | null;
    depositRequired: number;
    depositCollected: number | null;
    depositSatisfied: boolean;
    initialPaymentRequired: boolean;
    initialPolicySatisfied: boolean;
    recordedInvoices: OnboardingRow[];
    recordedItems: OnboardingRow[];
  } | null;
  draft: OnboardingRow;
  context: OnboardingRow;
  progress: ConfirmationProgress;
  services: OnboardingRow[];
  terms: OnboardingRow[];
  monthlyRent: number | null;
  serviceEstimate?: OnboardingRow;
  identityVerified: boolean;
  contractConfirmed: boolean;
  initialPaymentSatisfied: boolean;
  initialPaymentRequired: boolean;
  initialInvoiceId: number | null;
  contractVersion: OnboardingRow | null;
  handoverVersion?: OnboardingRow | null;
  handoverContentCurrent?: boolean;
  checkin: OnboardingRow | null;
  contractConfirmations: OnboardingRow[];
  handoverConfirmations?: OnboardingRow[];
  utilityRates: OnboardingRow[];
  assets?: OnboardingRow[];
  meters: OnboardingRow[];
  deposit: OnboardingRow | null;
  initialInvoiceOptions: OnboardingRow[];
  initialInvoice: OnboardingRow | null;
  initialDraftInvoice: OnboardingRow | null;
  confirmationNotice: string;
};

export const onboardingStageLabel: Record<string, string> = {
  DRAFT: "Bản nháp — chưa gửi xác nhận",
  CONTENT_REVIEW_REQUIRED: "Nội dung đã thay đổi — cần chốt phiên bản mới",
  WAITING_TENANT: "Chờ người thuê xác nhận",
  WAITING_LANDLORD: "Chờ bên cho thuê xác nhận",
  WAITING_IDENTITY: "Chờ hoàn thiện hồ sơ",
  WAITING_FINANCE: "Chờ hoàn tất tài chính",
  WAITING_HANDOVER: "Chờ bàn giao phòng",
  READY_FOR_CHECKIN: "Sẵn sàng kiểm tra và hoàn tất nhận phòng",
  ACTIVE: "Đang hiệu lực",
  WAITING_CHECKIN_DATE: "Chờ đến ngày nhận phòng",
  EXPIRING: "Đang hiệu lực — sắp hết hạn",
  EXPIRED: "Hợp đồng hết hạn",
  TERMINATED: "Đã chấm dứt",
  SETTLING: "Đang quyết toán",
  CANCELLED: "Đã hủy",
  TERMINATION_REQUESTED: "Đang yêu cầu chấm dứt",
};
