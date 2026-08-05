"use client";

import { useState } from "react";
import { Download, ReceiptText } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTenantPayments } from "@/hooks/use-tenant-invoices";
import { tenantInvoiceService } from "@/services/tenant-invoice.service";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import { date, label, money, openBlob } from "./invoice-ui";

export function PaymentHistoryPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const query = useTenantPayments(user?.activeRole === "TENANT", page);
  if (query.isLoading) return <PageLoading />;
  async function receipt(id: number) {
    setError("");
    try {
      openBlob((await tenantInvoiceService.receipt(id)).data);
    } catch {
      setError("Không thể mở biên nhận giao dịch.");
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <p className="text-sm font-medium text-blue-600">
          Tài chính / Thanh toán
        </p>
        <h1 className="mt-1 text-3xl font-black">Lịch sử thanh toán</h1>
        <p className="mt-1 text-slate-500">
          Các khoản tiền đã được quản lý xác nhận.
        </p>
      </div>
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>
      )}
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !query.data?.content.length ? (
        <EmptyState text="Chưa có giao dịch thanh toán." />
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="p-4">Biên nhận</th>
                  <th className="p-4">Hóa đơn</th>
                  <th className="p-4">Thời gian</th>
                  <th className="p-4">Phương thức</th>
                  <th className="p-4 text-right">Số tiền</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {query.data.content.map((x) => (
                  <tr key={x.id} className="border-t">
                    <td className="p-4 font-semibold">
                      <ReceiptText className="mr-2 inline size-4 text-blue-600" />
                      {x.receiptCode}
                    </td>
                    <td className="p-4 text-blue-700">{x.invoiceCode}</td>
                    <td className="p-4">{date(x.paidAt)}</td>
                    <td className="p-4">{label(x.paymentMethod)}</td>
                    <td className="p-4 text-right font-bold text-emerald-700">
                      {money(x.amount)}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => receipt(x.id)}
                        className="inline-flex items-center gap-1 text-blue-600"
                      >
                        <Download className="size-4" />
                        Biên nhận
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {(query.data?.totalPages ?? 0) > 1 && (
        <div className="flex justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage((v) => v - 1)}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
          >
            Trang trước
          </button>
          <span className="py-2">
            {page + 1}/{query.data?.totalPages}
          </span>
          <button
            disabled={page + 1 === query.data?.totalPages}
            onClick={() => setPage((v) => v + 1)}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      )}
    </main>
  );
}
