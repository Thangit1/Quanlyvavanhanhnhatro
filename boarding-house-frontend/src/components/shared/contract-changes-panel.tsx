"use client";
import { useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
type Row = Record<string, string | number | boolean | null>;
type Change = Row & { history: Row[]; confirmations: Row[] };
type Detail = {
  contract: Row;
  requests: Change[];
  residents: Row[];
  rooms: Row[];
  prices: Row[];
  canRequest: boolean;
};
const labels: Record<string, string> = {
  EXTENSION: "Gia hạn",
  TRANSFER: "Chuyển phòng",
  REPRESENTATIVE: "Thay đại diện bằng hợp đồng mới",
  REQUESTED: "Chờ duyệt nội dung",
  OFFERED: "Chờ các bên xác nhận",
  AGREED: "Đã thống nhất",
  PREPARED: "Đang bàn giao và quyết toán",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
const input = "w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
const button =
  "rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";
export function ContractChangesPanel({
  portal,
  contractId,
  requestId,
}: {
  portal: "admin" | "tenant";
  contractId?: number;
  requestId?: number;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("EXTENSION");
  const depositKeys = useRef<Record<string, string>>({});
  const base = `/${portal}/contract-changes`;
  const query = useQuery({
    queryKey: ["contract-changes", portal, user?.id, contractId, requestId],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<Detail>>(
          requestId
            ? `${base}/${requestId}`
            : `${base}/contracts/${contractId}`,
        )
      ).data.data,
  });
  const staff =
    portal === "admin" && ["OWNER", "MANAGER"].includes(user?.activeRole ?? "");
  async function post(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(path, body);
      await Promise.all(
        [
          "contract-changes",
          "resident-approvals",
          "admin-contract",
          "admin-contracts",
          "tenant-contract",
          "tenant-contracts",
          "rental-lifecycle",
          "checkout-settlement",
          "deposit-ledger",
          "representative-invitations",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function request(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    void post(`${base}/contracts/${contractId}`, {
      type: kind,
      effectiveDate: v.get("effective"),
      newEndDate: v.get("end"),
      monthlyRent: Number(v.get("rent")),
      depositRequired: Number(v.get("deposit")),
      proration: v.get("policy"),
      targetRoomId: kind === "TRANSFER" ? Number(v.get("room")) : null,
      targetProfileId:
        kind === "REPRESENTATIVE" ? Number(v.get("profile")) : null,
      reference: v.get("reference"),
      reason: v.get("reason"),
    });
  }
  const data = query.data;
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold">Gia hạn, chuyển phòng và thay đại diện</h2>
      {(error || query.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {error || apiErrorMessage(query.error)}
        </p>
      )}
      {query.isLoading && (
        <p className="text-sm text-slate-500">Đang tải hồ sơ…</p>
      )}
      {data && (
        <>
          <p className="text-sm text-slate-600">
            Thời hạn gốc:{" "}
            {String(data.contract.original_end_date ?? data.contract.end_date)}.
            Các khoảng thuê dùng ngày kết thúc không bao gồm ngày cuối. Bàn giao
            thực tế và hoàn tất tài chính được theo dõi riêng.
          </p>
          {data.canRequest && contractId && (
            <details>
              <summary className="cursor-pointer font-semibold text-blue-700">
                Tạo yêu cầu thay đổi
              </summary>
              <form
                onSubmit={request}
                className="mt-3 grid gap-3 sm:grid-cols-2"
              >
                <label>
                  Loại yêu cầu
                  <select
                    className={input}
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    {["EXTENSION", "TRANSFER", "REPRESENTATIVE"].map((k) => (
                      <option key={k} value={k}>
                        {labels[k]}
                      </option>
                    ))}
                  </select>
                </label>
                {kind === "TRANSFER" && (
                  <label>
                    Phòng đích
                    <select name="room" required className={input}>
                      <option value="">Chọn phòng khả dụng</option>
                      {data.rooms.map((r) => (
                        <option key={String(r.id)} value={String(r.id)}>
                          {String(r.property_name)} — {String(r.code)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {kind === "REPRESENTATIVE" && (
                  <label>
                    Người đại diện mới
                    <select required name="profile" className={input}>
                      <option value="">
                        Chọn người đang ở cùng có tài khoản
                      </option>
                      {data.residents
                        .filter(
                          (r) =>
                            r.status === "ACTIVE" &&
                            r.residence_role !== "REPRESENTATIVE" &&
                            r.user_id,
                        )
                        .map((r) => (
                          <option
                            key={String(r.id)}
                            value={String(r.tenant_profile_id)}
                          >
                            {String(r.full_name)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label>
                  Ngày hiệu lực / nhận phòng mới
                  <input
                    className={input}
                    name="effective"
                    type="date"
                    required
                    defaultValue={
                      kind === "EXTENSION"
                        ? String(data.contract.end_date)
                        : undefined
                    }
                  />
                </label>
                <label>
                  Ngày kết thúc mới (không bao gồm)
                  <input className={input} name="end" type="date" required />
                </label>
                <label>
                  Giá thuê đã thỏa thuận (VNĐ/tháng)
                  <input
                    className={input}
                    name="rent"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    defaultValue={Number(data.contract.agreed_monthly_rent)}
                  />
                </label>
                <label>
                  Cọc yêu cầu (không phải tiền đã thu)
                  <input
                    className={input}
                    name="deposit"
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    defaultValue={Number(data.contract.deposit_amount)}
                  />
                </label>
                <label>
                  Chính sách tiền thuê
                  <select
                    className={input}
                    name="policy"
                    defaultValue={String(data.contract.rent_proration)}
                  >
                    <option value="FULL_MONTH">Trọn tháng</option>
                    <option value="ACTUAL_DAYS">Theo ngày thực tế</option>
                  </select>
                </label>
                <label>
                  Tham chiếu thỏa thuận/chứng cứ
                  <input
                    className={input}
                    name="reference"
                    required
                    maxLength={500}
                  />
                </label>
                <label className="sm:col-span-2">
                  Lý do và điều khoản
                  <input
                    className={input}
                    name="reason"
                    required
                    maxLength={1000}
                  />
                </label>
                <p className="text-sm text-slate-600 sm:col-span-2">
                  Gia hạn giữ chính sách phân bổ và cọc hiện có; thay giá giữa
                  kỳ cần hợp đồng tính theo ngày. Chuyển phòng dùng hợp đồng
                  mới. Nợ cũ được quyết toán tại hợp đồng cũ. Thay đại diện cần
                  người cũ và mới xác nhận, hoàn/thu cọc riêng. Cư dân đi cùng
                  cần hồ sơ nhận phòng mới được xác minh.
                </p>
                <button className={button} disabled={busy}>
                  Gửi yêu cầu
                </button>
              </form>
            </details>
          )}
          {!data.requests.length && (
            <p className="text-sm text-slate-500">Chưa có hồ sơ thay đổi.</p>
          )}
          {data.requests.map((q) => (
            <article
              key={String(q.id)}
              className="space-y-3 rounded-xl border p-4"
            >
              <h3 className="font-semibold">
                #{String(q.id)} — {labels[String(q.change_type)]} —{" "}
                {labels[String(q.status)] ?? String(q.status)}
              </h3>
              <p className="text-sm">
                Hiệu lực {String(q.effective_date)} → {String(q.new_end_date)} ·{" "}
                {formatCurrency(Number(q.monthly_rent))}/tháng · Cọc yêu cầu{" "}
                {formatCurrency(Number(q.deposit_required))}
              </p>
              {q.content && (
                <details>
                  <summary className="cursor-pointer text-blue-700">
                    Đọc nội dung thỏa thuận và chứng cứ
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {String(q.content)}
                  </pre>
                </details>
              )}
              <p className="text-sm">
                Đã xác nhận:{" "}
                {q.confirmations
                  .map((c) => `${c.party} (${c.confirmed_at})`)
                  .join(", ") || "Chưa có"}
              </p>
              <div className="flex flex-wrap gap-2">
                {q.canOffer && (
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() =>
                      void post(`${base}/${q.id}/offer`, {
                        version: q.version,
                        reason:
                          "Đã kiểm tra phạm vi, giá, thời hạn và chứng cứ thỏa thuận",
                      })
                    }
                  >
                    Duyệt nội dung, chờ xác nhận
                  </button>
                )}
                {q.canConfirm && (
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() =>
                      void post(`${base}/${q.id}/confirm`, {
                        version: q.version,
                        hash: q.content_hash,
                      })
                    }
                  >
                    Tôi đã đọc và đồng ý đúng nội dung này
                  </button>
                )}
                {q.canApply && (
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() =>
                      void post(
                        `${base}/${q.id}/${q.change_type === "EXTENSION" ? "extension" : "prepare"}`,
                        {
                          version: q.version,
                          reason:
                            "Thực hiện thỏa thuận đã được các bên xác nhận",
                        },
                      )
                    }
                  >
                    {q.change_type === "EXTENSION"
                      ? "Áp dụng gia hạn"
                      : "Chuẩn bị hợp đồng đích / tiếp tục bàn giao"}
                  </button>
                )}
                {q.canComplete && (
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() =>
                      void post(`${base}/${q.id}/complete`, {
                        version: q.version,
                        reason:
                          "Đã kiểm tra hai bàn giao và đóng tài chính hợp đồng nguồn",
                      })
                    }
                  >
                    Kiểm tra và hoàn tất chuyển đổi
                  </button>
                )}
              </div>
              {q.canCancel && (
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = new FormData(e.currentTarget);
                    void post(`${base}/${q.id}/cancel`, {
                      version: q.version,
                      reason: v.get("reason"),
                    });
                  }}
                >
                  <input
                    aria-label="Lý do hủy yêu cầu"
                    className={input}
                    name="reason"
                    required
                    maxLength={1000}
                    placeholder="Lý do rút/hủy yêu cầu trước bàn giao"
                  />
                  <button className={button} disabled={busy}>
                    Rút/hủy yêu cầu
                  </button>
                </form>
              )}
              {q.checkout_id && (
                <p className="text-sm">
                  Bàn giao phòng cũ: phiếu #{String(q.checkout_id)}. Thực hiện
                  kiểm kê, chỉ số cuối và quyết toán ở mục Trả phòng của hợp
                  đồng này.
                </p>
              )}
              {q.target_contract_id && (
                <p className="text-sm">
                  <Link
                    className="text-blue-700 underline"
                    href={`/${portal}/contracts/${q.target_contract_id}`}
                  >
                    Mở hợp đồng đích #{String(q.target_contract_id)}
                  </Link>{" "}
                  để xác minh, thu cọc bổ sung và nhận phòng bằng chỉ số riêng.
                </p>
              )}
              {staff &&
                q.status === "PREPARED" &&
                q.change_type === "TRANSFER" && (
                  <form
                    className="grid gap-2 sm:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = new FormData(e.currentTarget);
                      void post(`${base}/${q.id}/deposit-transfer`, {
                        version: q.version,
                        amount: Number(v.get("amount")),
                        key: (depositKeys.current[
                          JSON.stringify([
                            q.id,
                            q.version,
                            v.get("amount"),
                            v.get("reason"),
                          ])
                        ] ??= String(q.id) + "-" + crypto.randomUUID()),
                        reason: v.get("reason"),
                      });
                    }}
                  >
                    <label>
                      Cọc thực chuyển sau quyết toán (VNĐ)
                      <input
                        className={input}
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </label>
                    <label>
                      Lý do theo thỏa thuận
                      <input
                        className={input}
                        name="reason"
                        required
                        maxLength={1000}
                      />
                    </label>
                    <button className={button} disabled={busy}>
                      Điều chuyển cọc còn giữ
                    </button>
                    <p className="text-sm text-slate-600">
                      Chỉ chuyển sau khi bàn giao và hết nợ nguồn, trước duyệt
                      chi hoàn. Không tạo phiếu thu tiền mới.
                    </p>
                  </form>
                )}
              <details>
                <summary className="cursor-pointer text-sm text-blue-700">
                  Lịch sử hồ sơ
                </summary>
                <ul className="space-y-1 text-sm">
                  {q.history.map((h) => (
                    <li key={String(h.id)}>
                      {String(h.occurred_at)} · {String(h.event_type)} ·{" "}
                      {String(h.content)}
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
          <details>
            <summary className="cursor-pointer text-sm text-blue-700">
              Lịch sử giá và cư trú
            </summary>
            <ul className="text-sm">
              {data.prices.map((p) => (
                <li key={String(p.id)}>
                  {String(p.effective_date)}:{" "}
                  {formatCurrency(Number(p.unit_price))} · {String(p.reference)}
                </li>
              ))}
              {data.residents.map((r) => (
                <li key={String(r.id)}>
                  {String(r.full_name)} · {String(r.residence_role)} ·{" "}
                  {String(r.move_in_date)} →{" "}
                  {String(r.move_out_date ?? "đang ở")} · {String(r.status)}
                </li>
              ))}
            </ul>
          </details>
          {staff && contractId && <ResidentApprovals contractId={contractId} />}
        </>
      )}
    </section>
  );
}
function ResidentApprovals({ contractId }: { contractId: number }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["resident-approvals", user?.id, contractId],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<Row[]>>(
          `/admin/contract-changes/contracts/${contractId}/resident-requests`,
        )
      ).data.data,
  });
  async function review(e: FormEvent<HTMLFormElement>, q: Row) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await apiClient.post(
        `/admin/contract-changes/resident-requests/${q.id}/review`,
        {
          version: q.version,
          approved: v.get("decision") === "approve",
          effectiveDate: v.get("date"),
          reference: v.get("reference"),
          reason: v.get("reason"),
        },
      );
      await Promise.all(
        [
          "resident-approvals",
          "contract-changes",
          "admin-contract",
          "tenant-co-occupants",
          "monthly-billing",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 border-t pt-3">
      <h3 className="font-semibold">Duyệt thêm/bớt người ở cùng</h3>
      {(error || query.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {error || apiErrorMessage(query.error)}
        </p>
      )}
      {!query.data?.length && (
        <p className="text-sm text-slate-500">Chưa có yêu cầu.</p>
      )}
      {query.data?.map((q) => (
        <div className="rounded-lg border p-3 text-sm" key={String(q.id)}>
          <p>
            #{String(q.id)} · {String(q.full_name)} ·{" "}
            {q.request_type === "ADD_CO_OCCUPANT"
              ? "Thêm người ở cùng"
              : "Chuyển đi"}{" "}
            · {String(q.status)}
          </p>
          {["SUBMITTED", "UNDER_REVIEW", "NEED_MORE_INFORMATION"].includes(
            String(q.status),
          ) && (
            <form
              onSubmit={(e) => void review(e, q)}
              className="mt-2 grid gap-2 sm:grid-cols-2"
            >
              <label>
                Ngày cư trú thực tế
                <input name="date" required type="date" className={input} />
              </label>
              <label>
                Quyết định
                <select className={input} name="decision">
                  <option value="approve">Chấp thuận</option>
                  <option value="reject">Từ chối</option>
                </select>
              </label>
              <label>
                Tham chiếu xác minh hồ sơ
                <input
                  name="reference"
                  required
                  maxLength={500}
                  className={input}
                />
              </label>
              <label>
                Lý do
                <input
                  name="reason"
                  required
                  maxLength={1000}
                  className={input}
                />
              </label>
              <button disabled={busy} className={button}>
                Ghi nhận quyết định
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
export function RepresentativeInvitations() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["representative-invitations", user?.id],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<Row[]>>(
          "/tenant/contract-changes/invitations",
        )
      ).data.data,
  });
  return (
    <>
      {query.isError && (
        <p role="alert" className="text-sm text-red-700">
          {apiErrorMessage(query.error)}
        </p>
      )}
      {query.data?.map((q) => (
        <ContractChangesPanel
          key={String(q.id)}
          portal="tenant"
          requestId={Number(q.id)}
        />
      ))}
    </>
  );
}
