"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Copy, Upload } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useInvoiceActions,
  useTenantInvoice,
} from "@/hooks/use-tenant-invoices";
import { apiErrorMessage } from "@/lib/api-error";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import type { PaymentMethod, PaymentSession } from "@/types/tenant-invoice";
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
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState(0);
  const [session, setSession] = useState<PaymentSession>();
  const [file, setFile] = useState<File>();
  const [at, setAt] = useState(nowLocal());
  const [bank, setBank] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void q.refetch()} />
      </main>
    );
  const d = q.data;
  if (!d.permissions.canPay)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link href={`/tenant/invoices/${invoiceId}`} className="text-blue-600">
          ← Quay lại hóa đơn
        </Link>
        <div className="mt-6 rounded-2xl border bg-white p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <h1 className="mt-3 text-2xl font-black">
            Hóa đơn không cần thanh toán
          </h1>
          <p className="mt-2 text-slate-500">Trạng thái hiện tại: {d.status}</p>
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
        amount,
        paymentMethod: method,
        idempotencyKey: idempotencyKey.current,
      });
      setSession(s);
      setMessage("Đã tạo hướng dẫn thanh toán.");
    } catch (e) {
      setMessage(apiErrorMessage(e, "Không thể tạo phiên thanh toán."));
    }
  }
  async function proof() {
    if (!session || !file) return;
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
    } catch (e) {
      setMessage(apiErrorMessage(e, "Không thể gửi minh chứng."));
    }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <Link
        href={`/tenant/invoices/${invoiceId}`}
        className="inline-flex items-center gap-2 font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Chi tiết hóa đơn
      </Link>
      <div>
        <h1 className="text-3xl font-black">Thanh toán {d.invoiceCode}</h1>
        <p className="mt-1 text-slate-500">
          Còn phải trả:{" "}
          <b className="text-blue-700">{money(d.remainingAmount)}</b>
        </p>
      </div>
      {message && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-800">
          {message}
        </div>
      )}
      {!session ? (
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">1. Chọn phương thức</h2>
          {!d.paymentMethods.length ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-800">
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
                      setAmount(d.remainingAmount);
                    }}
                    className={`rounded-xl border p-4 text-left ${method === x.code ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}
                  >
                    <Building2 className="size-5 text-blue-600" />
                    <b className="mt-2 block">{x.label}</b>
                    {x.code === "BANK_TRANSFER" && (
                      <span className="text-sm text-slate-500">
                        {x.bankName} · {x.accountNumber}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {method && (
                <div className="mt-5">
                  <label className="text-sm font-semibold">Số tiền</label>
                  <input
                    type="number"
                    min={1}
                    max={d.remainingAmount}
                    disabled={
                      !d.paymentMethods.find((x) => x.code === method)
                        ?.allowPartialPayment
                    }
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border p-3 disabled:bg-slate-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Không được vượt quá {money(d.remainingAmount)}.
                  </p>
                  <button
                    disabled={
                      amount <= 0 ||
                      amount > d.remainingAmount ||
                      a.session.isPending
                    }
                    onClick={create}
                    className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50"
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
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">2. Hướng dẫn thanh toán</h2>
            <p className="mt-2 text-sm text-slate-500">
              Phiên hết hạn lúc{" "}
              {new Date(session.expiresAt).toLocaleString("vi-VN")}
            </p>
            {session.paymentMethod === "CASH" ? (
              <p className="mt-4 rounded-xl bg-blue-50 p-4 text-blue-800">
                Vui lòng thanh toán {money(session.amount)} trực tiếp tại văn
                phòng quản lý và nhận biên nhận sau khi nhân viên xác nhận.
              </p>
            ) : (
              <BankInfo
                method={d.paymentMethods.find(
                  (x) => x.code === "BANK_TRANSFER",
                )}
                content={session.transferContent}
              />
            )}
          </section>
          {session.paymentMethod === "BANK_TRANSFER" && (
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">
                3. Gửi minh chứng chuyển khoản
              </h2>
              <p className="mt-1 text-sm text-slate-500">
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
                  label="Mã giao dịch"
                  value={reference}
                  onChange={setReference}
                />
                <Field label="Ghi chú" value={note} onChange={setNote} />
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-blue-700">
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
                disabled={!file || !at || a.proof.isPending}
                onClick={proof}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50"
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
}: {
  method?: PaymentMethod;
  content?: string;
}) {
  if (!method) return null;
  return (
    <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4">
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
      <div className="flex items-center justify-between rounded-lg bg-white p-3">
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
      {method.qrEnabled && (
        <p className="text-sm text-amber-700">
          QR chưa có nguồn ảnh được cấu hình nên không hiển thị. Vui lòng dùng
          thông tin tài khoản ở trên.
        </p>
      )}
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
