import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type {
  CreatedWorkflow,
  LifecycleBoard,
  Settlement,
} from "@/types/rental-lifecycle";

export const rentalLifecycleService = {
  async board(propertyId?: number, signal?: AbortSignal) {
    const { data } = await apiClient.get<ApiEnvelope<LifecycleBoard>>(
      "/admin/rental-lifecycle",
      { params: { propertyId }, signal },
    );
    return data.data;
  },
  async createBooking(payload: {
    tenantProfileId: number;
    roomId: number;
    reservationStart: string;
    reservationEnd: string;
    depositAmount: number;
    source?: string;
    note?: string;
  }) {
    const { data } = await apiClient.post<ApiEnvelope<CreatedWorkflow>>(
      "/admin/rental-lifecycle/bookings",
      payload,
    );
    return data.data;
  },
  async bookingStatus(
    id: number,
    payload: { status: string; reason?: string; version: number },
  ) {
    await apiClient.patch(
      `/admin/rental-lifecycle/bookings/${id}/status`,
      payload,
    );
  },
  async createContract(
    id: number,
    payload: {
      startDate: string;
      endDate: string;
      depositAmount: number;
      paymentDueDay: number;
      noticePeriodDays: number;
    },
  ) {
    const { data } = await apiClient.post<ApiEnvelope<CreatedWorkflow>>(
      `/admin/rental-lifecycle/bookings/${id}/contract`,
      payload,
    );
    return data.data;
  },
  async prepareCheckin(payload: {
    contractId: number;
    bookingId?: number;
    scheduledDate: string;
    note?: string;
  }) {
    const { data } = await apiClient.post<ApiEnvelope<CreatedWorkflow>>(
      "/admin/rental-lifecycle/checkins",
      payload,
    );
    return data.data;
  },
  async completeCheckin(
    id: number,
    payload: {
      identityVerified: boolean;
      contractVerified: boolean;
      depositVerified: boolean;
      electricityReading?: number;
      waterReading?: number;
      keysCardsCount: number;
      note?: string;
      version: number;
    },
  ) {
    await apiClient.post(
      `/admin/rental-lifecycle/checkins/${id}/complete`,
      payload,
    );
  },
  async requestCheckout(payload: {
    contractId: number;
    requestedDate: string;
    reason: string;
  }) {
    const { data } = await apiClient.post<ApiEnvelope<CreatedWorkflow>>(
      "/admin/rental-lifecycle/checkouts",
      payload,
    );
    return data.data;
  },
  async completeCheckout(
    id: number,
    payload: {
      actualDate: string;
      finalElectricityReading?: number;
      finalWaterReading?: number;
      charges: { chargeType: string; description: string; amount: number }[];
      note?: string;
      version: number;
    },
  ) {
    const { data } = await apiClient.post<ApiEnvelope<Settlement>>(
      `/admin/rental-lifecycle/checkouts/${id}/complete`,
      payload,
    );
    return data.data;
  },
};
