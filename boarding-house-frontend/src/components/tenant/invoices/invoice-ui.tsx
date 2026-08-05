import type { InvoiceStatus } from "@/types/tenant-invoice";
export const money = (v: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(v);
export const date = (v?: string) =>
  v ? new Intl.DateTimeFormat("vi-VN").format(new Date(v)) : "—";
const labels: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIALLY_PAID: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  CANCELLED: "Đã hủy",
  PENDING: "Chờ xác nhận",
  IN_REVIEW: "Đang rà soát",
  REJECTED: "Bị từ chối",
  CONFIRMED: "Đã xác nhận",
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  ELECTRICITY: "Điện",
  WATER: "Nước",
};
export const label = (v: string) => labels[v] ?? v;
export function InvoiceBadge({ status }: { status: InvoiceStatus | string }) {
  const tone =
    status === "PAID" || status === "CONFIRMED"
      ? "bg-emerald-100 text-emerald-700"
      : status === "OVERDUE" || status === "REJECTED"
        ? "bg-red-100 text-red-700"
        : status === "PARTIALLY_PAID" || status === "PENDING"
          ? "bg-amber-100 text-amber-700"
          : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {label(status)}
    </span>
  );
}
export function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
