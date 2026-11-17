import { apiClient, type ApiEnvelope } from "./api-client";

export type Organization = {
  id: number;
  code: string;
  name: string;
  description: string | null;
};
export type ManagementArea = Organization & {
  status: "ACTIVE" | "INACTIVE";
  version: number;
};
export type OrganizationRelationship = {
  id: number;
  property_id: number;
  property_name: string;
  area_id: number | null;
  area_name: string | null;
  agreement_reference: string;
  effective_from: string;
  ended_at: string | null;
  version: number;
};
export type OrganizationDetail = {
  organization: Organization;
  areas: ManagementArea[];
  relationships: OrganizationRelationship[];
  availableProperties: { id: number; name: string }[];
};
export type OrganizationAudit = {
  id: number;
  actor_id: number | null;
  action: string;
  reason: string;
  occurred_at: string;
};
const root = "/owner/organizations";
export const organizationService = {
  async setup() {
    return (await apiClient.post<ApiEnvelope<number>>(`${root}/setup`)).data
      .data;
  },
  async update(
    id: number,
    payload: { code: string; name: string; description: string },
  ) {
    await apiClient.put(`${root}/${id}`, payload);
  },
  async list(signal?: AbortSignal) {
    return (await apiClient.get<ApiEnvelope<Organization[]>>(root, { signal }))
      .data.data;
  },
  async detail(id: number, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<OrganizationDetail>>(`${root}/${id}`, {
        signal,
      })
    ).data.data;
  },
  async create(payload: { code: string; name: string; description: string }) {
    return (await apiClient.post<ApiEnvelope<number>>(root, payload)).data.data;
  },
  async saveArea(
    id: number,
    area: number | null,
    payload: {
      code: string;
      name: string;
      description: string;
      status: "ACTIVE" | "INACTIVE";
      version: number;
      reason: string;
    },
  ) {
    if (area) await apiClient.put(`${root}/${id}/areas/${area}`, payload);
    else await apiClient.post(`${root}/${id}/areas`, payload);
  },
  async link(
    id: number,
    payload: {
      propertyId: number;
      areaId: number | null;
      agreementReference: string;
      effectiveFrom: string;
      reason: string;
    },
  ) {
    await apiClient.post(`${root}/${id}/properties`, payload);
  },
  async move(
    id: number,
    relationship: number,
    payload: { areaId: number | null; version: number; reason: string },
  ) {
    await apiClient.put(
      `${root}/${id}/relationships/${relationship}/area`,
      payload,
    );
  },
  async end(
    id: number,
    relationship: number,
    payload: { version: number; reason: string },
  ) {
    await apiClient.post(
      `${root}/${id}/relationships/${relationship}/end`,
      payload,
    );
  },
  async history(id: number, page: number, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiEnvelope<OrganizationAudit[]>>(
        `${root}/${id}/history`,
        { params: { page }, signal },
      )
    ).data.data;
  },
};
