export interface LifecycleOption {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  status: string;
}
export interface LifecycleSummary {
  reserved: number;
  awaitingCheckin: number;
  staying: number;
  checkoutRequested: number;
  settlementPending: number;
  cleaningOrMaintenance: number;
}
export interface BookingRow {
  id: number;
  code: string;
  tenantProfileId: number;
  tenantName: string;
  propertyId: number;
  propertyName: string;
  roomId: number;
  roomCode: string;
  reservationStart: string;
  reservationEnd: string;
  depositAmount: number;
  depositStatus: string;
  status: string;
  contractId: number | null;
  version: number;
  updatedAt: string;
}
export interface CheckinRow {
  id: number;
  contractId: number;
  contractCode: string;
  tenantName: string;
  propertyName: string;
  roomId: number;
  roomCode: string;
  scheduledDate: string;
  actualCheckinAt: string | null;
  status: string;
  identityVerified: boolean;
  contractVerified: boolean;
  depositVerified: boolean;
  electricityReading: number | null;
  waterReading: number | null;
  keysCardsCount: number;
  version: number;
}
export interface CheckoutRow {
  id: number;
  contractId: number;
  contractCode: string;
  tenantName: string;
  propertyName: string;
  roomId: number;
  roomCode: string;
  requestedDate: string;
  confirmedDate: string | null;
  actualCheckoutAt: string | null;
  status: string;
  depositHeld: number;
  outstandingDebt: number;
  additionalCharges: number;
  refundAmount: number;
  balanceDue: number;
  reason: string;
  version: number;
}
export interface LifecycleBoard {
  summary: LifecycleSummary;
  properties: LifecycleOption[];
  rooms: LifecycleOption[];
  tenants: LifecycleOption[];
  contracts: LifecycleOption[];
  bookings: BookingRow[];
  checkins: CheckinRow[];
  checkouts: CheckoutRow[];
}
export interface CreatedWorkflow {
  id: number;
  code: string;
  status: string;
}
export interface Settlement {
  checkoutId: number;
  depositHeld: number;
  outstandingDebt: number;
  additionalCharges: number;
  refundAmount: number;
  balanceDue: number;
  roomStatus: string;
}
