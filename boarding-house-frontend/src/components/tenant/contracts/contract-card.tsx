import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Download,
  DoorOpen,
  Eye,
  FileClock,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ContractSummary } from "@/types/tenant-contract";
import { ContractStatusBadge } from "./contract-status-badge";

export function ContractCard({
  contract,
  downloading,
  onDownload,
}: {
  contract: ContractSummary;
  downloading: boolean;
  onDownload: (contract: ContractSummary) => void;
}) {
  const ended = ["EXPIRED", "TERMINATED", "CANCELLED"].includes(
    contract.status,
  );
  return (
    <article className="surface-card p-5 transition hover:border-accent-border hover:shadow-md sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">
              {contract.contractCode}
            </h2>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="mt-2 flex items-center gap-2 font-semibold text-secondary-foreground">
            <Building2 className="size-4 text-link" />
            {contract.propertyName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {contract.propertyAddress}
          </p>
        </div>
        <div className="rounded-xl bg-accent px-4 py-3 text-center">
          <p className="text-xs text-link">Phòng</p>
          <p className="text-xl font-extrabold text-link">
            {contract.roomCode}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid gap-3 rounded-xl bg-muted p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <CalendarDays className="size-4" />
            Bắt đầu
          </dt>
          <dd className="mt-1 font-semibold">
            {formatDate(contract.startDate)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <FileClock className="size-4" />
            Kết thúc
          </dt>
          <dd className="mt-1 font-semibold">{formatDate(contract.endDate)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <WalletCards className="size-4" />
            Tiền thuê
          </dt>
          <dd className="mt-1 font-semibold">
            {formatCurrency(contract.monthlyRent)}/tháng
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <DoorOpen className="size-4" />
            Vai trò
          </dt>
          <dd className="mt-1 font-semibold">
            {contract.tenantRole === "REPRESENTATIVE"
              ? "Người đại diện thuê"
              : "Người ở cùng"}
          </dd>
        </div>
      </dl>
      {!ended && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Thời gian còn lại</span>
          <strong
            className={
              contract.daysRemaining <= 30 ? "text-warning" : "text-foreground"
            }
          >
            {contract.daysRemaining} ngày
          </strong>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/tenant/contracts/${contract.id}`}
          className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover focus:ring-4 focus:ring-ring"
        >
          <Eye className="size-4" />
          Xem chi tiết
        </Link>
        {contract.hasDocument && (
          <button
            onClick={() => onDownload(contract)}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-muted disabled:opacity-60"
          >
            <Download
              className={`size-4 ${downloading ? "animate-bounce" : ""}`}
            />
            {downloading ? "Đang tải" : "Tải hợp đồng"}
          </button>
        )}
        {contract.canRequestExtension && (
          <Link
            href={`/tenant/contracts/${contract.id}?action=extension`}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${contract.status === "EXPIRING" ? "border-amber-300 bg-warning-muted text-warning" : "border-accent-border text-link"}`}
          >
            <RotateCcw className="size-4" />
            Yêu cầu gia hạn
          </Link>
        )}
        {contract.canRequestTermination && (
          <Link
            href={`/tenant/contracts/${contract.id}?action=termination`}
            className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:bg-muted"
          >
            Yêu cầu trả phòng
          </Link>
        )}
      </div>
    </article>
  );
}
