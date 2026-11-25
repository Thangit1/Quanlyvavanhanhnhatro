export interface TenantUtilityData {
  rooms: UtilityRoomOption[];
  selectedContractId: number | null;
  selectedPeriod: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  room: UtilityRoom | null;
  reading: UtilityReading | null;
  history: UtilityHistoryItem[];
}

export interface UtilityRoomOption {
  contractId: number;
  roomId: number;
  roomCode: string;
  propertyName: string;
}

export interface UtilityRoom {
  roomId: number;
  roomCode: string;
  propertyName: string;
  propertyAddress: string;
}

export interface UtilityReading {
  id: number;
  status: "PENDING" | "RECORDED" | "INVOICED";
  electricity: UtilityMetric;
  water: UtilityMetric;
  totalAmount: number | null;
  invoice: null | { id: number; code: string; status: string };
}

export interface UtilityMetric {
  previousIndex: number | null;
  currentIndex: number | null;
  usage: number | null;
  unitPrice: number | null;
  amount: number | null;
  complete: boolean;
  valid: boolean;
}

export interface UtilityHistoryItem {
  period: string;
  electricityUsage: number | null;
  electricityAmount: number | null;
  waterUsage: number | null;
  waterAmount: number | null;
  electricityValid: boolean;
  waterValid: boolean;
  invoiceId: number | null;
}
