"use client";

import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";

type Row = Record<string, string | number | null>;
type Detail = Row & { transactions: Row[]; refunds: Row[] };
const input = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
const labels: Record<string, string> = {
  COLLECT: "Thực thu",
  TRANSFER_IN: "Nhận điều chuyển",
  TRANSFER_OUT: "Chuyển sang hợp đồng",
  DEDUCT: "Bù trừ công nợ",
  FORFEIT: "Giữ lại theo thỏa thuận",
  REFUND: "Thực hoàn",
  REQUESTED: "Chờ duyệt",
  APPROVED: "Đã duyệt, chờ chi",
  PARTIAL: "Đã hoàn một phần",
  PAID: "Đã hoàn đủ",
  NEEDS_REVIEW: "Cần đối soát",
  VERIFIED: "Đã đối soát",
};

export function DepositLedgerPanel({
  portal,
  contractId,
  propertyId,
  depositId,
}: {
  portal: "admin" | "accountant" | "tenant";
  contractId?: number;
  propertyId?: number;
  depositId?: number;
}) {
  const base = `/${portal}/deposit-ledger`;
  const { user } = useAuth();
  const client = useQueryClient();
  const [selected, setSelected] = useState<number>();
  const [action, setAction] = useState<{
    kind: "collect" | "refund" | "pay" | "amend" | "transfer";
    refundId?: number;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef("");
  const list = useQuery({
    queryKey: ["deposit-ledger", portal, user?.id, user?.activeRole],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<Row[]>>(base)).data.data,
  });
  const rows = (list.data ?? []).filter(
    (r) =>
      (!contractId || Number(r.contract_id) === contractId) &&
      (!propertyId || Number(r.property_id) === propertyId),
  );
  const id = rows.some((r) => Number(r.id) === selected)
    ? selected
    : rows.some((r) => Number(r.id) === depositId)
      ? depositId
      : rows[0]
        ? Number(rows[0].id)
        : undefined;
  const current = rows.find((r) => Number(r.id) === id);
  const detail = useQuery({
    queryKey: ["deposit-ledger-detail", portal, user?.id, user?.activeRole, id],
    enabled: !!id,
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<Detail>>(`${base}/${id}`)).data.data,
  });
  const canWrite = portal !== "tenant";
  const canApprove =
    user?.activeRole === "OWNER" || user?.activeRole === "MANAGER";
  async function perform(path: string, payload?: unknown, idempotent = false) {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(
        `${base}/${id}/${path}`,
        payload,
        idempotent
          ? { headers: { "Idempotency-Key": key.current } }
          : undefined,
      );
      setAction(undefined);
      key.current = "";
      await client.invalidateQueries();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "");
    if (action?.kind === "refund")
      return perform("refunds", {
        amount: Number(value("amount")),
        retainedAmount: Number(value("retained") || 0),
        reason: value("reason"),
      });
    if (action?.kind === "amend")
      return perform("requirement", {
        amount: Number(value("amount")),
        amendment: value("evidence"),
        reason: value("reason"),
      });
    key.current ||= crypto.randomUUID();
    if (action?.kind === "transfer")
      return perform(
        "transfers",
        {
          targetDepositId: Number(value("target")),
          amount: Number(value("amount")),
          amendment: value("evidence"),
          reason: value("reason"),
        },
        true,
      );
    return perform(
      action?.kind === "pay"
        ? `refunds/${action.refundId}/payments`
        : "collections",
      {
        amount: Number(value("amount")),
        method: value("method"),
        occurredAt: value("at"),
        reference: value("reference") || null,
        evidence: value("evidence"),
        reason: value("reason"),
        reconciled: data.has("reconciled"),
      },
      true,
    );
  }
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">Sổ tiền giữ chỗ và tiền cọc</h2>
        <button
          className={input}
          onClick={() =>
            void client.invalidateQueries({ queryKey: ["deposit-ledger"] })
          }
        >
          Tải lại
        </button>
      </div>
      {(list.isError || detail.isError || error) && (
        <p role="alert" className="text-sm text-red-700">
          {error || apiErrorMessage(list.error || detail.error)}
        </p>
      )}
      {list.isLoading ? (
        <p>Đang tải sổ cọc...</p>
      ) : !rows.length ? (
        <p className="text-sm text-slate-500">
          Chưa có sổ cọc trong phạm vi này.
        </p>
      ) : (
        <>
          <select
            aria-label="Chọn sổ cọc"
            className={`${input} w-full`}
            value={id}
            onChange={(e) => {
              setSelected(Number(e.target.value));
              setAction(undefined);
              setError("");
            }}
          >
            {rows.map((r) => (
              <option key={r.id} value={Number(r.id)}>
                {r.booking_code
                  ? `Giữ chỗ ${r.booking_code}`
                  : `Hợp đồng ${r.contract_code}`}{" "}
                ·{" "}
                {labels[String(r.reconciliation_status)] ??
                  r.reconciliation_status}
              </option>
            ))}
          </select>
          {current && (
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              {[
                ["Theo thỏa thuận", current.required_amount],
                ["Đã nhận hợp lệ", current.received_amount],
                ["Thu trực tiếp", current.collected_amount],
                ["Nhận điều chuyển nội bộ", current.transferred_amount],
                ["Còn thiếu", current.remaining_deposit_due],
                ["Đang giữ", current.balance_amount],
                ["Chờ hoàn (chưa thực chi)", current.refund_due],
                ["Đã hoàn thực tế", current.refunded_amount],
                ["Đã khấu trừ / giữ lại", current.deducted_amount],
              ].map(([label, amount]) => (
                <p key={String(label)} className="rounded-xl bg-slate-50 p-3">
                  {label}
                  <strong className="mt-1 block">
                    {formatCurrency(Number(amount))}
                  </strong>
                </p>
              ))}
            </div>
          )}
          {current?.reconciliation_status !== "VERIFIED" && (
            <p className="text-sm text-amber-700">
              Dữ liệu lịch sử cần đối soát chứng từ; số dư chưa được xác nhận.
              Hệ thống chặn ghi sổ mới trên hồ sơ này.
            </p>
          )}
          {canWrite && current?.reconciliation_status === "VERIFIED" && (
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                className={input}
                onClick={() => {
                  key.current = "";
                  setAction({ kind: "collect" });
                }}
              >
                Ghi nhận thực thu
              </button>
              <button
                disabled={busy}
                className={input}
                onClick={() => setAction({ kind: "refund" })}
              >
                Đề nghị hoàn / xử lý giữ chỗ
              </button>
              {canApprove && current.contract_id && (
                <>
                  <button
                    disabled={busy}
                    className={input}
                    onClick={() => setAction({ kind: "amend" })}
                  >
                    Điều chỉnh cọc theo phụ lục
                  </button>
                  <button
                    disabled={busy}
                    className={input}
                    onClick={() => {
                      key.current = "";
                      setAction({ kind: "transfer" });
                    }}
                  >
                    Chuyển sang hợp đồng khác
                  </button>
                  <button
                    disabled={busy}
                    className={input}
                    onClick={() => void perform("close-checkout")}
                  >
                    Đóng hồ sơ trả phòng
                  </button>
                </>
              )}
            </div>
          )}
          {action && (
            <form
              onSubmit={submit}
              onChange={() => {
                key.current = "";
              }}
              className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2"
            >
              <label className="text-sm">
                Số tiền
                <input
                  className={`${input} mt-1 w-full`}
                  name="amount"
                  type="number"
                  min={
                    action.kind === "refund" || action.kind === "amend"
                      ? "0"
                      : "0.01"
                  }
                  step="0.01"
                  required
                />
              </label>
              {action.kind === "refund" && current?.booking_id && (
                <label className="text-sm">
                  Giữ lại theo thỏa thuận
                  <input
                    className={`${input} mt-1 w-full`}
                    name="retained"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </label>
              )}
              {action.kind === "transfer" && (
                <label className="text-sm">
                  Sổ cọc hợp đồng nhận
                  <select
                    className={`${input} mt-1 w-full`}
                    name="target"
                    required
                  >
                    <option value="">Chọn hợp đồng nhận</option>
                    {rows
                      .filter(
                        (r) =>
                          r.contract_id &&
                          Number(r.id) !== id &&
                          Number(r.tenant_id) === Number(current?.tenant_id),
                      )
                      .map((r) => (
                        <option key={r.id} value={Number(r.id)}>
                          {r.contract_code}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {(action.kind === "collect" || action.kind === "pay") && (
                <>
                  <select
                    aria-label="Phương thức"
                    className={input}
                    name="method"
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                  </select>
                  <label className="text-sm">
                    Thời gian thực thu / chi
                    <input
                      className={`${input} mt-1 w-full`}
                      type="datetime-local"
                      step="1"
                      name="at"
                      required
                    />
                  </label>
                  <input
                    className={input}
                    name="reference"
                    placeholder="Mã giao dịch ngân hàng"
                    maxLength={100}
                  />
                  <label className="text-sm">
                    <input name="reconciled" type="checkbox" /> Đã đối soát giao
                    dịch ngân hàng thực tế
                  </label>
                </>
              )}
              {action.kind !== "refund" && (
                <input
                  className={input}
                  name="evidence"
                  placeholder={
                    action.kind === "amend" || action.kind === "transfer"
                      ? "Mã / đường dẫn phụ lục"
                      : "Mã / đường dẫn chứng từ thực thu, thực chi"
                  }
                  maxLength={500}
                  required
                />
              )}
              <input
                className={input}
                name="reason"
                placeholder="Lý do / căn cứ thỏa thuận"
                required
                maxLength={1000}
              />
              <div className="flex gap-2">
                <button disabled={busy} className={input}>
                  {busy ? "Đang ghi sổ..." : "Xác nhận"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={input}
                  onClick={() => setAction(undefined)}
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
          {detail.data?.refunds.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm"
            >
              <span>
                Đề nghị #{r.id}: {formatCurrency(Number(r.amount))} · Đã chi{" "}
                {formatCurrency(Number(r.paid_amount))} · Giữ lại{" "}
                {formatCurrency(Number(r.retained_amount))} ·{" "}
                {labels[String(r.status)] ?? r.status}
              </span>
              <span>{r.reason}</span>
              {canApprove && r.status === "REQUESTED" && (
                <button
                  disabled={busy}
                  className={input}
                  onClick={() => void perform(`refunds/${r.id}/approve`)}
                >
                  Duyệt theo căn cứ
                </button>
              )}
              {canWrite &&
                ["APPROVED", "PARTIAL"].includes(String(r.status)) && (
                  <button
                    disabled={busy}
                    className={input}
                    onClick={() => {
                      key.current = "";
                      setAction({ kind: "pay", refundId: Number(r.id) });
                    }}
                  >
                    Ghi nhận thực chi
                  </button>
                )}
            </div>
          ))}
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Lịch sử giao dịch và chứng từ
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th>Giao dịch</th>
                    <th>Loại</th>
                    <th>Số tiền</th>
                    <th>Thời gian</th>
                    <th>Chứng từ / căn cứ</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data?.transactions.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">{t.transaction_code}</td>
                      <td>
                        {labels[String(t.transaction_type)] ??
                          t.transaction_type}
                      </td>
                      <td>{formatCurrency(Number(t.amount))}</td>
                      <td>{t.transacted_at}</td>
                      <td>{t.evidence ?? t.reason}</td>
                      <td>
                        {t.status === "CONFIRMED"
                          ? "Đã ghi sổ"
                          : "Cần đối soát"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
