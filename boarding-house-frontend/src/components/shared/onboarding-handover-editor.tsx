"use client";
import { useState } from "react";
import { NumberInput } from "@/components/ui/number-input";
import type {
  OnboardingDetail,
  OnboardingRow,
} from "@/types/contract-onboarding";
import { formatDate } from "@/lib/format";

const input =
  "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm";
const button =
  "rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40";
const conditions: Record<string, string> = {
  NEW: "Mới",
  GOOD: "Tốt",
  FAIR: "Đã sử dụng",
  DAMAGED: "Hư hỏng",
  MISSING: "Thiếu",
};
export function OnboardingHandoverEditor({
  detail: d,
  busy,
  act,
}: {
  detail: OnboardingDetail;
  busy: boolean;
  act: (path: string, payload: unknown, put?: boolean) => Promise<boolean>;
}) {
  const ci = d.checkin!;
  const [step, setStep] = useState(1);
  const [assets, setAssets] = useState<OnboardingRow[]>(
    (d.assets ?? []).map((a) => ({
      ...a,
      condition_status:
        a.condition_status === "LOST" ? "MISSING" : a.condition_status,
    })),
  );
  const [date, setDate] = useState(String(ci.scheduled_date));
  const [readings, setReadings] = useState<Record<string, string>>({
    ELECTRICITY:
      ci.electricity_reading == null ? "" : String(ci.electricity_reading),
    WATER: ci.water_reading == null ? "" : String(ci.water_reading),
  });
  const [keys, setKeys] = useState(String(ci.keys_cards_count ?? 0));
  const [reference, setReference] = useState(
    String(ci.handover_reference ?? ""),
  );
  const [reviewed, setReviewed] = useState(false);
  const [roomCondition, setRoomCondition] = useState(
    String(d.handoverDocument?.snapshot.general.roomCondition ?? ""),
  );
  const [handoverNote, setHandoverNote] = useState(
    String(d.handoverDocument?.snapshot.general.note ?? ""),
  );
  const maxKeys = d.handoverPolicy?.maxKeysCards ?? 20;
  return (
    <section
      id="handover-editor"
      className="space-y-4 scroll-mt-6 rounded-xl border p-4"
    >
      <h3 className="font-semibold">Lập biên bản bàn giao</h3>
      <p className="text-sm">
        Bước {step}/3 ·{" "}
        {step === 1
          ? "Kiểm kê tài sản"
          : step === 2
            ? "Chỉ số điện nước"
            : "Xem trước và xác nhận bàn giao"}
      </p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (step < 3) {
            setStep(step + 1);
            setReviewed(false);
            return;
          }
          if (!reviewed) return;
          await act(
            "handover",
            {
              version: Number(ci.version),
              scheduledDate: date,
              electricityReading:
                readings.ELECTRICITY === ""
                  ? null
                  : Number(readings.ELECTRICITY),
              waterReading:
                readings.WATER === "" ? null : Number(readings.WATER),
              keysCardsCount: Number(keys),
              reference,
              roomCondition: roomCondition.trim() || null,
              handoverNote: handoverNote.trim() || null,
              confirmLandlord: reviewed,
              expectedContextHash: d.handoverContextHash,
              assets: assets.map((a) => ({
                roomAssetId: a.room_asset_id,
                assetName: a.asset_name,
                quantity: Number(a.quantity),
                conditionStatus: a.condition_status,
                note: a.note,
              })),
            },
            true,
          );
        }}
      >
        {step === 1 && (
          <>
            <p className="text-sm text-slate-600">
              Danh mục lấy từ phòng khi chuẩn bị bàn giao. Đối chiếu từng tài
              sản với thực tế.
            </p>
            {assets.length === 0 && (
              <p className="text-sm">
                Phòng chưa có tài sản trong danh mục kiểm kê.
              </p>
            )}
            {assets.map((a, i) => (
              <div
                key={String(a.room_asset_id ?? i)}
                className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"
              >
                <p className="sm:col-span-2">
                  {String(a.asset_name)} · Số lượng {String(a.quantity)}
                </p>
                <label className="text-sm">
                  Tình trạng
                  <select
                    className={input}
                    value={String(a.condition_status)}
                    onChange={(e) =>
                      setAssets(
                        assets.map((x, j) =>
                          j === i
                            ? { ...x, condition_status: e.target.value }
                            : x,
                        ),
                      )
                    }
                  >
                    {Object.entries(conditions).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Ghi chú và tham chiếu minh chứng
                  <input
                    maxLength={500}
                    value={String(a.note ?? "")}
                    onChange={(e) =>
                      setAssets(
                        assets.map((x, j) =>
                          j === i ? { ...x, note: e.target.value } : x,
                        ),
                      )
                    }
                    className={input}
                  />
                </label>
              </div>
            ))}
            <p className="text-xs text-slate-600">
              Nếu danh mục phòng đã thay đổi, nạp lại trước khi kiểm kê. Phiên
              bản biên bản thay đổi cần hai bên xác nhận lại.
            </p>
            <button
              type="button"
              disabled={busy}
              className="text-sm text-blue-700 underline"
              onClick={async () => {
                if (
                  window.confirm(
                    "Nạp danh mục phòng hiện tại? Các tình trạng và ghi chú chưa lưu sẽ được thay thế.",
                  )
                )
                  await act("inventory", {});
              }}
            >
              Nạp lại danh mục tài sản phòng
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <label className="block text-sm">
              Ngày ghi chỉ số và bàn giao
              <input
                type="date"
                required
                min={String(d.draft.start_date)}
                max={String(d.draft.end_date)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={input}
              />
            </label>
            {d.utilityRates.map((r) => {
              const code = String(r.code),
                meter = d.meters.find(
                  (m) => m.meter_type === code && m.status === "ACTIVE",
                );
              return (
                <div key={code} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p>
                    {String(r.name)} ·{" "}
                    {r.calculation_method === "METER"
                      ? `Đồng hồ ${meter?.meter_code ?? "chưa được thiết lập"}`
                      : "Phí cố định, không yêu cầu chỉ số riêng"}
                  </p>
                  {r.calculation_method === "METER" && (
                    <label className="block">
                      Chỉ số bàn giao thực tế
                      <NumberInput
                        id={`handover-${code}`}
                        name={code}
                        required
                        min={Number(meter?.current_reading ?? 0)}
                        step="0.01"
                        value={readings[code]}
                        onChange={(e) =>
                          setReadings({ ...readings, [code]: e.target.value })
                        }
                        className={input}
                      />
                    </label>
                  )}
                </div>
              );
            })}
            <label className="block text-sm">
              Số chìa khóa/thẻ
              <NumberInput
                id="handover-keys"
                name="keys"
                required
                min={0}
                max={maxKeys}
                value={keys}
                onChange={(e) => setKeys(e.target.value)}
                className={input}
              />
            </label>
            <p className="text-xs text-slate-600">
              Tổng chìa khóa và thẻ từ: tối đa {maxKeys} theo chính sách hiện
              tại; không nhập gộp mã thẻ vào số lượng.
            </p>
            <label className="block text-sm">
              Tình trạng phòng
              <textarea
                maxLength={1000}
                value={roomCondition}
                onChange={(e) => setRoomCondition(e.target.value)}
                className={input}
              />
            </label>
            <label className="block text-sm">
              Ghi chú bàn giao
              <textarea
                maxLength={2000}
                value={handoverNote}
                onChange={(e) => setHandoverNote(e.target.value)}
                className={input}
              />
            </label>
            <label className="block text-sm">
              Tham chiếu biên bản / ảnh bàn giao
              <input
                name="handoverReference"
                required
                maxLength={500}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={input}
              />
            </label>
          </>
        )}
        {step === 3 && (
          <div className="space-y-2 rounded-xl bg-blue-50 p-4 text-sm">
            <h4 className="font-semibold">Xem trước biên bản</h4>
            <p>
              {String(d.context.property_name)} / {String(d.context.room_code)}{" "}
              · {String(d.context.tenant_name)}
            </p>
            <p>Ngày bàn giao: {formatDate(date)}</p>
            {assets.map((a, i) => (
              <p key={i}>
                {String(a.asset_name)} · {String(a.quantity)} ·{" "}
                {conditions[String(a.condition_status)]} ·{" "}
                {String(a.note ?? "")}
              </p>
            ))}
            {d.utilityRates.map((r) => (
              <p key={String(r.code)}>
                {String(r.name)}:{" "}
                {r.calculation_method === "METER"
                  ? `${d.meters.find((m) => m.meter_type === r.code)?.meter_code ?? "Thiếu công tơ"} · ${readings[String(r.code)]}`
                  : "Phí cố định"}
              </p>
            ))}
            <p>
              Chìa khóa/thẻ: {keys} · Tham chiếu: {reference}
            </p>
            <p className="whitespace-pre-wrap">
              Tình trạng phòng: {roomCondition || "Chưa ghi chú"}
            </p>
            <p className="whitespace-pre-wrap">
              Ghi chú bàn giao: {handoverNote || "Không có ghi chú bổ sung"}
            </p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                required
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              Tôi đã đối chiếu thông tin bàn giao với thực tế và chủ động đồng ý
              xác nhận phía bên cho thuê. Nút bên dưới lưu/chốt phiên bản đồng
              thời ghi nhận xác nhận của tôi; người thuê phải xác nhận riêng
              cùng phiên bản.
            </label>
          </div>
        )}
        <div className="flex gap-2">
          {step > 1 && (
            <button
              type="button"
              disabled={busy}
              className="rounded-xl border px-4 py-2 text-sm"
              onClick={() => {
                setStep(step - 1);
                setReviewed(false);
              }}
            >
              Quay lại
            </button>
          )}
          <button
            disabled={busy || (step === 3 && !reviewed)}
            className={button}
          >
            {step < 3
              ? "Tiếp tục"
              : d.handoverDocument
                ? "Chốt phiên bản và xác nhận bên cho thuê"
                : "Lưu biên bản và xác nhận bên cho thuê"}
          </button>
        </div>
      </form>
    </section>
  );
}
