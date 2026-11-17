"use client";
import { CurrencyInput, NumberInput } from "@/components/ui/number-input";

import { useState } from "react";
import { OnboardingIdentityProfile } from "./onboarding-identity-profile";
import { OnboardingProcedures } from "./onboarding-procedures";
import { OnboardingHandoverEditor } from "./onboarding-handover-editor";
import Link from "next/link";
import { ContractMeterReadiness } from "./contract-meter-readiness";
import { ContractConfirmationProgress } from "./contract-confirmation-progress";
import { DepositLedgerPanel } from "./deposit-ledger-panel";
import type {
  OnboardingDetail as Detail,
  OnboardingRow as Row,
} from "@/types/contract-onboarding";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import { HandoverDocumentPanel } from "./handover-document";

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
    queryFn: async ({ signal }) =>
      (await apiClient.get<ApiEnvelope<Detail>>(base, { signal })).data.data,
    enabled: !!user,
    refetchInterval: 15_000,
  });
  const staff = portal === "admin" && !!query.data?.progress?.canManageHandover;
  async function act(path: string, payload: unknown, put = false) {
    setBusy(true);
    setError("");
    try {
      if (put) await apiClient.put(`${base}/${path}`, payload);
      else await apiClient.post(`${base}/${path}`, payload);
      await client.invalidateQueries();
      return true;
    } catch (e) {
      setError(apiErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return <p>Đang tải điều kiện nhận phòng…</p>;
  if (query.isError) return <p role="alert">{apiErrorMessage(query.error)}</p>;
  if (!query.data.progress)
    return (
      <p
        role="alert"
        className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
      >
        Backend chưa có dữ liệu tiến độ xác nhận mới. Cần khởi động lại backend
        sau khi biên dịch bản cập nhật.
      </p>
    );
  const d = query.data,
    ci = d.checkin;
  function confirm(path: string, v: Row) {
    void act(path, { version: Number(v.version), contentHash: v.content_hash });
  }
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      {portal === "admin" && (
        <ContractMeterReadiness
          roomId={Number(d.context.room_id)}
          requiredTypes={d.utilityRates
            .filter((r) => r.calculation_method === "METER")
            .map((r) => String(r.code))}
        />
      )}
      <OnboardingProcedures detail={d} contractId={contractId} />
      <ContractConfirmationProgress
        key={`${user?.id}:${user?.activeRole}:${d.contractVersion?.content_hash ?? "none"}`}
        detail={d}
        busy={busy}
        onConfirm={(v) => confirm("confirmations", v)}
      />
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {d.serviceEstimate && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm">
          Dự kiến kỳ đầu theo thỏa thuận đã lưu: dịch vụ định kỳ{" "}
          {formatCurrency(Number(d.serviceEstimate.recurringEstimate))}, phí một
          lần {formatCurrency(Number(d.serviceEstimate.onceEstimate))}, tổng gồm
          thuê/cọc/định mức{" "}
          {formatCurrency(Number(d.serviceEstimate.initialEstimate))}. Chưa phân
          bổ ngày lẻ hoặc tính lượt sử dụng; đây chưa phải số đã thanh toán. Số
          phải thu theo hóa đơn và sổ cọc.
        </p>
      )}
      {d.progress.canWriteFinance && (
        <p>
          <a
            className="text-sm font-semibold text-blue-700 underline"
            href={`#deposit-ledger-${contractId}`}
          >
            Ghi nhận tiền cọc trong sổ cọc
          </a>
        </p>
      )}
      {d.progress.canReadFinance && d.deposit && (
        <p className="text-sm">
          Cọc phải thu: {formatCurrency(Number(d.deposit.required_amount))} · Đã
          thu: {formatCurrency(Number(d.deposit.balance_amount))} · Còn thiếu:{" "}
          {formatCurrency(Number(d.deposit.remaining_due))}
        </p>
      )}
      {portal !== "tenant" &&
        d.draft.status === "PENDING_CONFIRMATION" &&
        d.progress.canReadFinance && (
          <DepositLedgerPanel
            portal={portal}
            contractId={contractId}
            writeAllowed={d.progress.canWriteFinance}
            approvalAllowed={d.progress.canApproveDeposit}
          />
        )}
      <OnboardingIdentityProfile
        key={`${user?.id}:${user?.activeRole}:${contractId}:${d.identityProfile?.dataHash}`}
        detail={d}
        portal={portal}
        busy={busy}
        act={act}
      />
      {d.progress.canRevise && (
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
      {d.initialPaymentRequired && !d.progress.checkinCompleted && (
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="font-semibold">Hóa đơn thuê đầu kỳ</h3>
          {d.initialInvoice && (
            <p className="text-sm">
              <Link
                className="text-blue-700 underline"
                href={`/${portal}/invoices/${d.initialInvoice.id}`}
              >
                {String(d.initialInvoice.code)}
              </Link>{" "}
              · Còn phải thanh toán:{" "}
              {formatCurrency(Number(d.initialInvoice.remaining_amount))}
            </p>
          )}
          {d.progress.canWriteFinance &&
            !d.initialInvoiceId &&
            d.initialInvoiceOptions.length > 0 && (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("initial-invoice", {
                    invoiceId: Number(
                      new FormData(e.currentTarget).get("invoice"),
                    ),
                  });
                }}
              >
                <label className="min-w-0 flex-1 text-sm">
                  Chọn hóa đơn đã phát hành hợp lệ
                  <select
                    name="invoice"
                    required
                    className={input}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Chọn hóa đơn đầu kỳ
                    </option>
                    {d.initialInvoiceOptions.map((i) => (
                      <option key={String(i.id)} value={String(i.id)}>
                        {String(i.code)} · Còn phải trả{" "}
                        {formatCurrency(Number(i.remaining_amount))}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={busy} className={button}>
                  Gắn hóa đơn đầu kỳ
                </button>
              </form>
            )}
          {d.initialDraftInvoice &&
            (d.progress.canWriteFinance ||
              d.progress.canCreateInitialInvoice) && (
              <Link
                className="inline-block text-sm font-semibold text-blue-700 underline"
                href={`/${portal}/invoices/${d.initialDraftInvoice.id}`}
              >
                Kiểm tra và phát hành hóa đơn nháp{" "}
                {String(d.initialDraftInvoice.code)}
              </Link>
            )}
          {d.progress.canCreateInitialInvoice &&
            !d.initialInvoiceId &&
            !d.initialDraftInvoice && (
              <button
                disabled={busy}
                className={button}
                type="button"
                onClick={() => void act("initial-invoice/draft", {})}
              >
                Tạo hóa đơn đầu kỳ nháp
              </button>
            )}
          {!d.initialPaymentSatisfied && (
            <p className="text-xs text-slate-600">
              Hóa đơn phải được phát hành, liên kết đúng hợp đồng và thanh toán
              bằng chứng từ. Tạo hóa đơn nháp không ghi nhận đã thu.
            </p>
          )}
        </section>
      )}
      {staff && !ci && (
        <form
          id="handover-editor"
          className="space-y-3 rounded-xl border p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const date = new FormData(e.currentTarget).get("date");
            setBusy(true);
            setError("");
            try {
              await apiClient.post("/admin/rental-lifecycle/checkins", {
                contractId,
                scheduledDate: date,
                assets: [],
                note: "Chuẩn bị bàn giao từ hợp đồng",
              });
              await client.invalidateQueries();
            } catch (err) {
              setError(apiErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="font-semibold">Chuẩn bị biên bản bàn giao</h3>
          <label className="block text-sm">
            Ngày dự kiến nhận phòng
            <input
              required
              type="date"
              name="date"
              min={String(d.draft.start_date)}
              max={String(d.draft.end_date)}
              defaultValue={String(
                d.context.expected_checkin_date ?? d.draft.start_date,
              )}
              className={input}
            />
          </label>
          <p className="text-xs text-slate-600">
            Tự điền danh mục tài sản của phòng. Cần kiểm kê, chỉ số thực tế và
            xác nhận hai bên trước khi hoàn tất.
          </p>
          <button disabled={busy} className={button}>
            Lập biên bản bàn giao
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
                        ...(Number(s.snapshot_version) > 0
                          ? {
                              catalogServiceId:
                                s.catalog_service_id ?? undefined,
                              description: s.description ?? undefined,
                              unit: s.unit,
                              quantity:
                                s.quantity === null
                                  ? undefined
                                  : Number(s.quantity),
                              billingCycle: s.billing_cycle,
                              effectiveDate: s.effective_date,
                              endDate: s.end_date ?? undefined,
                              status: s.status,
                              note: s.note ?? undefined,
                              prorate: s.prorate,
                            }
                          : {}),
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
                <CurrencyInput
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
                <NumberInput
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
                <NumberInput
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
                      <CurrencyInput
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
        <OnboardingHandoverEditor
          key={`${contractId}:${ci.version}:${d.handoverContextHash}`}
          detail={d}
          busy={busy}
          act={act}
        />
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
              <NumberInput
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
      {ci && (
        <HandoverDocumentPanel
          key={`${user?.id}:${user?.activeRole}:${contractId}`}
          detail={d}
          portal={portal}
          contractId={contractId}
          busy={busy}
          onConfirm={(payload) => void act("handover-confirmations", payload)}
        />
      )}
      {staff && ci?.status === "READY" && (
        <button
          id="complete-checkin"
          className={button}
          disabled={busy || !d.progress.canCompleteCheckin}
          onClick={async () => {
            if (
              !window.confirm(
                "Xác nhận đã bàn giao phòng thực tế và hoàn tất nhận phòng? Hợp đồng sẽ chuyển sang hiệu lực.",
              )
            )
              return;
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
