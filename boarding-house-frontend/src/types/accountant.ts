export type Money = number;
export interface ApiPage<T = Record<string, unknown>> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export interface PropertyOption {
  id: number;
  name: string;
  address: string;
}
export interface AccountantSummary {
  collected: Money;
  spent: Money;
  debt: Money;
  pending_proofs: number;
}
export interface AccountantDashboard {
  properties: PropertyOption[];
  summary: AccountantSummary;
  recentPayments: Record<string, unknown>[];
  overdueInvoices: Record<string, unknown>[];
  ai: { available: boolean; reason: string };
}
export interface AccountantAccount {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  employee_code: string;
  version: number;
  properties: PropertyOption[];
  notify_payment: boolean;
  notify_overdue: boolean;
  notify_reconciliation: boolean;
}
export type AccountantResource =
  | "invoices"
  | "payments"
  | "payment-proofs"
  | "receipts"
  | "debts"
  | "deposits"
  | "payment-vouchers"
  | "expenses"
  | "other-income"
  | "periods"
  | "cashbook"
  | "bankbook"
  | "cash-flow"
  | "reports"
  | "exports"
  | "reconciliation/bank"
  | "reconciliation/payment-gateways";
