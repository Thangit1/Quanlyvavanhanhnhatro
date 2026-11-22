"use client";
import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
type Review = {
  id: number;
  version: number;
  decision: string;
  reason: string;
  status: string;
  response?: string;
  responder?: string;
};
export function ContractReviewPanel({
  portal,
  contractId,
  version,
  hash,
  canRequest,
  canRespond,
}: {
  portal: "admin" | "tenant" | "accountant";
  contractId: number;
  version: number;
  hash: string;
  canRequest: boolean;
  canRespond: boolean;
}) {
  const base = `/${portal}/contract-onboarding/${contractId}`;
  const client = useQueryClient();
  const lock = useRef(false);
  const retry = useRef({ body: "", key: "" });
  const [decision, setDecision] = useState("REQUEST_CHANGES");
  const [reason, setReason] = useState("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const query = useScopedQuery({
    queryKey: ["contract-reviews", portal, contractId],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Review[]>>(base + "/reviews", {
          signal,
        })
      ).data.data,
  });
  const pending = query.data?.some(
    (r) => r.status === "OPEN" && r.version === version,
  );
  async function request(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const body = {
        decision,
        reason: reason.trim(),
        version,
        contentHash: hash,
      };
      const text = JSON.stringify(body);
      if (retry.current.body !== text)
        retry.current = { body: text, key: crypto.randomUUID() };
      await apiClient.post(base + "/reviews", body, {
        headers: { "Idempotency-Key": retry.current.key },
      });
      setReason("");
      await client.invalidateQueries();
      setMessage(
        "Đã gửi yêu cầu tới bên cho thuê. Hãy chờ phản hồi hoặc đọc phiên bản mới trước khi xác nhận.",
      );
    } catch (e) {
      setMessage(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function respond(id: number) {
    if (lock.current || !response.trim()) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await apiClient.post(base + `/reviews/${id}/response`, {
        reason: response.trim(),
      });
      setResponse("");
      await client.invalidateQueries();
      setMessage(
        "Đã lưu phản hồi. Người thuê tự quyết định xác nhận sau khi đọc nội dung.",
      );
    } catch (e) {
      setMessage(apiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Yêu cầu xem lại hợp đồng"
      className="space-y-3 rounded-xl border p-4"
    >
      <h3 className="font-semibold">Yêu cầu xem lại hợp đồng</h3>
      {pending && (
        <p className="text-sm text-warning">
          Đang chờ phản hồi yêu cầu xem lại. Tạm dừng xác nhận phiên bản hiện
          tại.
        </p>
      )}
      {canRequest && !pending && (
        <form onSubmit={request} className="space-y-3">
          <label className="block text-sm">
            Yêu cầu
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2"
            >
              <option value="REQUEST_CHANGES">Yêu cầu chỉnh sửa</option>
              <option value="DECLINE">Từ chối nội dung hiện tại</option>
            </select>
          </label>
          <label className="block text-sm">
            Nội dung cần làm rõ
            <textarea
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Yêu cầu cần bên cho thuê xử lý; không tự hủy hợp đồng hoặc xử lý
            tiền.
          </p>
          <button
            disabled={busy}
            className="rounded-xl border px-4 py-2 disabled:opacity-50"
          >
            {busy ? "Đang gửi…" : "Gửi yêu cầu xem lại"}
          </button>
        </form>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-danger">
          Không tải được yêu cầu xem lại.{" "}
          <button onClick={() => void query.refetch()}>Thử lại</button>
        </p>
      )}
      {query.data?.map((r) => (
        <article
          key={r.id}
          className="space-y-2 rounded-xl bg-muted p-3 text-sm"
        >
          <p className="font-semibold">
            Phiên bản {r.version} ·{" "}
            {r.decision === "DECLINE"
              ? "Từ chối nội dung"
              : "Yêu cầu chỉnh sửa"}{" "}
            ·{" "}
            {r.status === "OPEN"
              ? "Chờ phản hồi"
              : r.status === "SUPERSEDED"
                ? "Đã có phiên bản mới"
                : "Đã phản hồi"}
          </p>
          <p className="whitespace-pre-wrap">{r.reason}</p>
          {r.response && (
            <p className="whitespace-pre-wrap">
              {r.responder || "Bên cho thuê"}: {r.response}
            </p>
          )}
          {canRespond && r.status === "OPEN" && (
            <div className="space-y-2">
              <p>
                Có thể chỉnh sửa điều khoản trên trang hợp đồng để tạo phiên bản
                mới, hoặc giải thích nội dung hiện tại ở đây.
              </p>
              <textarea
                aria-label="Phản hồi yêu cầu hợp đồng"
                maxLength={1000}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                className="w-full rounded-xl border p-2"
              />
              <button
                type="button"
                disabled={busy || !response.trim()}
                onClick={() => void respond(r.id)}
                className="rounded-xl bg-primary px-4 py-2 text-white disabled:opacity-50"
              >
                Phản hồi cho người thuê
              </button>
            </div>
          )}
        </article>
      ))}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
