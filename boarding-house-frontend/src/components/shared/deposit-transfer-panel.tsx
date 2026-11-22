/* eslint-disable @next/next/no-img-element */
"use client";
import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
type Request = {
  id: number;
  amount: number;
  bank_reference: string;
  evidence: string;
  status: string;
  review_reason?: string;
};
type Info = {
  amount: number;
  transferContent: string;
  bankAvailable: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  qr: { available: boolean; qrUrl?: string };
};
export function DepositTransferPanel({
  portal,
  id,
  canReview,
  ready,
  remaining,
}: {
  portal: "admin" | "accountant" | "tenant";
  id: number;
  canReview: boolean;
  ready: boolean;
  remaining: number;
}) {
  const client = useQueryClient();
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [evidence, setEvidence] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const lock = useRef(false);
  const retry = useRef({ body: "", key: "" });
  const base = `/${portal}/deposit-ledger/${id}`;
  const list = useScopedQuery({
    queryKey: ["deposit-transfer-requests", portal, id],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Request[]>>(
          base + "/transfer-requests",
          { signal },
        )
      ).data.data,
  });
  const info = useScopedQuery({
    queryKey: ["deposit-transfer-info", portal, id],
    enabled: portal === "tenant" && ready && remaining > 0,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Info>>(base + "/transfer-info", {
          signal,
        })
      ).data.data,
  });
  const pending = list.data?.some((r) => r.status === "PENDING");
  async function declare(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const body = {
        bankReference: reference.trim(),
        evidence: evidence.trim(),
      };
      const text = JSON.stringify(body);
      if (retry.current.body !== text)
        retry.current = { body: text, key: crypto.randomUUID() };
      await apiClient.post(base + "/transfer-requests", body, {
        headers: { "Idempotency-Key": retry.current.key },
      });
      setMessage(
        "Đã gửi yêu cầu. Tiền cọc chưa được ghi nhận cho tới khi người có quyền xác minh thực thu.",
      );
      await client.invalidateQueries();
    } catch (e) {
      setMessage(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function review(request: number, approve: boolean) {
    if (lock.current || !reason.trim()) return;
    if (
      !window.confirm(
        approve
          ? "Xác nhận đã kiểm tra giao dịch ngân hàng và thực nhận đủ số tiền này?"
          : "Từ chối yêu cầu đối soát này?",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await apiClient.post(base + `/transfer-requests/${request}/review`, {
        approve,
        reason: reason.trim(),
      });
      setReason("");
      await client.invalidateQueries();
      setMessage("Đã cập nhật kết quả đối soát.");
    } catch (e) {
      setMessage(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h4 className="font-semibold">Nộp và đối soát tiền cọc</h4>
      {portal === "tenant" && (
        <>
          {!ready ? (
            <p className="text-sm text-warning">
              Hai bên cần xác nhận cùng phiên bản hợp đồng trước khi nộp cọc.
            </p>
          ) : remaining > 0 ? (
            <>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  aria-pressed={method === "CASH"}
                  className="rounded-lg border px-3 py-2"
                  onClick={() => setMethod("CASH")}
                >
                  Tiền mặt
                </button>
                <button
                  type="button"
                  aria-pressed={method === "BANK_TRANSFER"}
                  className="rounded-lg border px-3 py-2"
                  onClick={() => setMethod("BANK_TRANSFER")}
                >
                  Chuyển khoản
                </button>
              </div>
              {method === "CASH" ? (
                <p className="text-sm">
                  Nộp tiền cho người có thẩm quyền. Kế toán/chủ nhà sẽ ghi nhận
                  sau khi thực nhận; không tự đánh dấu đã thanh toán.
                </p>
              ) : info.isLoading ? (
                <p role="status">Đang tải thông tin nhận cọc…</p>
              ) : info.data?.bankAvailable ? (
                <>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>Ngân hàng: {info.data.bankName}</div>
                    <div>Chủ tài khoản: {info.data.accountName}</div>
                    <div>Số tài khoản: {info.data.accountNumber}</div>
                    <div>Số tiền: {formatCurrency(info.data.amount)}</div>
                    <div>
                      Nội dung: <strong>{info.data.transferContent}</strong>
                    </div>
                  </dl>
                  {info.data.qr.available && !qrFailed && (
                    <img
                      src={info.data.qr.qrUrl}
                      alt="VietQR nộp cọc, chưa xác nhận thu tiền"
                      className="mx-auto max-h-72 max-w-full"
                      onError={() => setQrFailed(true)}
                    />
                  )}
                  <p className="text-sm text-warning">
                    QR và minh chứng chuyển khoản không tự xác nhận tiền đã
                    nhận.
                  </p>
                  <form onSubmit={declare} className="space-y-3">
                    <label className="block text-sm">
                      Mã giao dịch ngân hàng
                      <input
                        required
                        maxLength={100}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="mt-1 w-full rounded-xl border p-2"
                      />
                    </label>
                    <label className="block text-sm">
                      Minh chứng/căn cứ giao dịch
                      <textarea
                        required
                        maxLength={500}
                        value={evidence}
                        onChange={(e) => setEvidence(e.target.value)}
                        className="mt-1 w-full rounded-xl border p-2"
                      />
                    </label>
                    <button
                      disabled={busy || pending}
                      className="rounded-xl bg-primary px-4 py-2 text-white disabled:opacity-50"
                    >
                      {pending
                        ? "Đang chờ đối soát"
                        : busy
                          ? "Đang gửi…"
                          : "Gửi yêu cầu đối soát"}
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm">
                  Chưa có cấu hình chuyển khoản hợp lệ hoặc chưa tải được hướng
                  dẫn. Liên hệ quản lý hoặc chọn tiền mặt.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-success">
              Không còn tiền cọc phải nộp theo sổ hiện tại.
            </p>
          )}
        </>
      )}
      {list.isError && (
        <p role="alert" className="text-sm text-danger">
          Không tải được lịch sử đối soát.{" "}
          <button onClick={() => void list.refetch()}>Thử lại</button>
        </p>
      )}
      {!!list.data?.length && (
        <div className="space-y-3">
          {canReview && pending && (
            <label className="block text-sm">
              Kết quả kiểm tra và căn cứ xác nhận
              <textarea
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2"
              />
            </label>
          )}
          {list.data.map((r) => (
            <article
              key={r.id}
              className="space-y-2 rounded-xl bg-muted p-3 text-sm"
            >
              <p>
                {r.bank_reference} · {formatCurrency(r.amount)} ·{" "}
                {r.status === "PENDING"
                  ? "Chờ đối soát"
                  : r.status === "CONFIRMED"
                    ? "Đã xác nhận thực thu"
                    : "Đã từ chối"}
              </p>
              <p className="break-words">{r.evidence}</p>
              {r.review_reason && <p>{r.review_reason}</p>}
              {canReview && r.status === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-50"
                    onClick={() => void review(r.id, true)}
                  >
                    Xác nhận thực thu
                  </button>
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    className="rounded-lg border px-3 py-2 disabled:opacity-50"
                    onClick={() => void review(r.id, false)}
                  >
                    Từ chối
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
