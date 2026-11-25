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
    className: "border-border bg-muted text-secondary-foreground",
    icon: FilePenLine,
  },
  PENDING_CONFIRMATION: {
    label: "Chờ hoàn tất nhận phòng",
    className: "border-accent-border bg-accent text-link",
    icon: Hourglass,
  },
  ACTIVE: {
    label: "Đang hiệu lực",
    className: "border-success-border bg-success-muted text-success",
    icon: CheckCircle2,
  },
  EXPIRING: {
    label: "Sắp hết hạn",
    className: "border-warning-border bg-warning-muted text-warning",
    icon: Clock3,
  },
  EXPIRED: {
    label: "Đã hết hạn",
    className: "border-border bg-muted text-secondary-foreground",
    icon: XCircle,
  },
  TERMINATION_REQUESTED: {
    label: "Chờ chấm dứt",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    icon: RotateCcw,
  },
  TERMINATED: {
    label: "Đã chấm dứt",
    className: "border-input bg-muted text-secondary-foreground",
    icon: Ban,
  },
  SETTLING: {
    label: "Đang quyết toán tài chính",
    className: "border-warning-border bg-warning-muted text-warning",
    icon: Clock3,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-danger-border bg-danger-muted text-danger",
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
