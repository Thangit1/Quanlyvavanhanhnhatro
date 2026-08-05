"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Download,
  Eye,
  FileClock,
  Files,
  FilterX,
  Hourglass,
  Search,
  UserRoundX,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminContractStatusBadge } from "@/components/admin/contracts/contract-status-badge";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import { useAdminContracts } from "@/hooks/use-admin-contracts";
import { formatCurrency, formatDate } from "@/lib/format";
import { adminContractService } from "@/services/admin-contract.service";
import type {
  AdminContractFilters,
  AdminContractRow,
  AdminContractStatus,
} from "@/types/admin-contract";

const statusOptions: { value: AdminContractStatus; label: string }[] = [
  { value: "DRAFT", label: "Bản nháp" },
  { value: "PENDING_CONFIRMATION", label: "Chờ xác nhận" },
  { value: "ACTIVE", label: "Đang hiệu lực" },
  { value: "EXPIRING", label: "Sắp hết hạn" },
  { value: "TERMINATION_REQUESTED", label: "Chờ chấm dứt" },
  { value: "EXPIRED", label: "Đã hết hạn" },
  { value: "TERMINATED", label: "Đã chấm dứt" },
  { value: "CANCELLED", label: "Đã hủy" },
];

export function AdminContractListPage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [propertyId, setPropertyId] = useState<number>();
  const [status, setStatus] = useState<AdminContractStatus>();
  const [sort, setSort] = useState("endDate");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const filters = useMemo<AdminContractFilters>(
    () => ({
      keyword: keyword || undefined,
      propertyId,
      status,
      sort,
      direction,
      page,
      size: 20,
    }),
    [direction, keyword, page, propertyId, sort, status],
  );
  const query = useAdminContracts(filters);

  if (query.isLoading) return <PageLoading />;

  const data = query.data;
  const hasFilters = Boolean(keyword || propertyId || status);
  const resetFilters = () => {
    setKeywordInput("");
    setKeyword("");
    setPropertyId(undefined);
    setStatus(undefined);
    setPage(0);
  };
  const handleExport = async () => {
    try {
      setExporting(true);
      await adminContractService.exportCsv(filters);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminShell
      title="Quản lý hợp đồng"
      subtitle="Theo dõi vòng đời hợp đồng thuê phòng"
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
              Vận hành cho thuê
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Danh sách hợp đồng
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Quản lý thời hạn, hồ sơ ký kết và các yêu cầu phát sinh của từng
              phòng.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={exporting || !data}
              onClick={() => void handleExport()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="size-4" />
              {exporting ? "Đang xuất..." : "Xuất danh sách"}
            </button>
          </div>
        </section>

        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}

        {data && (
          <>
            <section
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
              aria-label="Tổng quan hợp đồng"
            >
              <Metric
                label="Tổng hợp đồng"
                value={data.summary.total}
                icon={Files}
                tone="blue"
              />
              <Metric
                label="Đang hiệu lực"
                value={data.summary.active}
                icon={CircleCheckBig}
                tone="emerald"
              />
              <Metric
                label="Sắp hết hạn"
                value={data.summary.expiring}
                icon={CalendarClock}
                tone="amber"
              />
              <Metric
                label="Chờ xác nhận"
                value={data.summary.pendingConfirmation}
                icon={Hourglass}
                tone="sky"
              />
              <Metric
                label="Yêu cầu chấm dứt"
                value={data.summary.terminationRequested}
                icon={UserRoundX}
                tone="orange"
              />
              <Metric
                label="Đã kết thúc"
                value={data.summary.ended}
                icon={FileClock}
                tone="slate"
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[minmax(260px,1.5fr)_1fr_1fr_1fr_auto]">
                <label className="relative">
                  <span className="sr-only">Tìm kiếm hợp đồng</span>
                  <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-400" />
                  <input
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    placeholder="Mã hợp đồng, khách thuê, SĐT, phòng..."
                    className="min-h-11 w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <Select
                  ariaLabel="Lọc theo nhà trọ"
                  value={propertyId?.toString() ?? ""}
                  onChange={(value) => {
                    setPropertyId(value ? Number(value) : undefined);
                    setPage(0);
                  }}
                  placeholder="Tất cả nhà trọ"
                  options={data.properties.map((item) => ({
                    value: String(item.id),
                    label: item.name,
                  }))}
                />
                <Select
                  ariaLabel="Lọc theo trạng thái"
                  value={status ?? ""}
                  onChange={(value) => {
                    setStatus(
                      (value || undefined) as AdminContractStatus | undefined,
                    );
                    setPage(0);
                  }}
                  placeholder="Mọi trạng thái"
                  options={statusOptions}
                />
                <Select
                  ariaLabel="Sắp xếp hợp đồng"
                  value={`${sort}:${direction}`}
                  onChange={(value) => {
                    const [nextSort, nextDirection] = value.split(":");
                    setSort(nextSort);
                    setDirection(nextDirection as "asc" | "desc");
                    setPage(0);
                  }}
                  placeholder="Sắp xếp"
                  options={[
                    { value: "endDate:asc", label: "Hết hạn gần nhất" },
                    { value: "endDate:desc", label: "Hết hạn xa nhất" },
                    { value: "startDate:desc", label: "Mới bắt đầu" },
                    { value: "contractCode:asc", label: "Theo mã hợp đồng" },
                  ]}
                />
                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <FilterX className="size-4" />
                    Xóa lọc
                  </button>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                <p>
                  Tìm thấy{" "}
                  <strong className="text-slate-900">
                    {data.page.totalElements}
                  </strong>{" "}
                  hợp đồng
                </p>
                {query.isFetching && (
                  <span aria-live="polite">Đang cập nhật...</span>
                )}
              </div>
            </section>

            {data.page.content.length === 0 ? (
              <EmptyState
                text={
                  hasFilters
                    ? "Không có hợp đồng phù hợp với bộ lọc."
                    : "Chưa có hợp đồng nào được tạo."
                }
              />
            ) : (
              <>
                <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Hợp đồng</th>
                          <th className="px-5 py-4 font-semibold">
                            Khách thuê
                          </th>
                          <th className="px-5 py-4 font-semibold">
                            Nhà trọ / phòng
                          </th>
                          <th className="px-5 py-4 font-semibold">Thời hạn</th>
                          <th className="px-5 py-4 font-semibold">Tiền thuê</th>
                          <th className="px-5 py-4 font-semibold">
                            Trạng thái
                          </th>
                          <th className="px-5 py-4 text-right font-semibold">
                            Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.page.content.map((contract) => (
                          <ContractTableRow
                            key={contract.id}
                            contract={contract}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="grid gap-4 lg:hidden">
                  {data.page.content.map((contract) => (
                    <ContractMobileCard key={contract.id} contract={contract} />
                  ))}
                </section>
                <Pagination
                  page={data.page.page}
                  totalPages={data.page.totalPages}
                  onChange={setPage}
                />
              </>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Files;
  tone: "blue" | "emerald" | "amber" | "sky" | "orange" | "slate";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
    orange: "bg-orange-50 text-orange-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span
        className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
    </article>
  );
}

function ContractTableRow({ contract }: { contract: AdminContractRow }) {
  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <Link
          href={`/admin/contracts/${contract.id}`}
          className="font-bold text-blue-700 hover:underline"
        >
          {contract.contractCode}
        </Link>
        <p className="mt-1 text-xs text-slate-500">
          {contract.hasDocument ? "Có hồ sơ đính kèm" : "Chưa có tệp hợp đồng"}
        </p>
      </td>
      <td className="px-5 py-4">
        <Link
          href={`/admin/tenants/${contract.tenantId}`}
          className="font-semibold text-slate-900 hover:text-blue-700"
        >
          {contract.tenantName}
        </Link>
        <p className="mt-1 text-xs text-slate-500">
          {contract.tenantCode} · {contract.tenantPhone || "Chưa có SĐT"}
        </p>
      </td>
      <td className="px-5 py-4">
        <p className="font-semibold text-slate-900">{contract.propertyName}</p>
        <p className="mt-1 text-xs text-slate-500">Phòng {contract.roomCode}</p>
      </td>
      <td className="px-5 py-4">
        <p className="font-medium text-slate-800">
          {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
        </p>
        <RemainingDays value={contract.daysRemaining} />
      </td>
      <td className="px-5 py-4">
        <p className="font-bold text-slate-900">
          {formatCurrency(contract.monthlyRent)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Cọc {formatCurrency(contract.depositAmount)}
        </p>
      </td>
      <td className="px-5 py-4">
        <AdminContractStatusBadge status={contract.status} />
      </td>
      <td className="px-5 py-4 text-right">
        <Link
          href={`/admin/contracts/${contract.id}`}
          aria-label={`Xem hợp đồng ${contract.contractCode}`}
          className="inline-grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <Eye className="size-4" />
        </Link>
      </td>
    </tr>
  );
}

function ContractMobileCard({ contract }: { contract: AdminContractRow }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {contract.contractCode}
          </p>
          <h2 className="mt-1 font-bold text-slate-950">
            {contract.tenantName}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {contract.propertyName} · Phòng {contract.roomCode}
          </p>
        </div>
        <AdminContractStatusBadge status={contract.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Thời hạn</dt>
          <dd className="mt-1 font-semibold text-slate-800">
            {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Tiền thuê / tháng</dt>
          <dd className="mt-1 font-bold text-slate-900">
            {formatCurrency(contract.monthlyRent)}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between">
        <RemainingDays value={contract.daysRemaining} />
        <Link
          href={`/admin/contracts/${contract.id}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        >
          Xem chi tiết <ChevronRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}

function RemainingDays({ value }: { value: number }) {
  if (value < 0)
    return (
      <p className="mt-1 text-xs font-medium text-slate-500">Đã hết hạn</p>
    );
  return (
    <p
      className={`mt-1 text-xs font-medium ${value <= 30 ? "text-amber-700" : "text-slate-500"}`}
    >
      Còn {value} ngày
    </p>
  );
}

function Select({
  ariaLabel,
  value,
  onChange,
  placeholder,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Phân trang hợp đồng"
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <p className="text-sm text-slate-500">
        Trang <strong className="text-slate-900">{page + 1}</strong> /{" "}
        {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Trang trước"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
          className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Trang sau"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
