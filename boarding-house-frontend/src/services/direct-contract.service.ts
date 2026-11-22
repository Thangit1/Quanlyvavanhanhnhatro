import { apiClient, type ApiEnvelope } from "./api-client";

export type TenantChoice = {
  id: number;
  full_name: string;
  tenant_code: string;
  phone: string;
  email?: string;
  has_account: boolean;
};
export type RoomChoice = {
  id: number;
  code: string;
  floor_name: string;
  area: number;
  monthly_rent: number;
  capacity: number;
  status: string;
};
export type Rate = {
  code: string;
  name: string;
  calculationMethod: "METER" | "FIXED";
  unitPrice: number;
  unit: string;
};
export type Service = {
  code: string;
  name: string;
  calculationMethod: "FIXED" | "PER_PERSON" | "QUANTITY" | "USAGE" | "ONCE";
  unitPrice: number;
  catalogServiceId?: number;
  description?: string;
  unit?: string;
  quantity?: number;
  billingCycle?: "MONTHLY" | "ON_USAGE" | "ONCE";
  effectiveDate?: string;
  endDate?: string;
  status?: "ACTIVE" | "INACTIVE";
  note?: string;
  prorate?: boolean;
};
export type NewTenant = {
  fullName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  identityNumber?: string;
  permanentAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};
export type DirectContractRequest = {
  roomId: number;
  tenantProfileId?: number;
  newTenant?: NewTenant;
  terms: {
    startDate: string;
    endDate: string;
    depositAmount: number;
    paymentDueDay: number;
    noticePeriodDays: number;
    monthlyRent: number;
    reservationTransferAmount: number;
    utilityRates: Rate[];
    services: Service[];
    terms: { title: string; content: string }[];
    initialPaymentRequired: boolean;
  };
  expectedCheckinDate: string;
  note?: string;
  submit: boolean;
};
export type DirectDraft = {
  status?: string;
  contentHash?: string;
  propertyId: number;
  tenant: TenantChoice;
  version: number;
  request: DirectContractRequest;
};
export type CreationOptions = {
  properties: {
    id: number;
    name: string;
    address: string;
    owner_name: string;
  }[];
  rooms: RoomChoice[];
  tenants: TenantChoice[];
  services: {
    code: string;
    name: string;
    calculation_method: Service["calculationMethod"];
    unit_price: number;
  }[];
};
export type SubmissionResult = {
  id: number;
  status: string;
  continuationCode?: string;
  continuationMessage?: string;
};
export const directContractService = {
  async options(propertyId?: number, keyword?: string, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<CreationOptions>>(
        "/admin/contracts/creation-options",
        { params: { propertyId, keyword }, signal },
      )
    ).data.data;
  },
  async draft(id: number, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<DirectDraft>>(
        `/admin/contracts/${id}/draft`,
        { signal },
      )
    ).data.data;
  },
  async agreement(id: number, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<DirectDraft>>(
        `/admin/contracts/${id}/agreement`,
        { signal },
      )
    ).data.data;
  },
  async save(
    request: DirectContractRequest,
    key: string,
    draftId?: number,
    version?: number,
    contentHash?: string,
    agreement = false,
  ) {
    if (agreement && draftId) {
      await apiClient.put(`/admin/contract-onboarding/${draftId}/terms`, {
        terms: request.terms,
        reason: request.note || "Cập nhật nội dung theo thỏa thuận",
        version,
        contentHash,
      });
      return {
        id: draftId,
        status: "PENDING_CONFIRMATION",
      } as SubmissionResult;
    }
    const response = draftId
      ? await apiClient.put<ApiEnvelope<SubmissionResult>>(
          `/admin/contracts/${draftId}/draft`,
          request,
          { params: { version } },
        )
      : await apiClient.post<ApiEnvelope<SubmissionResult>>(
          "/admin/contracts",
          request,
          { headers: { "Idempotency-Key": key } },
        );
    return response.data.data;
  },
  async submit(id: number) {
    return (
      await apiClient.post<ApiEnvelope<SubmissionResult>>(
        `/admin/contracts/${id}/submit`,
      )
    ).data.data;
  },
};
