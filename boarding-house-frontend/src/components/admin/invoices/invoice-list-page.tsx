"use client";
import Link from "next/link";
import { InvoicePolicyPanel } from "./invoice-policy-panel";
import { useSearchParams } from "next/navigation";
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
import { useManagementProperty } from "@/providers/management-scope";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import { SummaryCard } from "@/components/shared/management-ui";
import { apiErrorMessage } from "@/lib/api-error";
import { useInvoiceData } from "@/hooks/use-admin-invoices";
import { adminInvoiceService } from "@/services/admin-invoice.service";
import { formatCurrency, formatDate } from "@/lib/format";
const input =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring";
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
      ? "bg-success-muted text-success"
      : status === "OVERDUE"
        ? "bg-danger-muted text-danger"
        : status === "DRAFT"
          ? "bg-muted text-secondary-foreground"
          : status === "PARTIALLY_PAID"
            ? "bg-warning-muted text-warning"
            : "bg-accent text-link";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}
    >
      {labels[status] || status}
    </span>
  );
}
export function InvoiceListPage({ debtOnly = false }: { debtOnly?: boolean }) {
  const params = useSearchParams();
  const roomFilter = Number(params.get("roomId")) || undefined;
  const [typed, setTyped] = useState("");
  const [keyword, setKeyword] = useState("");
  const [propertyId, setPropertyId] = useManagementProperty(
    Number(params.get("propertyId")) || undefined,
  );
  const [period, setPeriod] = useState(params.get("billingPeriod") ?? "");
  const [sort, setSort] = useState(debtOnly ? "debt" : "newest");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [status, setStatus] = useState(
    debtOnly ? "OUTSTANDING" : (params.get("status") ?? ""),
  );
  const [page, setPage] = useState(0);
  const [previousProperty, setPreviousProperty] = useState(propertyId);
  if (previousProperty !== propertyId) {
    setPreviousProperty(propertyId);
    setPage(0);
  }
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
      roomId: roomFilter,
      keyword: keyword || undefined,
      billingPeriod: period || undefined,
      status: status || undefined,
      page,
      size: 20,
      sort,
    }),
    [propertyId, roomFilter, keyword, period, status, page, sort],
  );
  const { summary, list, options } = useInvoiceData(filters);
  const exportData = async (format: "csv" | "xlsx") => {
    setExporting(true);
    setExportError("");
    try {
      await adminInvoiceService.export({ ...filters, format });
    } catch (error) {
      setExportError(apiErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };
  const s = summary.data,
    p = list.data;
  return (
    <AdminShell
      title={debtOnly ? "Quản lý công nợ" : "Quản lý hóa đơn"}
      subtitle="Lập hóa đơn, theo dõi thanh toán và quản lý công nợ"
      readOnly
    >
      <div className="mx-auto max-w-[1650px] space-y-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Tổng quan / Hóa đơn</p>
            <h1 className="mt-1 text-2xl font-extrabold">
              {debtOnly ? "Quản lý công nợ" : "Quản lý hóa đơn"}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={exporting}
              onClick={() => void exportData("xlsx")}
              className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold"
            >
              <Download className="size-4" />
              Xuất Excel
            </button>
            <Link
              href="/admin/invoices/generate"
              className="rounded-xl border bg-card px-3 py-2 text-sm font-semibold"
            >
              Lập hàng loạt
            </Link>
            <Link
              href="/admin/invoices/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white"
            >
              <FilePlus2 className="size-4" />
              Tạo hóa đơn
            </Link>
          </div>
        </div>
        {exportError && (
          <p role="alert" className="text-sm text-danger">
            {exportError}
          </p>
        )}
        <nav className="flex flex-wrap gap-3 text-sm">
          <Link className="text-link" href="/admin/invoices">
            Hóa đơn
          </Link>
          <Link className="text-link" href="/admin/invoices/generate">
            Lập nháp hàng tháng
          </Link>
          <Link className="text-link" href="/admin/invoices/debt">
            Công nợ
          </Link>
          <Link className="text-link" href="/admin/reports/payments">
            Lịch sử thanh toán
          </Link>
          <button
            disabled={exporting}
            onClick={() => void exportData("csv")}
            className="text-link"
          >
            Tải CSV cùng bộ lọc
          </button>
        </nav>
        {(summary.isLoading || list.isLoading || options.isLoading) && (
          <PageLoading />
        )}
        {(summary.isError || list.isError) && (
          <ErrorState
            onRetry={() => {
              void summary.refetch();
              void list.refetch();
            }}
          />
        )}
        {propertyId && (
          <InvoicePolicyPanel propertyId={propertyId} period={period} />
        )}
        {s && (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Tổng hóa đơn trong phạm vi"
              value={s.totalInvoiceCount ?? 0}
            />
            <SummaryCard
              label="Đã phát hành (gồm đã thanh toán)"
              value={s.issuedInvoiceCount ?? 0}
            />
            <SummaryCard label="Đã thanh toán" value={s.paidInvoiceCount} />
            <SummaryCard
              label="Người thuê còn nợ"
              value={s.debtTenantCount ?? 0}
            />
          </section>
        )}
        {debtOnly && s && (
          <section className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Tổng công nợ"
              value={formatCurrency(s.totalOutstandingAmount)}
            />
            <SummaryCard
              label="Trong hạn"
              value={formatCurrency(
                s.totalOutstandingAmount - (s.overdueOutstandingAmount ?? 0),
              )}
            />
            <SummaryCard
              label="Quá hạn"
              value={formatCurrency(s.overdueOutstandingAmount ?? 0)}
            />
          </section>
        )}
        {s && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Stat
              label="Tổng đã lập"
              value={formatCurrency(s.totalInvoiceAmount)}
              icon={<WalletCards />}
            />
            <Stat
              label="Đã thanh toán"
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
        <section className="surface-card p-4 ">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="relative xl:col-span-2">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
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
          <p className="mt-3 text-xs text-muted-foreground">
            Thống kê theo nhà trọ/kỳ, không cộng tiền cọc chưa cấn trừ. Xuất
            dùng đúng các bộ lọc của danh sách.
          </p>
          <label className="mt-3 block max-w-xs text-xs text-muted-foreground">
            Sắp xếp
            <select
              aria-label="Sắp xếp hóa đơn"
              className={input}
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(0);
              }}
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="due">Hạn gần nhất</option>
              <option value="amount">Số tiền cao nhất</option>
              <option value="debt">Công nợ cao nhất</option>
            </select>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["", "Tất cả"],
              ["OUTSTANDING", "Còn nợ"],
              ["ISSUED", "Đã phát hành"],
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
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === v ? "bg-primary hover:bg-primary-hover text-white" : "bg-muted text-secondary-foreground"}`}
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
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-link"
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
              <section className="overflow-hidden surface-card ">
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1200px] text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
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
                        <tr key={i.id} className="border-t hover:bg-accent/30">
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/invoices/${i.id}`}
                              className="font-bold text-link"
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
                                <small className="rounded bg-warning-muted px-1 text-warning">
                                  Điều chỉnh
                                </small>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {i.property.name}
                            <p className="text-xs text-muted-foreground">
                              {i.room.name} · {i.room.secondary}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {i.tenant.name}
                            <p className="text-xs text-muted-foreground">
                              {i.tenant.secondary}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {i.billingPeriod}
                            <p
                              className={
                                i.overdueDays > 0
                                  ? "text-xs font-semibold text-danger"
                                  : "text-xs text-muted-foreground"
                              }
                            >
                              Hạn {formatDate(i.dueDate)}
                              {i.overdueDays > 0
                                ? ` · quá ${i.overdueDays} ngày`
                                : ""}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <strong>{formatCurrency(i.totalAmount)}</strong>
                            {i.breakdown && (
                              <details className="mt-2 text-xs">
                                <summary className="cursor-pointer text-link">
                                  Các khoản tính tiền
                                </summary>
                                {Object.entries(i.breakdown).map(
                                  ([type, value]) => (
                                    <p
                                      key={type}
                                      className="mt-1 whitespace-nowrap"
                                    >
                                      {{
                                        rent: "Tiền phòng",
                                        electricity: "Điện",
                                        water: "Nước",
                                        services: "Dịch vụ",
                                        other: "Khoản khác",
                                        discount: "Giảm giá",
                                      }[type] ?? type}
                                      : {formatCurrency(value)}
                                    </p>
                                  ),
                                )}
                              </details>
                            )}
                          </td>
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
                              className="font-semibold text-link"
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
                        <strong className="text-link">
                          {i.invoiceCode}
                        </strong>
                        <InvoiceBadge status={i.status} />
                      </div>
                      <p className="mt-2 text-sm">
                        {i.room.name} · {i.tenant.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Kỳ {i.billingPeriod} · Hạn {formatDate(i.dueDate)}
                      </p>
                      <div className="mt-3 flex justify-between">
                        <strong>{formatCurrency(i.totalAmount)}</strong>
                        <span
                          className={
                            i.remainingAmount > 0
                              ? "font-semibold text-danger"
                              : "text-success"
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
                  className="rounded-lg border bg-card px-3 py-2 disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="px-3 py-2 text-sm">
                  {page + 1}/{Math.max(1, p.totalPages)}
                </span>
                <button
                  disabled={page + 1 >= p.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-lg border bg-card px-3 py-2 disabled:opacity-40"
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
    <article className="surface-card p-4 ">
      <span className="block size-5 text-link">{icon}</span>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-extrabold">{value}</p>
    </article>
  );
}
function Money({ value, danger }: { value: number; danger?: boolean }) {
  return (
    <td
      className={`px-4 py-3 text-right font-semibold ${danger ? "text-danger" : ""}`}
    >
      {formatCurrency(value)}
    </td>
  );
}
