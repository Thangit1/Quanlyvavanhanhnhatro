import { AlertTriangle, CheckCircle2, Clock3, CircleDot } from "lucide-react";
import {
  areaLabels,
  categoryInfo,
  priorityLabels,
  statusLabels,
} from "@/constants/tenant-maintenance";
export const fmtDate = (v?: string, time = false) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat(
        "vi-VN",
        time
          ? { dateStyle: "short", timeStyle: "short" }
          : { dateStyle: "short" },
      ).format(d);
};
export function StatusBadge({ status }: { status: string }) {
  const red = ["REJECTED", "CANCELLED"].includes(status),
    green = status === "RESOLVED",
    amber = [
      "NEED_MORE_INFORMATION",
      "WAITING_TENANT",
      "INSPECTION_PENDING",
      "COMPLETED",
    ].includes(status);
  const Icon = green
    ? CheckCircle2
    : red
      ? AlertTriangle
      : amber
        ? Clock3
        : CircleDot;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${green ? "bg-emerald-100 text-emerald-700" : red ? "bg-red-100 text-red-700" : amber ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}
    >
      <Icon className="size-3.5" />
      {statusLabels[status] ?? "Đang cập nhật"}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priority === "URGENT" ? "bg-red-100 text-red-700" : priority === "HIGH" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}
    >
      {priorityLabels[priority] ?? "Chưa xác định"}
    </span>
  );
}
export const categoryLabel = (v: string) =>
  categoryInfo(v)?.[1] ?? "Sự cố khác";
export const areaLabel = (v: string) => areaLabels[v] ?? "Khu vực đã chọn";
