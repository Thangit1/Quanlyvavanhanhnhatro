"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminPropertyService } from "@/services/admin-property.service";
import type {
  PropertyFilters,
  PropertyPayload,
  RoomFilters,
  RoomPayload,
} from "@/types/admin-property";
export function useAdminProperties(filters: PropertyFilters) {
  return useQuery({
    queryKey: ["admin-properties", filters],
    queryFn: () => adminPropertyService.list(filters),
    staleTime: 20_000,
  });
}
export function useAdminProperty(id: number) {
  return useQuery({
    queryKey: ["admin-property", id],
    queryFn: () => adminPropertyService.detail(id),
    enabled: id > 0,
  });
}
export function usePropertyOptions() {
  return useQuery({
    queryKey: ["property-options"],
    queryFn: adminPropertyService.options,
    staleTime: 30_000,
  });
}
export function usePropertyMutations(id?: number) {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["admin-properties"] });
    await client.invalidateQueries({ queryKey: ["property-options"] });
    if (id)
      await client.invalidateQueries({ queryKey: ["admin-property", id] });
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
  return useQuery({
    queryKey: ["admin-rooms", filters],
    queryFn: () => adminPropertyService.rooms(filters),
    staleTime: 20_000,
  });
}
export function useAdminRoom(id: number) {
  return useQuery({
    queryKey: ["admin-room", id],
    queryFn: () => adminPropertyService.room(id),
    enabled: id > 0,
  });
}
export function useRoomMutations(id?: number) {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["admin-rooms"] });
    await client.invalidateQueries({ queryKey: ["admin-properties"] });
    if (id) await client.invalidateQueries({ queryKey: ["admin-room", id] });
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
      mutationFn: (p: { status: string; reason?: string; version: number }) =>
        adminPropertyService.roomStatus(id!, p),
      onSuccess: refresh,
    }),
  };
}
