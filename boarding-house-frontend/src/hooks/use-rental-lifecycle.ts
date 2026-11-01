"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rentalLifecycleService as service } from "@/services/rental-lifecycle.service";
import { useAuth } from "@/providers/auth-provider";

export function useRentalLifecycle(propertyId?: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rental-lifecycle", user?.id, user?.activeRole, propertyId],
    queryFn: ({ signal }) => service.board(propertyId, signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
export function useRentalLifecycleMutations() {
  const client = useQueryClient();
  const done = () =>
    Promise.all(
      [
        "rental-lifecycle",
        "admin-rooms",
        "admin-room",
        "admin-contracts",
        "admin-contract",
        "deposit-ledger",
        "deposit-ledger-detail",
      ].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  return {
    extendBooking: useMutation({
      mutationFn: ({
        id,
        ...payload
      }: {
        id: number;
        reservationEnd: string;
        reason: string;
        version: number;
      }) => service.extendBooking(id, payload),
      onSuccess: done,
    }),
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
        reservationTransferAmount?: number;
        monthlyRent?: number;
        initialPaymentRequired?: boolean;
        utilityRates?: {
          code: string;
          name: string;
          calculationMethod: string;
          unitPrice: number;
          unit: string;
        }[];
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
