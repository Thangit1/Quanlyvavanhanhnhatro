"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Download,
  MessageSquareWarning,
  Printer,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useInvoiceActions,
  useTenantInvoice,
} from "@/hooks/use-tenant-invoices";
import { tenantInvoiceService } from "@/services/tenant-invoice.service";
import { apiErrorMessage } from "@/lib/api-error";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import { InvoiceBadge, date, label, money, openBlob } from "./invoice-ui";
export function InvoiceDetailPage({ invoiceId }: { invoiceId: number }) {
  const { user } = useAuth();
  const q = useTenantInvoice(user?.activeRole === "TENANT", invoiceId);
  const actions = useInvoiceActions(invoiceId);
  const [review, setReview] = useState(false);
  const [issue, setIssue] = useState("OTHER");
  const [description, setDescription] = useState("");
  const [item, setItem] = useState("");
  const [message, setMessage] = useState("");
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void q.refetch()} />
      </main>
    );
  const d = q.data;
  async function document() {
    try {
      const r = await tenantInvoiceService.document(invoiceId);
      openBlob(r.data);
    } catch (e) {
      setMessage(apiErrorMessage(e, "Không thể mở bản in hóa đơn."));
    }
  }
  async function submitReview() {
    setMessage("");
    try {
      await actions.review.mutateAsync({
        invoiceItemId: item ? Number(item) : undefined,
        issueType: issue,
        description,
      });
      setReview(false);
      setDescription("");
      setMessage("Đã gửi yêu cầu rà soát.");
    } catch (e) {
      setMessage(apiErrorMessage(e, "Không thể gửi yêu cầu rà soát."));
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <Link
        href="/tenant/invoices"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Danh sách hóa đơn
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-950">
              {d.invoiceCode}
            </h1>
            <InvoiceBadge status={d.status} />
          </div>
          <p className="mt-2 text-slate-500">
            Kỳ {d.billingPeriod} · {d.property.name} · Phòng {d.room.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={document}
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-semibold"
          >
            <Download className="size-4" />
            Bản in
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-semibold"
          >
            <Printer className="size-4" />
            In trang
          </button>
          {d.permissions.canRequestReview && (
            <button
              onClick={() => setReview(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-semibold text-amber-800"
            >
              <MessageSquareWarning className="size-4" />
              Yêu cầu rà soát
            </button>
          )}
          {d.permissions.canPay && (
            <Link
              href={`/tenant/invoices/${invoiceId}/payment`}
              className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white"
            >
              Thanh toán
            </Link>
          )}
        </div>
      </div>
      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-800">
          {message}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Chi tiết hạng mục</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="p-3">Hạng mục</th>
                  <th className="p-3">Số lượng</th>
                  <th className="p-3">Đơn giá</th>
                  <th className="p-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((x) => (
                  <tr key={x.id} className="border-t">
                    <td className="p-3">
                      <b>{x.name}</b>
                      <p className="text-xs text-slate-500">{x.description}</p>
                    </td>
                    <td className="p-3">
                      {x.quantity} {x.unit}
                    </td>
                    <td className="p-3">{money(x.unitPrice)}</td>
                    <td className="p-3 text-right font-semibold">
                      {money(x.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Tổng thanh toán</h2>
          <Rows
            rows={[
              ["Tạm tính", d.subtotalAmount],
              ["Giảm trừ", -d.discountAmount],
              ["Nợ kỳ trước", d.previousDebtAmount],
              ["Phí trễ hạn", d.lateFeeAmount],
            ]}
          />
          <div className="mt-3 flex justify-between border-t pt-3 text-lg font-black">
            <span>Tổng cộng</span>
            <span>{money(d.totalAmount)}</span>
          </div>
          <div className="mt-2 flex justify-between text-emerald-700">
            <span>Đã thanh toán</span>
            <b>{money(d.paidAmount)}</b>
          </div>
          <div className="mt-2 flex justify-between rounded-xl bg-blue-50 p-3 text-blue-800">
            <span>Còn lại</span>
            <b>{money(d.remainingAmount)}</b>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Hạn thanh toán:{" "}
            <b
              className={
                d.status === "OVERDUE" ? "text-red-600" : "text-slate-800"
              }
            >
              {date(d.dueDate)}
            </b>
          </p>
          {d.permissions.canPay && !d.paymentMethods.length && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Chủ trọ chưa cấu hình phương thức thanh toán. Vui lòng liên hệ
              quản lý.
            </p>
          )}
        </aside>
      </div>
      {d.utilityReadings.length > 0 && (
        <Section title="Chỉ số điện nước">
          <div className="grid gap-3 sm:grid-cols-2">
            {d.utilityReadings.map((x) => (
              <div key={x.type} className="rounded-xl bg-slate-50 p-4">
                <b>{label(x.type)}</b>
                <p className="mt-2 text-sm">
                  Chỉ số: {x.previousValue} → {x.currentValue}
                </p>
                <p>
                  Tiêu thụ: <b>{x.consumption}</b>
                </p>
                <p className="text-blue-700">{money(x.amount)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Thanh toán đã xác nhận">
          {d.payments.length ? (
            d.payments.map((x) => (
              <div key={x.id} className="flex justify-between border-b py-3">
                <div>
                  <b>{x.receiptCode}</b>
                  <p className="text-xs text-slate-500">
                    {label(x.paymentMethod)} · {date(x.paidAt)}
                  </p>
                </div>
                <b className="text-emerald-700">{money(x.amount)}</b>
              </div>
            ))
          ) : (
            <EmptyState text="Chưa có thanh toán." />
          )}
        </Section>
        <Section title="Minh chứng đã gửi">
          {d.paymentProofs.length ? (
            d.paymentProofs.map((x) => (
              <div key={x.id} className="flex justify-between border-b py-3">
                <div>
                  <b>{x.originalName}</b>
                  <p className="text-xs text-slate-500">
                    {date(x.transferredAt)} ·{" "}
                    {x.transactionReference || "Không có mã tham chiếu"}
                  </p>
                </div>
                <InvoiceBadge status={x.status} />
              </div>
            ))
          ) : (
            <EmptyState text="Chưa gửi minh chứng." />
          )}
        </Section>
      </div>
      <Section title="Yêu cầu rà soát">
        {d.reviewRequests.length ? (
          d.reviewRequests.map((x) => (
            <div key={x.id} className="border-b py-3">
              <div className="flex justify-between">
                <b>
                  {x.requestCode} · {label(x.issueType)}
                </b>
                <InvoiceBadge status={x.status} />
              </div>
              <p className="mt-1 text-sm text-slate-600">{x.description}</p>
              {x.managerResponse && (
                <p className="mt-2 rounded-lg bg-blue-50 p-2 text-sm">
                  Phản hồi: {x.managerResponse}
                </p>
              )}
            </div>
          ))
        ) : (
          <EmptyState text="Chưa có yêu cầu rà soát." />
        )}
      </Section>
      {review && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-black">Yêu cầu rà soát hóa đơn</h2>
            <label className="mt-4 block text-sm font-semibold">
              Hạng mục (không bắt buộc)
            </label>
            <select
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="mt-1 w-full rounded-xl border p-3"
            >
              <option value="">Toàn bộ hóa đơn</option>
              {d.items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-sm font-semibold">
              Loại vấn đề
            </label>
            <select
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="mt-1 w-full rounded-xl border p-3"
            >
              <option value="WRONG_READING">Sai chỉ số</option>
              <option value="WRONG_PRICE">Sai đơn giá</option>
              <option value="WRONG_QUANTITY">Sai số lượng</option>
              <option value="MISSING_DISCOUNT">Thiếu giảm trừ</option>
              <option value="OTHER">Khác</option>
            </select>
            <label className="mt-3 block text-sm font-semibold">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={4}
              className="mt-1 w-full rounded-xl border p-3"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setReview(false)}
                className="rounded-xl border px-4 py-2"
              >
                Đóng
              </button>
              <button
                disabled={!description.trim() || actions.review.isPending}
                onClick={submitReview}
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                Gửi yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
function Rows({ rows }: { rows: Array<[string, number]> }) {
  return (
    <div className="mt-4 space-y-2 text-sm">
      {rows
        .filter(([, v]) => v !== 0)
        .map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-slate-500">{k}</span>
            <span>{money(v)}</span>
          </div>
        ))}
    </div>
  );
}
