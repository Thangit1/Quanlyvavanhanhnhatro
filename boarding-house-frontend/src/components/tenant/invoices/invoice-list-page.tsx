"use client";
import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  FileText,
  Search,
  WalletCards,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useInvoiceSummary,
  useTenantInvoices,
} from "@/hooks/use-tenant-invoices";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import { InvoiceBadge, date, money } from "./invoice-ui";
const tabs = [
  ["", "Tất cả"],
  ["UNPAID", "Chưa thanh toán"],
  ["PARTIALLY_PAID", "Một phần"],
  ["OVERDUE", "Quá hạn"],
  ["PAID", "Đã thanh toán"],
];
export function InvoiceListPage() {
  const { user } = useAuth();
  const enabled = user?.activeRole === "TENANT";
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const summary = useInvoiceSummary(enabled);
  const list = useTenantInvoices(enabled, {
    status,
    search,
    page,
    size: 10,
    sort: "createdAt,desc",
  });
  if (summary.isLoading || list.isLoading) return <PageLoading />;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Tài chính / Hóa đơn</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">
          Hóa đơn của tôi
        </h1>
        <p className="mt-1 text-slate-500">
          Theo dõi công nợ, hạn thanh toán và minh chứng đã gửi.
        </p>
      </div>
      {summary.isError ? (
        <ErrorState onRetry={() => void summary.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card
            icon={WalletCards}
            title="Công nợ còn lại"
            value={money(summary.data?.outstandingAmount ?? 0)}
          />
          <Card
            icon={AlertCircle}
            title="Hóa đơn quá hạn"
            value={String(summary.data?.overdueCount ?? 0)}
          />
          <Card
            icon={CalendarDays}
            title="Lần thanh toán gần nhất"
            value={
              summary.data?.lastPayment
                ? money(summary.data.lastPayment.amount)
                : "Chưa có"
            }
          />
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3 size-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Tìm mã hóa đơn, nhà trọ hoặc phòng..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 outline-none focus:border-blue-500"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map(([v, t]) => (
            <button
              key={v}
              onClick={() => {
                setStatus(v);
                setPage(0);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${status === v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>
      {list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.content.length ? (
        <EmptyState text="Không có hóa đơn phù hợp." />
      ) : (
        <div className="grid gap-4">
          {list.data.content.map((x) => (
            <Link
              key={x.id}
              href={`/tenant/invoices/${x.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-blue-600" />
                    <h2 className="font-bold text-slate-900">
                      {x.invoiceCode}
                    </h2>
                    <InvoiceBadge status={x.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {x.propertyName} · Phòng {x.roomCode} · Kỳ {x.billingPeriod}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-950">
                    {money(x.remainingAmount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    còn phải trả / {money(x.totalAmount)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-sm">
                <span>
                  Hạn: {date(x.dueDate)}
                  {x.overdueDays > 0 && (
                    <b className="ml-2 text-red-600">
                      quá {x.overdueDays} ngày
                    </b>
                  )}
                </span>
                <span className="font-semibold text-blue-600">
                  Xem chi tiết →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {(list.data?.totalPages ?? 0) > 1 && (
        <div className="flex justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
          >
            Trang trước
          </button>
          <span className="py-2">
            {page + 1}/{list.data?.totalPages}
          </span>
          <button
            disabled={page + 1 === (list.data?.totalPages ?? 0)}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      )}
    </main>
  );
}
function Card({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof WalletCards;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="size-6 text-blue-600" />
      <p className="mt-3 text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}
