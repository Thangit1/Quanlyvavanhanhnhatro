export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type InvoiceStatus =
  "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
export type Payment = {
  id: number;
  receiptCode: string;
  invoiceCode: string;
  amount: number;
  paymentMethod: string;
  referenceCode?: string;
  status: string;
  paidAt: string;
};
export type InvoiceSummary = {
  outstandingAmount: number;
  overdueCount: number;
  unpaidCount: number;
  lastPayment?: Payment;
};
export type InvoiceRow = {
  id: number;
  invoiceCode: string;
  billingPeriod: string;
  propertyName: string;
  roomCode: string;
  issueDate?: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overdueDays: number;
  status: InvoiceStatus;
};
export type Party = { id: number; name: string; secondary?: string };
export type InvoiceItem = {
  id: number;
  itemType: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
};
export type UtilityReading = {
  id: number;
  type: string;
  previousValue: number;
  currentValue: number;
  consumption: number;
  unitPrice: number;
  amount: number;
};
export type UtilityHistory = {
  billingPeriod: string;
  electricityConsumption: number;
  waterConsumption: number;
};
export type Adjustment = {
  id: number;
  code: string;
  type: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
};
export type PaymentProof = {
  id: number;
  amount: number;
  transferredAt: string;
  bankName?: string;
  transactionReference?: string;
  originalName: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
};
export type InvoiceReview = {
  id: number;
  requestCode: string;
  invoiceItemId?: number;
  issueType: string;
  description: string;
  expectedValue?: string;
  status: string;
  managerResponse?: string;
  createdAt: string;
  resolvedAt?: string;
};
export type PaymentMethod = {
  code: "CASH" | "BANK_TRANSFER";
  label: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  bankBranch?: string;
  transferContent?: string;
  qrEnabled: boolean;
  allowPartialPayment: boolean;
};
export type InvoiceDetail = {
  id: number;
  invoiceCode: string;
  billingPeriod: string;
  periodStartDate?: string;
  periodEndDate?: string;
  issueDate?: string;
  dueDate: string;
  status: InvoiceStatus;
  property: Party;
  room: Party;
  contract: Party;
  items: InvoiceItem[];
  utilityReadings: UtilityReading[];
  utilityHistory: UtilityHistory[];
  subtotalAmount: number;
  discountAmount: number;
  previousDebtAmount: number;
  lateFeeAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payments: Payment[];
  adjustments: Adjustment[];
  paymentProofs: PaymentProof[];
  reviewRequests: InvoiceReview[];
  paymentMethods: PaymentMethod[];
  permissions: {
    canPay: boolean;
    canRequestReview: boolean;
    canDownload: boolean;
    canPrint: boolean;
  };
  version: number;
};
export type PaymentSession = {
  id: number;
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  status: string;
  transferContent?: string;
  expiresAt: string;
};
export type PaymentDetail = { payment: Payment; property: Party; room: Party };
export type ReviewPayload = {
  invoiceItemId?: number;
  issueType: string;
  description: string;
  expectedValue?: string;
  contactPhone?: string;
  preferredContactTime?: string;
};
