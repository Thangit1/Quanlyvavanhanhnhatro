"use client";
import { requiredNumericValue, numericPreview } from "@/lib/numeric-input";
import { CurrencyInput } from "@/components/ui/number-input";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { MonthlyBillingPanel } from "@/components/shared/monthly-billing-panel";
import { useRef, useState } from "react";
import { Download, Printer, Send, WalletCards } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { InvoiceBadge } from "@/components/admin/invoices/invoice-list-page";
import {
  useInvoiceDetail,
  useInvoiceMutations,
} from "@/hooks/use-admin-invoices";
import { adminInvoiceService } from "@/services/admin-invoice.service";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";
const input =
  "w-full rounded-xl border border-border px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring";
function localDateTime() {
  const d = new Date(),
    z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:00`;
}
export function InvoiceDetailPage({ id }: { id: number }) {
  const client = useQueryClient();
  const [recalculating, setRecalculating] = useState(false);
  const q = useInvoiceDetail(id);
  const m = useInvoiceMutations(id);
  const [dialog, setDialog] = useState<
    "payment" | "adjust" | "cancel" | "remind" | null
  >(null);
  const [amount, setAmount] = useState<number | string>(0);
  const [type, setType] = useState("DECREASE");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState(false);
  const [paidAt, setPaidAt] = useState(localDateTime);
  const actionInFlight = useRef(false);
  const [error, setError] = useState("");
  const paymentAttempt = useRef<{
    signature: string;
    key: string;
    paidAt: string;
  } | null>(null);
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return (
      <AdminShell title="Chi tiết hóa đơn">
        <ErrorState onRetry={() => void q.refetch()} />
      </AdminShell>
    );
  const d = q.data;
  const action = async () => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setError("");
    try {
      if (dialog === "payment") {
        if (!received)
          throw new Error("Xác nhận đã nhận tiền thực tế trước khi ghi sổ.");
        if (method === "BANK_TRANSFER" && !reference.trim())
          throw new Error("Cần mã giao dịch ngân hàng đã đối soát.");
        const signature = JSON.stringify({
          amount: requiredNumericValue(amount),
          method,
          reference,
          paidAt,
          reason,
          version: d.version,
        });
        if (paymentAttempt.current?.signature !== signature)
          paymentAttempt.current = {
            signature,
            key: globalThis.crypto.randomUUID(),
            paidAt,
          };
        const payload = {
          amount: requiredNumericValue(amount),
          paymentMethod: method,
          paidAt: paymentAttempt.current.paidAt,
          note: reason,
          referenceCode: reference.trim() || undefined,
          version: d.version,
        };
        await m.payment.mutateAsync({
          ...payload,
          idempotencyKey: paymentAttempt.current.key,
        });
        paymentAttempt.current = null;
      }
      if (dialog === "adjust")
        await m.adjust.mutateAsync({
          adjustmentType: type,
          amount: requiredNumericValue(amount),
          reason,
          version: d.version,
        });
      if (dialog === "cancel")
        await m.cancel.mutateAsync({ reason, version: d.version });
      if (dialog === "remind") await m.remind.mutateAsync({ channel: type });
      setDialog(null);
      setReason("");
    } catch (e) {
      setError(apiErrorMessage(e, e instanceof Error ? e.message : undefined));
    } finally {
      actionInFlight.current = false;
    }
  };
  return (
    <AdminShell
      title={d.invoiceCode}
      subtitle={`${d.property.name} · ${d.room.name}`}
      readOnly
    >
      <div className="mx-auto max-w-6xl space-y-5">
        {error && !dialog && (
          <p
            role="alert"
            className="rounded-xl bg-danger-muted p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        {d.status === "DRAFT" && (
          <>
            <MonthlyBillingPanel contractId={d.contract.id} />
            <details className="rounded-2xl border bg-card p-5">
              <summary>Kiểm tra nguồn và tính lại bản nháp</summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setError("");
                  setRecalculating(true);
                  try {
                    const [month, year] = d.billingPeriod.split("/");
                    const period = d.billingPeriod.includes("/")
                      ? `${year}-${month.padStart(2, "0")}`
                      : d.billingPeriod;
                    await apiClient.put(`/admin/invoices/${id}/recalculate`, {
                      roomId: d.room.id,
                      contractId: d.contract.id,
                      billingPeriod: period,
                      periodStartDate: d.periodStartDate,
                      periodEndDate: d.periodEndDate,
                      issueDate:
                        d.issueDate ?? new Date().toISOString().slice(0, 10),
                      dueDate: f.get("due"),
                      additionalItems: d.items
                        .filter((x) => x.sourceType === "MANUAL")
                        .map((x) => ({
                          name: x.name,
                          quantity: x.quantity,
                          unit: x.unit,
                          unitPrice: x.unitPrice,
                          reason: x.description,
                        })),
                      discountAmount: Number(f.get("discount")),
                      includePreviousDebt: false,
                      note: f.get("reason"),
                      action: "SAVE_DRAFT",
                      version: d.version,
                    });
                    await client.invalidateQueries();
                  } catch (e) {
                    setError(apiErrorMessage(e));
                  } finally {
                    setRecalculating(false);
                  }
                }}
              >
                <label className="block text-sm">
                  Giảm giá
                  <CurrencyInput
                    required
                    name="discount"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={d.discountAmount}
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  Hạn thanh toán
                  <input
                    required
                    name="due"
                    type="date"
                    defaultValue={d.dueDate}
                    className={input}
                  />
                </label>
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  placeholder="Lý do điều chỉnh và căn cứ giảm giá (nếu có)"
                  className={input}
                />
                <button
                  disabled={recalculating}
                  className="rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40"
                >
                  Tính lại theo nguồn đã kiểm tra
                </button>
              </form>
            </details>
          </>
        )}
        <div className="flex flex-wrap justify-between gap-3">
          <Link
            href="/admin/invoices"
            className="text-sm font-semibold text-link"
          >
            ← Danh sách hóa đơn
          </Link>
          <div className="flex flex-wrap gap-2">
            {d.permissions.canIssue && (
              <button
                disabled={m.issue.isPending}
                onClick={async () => {
                  if (
                    actionInFlight.current ||
                    !window.confirm(
                      `Phát hành ${d.invoiceCode} với tổng tiền ${formatCurrency(d.totalAmount)}? Hãy kiểm tra kỳ sử dụng và khoảng thanh toán.`,
                    )
                  )
                    return;
                  actionInFlight.current = true;
                  setError("");
                  try {
                    await m.issue.mutateAsync(d.version);
                  } catch (error) {
                    setError(apiErrorMessage(error));
                  } finally {
                    actionInFlight.current = false;
                  }
                }}
                className="rounded-xl bg-primary hover:bg-primary-hover px-3 py-2 text-sm font-semibold text-white"
              >
                Phát hành
              </button>
            )}
            {d.permissions.canRecordPayment && (
              <button
                onClick={() => {
                  setAmount(d.remainingAmount);
                  setReceived(false);
                  setReference("");
                  setPaidAt(localDateTime());
                  setDialog("payment");
                }}
                className="rounded-xl bg-primary hover:bg-primary-hover px-3 py-2 text-sm font-semibold text-white"
              >
                <WalletCards className="mr-1 inline size-4" />
                Ghi nhận thanh toán
              </button>
            )}
            {d.permissions.canSendReminder && (
              <button
                onClick={() => {
                  setType("IN_APP");
                  setDialog("remind");
                }}
                className="rounded-xl border bg-card px-3 py-2 text-sm font-semibold"
              >
                <Send className="mr-1 inline size-4" />
                Nhắc thanh toán
              </button>
            )}
            <button
              onClick={() =>
                void adminInvoiceService
                  .print(id)
                  .catch((e) => setError(apiErrorMessage(e)))
              }
              className="rounded-xl border bg-card px-3 py-2 text-sm font-semibold"
            >
              <Download className="mr-1 inline size-4" />
              In / Lưu PDF
            </button>
            <button
              onClick={() =>
                void adminInvoiceService
                  .print(id)
                  .catch((e) => setError(apiErrorMessage(e)))
              }
              className="rounded-xl border bg-card px-3 py-2 text-sm font-semibold"
            >
              <Printer className="mr-1 inline size-4" />
              In
            </button>
          </div>
        </div>
        <section className="surface-card p-6 print:border-0 print:shadow-none">
          <div className="flex flex-col justify-between gap-5 sm:flex-row">
            <div>
              <InvoiceBadge status={d.status} />
              <h1 className="mt-3 text-3xl font-extrabold">
                HÓA ĐƠN {d.invoiceCode}
              </h1>
              <p className="mt-2 text-muted-foreground">
                Kỳ {d.billingPeriod} · {formatDate(d.periodStartDate)}–
                {formatDate(d.periodEndDate)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-muted-foreground">Còn phải thu</p>
              <p
                className={`text-3xl font-extrabold ${d.remainingAmount > 0 ? "text-danger" : "text-success"}`}
              >
                {formatCurrency(d.remainingAmount)}
              </p>
              <p className="text-sm text-muted-foreground">
                Thanh toán từ{" "}
                {formatDate(d.paymentAvailableFrom ?? d.issueDate)} đến hết{" "}
                {formatDate(d.dueDate)}
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Khu trọ" value={d.property.name} />
            <Info label="Phòng" value={d.room.name} />
            <Info label="Người thuê" value={d.tenant.name} />
            <Info label="Hợp đồng" value={d.contract.name} />
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3">Khoản thu</th>
                  <th className="p-3">Diễn giải</th>
                  <th className="p-3 text-right">Số lượng</th>
                  <th className="p-3 text-right">Đơn giá</th>
                  <th className="p-3 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((x) => (
                  <tr key={x.id} className="border-t">
                    <td className="p-3 font-semibold">{x.name}</td>
                    <td className="p-3 text-muted-foreground">{x.description}</td>
                    <td className="p-3 text-right">
                      {x.quantity} {x.unit}
                    </td>
                    <td className="p-3 text-right">
                      {formatCurrency(x.unitPrice)}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(x.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto mt-5 max-w-md space-y-2 text-sm">
            <Line label="Cộng tiền hàng" value={d.subtotalAmount} />
            <Line label="Giảm giá" value={-d.discountAmount} />
            <Line
              label="Nợ cũ tham khảo (không cộng vào tổng)"
              value={d.previousDebtAmount}
            />
            <Line label="Phí chậm thanh toán" value={d.lateFeeAmount} />
            <Line label="Tổng cộng" value={d.totalAmount} strong />
            <Line label="Đã thanh toán" value={d.paidAmount} />
            <Line label="Còn lại" value={d.remainingAmount} strong />
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <Card title="Lịch sử thanh toán">
            {d.payments.map((x) => (
              <div
                key={x.id}
                className="flex justify-between border-b py-3 text-sm"
              >
                <span>
                  <strong>{x.receiptCode}</strong>
                  <small className="block text-muted-foreground">
                    {x.paymentMethod} · {formatDate(x.paidAt, true)} ·{" "}
                    {x.status === "REVERSED" ? "Đã đảo" : "Đã xác nhận"}
                  </small>
                </span>
                <strong
                  className={
                    x.status === "REVERSED"
                      ? "text-muted-foreground line-through"
                      : "text-success"
                  }
                >
                  {formatCurrency(x.amount)}
                </strong>
              </div>
            ))}
            {!d.payments.length && (
              <p className="text-sm text-muted-foreground">Chưa có thanh toán.</p>
            )}
          </Card>
          <Card title="Lịch sử thay đổi">
            {d.history.map((x) => (
              <div key={x.id} className="border-b py-3 text-sm">
                <strong>{x.action}</strong>
                <p className="text-muted-foreground">
                  {x.actorName} · {formatDate(x.createdAt, true)} · {x.reason}
                </p>
              </div>
            ))}
            {!d.history.length && (
              <p className="text-sm text-muted-foreground">Chưa có lịch sử.</p>
            )}
          </Card>
        </section>
        <div className="flex flex-wrap gap-2">
          {d.permissions.canAdjust && (
            <button
              onClick={() => {
                setAmount(0);
                setType("DECREASE");
                setDialog("adjust");
              }}
              className="rounded-xl border bg-card px-4 py-2 text-sm font-semibold"
            >
              Tạo điều chỉnh
            </button>
          )}
          {d.permissions.canCancel && (
            <button
              onClick={() => setDialog("cancel")}
              className="rounded-xl border border-danger-border bg-card px-4 py-2 text-sm font-semibold text-danger"
            >
              Hủy hóa đơn
            </button>
          )}
        </div>
      </div>
      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 print:hidden">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-card p-6"
          >
            <h2 className="text-lg font-bold">
              {dialog === "payment"
                ? "Ghi nhận thanh toán"
                : dialog === "adjust"
                  ? "Điều chỉnh hóa đơn"
                  : dialog === "cancel"
                    ? "Hủy hóa đơn"
                    : "Gửi nhắc thanh toán"}
            </h2>
            {dialog === "payment" && (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Mặc định thu đủ số dư. Chỉ ghi số tiền thực nhận; chuyển khoản
                  phải được đối chiếu ngân hàng, ảnh minh chứng chưa đủ để ghi
                  đã thu.
                </p>
                <label className="mt-3 block text-sm">
                  Thời điểm thực thu
                  <input
                    type="datetime-local"
                    className={input}
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </label>
                <label className="mt-3 block text-sm">
                  Mã giao dịch / chứng từ
                  <input
                    className={input}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <label className="mt-3 flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={received}
                    onChange={(e) => setReceived(e.target.checked)}
                  />
                  Tôi đã nhận và đối chiếu số tiền thực tế
                </label>
                <CurrencyInput
                  type="number"
                  min="1"
                  max={d.remainingAmount}
                  className={`${input} mt-4`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <select
                  className={`${input} mt-3`}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                  <option value="CASH">Tiền mặt</option>
                  <option value="CARD">Thẻ</option>
                </select>
              </>
            )}
            {dialog === "adjust" && (
              <>
                <select
                  className={`${input} mt-4`}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="DECREASE">Giảm phải thu</option>
                  <option value="INCREASE">Tăng phải thu</option>
                </select>
                <CurrencyInput
                  type="number"
                  min="1"
                  className={`${input} mt-3`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </>
            )}
            {dialog === "remind" && (
              <select
                className={`${input} mt-4`}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="IN_APP">Thông báo trong ứng dụng</option>
              </select>
            )}
            {dialog !== "remind" && (
              <textarea
                className={`${input} mt-3 min-h-20`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  dialog === "payment" ? "Ghi chú" : "Lý do bắt buộc"
                }
              />
            )}{" "}
            {error && (
              <p className="mt-3 rounded-xl bg-danger-muted p-3 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setDialog(null);
                  setError("");
                }}
                className="rounded-xl border px-4 py-2"
              >
                Đóng
              </button>
              <button
                onClick={() => void action()}
                disabled={
                  m.payment.isPending ||
                  m.adjust.isPending ||
                  m.cancel.isPending ||
                  m.remind.isPending ||
                  (dialog === "payment" &&
                    (!received ||
                      !paidAt ||
                      (method === "BANK_TRANSFER" && !reference.trim()))) ||
                  (dialog !== "remind" && dialog !== "payment" && !reason) ||
                  ((dialog === "payment" || dialog === "adjust") &&
                    numericPreview(amount) <= 0)
                }
                className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "border-t pt-2 text-lg font-extrabold" : ""}`}
    >
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card p-5 sm:p-6 ">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
