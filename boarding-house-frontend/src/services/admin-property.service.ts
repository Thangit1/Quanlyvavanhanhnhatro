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
export type PropertySave = PropertyPayload & {
  imageFile?: File;
  onImageProgress?: (percent: number) => void;
};
export type RoomSave = RoomPayload & {
  gallery: { items: string[]; cover: number };
  imageFiles: File[];
  requestKey: string;
  onImageProgress?: (percent: number) => void;
};
function roomBody({
  gallery,
  imageFiles,
  requestKey,
  onImageProgress,
  ...room
}: RoomSave) {
  void requestKey;
  void onImageProgress;
  const body = new FormData();
  body.append(
    "room",
    new Blob(
      [
        JSON.stringify({
          ...room,
          buildingId: room.buildingId || undefined,
          floorId: room.floorId || undefined,
        }),
      ],
      { type: "application/json" },
    ),
  );
  body.append(
    "gallery",
    new Blob([JSON.stringify(gallery)], { type: "application/json" }),
  );
  imageFiles.forEach((file) => body.append("images", file));
  return body;
}
function roomUploadOptions(payload: RoomSave) {
  return {
    headers: {
      "Content-Type": undefined,
      "Idempotency-Key": payload.requestKey,
    },
    timeout: 180_000,
    onUploadProgress: (e: { loaded: number; total?: number }) =>
      payload.onImageProgress?.(
        Math.round((e.loaded / (e.total || e.loaded || 1)) * 100),
      ),
  };
}
function propertyBody({
  imageFile,
  onImageProgress: _progress,
  ...property
}: PropertySave) {
  void _progress;
  const data = new FormData();
  data.append(
    "property",
    new Blob([JSON.stringify(property)], { type: "application/json" }),
  );
  if (imageFile) data.append("image", imageFile);
  return data;
}
export const adminPropertyService = {
  async list(filters: PropertyFilters, signal?: AbortSignal) {
    const { data } = await apiClient.get<
      ApiEnvelope<{ summary: PropertySummary; page: PageData<PropertyRow> }>
    >("/admin/properties", { params: filters, signal });
    return data.data;
  },
  async detail(id: number, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiEnvelope<PropertyDetail>>(
      `/admin/properties/${id}`,
      { signal },
    );
    return data.data;
  },
  async options(signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiEnvelope<PropertyOptions>>(
      "/admin/properties/options",
      { signal },
    );
    return data.data;
  },
  async create(payload: PropertySave) {
    const { data } = await apiClient.post<ApiEnvelope<Created>>(
      "/admin/properties",
      propertyBody(payload),
      {
        headers: { "Content-Type": undefined },
        timeout: 120_000,
        onUploadProgress: (e) =>
          payload.onImageProgress?.(
            Math.round((e.loaded / (e.total || e.loaded || 1)) * 100),
          ),
      },
    );
    return data.data;
  },
  async update(id: number, payload: PropertySave) {
    const { data } = await apiClient.put<ApiEnvelope<PropertyDetail>>(
      `/admin/properties/${id}`,
      propertyBody(payload),
      {
        headers: { "Content-Type": undefined },
        timeout: 120_000,
        onUploadProgress: (e) =>
          payload.onImageProgress?.(
            Math.round((e.loaded / (e.total || e.loaded || 1)) * 100),
          ),
      },
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
  async rooms(filters: RoomFilters, signal?: AbortSignal) {
    const { data } = await apiClient.get<
      ApiEnvelope<{ summary: RoomSummary; page: PageData<RoomRow> }>
    >("/admin/rooms", { params: filters, signal });
    return data.data;
  },
  async room(id: number, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiEnvelope<RoomDetail>>(
      `/admin/rooms/${id}`,
      { signal },
    );
    return data.data;
  },
  async createRoom(payload: RoomSave) {
    const { data } = await apiClient.post<ApiEnvelope<Created>>(
      "/admin/rooms",
      roomBody(payload),
      roomUploadOptions(payload),
    );
    return data.data;
  },
  async updateRoom(id: number, payload: RoomSave) {
    const { data } = await apiClient.put<ApiEnvelope<RoomDetail>>(
      `/admin/rooms/${id}`,
      roomBody(payload),
      roomUploadOptions(payload),
    );
    return data.data;
  },
  async bulkRooms(payload: {
    propertyId: number;
    buildingId?: number;
    floorId?: number;
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
    payload: {
      status: string;
      reason?: string;
      version: number;
      readinessConfirmed?: boolean;
    },
  ) {
    const { data } = await apiClient.patch<ApiEnvelope<RoomDetail>>(
      `/admin/rooms/${id}/status`,
      payload,
    );
    return data.data;
  },
};
