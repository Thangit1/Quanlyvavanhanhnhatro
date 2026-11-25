import { apiClient, type ApiEnvelope } from "./api-client";
export type UtilityRecord = Record<string, string | number | boolean | null>;
export type UtilityRow = {
  id: number;
  code: string;
  room_id: number;
  room_code: string;
  tenant_name: string | null;
  canWrite: boolean;
  locked?: boolean;
  error?: string;
  comparison?: UtilityRecord;
  policies?: (UtilityRecord & {
    code: string;
    calculation_method: string;
    effectivePrice: number;
    unit: string;
  })[];
  replacements?: (UtilityRecord & {
    meter_id: number;
    removed_reading: number | null;
    new_reading: number | null;
  })[];
  detail?: {
    reading: UtilityRecord | null;
    previous: Record<string, number | string>;
    meters: UtilityRecord[];
    revisions: UtilityRecord[];
    rateHistory: UtilityRecord[];
    services: UtilityRecord[];
    rates: UtilityRecord[];
  };
};
export type UtilityWorkspace = {
  warningPolicy?: {
    highMultiplier: number;
    warnZero: boolean;
    version: number;
  };
  propertyId: number;
  period: string;
  canWrite: boolean;
  rows: UtilityRow[];
};
export type UtilityDraft = {
  version: number;
  electricity: string;
  water: string;
  reference: string;
  reason: string;
  confirmWarnings: boolean;
};
export type UtilityResult = {
  index: number;
  contractId: number;
  success: boolean;
  code?: string;
  message?: string;
  reading?: UtilityRecord;
};
export const utilityWorkspaceService = {
  async warningPolicy(payload: {
    propertyId: number;
    version: number;
    highMultiplier: number;
    warnZero: boolean;
    reason: string;
  }) {
    await apiClient.post(
      "/admin/monthly-billing/workspace/warning-policy",
      payload,
    );
  },
  async load(
    propertyId: number,
    period: string,
    signal?: AbortSignal,
    portal = "admin",
  ) {
    return (
      await apiClient.get<ApiEnvelope<UtilityWorkspace>>(
        `/${portal}/monthly-billing/workspace`,
        { params: { propertyId, period }, signal },
      )
    ).data.data;
  },
  async save(
    rows: {
      contractId: number;
      reading: {
        period: string;
        version: number;
        electricity?: number;
        water?: number;
        reference: string;
        reason: string;
        confirmWarnings: boolean;
      };
    }[],
  ) {
    return (
      await apiClient.post<ApiEnvelope<UtilityResult[]>>(
        "/admin/monthly-billing/workspace/readings",
        { rows },
      )
    ).data.data;
  },
};
