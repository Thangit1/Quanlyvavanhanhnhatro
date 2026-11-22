"use client";

import { useState } from "react";
import Link from "next/link";
import type { OnboardingDetail } from "@/types/contract-onboarding";
import { formatDate } from "@/lib/format";

const input =
  "mt-1 w-full rounded-xl border border-input px-3 py-2 text-sm";
const button =
  "rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40";

export function OnboardingIdentityProfile({
  detail: d,
  portal,
  busy,
  act,
}: {
  detail: OnboardingDetail;
  portal: "admin" | "tenant" | "accountant";
  busy: boolean;
  act: (path: string, payload: unknown, put?: boolean) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const p = d.identityProfile;
  if (!p) return null;
  return (
    <section
      id="identity-profile"
      className="scroll-mt-6 space-y-3 rounded-xl border p-4"
    >
      <h3 className="font-semibold">Hồ sơ định danh người thuê</h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {p.fields.map((f) => (
          <div
            key={f.key}
            className={
              f.present ? "text-secondary-foreground" : "font-semibold text-warning"
            }
          >
            <dt>{f.label}</dt>
            <dd>{f.present ? "Đã có" : "Chưa cập nhật"}</dd>
          </div>
        ))}
      </dl>
      {d.identityVerified && p.verification ? (
        <p role="status" className="text-sm text-success">
          Đã đối chiếu bởi {String(p.verification.actor_name)} ·{" "}
          {formatDate(String(p.verification.verified_at), true)} · Tham chiếu:{" "}
          {String(p.verification.evidence_reference)}
        </p>
      ) : (
        <p className="text-sm text-warning">
          {p.complete
            ? "Hồ sơ đã đầy đủ, cần đối chiếu chứng từ thực tế trước khi xác minh."
            : "Cần bổ sung thông tin còn thiếu trước khi xác minh."}
        </p>
      )}
      {p.canEdit && (
        <button
          type="button"
          disabled={busy}
          className={button}
          onClick={() => setEditing(true)}
        >
          Cập nhật hồ sơ người thuê
        </button>
      )}
      {portal === "tenant" && (
        <Link
          href="/tenant/account"
          className="block text-sm text-link underline"
        >
          Bổ sung hồ sơ của tôi theo quy trình tài khoản
        </Link>
      )}
      {editing && p.canEdit && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="identity-edit-title"
          className="space-y-3 rounded-xl bg-muted p-4"
        >
          <h4 id="identity-edit-title" className="font-semibold">
            Cập nhật hồ sơ người thuê
          </h4>
          <form
            key={p.dataHash}
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const success = await act(
                "identity-profile",
                {
                  fullName: f.get("fullName"),
                  dateOfBirth: f.get("dateOfBirth"),
                  phone: f.get("phone"),
                  identityType: f.get("identityType"),
                  identityNumber: f.get("identityNumber"),
                  permanentAddress: f.get("permanentAddress"),
                  dataHash: p.dataHash,
                },
                true,
              );
              if (success) {
                setEditing(false);
                setReviewed(false);
                setReviewing(false);
              }
            }}
          >
            <label className="text-sm">
              Họ tên
              <input
                name="fullName"
                required
                maxLength={150}
                defaultValue={p.full_name ?? ""}
                className={input}
              />
            </label>
            <label className="text-sm">
              Ngày sinh
              <input
                type="date"
                name="dateOfBirth"
                required
                max={new Date().toLocaleDateString("en-CA")}
                defaultValue={p.date_of_birth ?? ""}
                className={input}
              />
            </label>
            <label className="text-sm">
              Số điện thoại
              <input
                type="tel"
                name="phone"
                required
                maxLength={20}
                defaultValue={p.phone ?? ""}
                className={input}
              />
            </label>
            <label className="text-sm">
              Loại giấy tờ
              <input
                name="identityType"
                required
                maxLength={30}
                placeholder="CCCD / CMND / PASSPORT"
                defaultValue={p.identity_type ?? ""}
                className={input}
              />
            </label>
            <label className="text-sm">
              Số giấy tờ tùy thân
              <input
                name="identityNumber"
                required={!p.identity_number}
                maxLength={50}
                placeholder={
                  p.identity_number
                    ? `Đang lưu ${p.identity_number}; để trống để giữ nguyên`
                    : "Nhập số giấy tờ"
                }
                className={input}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Địa chỉ thường trú
              <textarea
                name="permanentAddress"
                required
                maxLength={500}
                defaultValue={p.permanent_address ?? ""}
                className={input}
              />
            </label>
            <p className="text-xs text-secondary-foreground sm:col-span-2">
              Các thông tin khác được giữ nguyên. Thay đổi dữ liệu định danh yêu
              cầu đối chiếu lại; nếu nội dung hợp đồng thay đổi, hai bên cần xác
              nhận phiên bản mới.
            </p>
            <div className="flex gap-2 sm:col-span-2">
              <button disabled={busy} className={button}>
                Lưu hồ sơ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(false)}
                className="px-3 text-sm"
              >
                Đóng
              </button>
            </div>
          </form>
        </div>
      )}
      {p.complete && d.progress.canVerifyIdentity && !editing && (
        <button
          type="button"
          disabled={busy}
          className={button}
          onClick={() => {
            setReviewing(true);
            setReviewed(false);
          }}
        >
          Xác minh hồ sơ
        </button>
      )}
      {reviewing && p.complete && d.progress.canVerifyIdentity && (
        <form
          key={p.dataHash}
          className="space-y-3 rounded-xl bg-accent p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reviewed) return;
            if (
              await act("identity-verification", {
                reference: new FormData(e.currentTarget).get("reference"),
                documentsReviewed: reviewed,
                dataHash: p.dataHash,
              })
            ) {
              setReviewing(false);
              setReviewed(false);
            }
          }}
        >
          <h4 className="font-semibold">
            Đối chiếu hồ sơ với chứng từ thực tế
          </h4>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {p.fields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd className="whitespace-pre-wrap">
                  {String(p[f.key as keyof typeof p] ?? "")}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm">
            Số giấy tờ được che để bảo vệ dữ liệu. Đối chiếu đầy đủ với giấy tờ
            gốc hoặc tài liệu được lưu theo quy trình quản lý hồ sơ.
          </p>
          <label className="block text-sm">
            Mã tham chiếu chứng từ
            <input
              name="reference"
              required
              maxLength={500}
              className={input}
              aria-describedby="identity-reference-help"
            />
          </label>
          <p id="identity-reference-help" className="text-xs text-secondary-foreground">
            Nhập mã hồ sơ, mã tệp giấy tờ hoặc số biên bản đã kiểm tra để truy
            vết. Đây không phải mã OTP và không thay thế việc xem chứng từ.
          </p>
          <label className="flex gap-2 text-sm">
            <input
              required
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            Tôi đã kiểm tra chứng từ thực tế và xác nhận thông tin hồ sơ khớp
            với giấy tờ.
          </label>
          <button disabled={busy || !reviewed} className={button}>
            Xác nhận đã đối chiếu hồ sơ
          </button>
        </form>
      )}
    </section>
  );
}
