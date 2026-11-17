"use client";

import { useState } from "react";
import { serviceMethods } from "@/lib/contract-services";
import { CheckCircle2, Circle, FileCheck2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  onboardingStageLabel,
  type OnboardingDetail,
  type OnboardingRow,
} from "@/types/contract-onboarding";

export function ContractConfirmationProgress({
  detail: d,
  busy,
  onConfirm,
}: {
  detail: OnboardingDetail;
  busy: boolean;
  onConfirm: (version: OnboardingRow) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [read, setRead] = useState(false);
  const p = d.progress;
  return (
    <div id="contract-content" className="scroll-mt-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
            Tiến độ xác nhận hợp đồng
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {String(d.context.code ?? "Hợp đồng")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {String(d.context.tenant_name ?? "Chưa liên kết người thuê")} ·{" "}
            {String(d.context.property_name)} / {String(d.context.room_code)}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
          {onboardingStageLabel[p.stage] ?? p.stage}
        </span>
      </div>
      {p.bothConfirmed && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900"
        >
          Hai bên đã xác nhận nội dung hợp đồng.
          {!p.checkinCompleted &&
            " Hợp đồng sẽ có hiệu lực sau khi đủ điều kiện và hoàn tất nhận phòng."}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Người thuê", p.tenant],
          ["Bên cho thuê", p.landlord],
        ].map(([label, value]) => {
          const party = value as typeof p.tenant;
          return (
            <div
              key={String(label)}
              className={`rounded-xl border p-4 ${party.confirmed ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
            >
              <p className="font-semibold">{String(label)}</p>
              <p className="mt-1 text-sm">
                {party.confirmed ? "Đã xác nhận" : "Chưa xác nhận"} · Phiên bản{" "}
                {String(d.contractVersion?.version ?? "chưa chốt")}
              </p>
              {party.confirmedAt && (
                <p className="mt-1 text-xs text-slate-600">
                  {party.actorName ? `${party.actorName} · ` : ""}
                  {formatDate(party.confirmedAt, true)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!d.procedureSteps && (
        <div>
          <p className="mb-2 text-sm font-semibold">
            Điều kiện nhận phòng · {p.completedCount}/{p.checklist.length}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.checklist.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm"
              >
                {item.completed ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="size-4 shrink-0 text-emerald-600"
                  />
                ) : (
                  <Circle
                    aria-hidden="true"
                    className="size-4 shrink-0 text-slate-400"
                  />
                )}
                <span>{item.label}</span>
                <span className="sr-only">
                  {item.completed ? "Đã hoàn tất" : "Chưa hoàn tất"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.contractVersion && typeof d.contractVersion.content === "string" && (
        <>
          <details
            className="rounded-xl border bg-slate-50 p-4"
            onToggle={(e) => {
              if (e.currentTarget.open) setOpened(true);
            }}
          >
            <summary className="cursor-pointer font-semibold">
              Đọc đầy đủ nội dung hợp đồng · Phiên bản{" "}
              {String(d.contractVersion.version)}
            </summary>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt>Thời hạn thuê</dt>
                <dd>
                  {formatDate(String(d.draft.start_date))} –{" "}
                  {formatDate(String(d.draft.end_date))}
                </dd>
              </div>
              <div>
                <dt>Giá thuê / tháng</dt>
                <dd>
                  {d.monthlyRent === null
                    ? "Cần đối soát"
                    : formatCurrency(d.monthlyRent)}
                </dd>
              </div>
              <div>
                <dt>Tiền cọc phải thu</dt>
                <dd>{formatCurrency(Number(d.draft.deposit_amount))}</dd>
              </div>
              <div>
                <dt>Báo trước chấm dứt</dt>
                <dd>{String(d.draft.notice_period_days)} ngày</dd>
              </div>
            </dl>
            <div className="mt-3 space-y-1 text-sm">
              {d.utilityRates.map((rate) => (
                <p key={String(rate.code)}>
                  {String(rate.name)}: {formatCurrency(Number(rate.unit_price))}
                  /{String(rate.unit)} ·{" "}
                  {rate.calculation_method === "METER" ? "Công tơ" : "Định mức"}
                </p>
              ))}
              {d.services.map((service, i) => (
                <p key={i}>
                  {String(service.name)}:{" "}
                  {formatCurrency(Number(service.unit_price))} ·{" "}
                  {serviceMethods[
                    service.calculation_method as keyof typeof serviceMethods
                  ] ?? String(service.calculation_method)}{" "}
                  · {String(service.quantity ?? 1)}{" "}
                  {String(service.unit ?? "tháng")}
                  {service.status === "INACTIVE" && " · Không áp dụng"}
                  {service.description && (
                    <span className="block whitespace-pre-wrap">
                      {String(service.description)}
                    </span>
                  )}
                  {service.note && (
                    <span className="block whitespace-pre-wrap text-slate-500">
                      {String(service.note)}
                    </span>
                  )}
                </p>
              ))}
              {d.terms.map((term, i) => (
                <div key={i} className="pt-2">
                  <h3 className="font-semibold">{String(term.title)}</h3>
                  <p className="whitespace-pre-wrap">{String(term.content)}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs">
              {String(d.contractVersion.content)}
            </pre>
          </details>
          {!p.contentCurrent && (
            <p role="alert" className="text-sm text-amber-800">
              Nội dung đã thay đổi so với bản này. Bên cho thuê cần chốt phiên
              bản mới trước khi hai bên xác nhận.
            </p>
          )}
          {p.ownConfirmed ? (
            <p
              role="status"
              className="flex items-center gap-2 font-semibold text-emerald-700"
            >
              <FileCheck2 className="size-5" />
              {p.confirmedByCurrentActor
                ? "Bạn đã xác nhận hợp đồng cho phiên bản này."
                : "Bên cho thuê đã xác nhận phiên bản này; không cần xác nhận lại."}
            </p>
          ) : (
            p.canConfirm && (
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={read}
                    disabled={!opened || busy}
                    onChange={(e) => setRead(e.target.checked)}
                  />
                  Tôi đã mở, đọc đầy đủ nội dung và đồng ý với phiên bản hợp
                  đồng này.
                </label>
                {!opened && (
                  <p className="text-xs text-slate-500">
                    Mở phần nội dung hợp đồng ở trên trước khi xác nhận.
                  </p>
                )}
                <button
                  type="button"
                  disabled={!opened || !read || busy}
                  className="min-h-11 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Xác nhận ${p.ownParty === "TENANT" ? "bên thuê" : "bên cho thuê"} đã đồng ý hợp đồng phiên bản ${d.contractVersion!.version}? Thao tác này chưa phải xác nhận nhận phòng.`,
                      )
                    )
                      onConfirm(d.contractVersion!);
                  }}
                >
                  {busy
                    ? "Đang ghi nhận…"
                    : p.ownParty === "TENANT"
                      ? "Tôi đã đọc và đồng ý xác nhận hợp đồng"
                      : "Xác nhận hợp đồng"}
                </button>
              </div>
            )
          )}
        </>
      )}
      <p className="text-xs text-slate-500">{d.confirmationNotice}</p>
    </div>
  );
}
