"use client";
import Link from "next/link";
import { GatewayPaymentPanel } from "./gateway-payment-panel";
import { VietQrPanel } from "./vietqr-panel";
import { useRef, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Copy, Upload } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useInvoiceActions,
  useTenantInvoice,
  useActivePaymentSession,
} from "@/hooks/use-tenant-invoices";
import { apiErrorMessage } from "@/lib/api-error";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import type { PaymentMethod } from "@/types/tenant-invoice";
import { money } from "./invoice-ui";
function nowLocal() {
  const d = new Date(),
    pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function InvoicePaymentPage({ invoiceId }: { invoiceId: number }) {
  const { user } = useAuth();
  const q = useTenantInvoice(user?.activeRole === "TENANT", invoiceId);
  const a = useInvoiceActions(invoiceId);
  const active = useActivePaymentSession(
    user?.activeRole === "TENANT",
    invoiceId,
  );
  const [method, setMethod] = useState("");
  const session = active.data;
  const [file, setFile] = useState<File>();
  const [at, setAt] = useState(nowLocal());
  const [bank, setBank] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  if (q.isLoading || active.isLoading) return <PageLoading />;
  if (q.isError || active.isError || !q.data)
    return (
      <main className="p-6">
        <ErrorState
          onRetry={() => {
            void q.refetch();
            void active.refetch();
          }}
        />
      </main>
    );
  const d = q.data;
  if (!d.permissions.canPay)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link href={`/tenant/invoices/${invoiceId}`} className="text-link">
          ← Quay lại hóa đơn
        </Link>
        <div className="mt-6 surface-card p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <h1 className="mt-3 text-2xl font-black">
            {d.remainingAmount > 0
              ? "Chưa thể thanh toán ở thời điểm này"
              : "Hóa đơn không còn số dư phải trả"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Trạng thái: {d.status}. Thanh toán từ{" "}
            {d.paymentAvailableFrom ?? d.issueDate ?? "ngày phát hành"} đến hết{" "}
            {d.dueDate}; quá hạn vẫn được thanh toán số dư hợp lệ.
          </p>
        </div>
      </main>
    );
  async function create() {
    setMessage("");
    try {
      idempotencyKey.current ??=
        globalThis.crypto?.randomUUID?.() ??
        `tenant-payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const s = await a.session.mutateAsync({
        amount: d.remainingAmount,
        paymentMethod: method,
        idempotencyKey: idempotencyKey.current,
      });
      await active.refetch();
      idempotencyKey.current = null;
      setMessage(
        s.status === "EXPIRED"
          ? "Phiên đã hết hạn. Vui lòng thử lại."
          : "Đã tạo hướng dẫn thanh toán.",
      );
    } catch (e) {
      setMessage(apiErrorMessage(e, "Không thể tạo phiên thanh toán."));
    }
  }
  async function proof() {
    if (!session || !file || !at || !reference.trim()) return;
    setMessage("");
    try {
      await a.proof.mutateAsync({
        sessionId: session.id,
        amount: session.amount,
        transferredAt: at,
        bankName: bank,
        transactionReference: reference,
        note,
        file,
      });
      setMessage(
        "Đã gửi minh chứng. Khoản tiền chỉ được ghi nhận sau khi quản lý xác nhận.",
      );
      setFile(undefined);
      await active.refetch();
    } catch (e) {
      setMessage(apiErrorMessage(e, "Không thể gửi minh chứng."));
    }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Link
        href={`/tenant/invoices/${invoiceId}`}
        className="inline-flex items-center gap-2 font-semibold text-secondary-foreground"
      >
        <ArrowLeft className="size-4" />
        Chi tiết hóa đơn
      </Link>
      <div>
        <h1 className="text-3xl font-black">Thanh toán {d.invoiceCode}</h1>
        <p className="mt-1 text-muted-foreground">
          Còn phải trả: <b className="text-link">{money(d.remainingAmount)}</b>
        </p>
      </div>
      {message && (
        <div className="rounded-xl border border-accent-border bg-accent p-3 text-link">
          {message}
        </div>
      )}
      {d.status === "OVERDUE" && (
        <p className="rounded-xl bg-warning-muted p-4 text-warning">
          Hóa đơn của bạn đã quá hạn. Vui lòng thanh toán toàn bộ số tiền còn
          phải trả.
        </p>
      )}
      <GatewayPaymentPanel invoiceId={invoiceId} />
      {!session ? (
        <section className="surface-card p-6 ">
          <h2 className="text-xl font-bold">1. Chọn phương thức</h2>
          {!d.paymentMethods.length ? (
            <p className="mt-4 rounded-xl bg-warning-muted p-4 text-warning">
              Chủ trọ chưa cấu hình phương thức thanh toán. Vui lòng liên hệ
              quản lý.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {d.paymentMethods.map((x) => (
                  <button
                    key={x.code}
                    onClick={() => {
                      setMethod(x.code);
                      idempotencyKey.current = null;
                    }}
                    className={`rounded-xl border p-4 text-left ${method === x.code ? "border-blue-600 bg-accent" : "border-border"}`}
                  >
                    <Building2 className="size-5 text-link" />
                    <b className="mt-2 block">{x.label}</b>
                    {x.code === "BANK_TRANSFER" && (
                      <span className="text-sm text-muted-foreground">
                        {x.bankName} · {x.accountNumber}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {method && (
                <div className="mt-5">
                  <label className="text-sm font-semibold">Số tiền</label>
                  <p className="mt-1 rounded-xl bg-muted p-3 font-bold">
                    {money(d.remainingAmount)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Thanh toán toàn bộ số dư, bao gồm phần còn thiếu sau đối
                    soát.
                  </p>
                  <button
                    disabled={d.remainingAmount <= 0 || a.session.isPending}
                    onClick={create}
                    className="mt-5 rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 font-bold text-white disabled:opacity-50"
                  >
                    Tiếp tục
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <>
          <section className="surface-card p-6 ">
            <h2 className="text-xl font-bold">2. Hướng dẫn thanh toán</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Phiên hết hạn lúc{" "}
              {new Date(session.expiresAt).toLocaleString("vi-VN")}
            </p>
            <p className="mt-2 font-semibold">
              {session.status === "PROOF_SUBMITTED"
                ? "Đang chờ đối soát chuyển khoản"
                : "Đang chờ kết quả thanh toán"}
            </p>
            <button
              className="mt-2 text-link underline"
              onClick={() => {
                void active.refetch();
                void q.refetch();
              }}
            >
              Kiểm tra lại trạng thái
            </button>
            {session.status === "PROOF_SUBMITTED" ? (
              <p className="mt-4 rounded-xl bg-warning-muted p-4 text-warning">
                Minh chứng đã được gửi. Vui lòng chờ nhân viên kiểm tra khoản
                thực thu trước khi chuyển thêm tiền.
              </p>
            ) : session.paymentMethod === "CASH" ? (
              <p className="mt-4 rounded-xl bg-accent p-4 text-link">
                Vui lòng thanh toán {money(session.amount)} trực tiếp tại văn
                phòng quản lý và nhận biên nhận sau khi nhân viên xác nhận.
              </p>
            ) : (
              <>
                <BankInfo
                  method={d.paymentMethods.find(
                    (x) => x.code === "BANK_TRANSFER",
                  )}
                  content={session.transferContent}
                  amount={session.amount}
                />
                <VietQrPanel invoiceId={invoiceId} sessionId={session.id} />
              </>
            )}
          </section>
          {session.paymentMethod === "BANK_TRANSFER" &&
            session.status === "AWAITING_TRANSFER" && (
              <section className="surface-card p-6 ">
                <h2 className="text-xl font-bold">
                  3. Gửi minh chứng chuyển khoản
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  JPG, PNG, WEBP hoặc PDF; tối đa 5 MB. Minh chứng không tự động
                  xác nhận thanh toán.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Thời gian chuyển"
                    type="datetime-local"
                    value={at}
                    onChange={setAt}
                  />
                  <Field
                    label="Ngân hàng đã chuyển"
                    value={bank}
                    onChange={setBank}
                  />
                  <Field
                    label="Mã giao dịch ngân hàng (bắt buộc)"
                    value={reference}
                    onChange={setReference}
                  />
                  <Field label="Ghi chú" value={note} onChange={setNote} />
                </div>
                <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-blue-300 bg-accent p-4 text-link">
                  <Upload className="size-5" />
                  <span>{file?.name ?? "Chọn tệp minh chứng"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size <= 5 * 1024 * 1024) setFile(f);
                      else if (f) setMessage("Tệp không được vượt quá 5 MB.");
                    }}
                  />
                </label>
                <button
                  disabled={
                    !file || !at || !reference.trim() || a.proof.isPending
                  }
                  onClick={proof}
                  className="mt-5 rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 font-bold text-white disabled:opacity-50"
                >
                  Gửi minh chứng
                </button>
              </section>
            )}
        </>
      )}
    </main>
  );
}
function BankInfo({
  method,
  content,
  amount,
}: {
  method?: PaymentMethod;
  content?: string;
  amount: number;
}) {
  if (!method) return null;
  return (
    <div className="mt-4 space-y-2 rounded-xl bg-muted p-4">
      <p>
        Số tiền: <b>{money(amount)}</b>
      </p>
      <p>
        Ngân hàng: <b>{method.bankName}</b>
      </p>
      <p>
        Chủ tài khoản: <b>{method.accountName}</b>
      </p>
      <p>
        Số tài khoản: <b>{method.accountNumber}</b>
      </p>
      {method.bankBranch && (
        <p>
          Chi nhánh: <b>{method.bankBranch}</b>
        </p>
      )}
      <div className="flex items-center justify-between rounded-lg bg-card p-3">
        <span>
          Nội dung: <b>{content}</b>
        </span>
        <button
          onClick={() => void navigator.clipboard.writeText(content ?? "")}
          title="Sao chép"
        >
          <Copy className="size-4" />
        </button>
      </div>
    </div>
  );
}
function Field({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-xl border p-3 font-normal"
      />
    </label>
  );
}
