"use client";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import { DepositLedgerPanel } from "@/components/shared/deposit-ledger-panel";
type Row = Record<string, string | number | boolean | null>;
type Charge = { chargeType: string; description: string; amount: number };
type Line = {
  type: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  amount: number;
};
type Preview = {
  oldDebt: number;
  newCharges: number;
  deposit: number;
  deduction: number;
  refund: number;
  balanceDue: number;
  hash: string;
  credits: string[];
  lines: Line[];
};
type Detail = {
  contractCode: string;
  contractEnd: string;
  noticeDays: number;
  checkout: Row | null;
  initialAssets: Row[];
  initialKeys: number | null;
  inspection: Row[];
  inspectionVersion: Row | null;
  inspectionConfirmations: Row[];
  charges: Row[];
  history: Row[];
  disputes: Row[];
  rates: Row[];
  approved: Row | null;
  confirmations: Row[];
  completionCharges: Charge[];
  preview?: Preview;
  previewError?: string;
  depositId: number;
  depositBalance: number;
  currentDebt: number;
  currentFinancialStatus: string;
  refunds: Row[];
  timing: {
    classification: string;
    shortNotice: boolean;
    noticeGiven: number;
    noticeRequired: number;
  };
  versions: Row[];
};
const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
const button =
  "rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40";
function now() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");
}
export function CheckoutSettlementPanel({
  portal,
  contractId,
  showLedger = true,
}: {
  portal: "admin" | "tenant" | "accountant";
  contractId: number;
  showLedger?: boolean;
}) {
  const { user } = useAuth(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const base = `/${portal}/checkout-settlement`;
  const staff =
    portal === "admin" && ["OWNER", "MANAGER"].includes(user?.activeRole ?? "");
  const tenant = portal === "tenant" && user?.activeRole === "TENANT";
  const query = useQuery({
    queryKey: [
      "checkout-settlement",
      portal,
      user?.id,
      user?.activeRole,
      contractId,
    ],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<Detail>>(
          `${base}/contracts/${contractId}`,
        )
      ).data.data,
  });
  async function act(path: string, payload: unknown) {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(path, payload);
      await client.invalidateQueries();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function fields(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return new FormData(e.currentTarget);
  }
  if (query.isPending) return <p>Đang tải hồ sơ trả phòng…</p>;
  if (query.isError)
    return (
      <p role="alert" className="text-red-700">
        {apiErrorMessage(query.error)}
      </p>
    );
  const d = query.data,
    co = d.checkout,
    editable =
      !!co &&
      !co.settlement_applied_at &&
      !["CANCELLED", "COMPLETED"].includes(String(co.status));
  const current = co ? `${base}/${co.id}` : base;
  const tenantConfirmed = d.confirmations?.some((x) => x.party === "TENANT");
  const blocked = d.disputes?.some((x) => x.status === "OPEN");
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Trả phòng, bàn giao và quyết toán</h2>
      <p className="text-sm text-slate-600">
        Xác nhận nội bộ theo phiên bản. Gửi yêu cầu hoặc tính tiền hoàn chưa có
        nghĩa là đã bàn giao hay đã chi hoàn cọc.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {(!co || co.status === "CANCELLED") && (staff || tenant) && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            const f = fields(e);
            void act(base, {
              contractId,
              requestedDate: f.get("date"),
              reason: f.get("reason"),
            });
          }}
        >
          <label className="block text-sm">
            Ngày dự kiến trả phòng
            <input
              required
              name="date"
              type="date"
              min={now().slice(0, 10)}
              className={input}
            />
          </label>
          <input
            required
            maxLength={500}
            name="reason"
            placeholder="Lý do yêu cầu trả phòng"
            className={input}
          />
          <p className="text-xs">
            Thời gian báo trước theo hợp đồng: {d.noticeDays} ngày. Trường hợp
            trả sớm/thiếu báo trước cần xem xét thỏa thuận; không tự phạt hoặc
            mất cọc.
          </p>
          <button disabled={busy} className={button}>
            Gửi yêu cầu trả phòng
          </button>
        </form>
      )}
      {co && (
        <>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p>
              Hồ sơ #{String(co.id)} · {String(co.status)} ·{" "}
              {String(co.workflow_stage)}
            </p>
            <p>
              Nguồn:{" "}
              {co.request_source === "TENANT"
                ? "Người thuê"
                : co.request_source === "STAFF"
                  ? "Bên quản lý"
                  : "Hồ sơ lịch sử cần đối soát"}
            </p>
            <p>
              Ngày dự kiến: {String(co.requested_date)} · Lịch đã xác nhận:{" "}
              {String(co.confirmed_date ?? "Chưa xác nhận")}
            </p>
            <p>
              Bàn giao thực tế:{" "}
              {String(co.actual_checkout_at ?? "Chưa bàn giao")}
            </p>
            <p>
              Phân loại:{" "}
              {d.timing.classification === "EARLY"
                ? "Trước hạn"
                : d.timing.classification === "LATE"
                  ? "Sau hạn"
                  : "Đúng hạn"}{" "}
              · Báo trước {d.timing.noticeGiven}/{d.timing.noticeRequired} ngày
              {d.timing.shortNotice ? " · Cần xem xét thiếu báo trước" : ""}
            </p>
          </div>
          {editable && !co.actual_checkout_at && (staff || tenant) && (
            <details>
              <summary>Đổi lịch hoặc rút yêu cầu</summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  const f = fields(e);
                  void act(`${current}/schedule`, {
                    date: f.get("date"),
                    version: Number(co.version),
                    reason: f.get("reason"),
                    reference: f.get("reference"),
                  });
                }}
              >
                <input
                  required
                  name="date"
                  type="date"
                  min={now().slice(0, 10)}
                  defaultValue={String(co.requested_date)}
                  className={input}
                />
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  placeholder="Lý do đổi lịch"
                  className={input}
                />
                <input
                  required
                  name="reference"
                  maxLength={500}
                  placeholder="Tham chiếu trao đổi/thỏa thuận"
                  className={input}
                />
                <button disabled={busy} className={button}>
                  Lưu lịch mới
                </button>
              </form>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  const f = fields(e);
                  void act(`${current}/cancel`, {
                    version: Number(co.version),
                    reason: f.get("reason"),
                  });
                }}
              >
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  placeholder="Lý do rút yêu cầu"
                  className={input}
                />
                <button disabled={busy} className={button}>
                  Rút yêu cầu
                </button>
              </form>
            </details>
          )}
          {staff && editable && !co.actual_checkout_at && (
            <details open={!co.confirmed_date}>
              <summary>Xác nhận kế hoạch trả phòng</summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  const f = fields(e);
                  void act(`${current}/schedule-approval`, {
                    date: f.get("date"),
                    version: Number(co.version),
                    reason: f.get("reason"),
                    reference: f.get("reference"),
                  });
                }}
              >
                <input
                  required
                  name="date"
                  type="date"
                  min={now().slice(0, 10)}
                  defaultValue={String(co.confirmed_date ?? co.requested_date)}
                  className={input}
                />
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  placeholder="Kết quả kiểm tra thời hạn và báo trước"
                  className={input}
                />
                <input
                  required
                  name="reference"
                  maxLength={500}
                  placeholder="Căn cứ hợp đồng/trao đổi về lịch trả"
                  className={input}
                />
                <button disabled={busy} className={button}>
                  Xác nhận lịch
                </button>
              </form>
            </details>
          )}
          {staff && editable && !co.actual_checkout_at && co.confirmed_date && (
            <details open={!co.inspection_at}>
              <summary>Kiểm kê theo biên bản nhận phòng</summary>
              <form
                key={`${co.id}-${co.version}`}
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  const f = fields(e);
                  void act(`${current}/inspection`, {
                    version: Number(co.version),
                    actualAt: f.get("actual"),
                    electricity: f.has("ELECTRICITY")
                      ? Number(f.get("ELECTRICITY"))
                      : null,
                    water: f.has("WATER") ? Number(f.get("WATER")) : null,
                    keysReturned: Number(f.get("keys")),
                    includeHandoverDay: f.get("include") === "on",
                    repairRequired: f.get("repair") === "on",
                    reference: f.get("reference"),
                    absenceReference: f.get("absence") || null,
                    assets: d.initialAssets.map((a) => ({
                      checkinAssetId: Number(a.id),
                      returnedQuantity: Number(f.get(`qty-${a.id}`)),
                      condition: f.get(`condition-${a.id}`),
                      responsibility: f.get(`responsibility-${a.id}`),
                      reference: f.get(`reference-${a.id}`),
                      note: f.get(`note-${a.id}`),
                    })),
                  });
                }}
              >
                <label className="block text-sm">
                  Ngày giờ kiểm kê/bàn giao thực tế
                  <input
                    required
                    name="actual"
                    type="datetime-local"
                    step={1}
                    defaultValue={
                      co.inspection_at
                        ? String(co.inspection_at).slice(0, 19)
                        : now()
                    }
                    className={input}
                  />
                </label>
                {d.initialAssets.map((a) => {
                  const v = d.inspection.find(
                    (i) => Number(i.checkin_asset_id) === Number(a.id),
                  );
                  return (
                    <div
                      key={String(a.id)}
                      className="space-y-2 rounded-xl bg-slate-50 p-3"
                    >
                      <p className="text-sm font-semibold">
                        {String(a.asset_name)} · Khi nhận: {String(a.quantity)}{" "}
                        · {String(a.condition_status)}
                      </p>
                      <label className="block text-sm">
                        Số lượng trả
                        <input
                          required
                          name={`qty-${a.id}`}
                          type="number"
                          min={0}
                          max={Number(a.quantity)}
                          defaultValue={Number(
                            v?.returned_quantity ?? a.quantity,
                          )}
                          className={input}
                        />
                      </label>
                      <select
                        required
                        name={`condition-${a.id}`}
                        defaultValue={String(
                          v?.returned_condition ?? a.condition_status,
                        )}
                        className={input}
                      >
                        {["NEW", "GOOD", "FAIR", "DAMAGED", "MISSING"].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                      <select
                        required
                        name={`responsibility-${a.id}`}
                        defaultValue={String(v?.responsibility ?? "UNKNOWN")}
                        className={input}
                      >
                        {[
                          ["UNKNOWN", "Chưa xác định trách nhiệm"],
                          ["NATURAL_WEAR", "Hao mòn tự nhiên"],
                          ["PREEXISTING", "Có từ trước"],
                          ["TENANT", "Đã xác minh trách nhiệm người thuê"],
                          ["MISSING", "Thất lạc"],
                        ].map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input
                        required
                        name={`reference-${a.id}`}
                        maxLength={500}
                        defaultValue={String(v?.evidence_reference ?? "")}
                        placeholder="Ảnh/biên bản đối chiếu tài sản"
                        className={input}
                      />
                      <input
                        name={`note-${a.id}`}
                        maxLength={1000}
                        defaultValue={String(v?.note ?? "")}
                        placeholder="Ghi chú tình trạng"
                        className={input}
                      />
                    </div>
                  );
                })}
                {d.rates
                  .filter((r) => r.calculation_method === "METER")
                  .map((r) => (
                    <label key={String(r.code)} className="block text-sm">
                      {r.code === "ELECTRICITY"
                        ? "Chỉ số điện cuối"
                        : "Chỉ số nước cuối"}
                      <input
                        required
                        type="number"
                        min={0}
                        step="0.01"
                        name={String(r.code)}
                        defaultValue={
                          co[
                            r.code === "ELECTRICITY"
                              ? "final_electricity_reading"
                              : "final_water_reading"
                          ] == null
                            ? undefined
                            : Number(
                                co[
                                  r.code === "ELECTRICITY"
                                    ? "final_electricity_reading"
                                    : "final_water_reading"
                                ],
                              )
                        }
                        className={input}
                      />
                    </label>
                  ))}
                <label className="block text-sm">
                  Khóa/thẻ trả lại (đã nhận{" "}
                  {d.initialKeys ?? "chưa có chứng cứ"})
                  <input
                    required
                    name="keys"
                    type="number"
                    min={0}
                    defaultValue={
                      co.keys_returned == null
                        ? undefined
                        : Number(co.keys_returned)
                    }
                    className={input}
                  />
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    name="include"
                    type="checkbox"
                    defaultChecked={Boolean(co.include_handover_day)}
                  />
                  Tính cả ngày bàn giao theo thỏa thuận
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    name="repair"
                    type="checkbox"
                    defaultChecked={Boolean(co.repair_required)}
                  />
                  Cần kiểm tra/sửa chữa trước khai thác lại
                </label>
                <input
                  required
                  name="reference"
                  maxLength={500}
                  defaultValue={String(co.handover_reference ?? "")}
                  placeholder="Mã biên bản/ảnh bàn giao"
                  className={input}
                />
                <input
                  name="absence"
                  maxLength={500}
                  defaultValue={String(co.absence_reference ?? "")}
                  placeholder="Căn cứ xử lý vắng mặt (chỉ nhập khi thực tế vắng mặt)"
                  className={input}
                />
                <p className="text-xs text-slate-600">
                  Không tự ghi người thuê đã xác nhận. Hao mòn hoặc tình trạng
                  thay đổi không tự tạo tiền bồi thường.
                </p>
                <button disabled={busy} className={button}>
                  Lưu kiểm kê và chốt mốc bàn giao
                </button>
              </form>
            </details>
          )}
          {d.inspectionVersion && (
            <div className="space-y-3 rounded-xl border p-3">
              <h3 className="font-semibold">
                Xác nhận kiểm kê và bàn giao thực tế
              </h3>
              <details>
                <summary>
                  Biên bản kiểm kê · phiên bản{" "}
                  {String(d.inspectionVersion.version)}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
                  {String(d.inspectionVersion.content)}
                </pre>
              </details>
              <p className="text-xs">
                Xác nhận kiểm kê không mặc định chấp nhận khoản bồi thường hay
                quyết toán tài chính.
              </p>
              {tenant &&
                editable &&
                !d.inspectionConfirmations.some(
                  (x) => x.party === "TENANT",
                ) && (
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() =>
                      void act(`${current}/inspection-confirmation`, {
                        version: Number(d.inspectionVersion!.version),
                        contentHash: d.inspectionVersion!.content_hash,
                      })
                    }
                  >
                    Tôi xác nhận biên bản kiểm kê này
                  </button>
                )}
              {staff && editable && !co.actual_checkout_at && (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    const f = fields(e);
                    void act(`${current}/handover`, {
                      version: Number(co.version),
                      reason: f.get("reason"),
                    });
                  }}
                >
                  <input
                    required
                    name="reason"
                    maxLength={1000}
                    placeholder="Căn cứ xác nhận đã nhận lại phòng thực tế"
                    className={input}
                  />
                  <button
                    disabled={
                      busy ||
                      (!d.inspectionConfirmations.some(
                        (x) => x.party === "TENANT",
                      ) &&
                        !co.absence_reference)
                    }
                    className={button}
                  >
                    Ghi nhận đã bàn giao, tiếp tục theo dõi tài chính riêng
                  </button>
                </form>
              )}
            </div>
          )}
          {d.inspection.length > 0 && (
            <details>
              <summary>Xem kiểm kê đã lưu</summary>
              {d.inspection.map((a) => (
                <p key={String(a.id)} className="text-sm">
                  {String(
                    d.initialAssets.find(
                      (x) => Number(x.id) === Number(a.checkin_asset_id),
                    )?.asset_name ?? "Tài sản",
                  )}{" "}
                  · Trả {String(a.returned_quantity)} ·{" "}
                  {String(a.returned_condition)} · {String(a.responsibility)} ·{" "}
                  {String(a.evidence_reference)}
                </p>
              ))}
            </details>
          )}
          <details>
            <summary>Bồi thường và khoản phát sinh cần xác minh</summary>
            <div className="mt-3 space-y-3">
              {d.charges.map((c) => (
                <div
                  key={String(c.id)}
                  className="rounded-xl bg-slate-50 p-3 text-sm"
                >
                  <p>
                    {String(c.description)} · {formatCurrency(Number(c.amount))}{" "}
                    · {String(c.status)}
                  </p>
                  <p>
                    {String(c.evidence_reference)} · {String(c.reason)}
                  </p>
                  {staff && editable && c.status === "PROPOSED" && (
                    <form
                      className="mt-2 space-y-2"
                      onSubmit={(e) => {
                        const f = fields(e);
                        void act(`${current}/charges/${c.id}/decision`, {
                          confirmed: f.get("decision") === "CONFIRMED",
                          reason: f.get("reason"),
                        });
                      }}
                    >
                      <select name="decision" className={input}>
                        <option value="REJECTED">Không tính khoản này</option>
                        <option value="CONFIRMED">
                          Đã xác minh căn cứ và trách nhiệm
                        </option>
                      </select>
                      <input
                        required
                        name="reason"
                        maxLength={1000}
                        placeholder="Kết quả kiểm tra chứng từ/trách nhiệm"
                        className={input}
                      />
                      <button disabled={busy} className={button}>
                        Lưu kết quả
                      </button>
                    </form>
                  )}
                </div>
              ))}
              {staff && editable && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    const f = fields(e);
                    void act(`${current}/charges`, {
                      evidenceKey: f.get("key"),
                      type: f.get("type"),
                      description: f.get("description"),
                      amount: Number(f.get("amount")),
                      reference: f.get("reference"),
                      reason: f.get("reason"),
                      maintenanceId: f.get("maintenance")
                        ? Number(f.get("maintenance"))
                        : null,
                    });
                  }}
                >
                  <input
                    required
                    name="key"
                    maxLength={100}
                    placeholder="Mã hư hỏng/nghĩa vụ duy nhất để chống tính trùng"
                    className={input}
                  />
                  <select name="type" className={input}>
                    <option value="DAMAGE">Bồi thường</option>
                    <option value="CLEANING">Vệ sinh có thỏa thuận</option>
                    <option value="PENALTY">
                      Phí theo điều khoản đã kiểm tra
                    </option>
                    <option value="OTHER">Khoản hợp lệ khác</option>
                  </select>
                  <input
                    required
                    name="description"
                    maxLength={255}
                    placeholder="Nội dung khoản đề xuất"
                    className={input}
                  />
                  <input
                    required
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Chi phí đã xác định"
                    className={input}
                  />
                  <input
                    required
                    name="reference"
                    maxLength={500}
                    placeholder="Ảnh/biên bản/báo giá"
                    className={input}
                  />
                  <input
                    required
                    name="reason"
                    maxLength={1000}
                    placeholder="Căn cứ và trách nhiệm, không mặc định giá mua mới"
                    className={input}
                  />
                  <input
                    name="maintenance"
                    type="number"
                    min={1}
                    placeholder="ID hồ sơ bảo trì liên quan (nếu có)"
                    className={input}
                  />
                  <button disabled={busy} className={button}>
                    Đề xuất để kiểm tra, chưa tính tiền
                  </button>
                </form>
              )}
            </div>
          </details>
          {d.previewError && (
            <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">
              Cần đối soát trước quyết toán: {d.previewError}
            </p>
          )}
          {(d.preview || d.approved) && (
            <div className="space-y-3 rounded-xl border p-3">
              <h3 className="font-semibold">
                Bảng quyết toán{" "}
                {co.settlement_applied_at ? "đã áp dụng" : "chờ bàn giao"}
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Công nợ cũ", d.preview?.oldDebt ?? d.approved?.old_debt],
                  [
                    "Phát sinh chưa lập hóa đơn",
                    d.preview?.newCharges ?? d.approved?.new_charges,
                  ],
                  [
                    "Cọc thực giữ tại quyết toán",
                    d.preview?.deposit ?? d.approved?.deposit_held,
                  ],
                  [
                    "Cọc được bù trừ",
                    d.preview?.deduction ?? d.approved?.deduction,
                  ],
                  [
                    "Cọc phải hoàn",
                    d.preview?.refund ?? d.approved?.refund_due,
                  ],
                  [
                    "Còn phải thu",
                    d.preview?.balanceDue ?? d.approved?.balance_due,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{String(label)}</dt>
                    <dd className="font-semibold">
                      {formatCurrency(value == null ? null : Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
              {d.preview?.lines.map((l, i) => (
                <p key={i} className="text-sm">
                  {l.name} · {l.quantity} {l.unit} · {formatCurrency(l.price)} ·{" "}
                  {formatCurrency(l.amount)}
                  <span className="block text-xs text-slate-500">
                    {l.description}
                  </span>
                </p>
              ))}
              {d.preview?.credits.map((c, i) => (
                <p key={i} className="text-sm text-amber-800">
                  {c}
                </p>
              ))}
            </div>
          )}
          {staff && editable && d.preview && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                const f = fields(e);
                void act(`${current}/approval`, {
                  version: Number(co.version),
                  contentHash: d.preview!.hash,
                  policyReference: f.get("reference"),
                  reason: f.get("reason"),
                  creditTreatment: f.get("credit"),
                });
              }}
            >
              <input
                required
                name="reference"
                maxLength={500}
                placeholder="Căn cứ hợp đồng/thỏa thuận quyết toán"
                className={input}
              />
              <input
                required
                name="reason"
                maxLength={1000}
                placeholder="Kết quả rà soát công nợ, cọc và các khoản phát sinh"
                className={input}
              />
              <select name="credit" className={input}>
                <option value="NONE">Không có khoản thu dư cần xử lý</option>
                <option value="RETAIN_AS_BILLED">
                  Giữ mức đã lập theo thỏa thuận riêng, cần người thuê xác nhận
                </option>
              </select>
              <button disabled={busy || blocked} className={button}>
                Phê duyệt phiên bản quyết toán
              </button>
            </form>
          )}
          {d.approved && (
            <>
              <button
                disabled={busy}
                className={button}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const { data } = await apiClient.get<string>(
                      `${base}/contracts/${contractId}/document`,
                      { responseType: "text" },
                    );
                    const url = URL.createObjectURL(
                      new Blob([data], { type: "text/plain;charset=utf-8" }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `ho-so-thanh-ly-${contractId}.txt`;
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    setError(apiErrorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Tải hồ sơ bàn giao/quyết toán nội bộ
              </button>
              <details>
                <summary>
                  Nội dung đã phê duyệt · phiên bản {String(d.approved.version)}
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
                  {String(d.approved.content)}
                </pre>
              </details>
              <p className="text-xs">
                Đã xác nhận:{" "}
                {d.confirmations
                  .map((c) =>
                    c.party === "TENANT" ? "Người thuê" : "Bên cho thuê",
                  )
                  .join(", ")}
              </p>
              {tenant && editable && !tenantConfirmed && (
                <button
                  disabled={busy || blocked}
                  className={button}
                  onClick={() =>
                    void act(`${current}/confirmation`, {
                      version: Number(d.approved!.version),
                      contentHash: d.approved!.content_hash,
                    })
                  }
                >
                  Tôi đã xem và xác nhận nội bộ quyết toán/bàn giao phiên bản
                  này
                </button>
              )}
              {staff && editable && (
                <button
                  disabled={
                    busy ||
                    blocked ||
                    (!tenantConfirmed && !co.absence_reference)
                  }
                  className={button}
                  onClick={() =>
                    void act(
                      `/admin/rental-lifecycle/checkouts/${co.id}/complete`,
                      {
                        actualDate: String(co.inspection_at).slice(0, 10),
                        finalElectricityReading: co.final_electricity_reading,
                        finalWaterReading: co.final_water_reading,
                        charges: d.completionCharges,
                        note: "Hoàn tất theo phiên bản đã phê duyệt và chứng cứ bàn giao",
                        version: Number(co.version),
                      },
                    )
                  }
                >
                  Xác nhận đã bàn giao thực tế và áp dụng quyết toán
                </button>
              )}
            </>
          )}
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p>Công nợ còn lại hiện tại: {formatCurrency(d.currentDebt)}</p>
            <p>Cọc còn giữ hiện tại: {formatCurrency(d.depositBalance)}</p>
            <p>
              Trạng thái tài chính:{" "}
              {String(
                d.currentFinancialStatus ??
                  co.financial_status ??
                  "Chưa quyết toán",
              )}
            </p>
            {d.refunds.map((r) => (
              <p key={String(r.id)}>
                Yêu cầu hoàn #{String(r.id)} · {String(r.status)} · Phải hoàn{" "}
                {formatCurrency(Number(r.amount))} · Đã thực hoàn{" "}
                {formatCurrency(Number(r.paid_amount))}
              </p>
            ))}
          </div>
          {(tenant || staff) &&
            co.status !== "COMPLETED" &&
            co.status !== "CANCELLED" && (
              <details>
                <summary>Phản hồi hoặc tranh chấp</summary>
                <form
                  className="mt-3 space-y-3"
                  onSubmit={(e) => {
                    const f = fields(e);
                    void act(`${current}/disputes`, {
                      description: f.get("description"),
                    });
                  }}
                >
                  <textarea
                    required
                    name="description"
                    maxLength={2000}
                    placeholder="Khoản cần rà soát và căn cứ phản hồi"
                    className={input}
                  />
                  <button disabled={busy} className={button}>
                    Gửi phản hồi
                  </button>
                </form>
              </details>
            )}
          {d.disputes.map((r) => (
            <div key={String(r.id)} className="rounded-xl border p-3 text-sm">
              <p>
                {String(r.description)} · {String(r.status)}
              </p>
              {r.resolution && (
                <p>
                  {String(r.resolution)} · {String(r.resolution_reference)}
                </p>
              )}
              {staff && r.status === "OPEN" && (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    const f = fields(e);
                    void act(`${current}/disputes/${r.id}/resolve`, {
                      reason: f.get("reason"),
                      reference: f.get("reference"),
                    });
                  }}
                >
                  <input
                    required
                    name="reason"
                    maxLength={2000}
                    placeholder="Kết quả đối soát/thỏa thuận, không tự sửa tiền"
                    className={input}
                  />
                  <input
                    required
                    name="reference"
                    maxLength={500}
                    placeholder="Biên bản xử lý phản hồi"
                    className={input}
                  />
                  <button disabled={busy} className={button}>
                    Ghi nhận kết quả
                  </button>
                </form>
              )}
            </div>
          ))}
          <details>
            <summary>Lịch sử xử lý</summary>
            {d.history.map((h) => (
              <p key={String(h.id)} className="text-xs">
                {String(h.created_at)} · {String(h.event_type)} ·{" "}
                {String(h.description)}
              </p>
            ))}
            {d.versions.map((v) => (
              <p key={String(v.id)} className="text-xs">
                Phiên bản {String(v.version)} · {String(v.created_at)} ·{" "}
                {String(v.reason)}
              </p>
            ))}
          </details>
          {showLedger && (
            <DepositLedgerPanel portal={portal} contractId={contractId} />
          )}
        </>
      )}
    </section>
  );
}
