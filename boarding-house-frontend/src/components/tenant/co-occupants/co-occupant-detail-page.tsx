"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Mail, Phone, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useCoOccupant } from "@/hooks/use-tenant-co-occupants";
import { tenantCoOccupantService } from "@/services/tenant-co-occupant.service";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { Badge, initials } from "./co-occupant-ui";

const today = new Date().toISOString().slice(0, 10);

export function CoOccupantDetailPage({ occupantId }: { occupantId: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const q = useCoOccupant(user?.activeRole === "TENANT", occupantId);
  const [modal, setModal] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const key = useRef("");
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void q.refetch()} />
      </main>
    );
  const d = q.data;
  const submit = async () => {
    if (!date || reason.trim().length < 3 || !phone) {
      setError("Vui lòng nhập đầy đủ ngày, lý do và số điện thoại liên hệ.");
      return;
    }
    setPending(true);
    setError("");
    if (!key.current) key.current = globalThis.crypto.randomUUID();
    try {
      const x = await tenantCoOccupantService.moveOut(
        occupantId,
        {
          expectedMoveOutDate: date,
          reason,
          note: note || undefined,
          contactPhone: phone,
        },
        key.current,
      );
      router.push(`/tenant/co-occupants/requests/${x.id}`);
    } catch (e) {
      setError(apiErrorMessage(e, "Không thể gửi yêu cầu chuyển đi."));
      setPending(false);
    }
  };
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 pb-28 sm:p-6">
      <Link
        href="/tenant/co-occupants"
        className="inline-flex items-center gap-2 font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Người ở cùng
      </Link>
      <section className="flex flex-col gap-5 rounded-3xl border bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <span className="grid size-20 shrink-0 place-items-center rounded-3xl bg-blue-100 text-2xl font-black text-blue-700">
          {initials(d.fullName)}
        </span>
        <div className="flex-1">
          <h1 className="text-3xl font-black">{d.fullName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {d.tenantCode} · Chuyển vào {formatDate(d.moveInDate)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge kind="role" value={d.residenceRole} />
            <Badge kind="residence" value={d.residenceStatus} />
            <Badge kind="temporary" value={d.temporaryResidence.status} />
          </div>
        </div>
        {d.permissions.canRequestMoveOut && (
          <button
            onClick={() => setModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700"
          >
            <UserMinus className="size-4" />
            Yêu cầu chuyển đi
          </button>
        )}
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-black">Thông tin cơ bản</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <Info icon={<Phone />} name="Điện thoại" value={d.maskedPhone} />
            <Info icon={<Mail />} name="Email" value={d.maskedEmail} />
            <Info
              icon={<CalendarDays />}
              name="Ngày sinh"
              value={formatDate(d.dateOfBirth)}
            />
            <Info name="Quan hệ" value={d.relationship} />
            <Info name="Nghề nghiệp" value={d.occupation} />
            <Info name="Nơi làm việc / trường học" value={d.workplace} />
            <Info
              name="Tài khoản SmartHome AI"
              value={
                d.accountStatus === "NOT_CREATED"
                  ? "Chưa tạo"
                  : "Đang hoạt động"
              }
            />
          </dl>
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="text-lg font-black">Hồ sơ tạm trú</h2>
          <div className="mt-4">
            <Badge kind="temporary" value={d.temporaryResidence.status} />
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <Info
              name="Ngày gửi"
              value={formatDate(d.temporaryResidence.registeredAt)}
            />
            <Info
              name="Ngày hết hạn"
              value={formatDate(d.temporaryResidence.expiresAt)}
            />
            <Info
              name="Thông tin công khai"
              value={d.temporaryResidence.publicNote}
            />
          </dl>
          <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
            Trạng thái này do quản lý xác nhận, không được suy ra từ việc đã tải
            giấy tờ.
          </p>
        </section>
      </div>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-black">Lịch sử cư trú</h2>
        <div className="mt-4 space-y-3">
          {d.history.map((x) => (
            <div key={x.id} className="rounded-xl bg-slate-50 p-4 text-sm">
              <b>
                {x.propertyName} · Phòng {x.roomCode}
              </b>
              <p className="mt-1 text-slate-500">
                {formatDate(x.moveInDate)} –{" "}
                {x.moveOutDate ? formatDate(x.moveOutDate) : "Hiện tại"}
              </p>
            </div>
          ))}
        </div>
      </section>
      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="move-out-title"
          onKeyDown={(e) => e.key === "Escape" && setModal(false)}
          className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center"
        >
          <div className="w-full rounded-t-3xl bg-white p-6 sm:max-w-lg sm:rounded-3xl">
            <h2 id="move-out-title" className="text-xl font-black">
              Yêu cầu chuyển đi
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Người ở cùng vẫn được tính là đang cư trú cho tới khi quản lý xác
              nhận.
            </p>
            {error && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold">
                Ngày dự kiến chuyển đi
                <input
                  autoFocus
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                />
              </label>
              <label className="block text-sm font-semibold">
                Lý do
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                  rows={3}
                />
              </label>
              <label className="block text-sm font-semibold">
                Số điện thoại liên hệ
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                />
              </label>
              <label className="block text-sm font-semibold">
                Ghi chú
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                  rows={2}
                />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setModal(false)}
                className="flex-1 rounded-xl border p-3 font-semibold"
              >
                Đóng
              </button>
              <button
                disabled={pending}
                onClick={() => void submit()}
                className="flex-1 rounded-xl bg-red-600 p-3 font-bold text-white disabled:opacity-50"
              >
                {pending ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function Info({
  name,
  value,
  icon,
}: {
  name: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      {icon && (
        <span className="mt-0.5 [&>svg]:size-4 [&>svg]:text-blue-600">
          {icon}
        </span>
      )}
      <div>
        <dt className="text-slate-500">{name}</dt>
        <dd className="font-semibold">{value || "Chưa cập nhật"}</dd>
      </div>
    </div>
  );
}
