import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FilePenLine,
  Hourglass,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { AdminContractStatus } from "@/types/admin-contract";

const statusConfig: Record<
  AdminContractStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  DRAFT: {
    label: "Bản nháp",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: FilePenLine,
  },
  PENDING_CONFIRMATION: {
    label: "Chờ xác nhận",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Hourglass,
  },
  ACTIVE: {
    label: "Đang hiệu lực",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  EXPIRING: {
    label: "Sắp hết hạn",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  EXPIRED: {
    label: "Đã hết hạn",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: XCircle,
  },
  TERMINATION_REQUESTED: {
    label: "Chờ chấm dứt",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    icon: RotateCcw,
  },
  TERMINATED: {
    label: "Đã chấm dứt",
    className: "border-slate-300 bg-slate-100 text-slate-700",
    icon: Ban,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: CircleDashed,
  },
};

export function AdminContractStatusBadge({
  status,
}: {
  status: AdminContractStatus;
}) {
  const config = statusConfig[status] ?? statusConfig.DRAFT;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}
