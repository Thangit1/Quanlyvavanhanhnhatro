"use client";
import { useState } from "react";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
type Transaction = {
  id: number;
  invoice_code?: string;
  provider: string;
  environment: string;
  transactionStatus: string;
  status: string;
  amount: number;
  realMoney: boolean;
  canReconcile: boolean;
  result_code?: string;
};
type Page = { content: Transaction[]; totalPages: number };
const labels: Record<string, string> = {
  PENDING: "Đang chờ",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  REVIEW_REQUIRED: "Cần đối soát",
};
function nowLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function PaymentTransactionsPanel({
  management = false,
}: {
  management?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [decision, setDecision] = useState<{ id: number; action: string }>();
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(nowLocal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useScopedQuery({
    queryKey: ["payment-transactions", management, page],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<Page>>(
          management ? "/payments/transactions" : "/tenant/gateway-sessions",
          { params: { page, size: 20 } },
        )
      ).data.data,
  });
  async function resolve() {
    if (!decision || !note.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`/payments/transactions/${decision.id}/reconcile`, {
        action: decision.action,
        note,
        paidAt: decision.action === "CONFIRM" ? paidAt : null,
      });
      setDecision(undefined);
      setNote("");
      await query.refetch();
    } catch (failure) {
      setError(apiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface-card mx-auto my-6 max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Giao dịch và đối soát thanh toán</h2>
        <button
          className="rounded-xl border px-3 py-2 text-sm"
          onClick={() => void query.refetch()}
        >
          Làm mới
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Giao dịch thử nghiệm và giả lập được lưu riêng, không được tính vào
        doanh thu đã thu. Biên nhận tiền thực tế nằm trong lịch sử thu tiền.
      </p>
      {query.isLoading ? (
        <p>Đang tải giao dịch…</p>
      ) : query.isError ? (
        <p role="alert" className="text-danger">
          {apiErrorMessage(query.error)}
        </p>
      ) : !query.data?.content.length ? (
        <p className="text-muted-foreground">
          Chưa có giao dịch gateway hoặc giả lập.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Hóa đơn</th>
                <th>Phương thức</th>
                <th>Số tiền</th>
                <th>Kết quả</th>
                <th>Thực thu</th>
                {management && <th>Đối soát</th>}
              </tr>
            </thead>
            <tbody>
              {query.data.content.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-3">{row.invoice_code ?? `#${row.id}`}</td>
                  <td>
                    {row.provider === "SIMULATED" ? "Giả lập" : row.provider}
                    <span className="block text-xs text-muted-foreground">
                      {row.environment === "TEST"
                        ? "Thử nghiệm — không thu tiền thật"
                        : "Thực tế"}
                    </span>
                  </td>
                  <td>
                    {new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                    }).format(row.amount)}
                  </td>
                  <td>
                    {labels[row.transactionStatus] ?? row.transactionStatus}
                  </td>
                  <td>{row.realMoney ? "Đã ghi nhận" : "Chưa ghi nhận"}</td>
                  {management && (
                    <td>
                      {row.canReconcile &&
                        row.status === "REVIEW_REQUIRED" &&
                        row.environment === "PRODUCTION" && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-lg border px-2 py-1 text-link"
                              onClick={() => {
                                setDecision({ id: row.id, action: "CONFIRM" });
                                setError("");
                              }}
                            >
                              Xác nhận thực thu
                            </button>
                            <button
                              className="rounded-lg border px-2 py-1"
                              onClick={() => {
                                setDecision({
                                  id: row.id,
                                  action: "NO_COLLECTION",
                                });
                                setError("");
                              }}
                            >
                              Ghi nhận xử lý ngoài hệ thống
                            </button>
                          </div>
                        )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-end gap-3 text-sm">
        <button
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          className="disabled:opacity-40"
        >
          Trước
        </button>
        <span>Trang {page + 1}</span>
        <button
          disabled={!query.data || page + 1 >= query.data.totalPages}
          onClick={() => setPage(page + 1)}
          className="disabled:opacity-40"
        >
          Sau
        </button>
      </div>
      {decision && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quyết định đối soát"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void resolve();
            }}
            className="w-full max-w-lg space-y-4 rounded-3xl bg-card p-6 shadow-xl"
          >
            <h3 className="text-xl font-bold">Lưu quyết định đối soát</h3>
            <p className="text-sm">
              Chỉ xác nhận thực thu sau khi kiểm tra sao kê hoặc dữ liệu nhà
              cung cấp. Hệ thống kiểm tra lại số dư và quyền của bạn trước khi
              lập phiếu thu.
            </p>
            <label className="block text-sm">
              Căn cứ và lý do
              <textarea
                required
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1 min-h-24 w-full rounded-xl border bg-background p-3"
              />
            </label>
            {decision.action === "CONFIRM" && (
              <label className="block text-sm">
                Thời điểm thực nhận tiền
                <input
                  type="datetime-local"
                  required
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background p-3"
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDecision(undefined)}
              >
                Đóng
              </button>
              <button
                disabled={busy || !note.trim()}
                className="rounded-xl bg-primary px-4 py-2 text-white disabled:opacity-50"
              >
                Lưu quyết định
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
