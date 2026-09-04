"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rentalLifecycleService as service } from "@/services/rental-lifecycle.service";

export function useRentalLifecycle(propertyId?: number) {
  return useQuery({
    queryKey: ["rental-lifecycle", propertyId],
    queryFn: ({ signal }) => service.board(propertyId, signal),
    staleTime: 15_000,
  });
}
export function useRentalLifecycleMutations() {
  const client = useQueryClient();
  const done = () =>
    client.invalidateQueries({ queryKey: ["rental-lifecycle"] });
  return {
    createBooking: useMutation({
      mutationFn: service.createBooking,
      onSuccess: done,
    }),
    bookingStatus: useMutation({
      mutationFn: ({
        id,
        ...payload
      }: {
        id: number;
        status: string;
        reason?: string;
        version: number;
      }) => service.bookingStatus(id, payload),
      onSuccess: done,
    }),
    createContract: useMutation({
      mutationFn: ({
        id,
        ...payload
      }: {
        id: number;
        startDate: string;
        endDate: string;
        depositAmount: number;
        paymentDueDay: number;
        noticePeriodDays: number;
      }) => service.createContract(id, payload),
      onSuccess: done,
    }),
    prepareCheckin: useMutation({
      mutationFn: service.prepareCheckin,
      onSuccess: done,
    }),
    completeCheckin: useMutation({
      mutationFn: ({
        id,
        ...payload
      }: {
        id: number;
        identityVerified: boolean;
        contractVerified: boolean;
        depositVerified: boolean;
        electricityReading?: number;
        waterReading?: number;
        keysCardsCount: number;
        note?: string;
        version: number;
      }) => service.completeCheckin(id, payload),
      onSuccess: done,
    }),
    requestCheckout: useMutation({
      mutationFn: service.requestCheckout,
      onSuccess: done,
    }),
    completeCheckout: useMutation({
      mutationFn: ({
        id,
        ...payload
      }: {
        id: number;
        actualDate: string;
        finalElectricityReading?: number;
        finalWaterReading?: number;
        charges: { chargeType: string; description: string; amount: number }[];
        note?: string;
        version: number;
      }) => service.completeCheckout(id, payload),
      onSuccess: done,
    }),
  };
}
