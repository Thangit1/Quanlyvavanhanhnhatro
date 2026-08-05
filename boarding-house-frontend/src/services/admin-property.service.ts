import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  PropertyDetail,
  PropertyFilters,
  PropertyOptions,
  PropertyPayload,
  PropertyRow,
  PropertySummary,
  PageData,
  RoomDetail,
  RoomFilters,
  RoomPayload,
  RoomRow,
  RoomSummary,
} from "@/types/admin-property";

type Created = { id: number; code: string };
export const adminPropertyService = {
  async list(filters: PropertyFilters) {
    const { data } = await apiClient.get<
      ApiEnvelope<{ summary: PropertySummary; page: PageData<PropertyRow> }>
    >("/admin/properties", { params: filters });
    return data.data;
  },
  async detail(id: number) {
    const { data } = await apiClient.get<ApiEnvelope<PropertyDetail>>(
      `/admin/properties/${id}`,
    );
    return data.data;
  },
  async options() {
    const { data } = await apiClient.get<ApiEnvelope<PropertyOptions>>(
      "/admin/properties/options",
    );
    return data.data;
  },
  async create(payload: PropertyPayload) {
    const { data } = await apiClient.post<ApiEnvelope<Created>>(
      "/admin/properties",
      payload,
    );
    return data.data;
  },
  async update(id: number, payload: PropertyPayload) {
    const { data } = await apiClient.put<ApiEnvelope<PropertyDetail>>(
      `/admin/properties/${id}`,
      payload,
    );
    return data.data;
  },
  async status(id: number, status: string, version: number) {
    await apiClient.patch(`/admin/properties/${id}/status`, {
      status,
      version,
    });
  },
  async addBuilding(
    propertyId: number,
    payload: { code: string; name: string; displayOrder: number },
  ) {
    const { data } = await apiClient.post<ApiEnvelope<Created>>(
      `/admin/properties/${propertyId}/buildings`,
      payload,
    );
    return data.data;
  },
  async addFloor(
    buildingId: number,
    payload: {
      code: string;
      name: string;
      floorNumber?: number;
      displayOrder: number;
    },
  ) {
    const { data } = await apiClient.post<ApiEnvelope<Created>>(
      `/admin/buildings/${buildingId}/floors`,
      payload,
    );
    return data.data;
  },
  async rooms(filters: RoomFilters) {
    const { data } = await apiClient.get<
      ApiEnvelope<{ summary: RoomSummary; page: PageData<RoomRow> }>
    >("/admin/rooms", { params: filters });
    return data.data;
  },
  async room(id: number) {
    const { data } = await apiClient.get<ApiEnvelope<RoomDetail>>(
      `/admin/rooms/${id}`,
    );
    return data.data;
  },
  async createRoom(payload: RoomPayload) {
    const { data } = await apiClient.post<ApiEnvelope<Created>>(
      "/admin/rooms",
      payload,
    );
    return data.data;
  },
  async updateRoom(id: number, payload: RoomPayload) {
    const { data } = await apiClient.put<ApiEnvelope<RoomDetail>>(
      `/admin/rooms/${id}`,
      payload,
    );
    return data.data;
  },
  async bulkRooms(payload: {
    propertyId: number;
    buildingId: number;
    floorId: number;
    prefix: string;
    fromNumber: number;
    toNumber: number;
    padding: number;
    roomType?: string;
    area?: number;
    monthlyRent: number;
    depositAmount?: number;
    capacity: number;
  }) {
    const { data } = await apiClient.post<ApiEnvelope<Created[]>>(
      "/admin/rooms/bulk",
      payload,
    );
    return data.data;
  },
  async roomPrice(
    id: number,
    payload: {
      newPrice: number;
      effectiveDate: string;
      reason?: string;
      version: number;
    },
  ) {
    const { data } = await apiClient.patch<ApiEnvelope<RoomDetail>>(
      `/admin/rooms/${id}/price`,
      payload,
    );
    return data.data;
  },
  async roomStatus(
    id: number,
    payload: { status: string; reason?: string; version: number },
  ) {
    const { data } = await apiClient.patch<ApiEnvelope<RoomDetail>>(
      `/admin/rooms/${id}/status`,
      payload,
    );
    return data.data;
  },
};
