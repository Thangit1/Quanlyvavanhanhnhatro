import { AlertTriangle, CheckCircle2, Clock3, Wrench } from "lucide-react";
import {
  maintenanceCategories,
  maintenancePriorities,
  maintenanceStatuses,
} from "@/types/admin-maintenance";
export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "RESOLVED"
      ? "bg-emerald-50 text-emerald-700"
      : status === "CANCELLED"
        ? "bg-slate-100 text-slate-600"
        : status.includes("WAITING")
          ? "bg-amber-50 text-amber-700"
          : status === "IN_PROGRESS"
            ? "bg-blue-50 text-blue-700"
            : "bg-indigo-50 text-indigo-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      <Clock3 className="size-3" />
      {maintenanceStatuses[status] ?? status}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "URGENT"
      ? "bg-red-50 text-red-700"
      : priority === "HIGH"
        ? "bg-orange-50 text-orange-700"
        : priority === "LOW"
          ? "bg-slate-100 text-slate-600"
          : "bg-blue-50 text-blue-700";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {priority === "URGENT" ? (
        <AlertTriangle className="size-3" />
      ) : (
        <CheckCircle2 className="size-3" />
      )}
      {maintenancePriorities[priority] ?? priority}
    </span>
  );
}
export const categoryLabel = (value: string) =>
  maintenanceCategories[value] ?? value;
export function EmptyMaintenance() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <Wrench className="mx-auto mb-3 size-10 text-slate-300" />
      <p className="font-semibold text-slate-700">
        Chưa có yêu cầu bảo trì nào.
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Tạo yêu cầu mới hoặc thay đổi bộ lọc để tiếp tục.
      </p>
    </div>
  );
}
