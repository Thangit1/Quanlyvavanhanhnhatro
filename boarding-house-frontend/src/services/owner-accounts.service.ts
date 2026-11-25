import { apiClient, type ApiEnvelope } from "./api-client";
export type StaffRole = "MANAGER" | "ACCOUNTANT" | "TECHNICIAN";
export type AccountRole = StaffRole | "TENANT";
export type AccountAssignment = {
  property_id: number;
  property_name: string;
  role_code: AccountRole;
  is_primary?: boolean;
  organization_name?: string | null;
  area_id?: number | null;
  area_name?: string | null;
};
export type ManagedAccount = {
  created_at?: string | null;
  must_change_password?: boolean;
  profile_status?: string | null;
  id: number | null;
  profile_id: number | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  role_code: AccountRole;
  tenant_code?: string;
  residence_status?: string | null;
  room_code?: string;
  contract_code?: string;
  assignments: AccountAssignment[];
};
export type AccountPage = {
  items: ManagedAccount[];
  total: number;
  page: number;
  size: number;
  summary: Record<string, number>;
};
export type AccountOptions = {
  organizations?: { id: number; name: string }[];
  managerAssignments: {
    property_id: number;
    manager_id: number;
    full_name: string;
    is_primary: boolean;
    area_id: number | null;
  }[];
  properties: { id: number; name: string }[];
  areas: { id: number; name: string; organization_id: number }[];
  staff: ManagedAccount[];
  emailDeliveryAvailable: boolean;
};
export type AccountDetail = {
  tasks?: {
    id: number;
    code: string;
    title: string;
    status: string;
    updated_at: string;
    property_name: string;
  }[];
  user: ManagedAccount;
  assignments: AccountAssignment[];
  capabilities: { property_id: number; capability: string }[];
  accountant?: Record<string, boolean>[];
  technician?: {
    property_id: number;
    can_update: boolean;
    can_record_cost: boolean;
  }[];
};
export type Invitation = {
  id: number;
  email: string;
  full_name: string;
  role_code: AccountRole;
  status: string;
  expires_at: string;
  created_at: string;
  tenant_profile_id: number | null;
};
export type InvitationLink = {
  id: number;
  token: string;
  delivery: string;
  expiresInHours: number;
};
export type AccountAudit = {
  id: number;
  actor_id: number | null;
  action: string;
  resource_type: string;
  resource_id: number;
  reason: string;
  occurred_at: string;
};
export const roleLabels: Record<AccountRole, string> = {
  MANAGER: "Người quản lý",
  TENANT: "Người thuê",
  ACCOUNTANT: "Kế toán",
  TECHNICIAN: "Kỹ thuật",
};
export const accountantPermissions = {
  can_issue_invoice: "Phát hành hóa đơn",
  can_record_payment: "Ghi nhận thanh toán và công nợ",
  can_review_proof: "Đối soát minh chứng thanh toán",
  can_create_voucher: "Lập phiếu chi",
  can_create_adjustment: "Điều chỉnh hóa đơn và giao dịch",
  can_close_period: "Khóa kỳ kế toán",
  can_reopen_period: "Mở lại kỳ kế toán",
  can_approve_refund: "Phê duyệt hoàn cọc (ủy quyền riêng)",
};
export const technicianPermissions = {
  MAINTENANCE_UPDATE: "Cập nhật công việc được giao",
  MAINTENANCE_COST: "Ghi nhận vật tư và đề xuất chi phí",
};
const root = "/owner/accounts";
export const ownerAccountsService = {
  async list(
    params: {
      propertyId?: number;
      areaId?: number;
      organizationId?: number;
      role?: string;
      keyword?: string;
      status?: string;
      page?: number;
      size?: number;
    },
    signal?: AbortSignal,
  ) {
    return (
      await apiClient.get<ApiEnvelope<AccountPage>>(root, { params, signal })
    ).data.data;
  },
  async options(signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<AccountOptions>>(`${root}/options`, {
        signal,
      })
    ).data.data;
  },
  async detail(user: number, role: StaffRole, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<AccountDetail>>(`${root}/${user}`, {
        params: { role },
        signal,
      })
    ).data.data;
  },
  async assign(
    user: number,
    payload: {
      role: StaffRole;
      propertyIds: number[];
      areaId: number | null;
      capabilities: string[];
      primary: boolean;
      reason: string;
    },
  ) {
    await apiClient.put(`${root}/${user}/assignments`, payload);
  },
  async revoke(
    user: number,
    role: StaffRole,
    property: number,
    reason: string,
  ) {
    await apiClient.post(
      `${root}/${user}/assignments/${property}/revoke`,
      { reason },
      { params: { role } },
    );
  },
  async status(user: number, status: "ACTIVE" | "LOCKED", reason: string) {
    await apiClient.put(`${root}/${user}/status`, { status, reason });
  },
  async invitations(signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<Invitation[]>>(`${root}/invitations`, {
        signal,
      })
    ).data.data;
  },
  async invite(payload: {
    email: string;
    fullName: string;
    role: AccountRole;
    tenantProfileId: number | null;
    reason: string;
  }) {
    return (
      await apiClient.post<ApiEnvelope<InvitationLink>>(
        `${root}/invitations`,
        payload,
      )
    ).data.data;
  },
  async resend(id: number, reason: string) {
    return (
      await apiClient.post<ApiEnvelope<InvitationLink>>(
        `${root}/invitations/${id}/resend`,
        { reason },
      )
    ).data.data;
  },
  async revokeInvitation(id: number, reason: string) {
    await apiClient.post(`${root}/invitations/${id}/revoke`, { reason });
  },
  async accept(token: string, password?: string) {
    await apiClient.post("/auth/invitations/accept", { token, password });
  },
  async history(page: number, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<AccountAudit[]>>(`${root}/history`, {
        params: { page },
        signal,
      })
    ).data.data;
  },
};
