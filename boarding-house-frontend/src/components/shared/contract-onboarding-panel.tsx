"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";

type Row = Record<string, string | number | boolean | null>;
type Detail = {
  draft: Row;
  services: Row[];
  terms: Row[];
  monthlyRent: number | null;
  identityVerified: boolean;
  contractConfirmed: boolean;
  initialPaymentSatisfied: boolean;
  initialPaymentRequired: boolean;
  initialInvoiceId: number | null;
  contractVersion: Row | null;
  handoverVersion?: Row | null;
  checkin: Row | null;
  contractConfirmations: Row[];
  handoverConfirmations?: Row[];
  utilityRates: Row[];
  assets?: Row[];
  meters: Row[];
  deposit: Row | null;
  confirmationNotice: string;
};
const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";
const button =
  "rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40";

export function ContractOnboardingPanel({
  portal,
  contractId,
}: {
  portal: "admin" | "tenant" | "accountant";
  contractId: number;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/${portal}/contract-onboarding/${contractId}`;
  const query = useQuery({
    queryKey: [
      "contract-onboarding",
      portal,
      user?.id,
      user?.activeRole,
      contractId,
    ],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<Detail>>(base)).data.data,
  });
  const staff =
    portal === "admin" && ["OWNER", "MANAGER"].includes(user?.activeRole ?? "");
  async function act(path: string, payload: unknown, put = false) {
    setBusy(true);
    setError("");
    try {
      if (put) await apiClient.put(`${base}/${path}`, payload);
      else await apiClient.post(`${base}/${path}`, payload);
      await client.invalidateQueries();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return <p>Đang tải điều kiện nhận phòng…</p>;
  if (query.isError) return <p role="alert">{apiErrorMessage(query.error)}</p>;
  const d = query.data,
    ci = d.checkin;
  const confirmedHandover =
    new Set((d.handoverConfirmations ?? []).map((x) => x.party)).size === 2;
  const ownParty = portal === "tenant" ? "TENANT" : "LANDLORD";
  function confirm(path: string, v: Row) {
    void act(path, { version: Number(v.version), contentHash: v.content_hash });
  }
  function evidence(e: FormEvent<HTMLFormElement>, path: string) {
    e.preventDefault();
    void act(path, {
      reference: new FormData(e.currentTarget).get("reference"),
    });
  }
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Hồ sơ xác nhận và bàn giao</h2>
      <p className="text-sm text-slate-600">{d.confirmationNotice}</p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <p>
        Giá thuê đã chốt:{" "}
        {d.monthlyRent === null
          ? "Cần đối soát hợp đồng cũ"
          : formatCurrency(d.monthlyRent)}
      </p>
      <ul className="space-y-1 text-sm">
        <li>
          Hồ sơ định danh:{" "}
          {d.identityVerified
            ? "Đã xác minh"
            : "Chưa xác minh hoặc đã thay đổi"}
        </li>
        <li>
          Hợp đồng:{" "}
          {d.contractConfirmed
            ? "Hai bên đã xác nhận cùng phiên bản"
            : "Đang chờ xác nhận"}
        </li>
        <li>
          Cọc còn thiếu:{" "}
          {d.deposit
            ? formatCurrency(Number(d.deposit.remaining_due))
            : "Chưa có tài khoản cọc"}
        </li>
        <li>
          Thu đầu kỳ:{" "}
          {d.initialPaymentSatisfied
            ? "Đã đáp ứng chính sách"
            : "Chưa thanh toán đủ hóa đơn đầu kỳ"}
          {d.initialInvoiceId ? ` · Hóa đơn #${d.initialInvoiceId}` : ""}
        </li>
        <li>
          Bàn giao:{" "}
          {confirmedHandover
            ? "Hai bên đã xác nhận"
            : "Đang chờ lập hoặc xác nhận"}
        </li>
      </ul>
      {d.contractVersion && (
        <details className="rounded-xl bg-slate-50 p-3">
          <summary>
            Nội dung hợp đồng · phiên bản {String(d.contractVersion.version)}
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
            {String(d.contractVersion.content)}
          </pre>
        </details>
      )}
      <p className="text-xs">
        Đã xác nhận:{" "}
        {d.contractConfirmations
          .map(
            (x) =>
              `${x.party === "TENANT" ? "Người thuê" : "Bên cho thuê"} (${x.confirmed_at})`,
          )
          .join("; ") || "Chưa có"}
      </p>
      {(staff || portal === "tenant") &&
        d.contractVersion &&
        !d.contractConfirmations.some((x) => x.party === ownParty) && (
          <button
            disabled={busy}
            className={button}
            onClick={() => confirm("confirmations", d.contractVersion!)}
          >
            Tôi đã đọc và xác nhận phiên bản hợp đồng này
          </button>
        )}
      {staff && !d.identityVerified && (
        <form
          className="flex gap-2"
          onSubmit={(e) => evidence(e, "identity-verification")}
        >
          <input
            required
            maxLength={500}
            name="reference"
            className={input}
            placeholder="Mã hồ sơ/chứng từ đã đối chiếu định danh"
          />
          <button disabled={busy} className={button}>
            Xác minh hồ sơ
          </button>
        </form>
      )}
      {staff && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act("versions", {
              reason: new FormData(e.currentTarget).get("reason"),
            });
          }}
        >
          <input
            required
            maxLength={1000}
            name="reason"
            className={input}
            placeholder="Lý do chốt lại nội dung sau khi cập nhật hồ sơ"
          />
          <button disabled={busy} className={button}>
            Chốt phiên bản
          </button>
        </form>
      )}
      {portal !== "tenant" &&
        d.initialPaymentRequired &&
        !d.initialInvoiceId && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act("initial-invoice", {
                invoiceId: Number(new FormData(e.currentTarget).get("invoice")),
              });
            }}
          >
            <input
              required
              name="invoice"
              type="number"
              min={1}
              className={input}
              placeholder="ID hóa đơn thuê đã phát hành đúng tháng bắt đầu"
            />
            <button disabled={busy} className={button}>
              Gắn hóa đơn đầu kỳ
            </button>
          </form>
        )}
      {staff &&
        d.draft.status === "PENDING_CONFIRMATION" &&
        !d.initialInvoiceId && (
          <details className="border-t pt-3">
            <summary>Điều chỉnh nội dung trước nhận phòng</summary>
            <form
              key={String(d.contractVersion?.version)}
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act(
                  "terms",
                  {
                    reason: f.get("reason"),
                    terms: {
                      startDate: f.get("start"),
                      endDate: f.get("end"),
                      depositAmount: Number(d.draft.deposit_amount),
                      paymentDueDay: Number(f.get("due")),
                      noticePeriodDays: Number(f.get("notice")),
                      monthlyRent: Number(f.get("rent")),
                      initialPaymentRequired: f.get("initial") === "on",
                      utilityRates: ["ELECTRICITY", "WATER"].map((code) => ({
                        code,
                        name: code === "ELECTRICITY" ? "Điện" : "Nước",
                        calculationMethod: f.get(`${code}-method`),
                        unitPrice: Number(f.get(`${code}-price`)),
                        unit:
                          f.get(`${code}-method`) === "METER"
                            ? code === "ELECTRICITY"
                              ? "kWh"
                              : "m3"
                            : "tháng",
                      })),
                      services: d.services.map((s) => ({
                        code: s.code,
                        name: s.name,
                        calculationMethod: s.calculation_method,
                        unitPrice: Number(s.unit_price),
                      })),
                      terms: [
                        ...d.terms.map((t) => ({
                          title: t.title,
                          content: t.content,
                        })),
                        ...(f.get("termContent")
                          ? [
                              {
                                title: f.get("termTitle"),
                                content: f.get("termContent"),
                              },
                            ]
                          : []),
                      ],
                    },
                  },
                  true,
                );
              }}
            >
              <p className="text-xs text-slate-600">
                Thay đổi tạo phiên bản mới, yêu cầu hai bên xác nhận lại. Cọc
                được điều chỉnh riêng qua sổ cọc. Hóa đơn đã tạo phải được xử lý
                trước.
              </p>
              <label className="block text-sm">
                Giá thuê tháng
                <input
                  required
                  name="rent"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={d.monthlyRent ?? undefined}
                  className={input}
                />
              </label>
              <label className="block text-sm">
                Ngày bắt đầu
                <input
                  required
                  name="start"
                  type="date"
                  defaultValue={String(d.draft.start_date)}
                  className={input}
                />
              </label>
              <label className="block text-sm">
                Ngày kết thúc
                <input
                  required
                  name="end"
                  type="date"
                  defaultValue={String(d.draft.end_date)}
                  className={input}
                />
              </label>
              <label className="block text-sm">
                Ngày hạn thanh toán
                <input
                  required
                  name="due"
                  type="number"
                  min={1}
                  max={28}
                  defaultValue={Number(d.draft.payment_due_day)}
                  className={input}
                />
              </label>
              <label className="block text-sm">
                Báo trước (ngày)
                <input
                  required
                  name="notice"
                  type="number"
                  min={0}
                  defaultValue={Number(d.draft.notice_period_days)}
                  className={input}
                />
              </label>
              {["ELECTRICITY", "WATER"].map((code) => {
                const r = d.utilityRates.find((x) => x.code === code);
                return (
                  <div key={code} className="grid grid-cols-2 gap-2">
                    <label>
                      {code === "ELECTRICITY" ? "Điện" : "Nước"}
                      <select
                        required
                        name={`${code}-method`}
                        defaultValue={String(r?.calculation_method ?? "METER")}
                        className={input}
                      >
                        <option value="METER">Đồng hồ riêng</option>
                        <option value="FIXED">Phí cố định / không thu</option>
                      </select>
                    </label>
                    <label>
                      Đơn giá
                      <input
                        required
                        name={`${code}-price`}
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={r ? Number(r.unit_price) : undefined}
                        className={input}
                      />
                    </label>
                  </div>
                );
              })}
              <label className="flex gap-2 text-sm">
                <input
                  name="initial"
                  type="checkbox"
                  defaultChecked={d.initialPaymentRequired}
                />
                Thu đủ hóa đơn thuê đầu kỳ trước nhận phòng
              </label>
              <input
                name="termTitle"
                maxLength={200}
                placeholder="Tiêu đề điều khoản bổ sung"
                className={input}
              />
              <textarea
                name="termContent"
                maxLength={5000}
                placeholder="Nội dung điều khoản bổ sung (nếu có)"
                className={input}
              />
              <input
                required
                name="reason"
                maxLength={1000}
                placeholder="Lý do thay đổi"
                className={input}
              />
              <button disabled={busy} className={button}>
                Lưu và yêu cầu xác nhận lại
              </button>
            </form>
          </details>
        )}
      {staff && ci?.status === "READY" && (
        <form
          key={String(ci.version)}
          className="space-y-3 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void act(
              "handover",
              {
                version: Number(ci.version),
                scheduledDate: f.get("date"),
                electricityReading: f.has("ELECTRICITY")
                  ? Number(f.get("ELECTRICITY"))
                  : null,
                waterReading: f.has("WATER") ? Number(f.get("WATER")) : null,
                keysCardsCount: Number(f.get("keys")),
                reference: f.get("reference"),
                assets:
                  f.get("refreshInventory") === "on"
                    ? []
                    : (d.assets ?? []).map((a, i) => ({
                        roomAssetId: a.room_asset_id,
                        assetName: a.asset_name,
                        quantity: Number(a.quantity),
                        conditionStatus: f.get(`condition-${i}`),
                        note: f.get(`note-${i}`),
                      })),
              },
              true,
            );
          }}
        >
          <h3 className="font-semibold">Kiểm kê và lập phiên bản bàn giao</h3>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="refreshInventory" />
            Nạp lại danh mục tài sản hiện tại vào biên bản mới (cần kiểm kê và
            xác nhận lại)
          </label>
          <label className="block text-sm">
            Ngày bàn giao
            <input
              required
              type="date"
              name="date"
              defaultValue={String(ci.scheduled_date)}
              className={input}
            />
          </label>
          {d.utilityRates.map((r) => (
            <div key={String(r.code)} className="text-sm">
              {String(r.name)} · {formatCurrency(Number(r.unit_price))} /{" "}
              {String(r.unit)} ·{" "}
              {r.calculation_method === "METER"
                ? "Theo đồng hồ"
                : "Phí cố định"}
              {r.calculation_method === "METER" && (
                <label className="block">
                  Chỉ số thực tế (
                  {String(
                    d.meters.find((m) => m.meter_type === r.code)?.meter_code ??
                      "Thiếu đồng hồ",
                  )}
                  )
                  <input
                    required
                    name={String(r.code)}
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={
                      ci[
                        r.code === "ELECTRICITY"
                          ? "electricity_reading"
                          : "water_reading"
                      ] === null
                        ? undefined
                        : Number(
                            ci[
                              r.code === "ELECTRICITY"
                                ? "electricity_reading"
                                : "water_reading"
                            ],
                          )
                    }
                    className={input}
                  />
                </label>
              )}
            </div>
          ))}
          {(d.assets ?? []).map((a, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-slate-50 p-3">
              <p>
                {String(a.asset_name)} · Số lượng {String(a.quantity)}
              </p>
              <select
                name={`condition-${i}`}
                defaultValue={String(a.condition_status)}
                className={input}
              >
                {["NEW", "GOOD", "FAIR", "DAMAGED", "MISSING"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <input
                name={`note-${i}`}
                maxLength={500}
                defaultValue={String(a.note ?? "")}
                placeholder="Tình trạng thực tế và ghi chú"
                className={input}
              />
            </div>
          ))}
          <label className="block text-sm">
            Số khóa/thẻ
            <input
              required
              type="number"
              min={0}
              name="keys"
              defaultValue={Number(ci.keys_cards_count ?? 0)}
              className={input}
            />
          </label>
          <input
            required
            name="reference"
            maxLength={500}
            defaultValue={String(ci.handover_reference ?? "")}
            placeholder="Mã biên bản/ảnh bàn giao"
            className={input}
          />
          <button disabled={busy} className={button}>
            Lưu biên bản và xác nhận bên cho thuê
          </button>
        </form>
      )}
      {staff &&
        d.draft.status === "PENDING_CONFIRMATION" &&
        d.meters.length > 0 && (
          <details className="border-t pt-3">
            <summary>Ghi nhận thay hoặc reset đồng hồ có chứng từ</summary>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act("meter-events", {
                  meterId: Number(f.get("meter")),
                  newCode: f.get("code"),
                  newReading: Number(f.get("reading")),
                  reason: f.get("reason"),
                  reference: f.get("reference"),
                });
              }}
            >
              <select required name="meter" className={input}>
                {d.meters.map((m) => (
                  <option key={String(m.id)} value={String(m.id)}>
                    {String(m.meter_type)} · {String(m.meter_code)} ·{" "}
                    {String(m.current_reading)}
                  </option>
                ))}
              </select>
              <input
                required
                name="code"
                maxLength={50}
                placeholder="Mã đồng hồ sau thay/reset"
                className={input}
              />
              <input
                required
                name="reading"
                type="number"
                min={0}
                step="0.01"
                placeholder="Chỉ số thực tế sau thay/reset"
                className={input}
              />
              <input
                required
                name="reason"
                maxLength={1000}
                placeholder="Lý do thay/reset"
                className={input}
              />
              <input
                required
                name="reference"
                maxLength={500}
                placeholder="Mã biên bản/ảnh đồng hồ"
                className={input}
              />
              <p className="text-xs">
                Biên bản bàn giao cũ cần được xác nhận lại nếu thông tin đồng hồ
                thay đổi. Thay đồng hồ sau nhận phòng cần đối soát các đoạn sử
                dụng trước khi lập hóa đơn.
              </p>
              <button disabled={busy} className={button}>
                Lưu sự kiện đồng hồ
              </button>
            </form>
          </details>
        )}
      {d.handoverVersion && (
        <details className="rounded-xl bg-slate-50 p-3">
          <summary>
            Biên bản bàn giao · phiên bản {String(d.handoverVersion.version)}
          </summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
            {String(d.handoverVersion.content)}
          </pre>
        </details>
      )}
      {portal === "tenant" &&
        ci?.status === "READY" &&
        d.handoverVersion &&
        !(d.handoverConfirmations ?? []).some((x) => x.party === "TENANT") && (
          <button
            disabled={busy}
            className={button}
            onClick={() =>
              confirm("handover-confirmations", d.handoverVersion!)
            }
          >
            Tôi đã đối chiếu và xác nhận biên bản bàn giao này
          </button>
        )}
      {staff && ci?.status === "READY" && (
        <button
          className={button}
          disabled={
            busy ||
            !d.identityVerified ||
            !d.contractConfirmed ||
            !d.initialPaymentSatisfied ||
            !confirmedHandover ||
            !d.deposit ||
            Number(d.deposit.remaining_due) > 0
          }
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await apiClient.post(
                `/admin/rental-lifecycle/checkins/${ci.id}/complete`,
                {
                  identityVerified: true,
                  contractVerified: true,
                  depositVerified: true,
                  policyBasedMeters: true,
                  electricityReading: ci.electricity_reading,
                  waterReading: ci.water_reading,
                  keysCardsCount: Number(ci.keys_cards_count),
                  version: Number(ci.version),
                  note: "Hoàn tất theo biên bản đã được hai bên xác nhận",
                },
              );
              await client.invalidateQueries();
            } catch (e) {
              setError(apiErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Xác nhận bàn giao thực tế và hoàn tất nhận phòng
        </button>
      )}
      {ci?.status === "COMPLETED" && (
        <p className="text-sm text-emerald-700">
          Đã hoàn tất nhận phòng · {String(ci.actual_checkin_at)}
        </p>
      )}
    </section>
  );
}
