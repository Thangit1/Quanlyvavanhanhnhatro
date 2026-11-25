"use client";
import { NumberInput, CurrencyInput } from "@/components/ui/number-input";
import Link from "next/link";
import { CheckoutEvidencePanel } from "./checkout-evidence-panel";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  permissions?: {
    canManage: boolean;
    canApprove: boolean;
    canApply: boolean;
    canClose: boolean;
    canRequest: boolean;
  };
  blockers?: string[];
  obligations?: Row[];
  approvedLines?: Row[];
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
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm";
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
  wizard = true,
}: {
  portal: "admin" | "tenant" | "accountant";
  contractId: number;
  showLedger?: boolean;
  wizard?: boolean;
}) {
  const { user } = useAuth(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const base = `/${portal}/checkout-settlement`;
  const staffRole =
    portal === "admin" && ["OWNER", "MANAGER"].includes(user?.activeRole ?? "");
  const tenant = portal === "tenant" && user?.activeRole === "TENANT";
  const [step, setStep] = useState(1);
  const inFlight = useRef(false);
  const show = (...steps: number[]) => !wizard || steps.includes(step);
  const query = useScopedQuery({
    enabled: contractId > 0,
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
    if (inFlight.current) return;
    if (
      /(approval|decision|complete|handover|confirmation|resolve|cancel)$/.test(
        path,
      ) &&
      !window.confirm(
        "Xác nhận thực hiện trên hồ sơ và phiên bản đang hiển thị? Giao dịch tài chính chỉ được ghi khi backend chấp nhận.",
      )
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await apiClient.post(path, payload);
      await client.invalidateQueries();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  function fields(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return new FormData(e.currentTarget);
  }
  if (query.isPending) return <p>Đang tải hồ sơ trả phòng…</p>;
  if (query.isError)
    return (
      <p role="alert" className="text-danger">
        {apiErrorMessage(query.error)}
      </p>
    );
  const d = query.data,
    co = d.checkout,
    editable =
      !!co &&
      !co.settlement_applied_at &&
      !["CANCELLED", "COMPLETED"].includes(String(co.status));
  const staff = staffRole && (d.permissions?.canManage ?? true);
  const canApprove = staff && (d.permissions?.canApprove ?? true);
  const canApply = staff && (d.permissions?.canApply ?? true);
  const current = co ? `${base}/${co.id}` : base;
  const tenantConfirmed = d.confirmations?.some((x) => x.party === "TENANT");
  const blocked = d.disputes?.some((x) => x.status === "OPEN");
  return (
    <section className="space-y-4 surface-card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Trả phòng, bàn giao và quyết toán</h2>
      <p className="text-sm text-secondary-foreground">
        Xác nhận nội bộ theo phiên bản. Gửi yêu cầu hoặc tính tiền hoàn chưa có
        nghĩa là đã bàn giao hay đã chi hoàn cọc.
      </p>
      {wizard && <CheckoutSteps step={step} onChange={setStep} data={d} />}
      {show(2) && (
        <div className="space-y-3 rounded-xl bg-muted p-4 text-sm">
          <h3 className="font-semibold">
            Điều kiện hợp đồng và nghĩa vụ hiện tại
          </h3>
          <p>
            Hợp đồng: {d.contractCode} · Kết thúc dự kiến: {d.contractEnd} · Báo
            trước: {d.noticeDays} ngày.
          </p>
          <p>
            Công nợ hiện tại: {formatCurrency(d.currentDebt)} · Cọc còn giữ:{" "}
            {formatCurrency(d.depositBalance)}
          </p>
          <p>
            Không mặc định trả sớm được hoàn theo ngày. Các kỳ đã phát hành giữ
            nguyên; khoản thu dư cần điều chỉnh hoặc thỏa thuận RETAIN_AS_BILLED
            hợp lệ.
          </p>
          {portal!=="accountant" ? <Link
            className="text-link underline"
            href={`/${portal}/contracts/${contractId}`}
          >
            Hồ sơ hợp đồng và biên bản nhận phòng
          </Link> : <p className="text-sm text-muted-foreground">Thông tin hợp đồng được hiển thị trong hồ sơ quyết toán này.</p>}
          {d.obligations?.map((i) => (
            <Link
              key={String(i.id)}
              className="block rounded-lg border bg-card p-3 text-link"
              href={`/${portal}/invoices/${i.id}`}
            >
              {String(i.code)} · Còn phải thu{" "}
              {formatCurrency(Number(i.remaining_amount))}
            </Link>
          ))}
        </div>
      )}
      {d.blockers && d.blockers.length > 0 && show(6, 8, 9) && (
        <aside className="rounded-xl border border-warning-border bg-warning-muted p-4 text-sm">
          <h3 className="font-semibold">Điều kiện còn thiếu để đóng hồ sơ</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {d.blockers.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </aside>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-muted p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {show(1) && (!co || co.status === "CANCELLED") && (staff || tenant) && (
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
          <div className="rounded-xl bg-muted p-3 text-sm">
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
          {show(1) &&
            editable &&
            !co.actual_checkout_at &&
            (staff || tenant) && (
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
          {show(3, 4) &&
            staff &&
            editable &&
            !co.actual_checkout_at &&
            co.confirmed_date && (
              <details open={wizard || !co.inspection_at}>
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
                        className="space-y-2 rounded-xl bg-muted p-3"
                      >
                        <p className="text-sm font-semibold">
                          {String(a.asset_name)} · Khi nhận:{" "}
                          {String(a.quantity)} · {String(a.condition_status)}
                        </p>
                        <label className="block text-sm">
                          Số lượng trả
                          <NumberInput
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
                        <NumberInput
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
                    <NumberInput
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
                  <p className="text-xs text-secondary-foreground">
                    Không tự ghi người thuê đã xác nhận. Hao mòn hoặc tình trạng
                    thay đổi không tự tạo tiền bồi thường.
                  </p>
                  <button disabled={busy} className={button}>
                    Lưu kiểm kê và chốt mốc bàn giao
                  </button>
                </form>
              </details>
            )}
          {show(3, 9) && d.inspectionVersion && (
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
          {show(3, 4) && d.inspection.length > 0 && (
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
          {show(5) && (
            <details open={wizard}>
              <summary>Bồi thường và khoản phát sinh cần xác minh</summary>
              <div className="mt-3 space-y-3">
                {d.charges.map((c) => (
                  <div
                    key={String(c.id)}
                    className="rounded-xl bg-muted p-3 text-sm"
                  >
                    <p>
                      {String(c.description)} ·{" "}
                      {formatCurrency(Number(c.amount))} · {String(c.status)}
                    </p>
                    <p>
                      {String(c.evidence_reference)} · {String(c.reason)}
                    </p>
                    {canApprove && editable && c.status === "PROPOSED" && (
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
                    <CurrencyInput
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
                    <NumberInput
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
          )}
          {show(6) && d.previewError && (
            <p role="alert" className="rounded-xl bg-warning-muted p-3 text-sm">
              Cần đối soát trước quyết toán: {d.previewError}
            </p>
          )}
          {show(6) && (d.preview || d.approved) && (
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
                  <span className="block text-xs text-muted-foreground">
                    {l.description}
                  </span>
                </p>
              ))}
              {d.preview?.credits.map((c, i) => (
                <p key={i} className="text-sm text-warning">
                  {c}
                </p>
              ))}
            </div>
          )}
          {show(6) && canApprove && editable && d.preview && (
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
          {show(7, 8, 9) && d.approved && (
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
              {show(7) && tenant && editable && !tenantConfirmed && (
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
              {show(8) && canApply && editable && (
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
          <div className="rounded-xl bg-muted p-3 text-sm">
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
          {show(7) &&
            (tenant || staff) &&
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
          {show(7) &&
            d.disputes.map((r) => (
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
          {show(9) && (
            <details open={wizard}>
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
          )}
          {show(3, 4, 7, 9) && (
            <CheckoutEvidencePanel
              portal={portal}
              id={Number(co.id)}
              editable={editable && (staff || tenant)}
            />
          )}
          {show(9) && <CheckoutPrint data={d} />}
          {showLedger && show(8, 9) && (
            <DepositLedgerPanel
              portal={portal}
              contractId={contractId}
              approvalAllowed={
                portal === "admin" ? d.permissions?.canClose : undefined
              }
            />
          )}
        </>
      )}
    </section>
  );
}

const checkoutStepNames = [
  "Thông tin & lịch trả",
  "Hợp đồng & công nợ",
  "Kiểm kê tài sản",
  "Điện nước & dịch vụ",
  "Phí phát sinh",
  "Xem trước & phê duyệt",
  "Xác nhận & phản hồi",
  "Thu thiếu / hoàn cọc",
  "Bàn giao & đóng hồ sơ",
];
function CheckoutSteps({
  step,
  onChange,
  data: d,
}: {
  step: number;
  onChange: (step: number) => void;
  data: Detail;
}) {
  const co = d.checkout;
  const disputed = d.disputes?.some((x) => x.status === "OPEN");
  const states = [
    co?.confirmed_date ? "Đã xác nhận" : co ? "Chờ xác nhận" : "Chưa yêu cầu",
    d.timing?.shortNotice ? "Cần rà soát" : "Thông tin nguồn",
    co?.inspection_at ? "Đã lưu" : "Chưa kiểm kê",
    co?.inspection_at ? "Đã chốt theo kiểm kê" : "Chưa chốt",
    d.charges?.some((x) => x.status === "PROPOSED")
      ? "Cần phê duyệt"
      : "Theo dữ liệu",
    d.approved ? "Đã phê duyệt" : d.preview ? "Chờ duyệt" : "Chưa đủ dữ liệu",
    disputed
      ? "Có tranh chấp"
      : d.confirmations?.some((x) => x.party === "TENANT")
        ? "Đã xác nhận"
        : "Chờ phản hồi",
    co?.settlement_applied_at &&
    Number(d.currentDebt) === 0 &&
    Number(d.depositBalance) === 0
      ? "Đã đối soát"
      : "Chờ xử lý",
    co?.status === "COMPLETED"
      ? "Đã đóng"
      : co?.actual_checkout_at
        ? "Đã bàn giao; chờ tài chính"
        : "Chưa bàn giao",
  ];
  return (
    <nav aria-label="Các bước trả phòng" className="grid gap-2 sm:grid-cols-3">
      {checkoutStepNames.map((name, i) => (
        <button
          key={name}
          type="button"
          aria-current={step === i + 1 ? "step" : undefined}
          onClick={() => onChange(i + 1)}
          className={
            step === i + 1
              ? "rounded-xl border border-blue-600 bg-accent p-3 text-left text-link"
              : "rounded-xl border border-border p-3 text-left text-secondary-foreground"
          }
        >
          <span className="text-sm font-semibold">
            {i + 1}. {name}
          </span>
          <span className="mt-1 block text-xs">{states[i]}</span>
        </button>
      ))}
    </nav>
  );
}
function CheckoutPrint({ data: d }: { data: Detail }) {
  function print() {
    document.body.dataset.checkoutPrint = "true";
    const clear = () => {
      delete document.body.dataset.checkoutPrint;
      window.removeEventListener("afterprint", clear);
    };
    window.addEventListener("afterprint", clear);
    window.print();
    clear();
  }
  return (
    <>
      <button
        type="button"
        onClick={print}
        className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
      >
        In / Lưu PDF biên bản và quyết toán
      </button>
      <article className="checkout-print">
        <h1>BIÊN BẢN TRẢ PHÒNG VÀ QUYẾT TOÁN</h1>
        <p>
          Hợp đồng {d.contractCode} · Hồ sơ CO-{String(d.checkout?.id)}
        </p>
        <p>
          {d.approved
            ? "Phiên bản được phê duyệt " + String(d.approved.version)
            : "BẢN DỰ THẢO — CHƯA PHÊ DUYỆT"}
        </p>
        <p>
          Dự kiến: {String(d.checkout?.requested_date ?? "—")} · Lịch xác nhận:{" "}
          {String(d.checkout?.confirmed_date ?? "—")}
        </p>
        <p>
          Kiểm kê: {String(d.checkout?.inspection_at ?? "—")} · Bàn giao thực
          tế: {String(d.checkout?.actual_checkout_at ?? "Chưa bàn giao")}
        </p>
        <h2>Kiểm kê tài sản</h2>
        <table>
          <thead>
            <tr>
              <th>Tài sản</th>
              <th>Khi nhận</th>
              <th>Khi trả</th>
              <th>Căn cứ</th>
            </tr>
          </thead>
          <tbody>
            {d.initialAssets.map((a) => {
              const r = d.inspection.find(
                (x) => Number(x.checkin_asset_id) === Number(a.id),
              );
              return (
                <tr key={String(a.id)}>
                  <td>{String(a.asset_name)}</td>
                  <td>
                    {String(a.quantity)} · {String(a.condition_status)}
                  </td>
                  <td>
                    {r
                      ? String(r.returned_quantity) +
                        " · " +
                        String(r.returned_condition)
                      : "Chưa kiểm kê"}
                  </td>
                  <td>{String(r?.evidence_reference ?? "—")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h2>Nghĩa vụ và tiền cọc</h2>
        <p>
          Nợ hiện tại: {formatCurrency(d.currentDebt)} · Cọc còn giữ hiện tại:{" "}
          {formatCurrency(d.depositBalance)}
        </p>
        <p>
          Tại phiên bản: nợ cũ{" "}
          {formatCurrency(
            d.approved?.old_debt == null && d.preview?.oldDebt == null
              ? null
              : Number(d.approved?.old_debt ?? d.preview?.oldDebt),
          )}
          ; phát sinh{" "}
          {formatCurrency(
            d.approved?.new_charges == null && d.preview?.newCharges == null
              ? null
              : Number(d.approved?.new_charges ?? d.preview?.newCharges),
          )}
          ; cấn trừ{" "}
          {formatCurrency(
            d.approved?.deduction == null && d.preview?.deduction == null
              ? null
              : Number(d.approved?.deduction ?? d.preview?.deduction),
          )}
          ; hoàn dự kiến{" "}
          {formatCurrency(
            d.approved?.refund_due == null && d.preview?.refund == null
              ? null
              : Number(d.approved?.refund_due ?? d.preview?.refund),
          )}
          .
        </p>
        <table>
          <thead>
            <tr>
              <th>Khoản mục</th>
              <th>Số lượng / đơn giá</th>
              <th>Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {d.approved
              ? (d.approvedLines ?? []).map((l, i) => (
                  <tr key={i}>
                    <td>{String(l.name)}</td>
                    <td>
                      {String(l.quantity)} {String(l.unit)} ×{" "}
                      {formatCurrency(Number(l.unit_price))}
                    </td>
                    <td>{formatCurrency(Number(l.amount))}</td>
                  </tr>
                ))
              : d.preview?.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.name}</td>
                    <td>
                      {l.quantity} {l.unit} × {formatCurrency(l.price)}
                    </td>
                    <td>{formatCurrency(l.amount)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        <p>
          Xác nhận quyết toán:{" "}
          {d.confirmations
            ?.map((c) => String(c.party) + " · " + String(c.confirmed_at))
            .join("; ") || "Chưa có"}
        </p>
        <p>
          Hoàn cọc:{" "}
          {d.refunds
            ?.map(
              (r) =>
                "#" +
                r.id +
                " · " +
                r.status +
                " · đã trả " +
                formatCurrency(Number(r.paid_amount ?? 0)),
            )
            .join("; ") || "Chưa có yêu cầu"}
        </p>
        <p>
          Trạng thái hồ sơ: {String(d.checkout?.status)} · Tài chính:{" "}
          {d.currentFinancialStatus}
        </p>
        <p>
          Tài liệu nội bộ. Xác nhận theo phiên bản không phải chữ ký số được
          chứng nhận. Số phải hoàn không chứng minh đã chuyển tiền.
        </p>
      </article>
    </>
  );
}
