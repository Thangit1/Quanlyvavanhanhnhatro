import type { ContractStatus } from "@/types/tenant-contract";

export const contractStatusLabel: Record<ContractStatus, string> = {
  PENDING_CONFIRMATION: "Chờ xác nhận",
  ACTIVE: "Đang hiệu lực",
  EXPIRING: "Sắp hết hạn",
  EXPIRED: "Đã hết hạn",
  TERMINATION_REQUESTED: "Đang yêu cầu chấm dứt",
  TERMINATED: "Đã chấm dứt",
  CANCELLED: "Đã hủy",
};
export const contractStatusStyle: Record<ContractStatus, string> = {
  PENDING_CONFIRMATION: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  EXPIRING: "border-amber-200 bg-amber-50 text-amber-800",
  EXPIRED: "border-slate-200 bg-slate-100 text-slate-700",
  TERMINATION_REQUESTED: "border-orange-200 bg-orange-50 text-orange-700",
  TERMINATED: "border-slate-300 bg-slate-100 text-slate-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};
