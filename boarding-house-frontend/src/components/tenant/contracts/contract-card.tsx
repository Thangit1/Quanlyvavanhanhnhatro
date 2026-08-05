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
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              {contract.contractCode}
            </h2>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="mt-2 flex items-center gap-2 font-semibold text-slate-700">
            <Building2 className="size-4 text-blue-600" />
            {contract.propertyName}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {contract.propertyAddress}
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
          <p className="text-xs text-blue-600">Phòng</p>
          <p className="text-xl font-extrabold text-blue-800">
            {contract.roomCode}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1 text-slate-500">
            <CalendarDays className="size-4" />
            Bắt đầu
          </dt>
          <dd className="mt-1 font-semibold">
            {formatDate(contract.startDate)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-slate-500">
            <FileClock className="size-4" />
            Kết thúc
          </dt>
          <dd className="mt-1 font-semibold">{formatDate(contract.endDate)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-slate-500">
            <WalletCards className="size-4" />
            Tiền thuê
          </dt>
          <dd className="mt-1 font-semibold">
            {formatCurrency(contract.monthlyRent)}/tháng
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-slate-500">
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
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
          <span className="text-slate-500">Thời gian còn lại</span>
          <strong
            className={
              contract.daysRemaining <= 30 ? "text-amber-700" : "text-slate-800"
            }
          >
            {contract.daysRemaining} ngày
          </strong>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/tenant/contracts/${contract.id}`}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-100"
        >
          <Eye className="size-4" />
          Xem chi tiết
        </Link>
        {contract.hasDocument && (
          <button
            onClick={() => onDownload(contract)}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${contract.status === "EXPIRING" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-blue-200 text-blue-700"}`}
          >
            <RotateCcw className="size-4" />
            Yêu cầu gia hạn
          </Link>
        )}
        {contract.canRequestTermination && (
          <Link
            href={`/tenant/contracts/${contract.id}?action=termination`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Yêu cầu trả phòng
          </Link>
        )}
      </div>
    </article>
  );
}
