"use client";
import { useScopedQuery } from "./use-scoped-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminPropertyService } from "@/services/admin-property.service";
import type {
  PropertyFilters,
  PropertyPayload,
  RoomFilters,
  RoomPayload,
} from "@/types/admin-property";
export function useAdminProperties(filters: PropertyFilters) {
  return useScopedQuery({
    queryKey: ["admin-properties", filters],
    queryFn: ({ signal }) => adminPropertyService.list(filters, signal),
    staleTime: 20_000,
  });
}
export function useAdminProperty(id: number) {
  return useScopedQuery({
    queryKey: ["admin-property", id],
    queryFn: ({ signal }) => adminPropertyService.detail(id, signal),
    enabled: id > 0,
  });
}
export function usePropertyOptions() {
  return useScopedQuery({
    queryKey: ["property-options"],
    queryFn: ({ signal }) => adminPropertyService.options(signal),
    staleTime: 30_000,
  });
}
export function usePropertyMutations(id?: number) {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["admin-properties"] });
    await client.invalidateQueries({ queryKey: ["rental-lifecycle"] });
    await client.invalidateQueries({ queryKey: ["property-options"] });
    if (id) await client.invalidateQueries({ queryKey: ["admin-property"] });
  };
  return {
    create: useMutation({
      mutationFn: (p: PropertyPayload) => adminPropertyService.create(p),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (p: PropertyPayload) => adminPropertyService.update(id!, p),
      onSuccess: refresh,
    }),
    status: useMutation({
      mutationFn: (p: { status: string; version: number }) =>
        adminPropertyService.status(id!, p.status, p.version),
      onSuccess: refresh,
    }),
    building: useMutation({
      mutationFn: (p: { code: string; name: string; displayOrder: number }) =>
        adminPropertyService.addBuilding(id!, p),
      onSuccess: refresh,
    }),
    floor: useMutation({
      mutationFn: (p: {
        buildingId: number;
        code: string;
        name: string;
        floorNumber?: number;
        displayOrder: number;
      }) => adminPropertyService.addFloor(p.buildingId, p),
      onSuccess: refresh,
    }),
  };
}
export function useAdminRooms(filters: RoomFilters) {
  return useScopedQuery({
    queryKey: ["admin-rooms", filters],
    queryFn: ({ signal }) => adminPropertyService.rooms(filters, signal),
    staleTime: 20_000,
  });
}
export function useAdminRoom(id: number) {
  return useScopedQuery({
    queryKey: ["admin-room", id],
    queryFn: ({ signal }) => adminPropertyService.room(id, signal),
    enabled: id > 0,
  });
}
export function useRoomMutations(id?: number) {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["admin-rooms"] });
    await client.invalidateQueries({ queryKey: ["rental-lifecycle"] });
    await client.invalidateQueries({ queryKey: ["admin-properties"] });
    if (id) await client.invalidateQueries({ queryKey: ["admin-room"] });
  };
  return {
    create: useMutation({
      mutationFn: (p: RoomPayload) => adminPropertyService.createRoom(p),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (p: RoomPayload) => adminPropertyService.updateRoom(id!, p),
      onSuccess: refresh,
    }),
    price: useMutation({
      mutationFn: (p: {
        newPrice: number;
        effectiveDate: string;
        reason?: string;
        version: number;
      }) => adminPropertyService.roomPrice(id!, p),
      onSuccess: refresh,
    }),
    status: useMutation({
      mutationFn: (p: {
        status: string;
        reason?: string;
        version: number;
        readinessConfirmed?: boolean;
      }) => adminPropertyService.roomStatus(id!, p),
      onSuccess: refresh,
    }),
  };
}
