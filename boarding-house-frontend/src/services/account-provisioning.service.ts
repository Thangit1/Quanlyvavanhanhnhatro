import { apiClient, type ApiEnvelope } from "./api-client";
import type { AccountRole } from "./owner-accounts.service";
export type ProvisionProfile = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  user_id: number | null;
  date_of_birth: string | null;
  property_id: number | null;
  property_name: string | null;
  room_code: string | null;
  contract_code: string | null;
  account_status?: string | null;
  must_change_password?: boolean;
  account_email?: string | null;
  account_phone?: string | null;
};
export type ProvisionOptions = {
  properties: { id: number; name: string }[];
  areas: { id: number; name: string }[];
  roles: AccountRole[];
  tenantProfiles: ProvisionProfile[];
  existingAccounts: {
    id: number;
    full_name: string;
    phone: string | null;
    email: string | null;
    status: string;
  }[];
};
export type ProvisionRequest = {
  fullName: string;
  phone: string;
  email: string | null;
  roles: AccountRole[];
  initialStatus: "ACTIVE" | "INACTIVE";
  propertyIds: number[];
  areaId: number | null;
  managementPropertyId: number | null;
  tenantProfileId: number | null;
  existingUserId: number | null;
  dateOfBirth: string | null;
  permissions: Record<string, string[]>;
  primary: boolean;
  identityConfirmed: boolean;
  reason: string;
};
export type ProvisionResult = {
  id: number;
  roles: AccountRole[];
  loginIdentifier: string | null;
  initialPassword: string | null;
  linkedExisting: boolean;
  mustChangePassword: boolean;
  passwordExpiresInHours: number;
  tenantProfileId: number | null;
};
const root = "/admin/account-provisioning";
export const accountProvisioningService = {
  async options(signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<ProvisionOptions>>(`${root}/options`, {
        signal,
      })
    ).data.data;
  },
  async create(payload: ProvisionRequest) {
    return (await apiClient.post<ApiEnvelope<ProvisionResult>>(root, payload))
      .data.data;
  },
  async reset(user: number, reason: string) {
    return (
      await apiClient.post<ApiEnvelope<ProvisionResult>>(
        `${root}/${user}/reset-password`,
        { reason },
      )
    ).data.data;
  },
  async edit(
    user: number,
    payload: {
      fullName: string;
      phone: string;
      email: string | null;
      reason: string;
    },
  ) {
    await apiClient.put(`${root}/${user}`, payload);
  },
  async status(
    user: number,
    status: "ACTIVE" | "INACTIVE" | "LOCKED",
    reason: string,
  ) {
    await apiClient.put(`${root}/${user}/status`, { status, reason });
  },
  async changeInitialPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) {
    await apiClient.post("/auth/change-initial-password", payload);
  },
};
