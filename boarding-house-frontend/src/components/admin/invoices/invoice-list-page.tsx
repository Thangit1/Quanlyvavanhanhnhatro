"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Download,
  FileClock,
  FilePlus2,
  RefreshCw,
  Search,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import { useInvoiceData } from "@/hooks/use-admin-invoices";
import { adminInvoiceService } from "@/services/admin-invoice.service";
import { formatCurrency, formatDate } from "@/lib/format";
const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500";
const labels: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING_REVIEW: "Chờ kiểm tra",
  ISSUED: "Đã phát hành",
  UNPAID: "Chưa thanh toán",
  PARTIALLY_PAID: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  ADJUSTED: "Đã điều chỉnh",
  CANCELLED: "Đã hủy",
};
export function InvoiceBadge({ status }: { status: string }) {
  const c =
    status === "PAID"
      ? "bg-emerald-100 text-emerald-700"
      : status === "OVERDUE"
        ? "bg-red-100 text-red-700"
        : status === "DRAFT"
          ? "bg-slate-100 text-slate-700"
          : status === "PARTIALLY_PAID"
            ? "bg-amber-100 text-amber-700"
            : "bg-blue-100 text-blue-700";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}
    >
      {labels[status] || status}
    </span>
  );
}
export function InvoiceListPage() {
  const [typed, setTyped] = useState("");
  const [keyword, setKeyword] = useState("");
  const [propertyId, setPropertyId] = useState<number>();
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(typed.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [typed]);
  const filters = useMemo(
    () => ({
      propertyId,
      keyword: keyword || undefined,
      billingPeriod: period || undefined,
      status: status || undefined,
      page,
      size: 20,
    }),
    [propertyId, keyword, period, status, page],
  );
  const { summary, list, options } = useInvoiceData(filters);
  if (summary.isLoading || list.isLoading || options.isLoading)
    return <PageLoading />;
  const s = summary.data,
    p = list.data;
  return (
    <AdminShell
      title="Quản lý hóa đơn"
      subtitle="Lập hóa đơn, theo dõi thanh toán và quản lý công nợ"
      readOnly
    >
      <div className="mx-auto max-w-[1650px] space-y-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm text-slate-500">Tổng quan / Hóa đơn</p>
            <h1 className="mt-1 text-2xl font-extrabold">Quản lý hóa đơn</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                void adminInvoiceService.export({
                  propertyId,
                  billingPeriod: period || undefined,
                  status: status || undefined,
                })
              }
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"
            >
              <Download className="size-4" />
              Xuất dữ liệu
            </button>
            <Link
              href="/admin/invoices/generate"
              className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold"
            >
              Lập hàng loạt
            </Link>
            <Link
              href="/admin/invoices/new"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <FilePlus2 className="size-4" />
              Tạo hóa đơn
            </Link>
          </div>
        </div>
        {(summary.isError || list.isError) && (
          <ErrorState
            onRetry={() => {
              void summary.refetch();
              void list.refetch();
            }}
          />
        )}
        {s && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Stat
              label="Tổng đã lập"
              value={formatCurrency(s.totalInvoiceAmount)}
              icon={<WalletCards />}
            />
            <Stat
              label="Đã thu"
              value={formatCurrency(s.totalPaidAmount)}
              icon={<Banknote />}
            />
            <Stat
              label="Công nợ"
              value={formatCurrency(s.totalOutstandingAmount)}
              icon={<TriangleAlert />}
            />
            <Stat
              label="Tỷ lệ thu"
              value={`${s.collectionRate}%`}
              icon={<Banknote />}
            />
            <Stat
              label="Bản nháp"
              value={String(s.draftInvoiceCount)}
              icon={<FileClock />}
            />
            <Stat
              label="Chưa thu"
              value={String(s.unpaidInvoiceCount)}
              icon={<FileClock />}
            />
            <Stat
              label="Một phần"
              value={String(s.partiallyPaidInvoiceCount)}
              icon={<FileClock />}
            />
            <Stat
              label="Quá hạn"
              value={String(s.overdueInvoiceCount)}
              icon={<TriangleAlert />}
            />
          </section>
        )}
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="relative xl:col-span-2">
              <Search className="absolute left-3 top-3 size-4 text-slate-400" />
              <input
                className={`${input} pl-9`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Mã hóa đơn, phòng, người thuê, hợp đồng..."
              />
            </label>
            <select
              className={input}
              value={propertyId || ""}
              onChange={(e) => {
                setPropertyId(
                  e.target.value ? Number(e.target.value) : undefined,
                );
                setPage(0);
              }}
            >
              <option value="">Tất cả khu trọ</option>
              {options.data?.properties.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
            <input
              type="month"
              className={input}
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(0);
              }}
            />
            <select
              className={input}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(labels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["", "Tất cả"],
              ["DRAFT", "Bản nháp"],
              ["UNPAID", "Chờ thanh toán"],
              ["PARTIALLY_PAID", "Thanh toán một phần"],
              ["PAID", "Đã thanh toán"],
              ["OVERDUE", "Quá hạn"],
              ["CANCELLED", "Đã hủy"],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => {
                  setStatus(v);
                  setPage(0);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {l}
              </button>
            ))}
            <button
              onClick={() => {
                setTyped("");
                setKeyword("");
                setPropertyId(undefined);
                setPeriod("");
                setStatus("");
                setPage(0);
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
            >
              <RefreshCw className="size-3" />
              Xóa bộ lọc
            </button>
          </div>
        </section>
        {p && p.content.length === 0 ? (
          <EmptyState text="Không tìm thấy hóa đơn phù hợp." />
        ) : (
          p && (
            <>
              <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1200px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        {[
                          "Mã hóa đơn",
                          "Khu trọ / Phòng",
                          "Người thuê",
                          "Kỳ / Hạn",
                          "Tổng tiền",
                          "Đã thu",
                          "Còn lại",
                          "Trạng thái",
                          "",
                        ].map((x) => (
                          <th key={x} className="px-4 py-3">
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {p.content.map((i) => (
                        <tr key={i.id} className="border-t hover:bg-blue-50/30">
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/invoices/${i.id}`}
                              className="font-bold text-blue-700"
                            >
                              {i.invoiceCode}
                            </Link>
                            <div className="mt-1 flex gap-1">
                              {i.automated && (
                                <small className="rounded bg-violet-50 px-1 text-violet-700">
                                  Tự động
                                </small>
                              )}
                              {i.hasAdjustment && (
                                <small className="rounded bg-amber-50 px-1 text-amber-700">
                                  Điều chỉnh
                                </small>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {i.property.name}
                            <p className="text-xs text-slate-500">
                              {i.room.name} · {i.room.secondary}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {i.tenant.name}
                            <p className="text-xs text-slate-500">
                              {i.tenant.secondary}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {i.billingPeriod}
                            <p
                              className={
                                i.overdueDays > 0
                                  ? "text-xs font-semibold text-red-600"
                                  : "text-xs text-slate-500"
                              }
                            >
                              Hạn {formatDate(i.dueDate)}
                              {i.overdueDays > 0
                                ? ` · quá ${i.overdueDays} ngày`
                                : ""}
                            </p>
                          </td>
                          <Money value={i.totalAmount} />
                          <Money value={i.paidAmount} />
                          <Money
                            value={i.remainingAmount}
                            danger={i.overdueDays > 0}
                          />
                          <td className="px-4 py-3">
                            <InvoiceBadge status={i.status} />
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/invoices/${i.id}`}
                              className="font-semibold text-blue-600"
                            >
                              Chi tiết →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 p-3 lg:hidden">
                  {p.content.map((i) => (
                    <Link
                      href={`/admin/invoices/${i.id}`}
                      key={i.id}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex justify-between gap-2">
                        <strong className="text-blue-700">
                          {i.invoiceCode}
                        </strong>
                        <InvoiceBadge status={i.status} />
                      </div>
                      <p className="mt-2 text-sm">
                        {i.room.name} · {i.tenant.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        Kỳ {i.billingPeriod} · Hạn {formatDate(i.dueDate)}
                      </p>
                      <div className="mt-3 flex justify-between">
                        <strong>{formatCurrency(i.totalAmount)}</strong>
                        <span
                          className={
                            i.remainingAmount > 0
                              ? "font-semibold text-red-600"
                              : "text-emerald-600"
                          }
                        >
                          Còn {formatCurrency(i.remainingAmount)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
              <div className="flex justify-end gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                  className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="px-3 py-2 text-sm">
                  {page + 1}/{Math.max(1, p.totalPages)}
                </span>
                <button
                  disabled={page + 1 >= p.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </>
          )
        )}
      </div>
    </AdminShell>
  );
}
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm">
      <span className="block size-5 text-blue-600">{icon}</span>
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-extrabold">{value}</p>
    </article>
  );
}
function Money({ value, danger }: { value: number; danger?: boolean }) {
  return (
    <td
      className={`px-4 py-3 text-right font-semibold ${danger ? "text-red-600" : ""}`}
    >
      {formatCurrency(value)}
    </td>
  );
}
