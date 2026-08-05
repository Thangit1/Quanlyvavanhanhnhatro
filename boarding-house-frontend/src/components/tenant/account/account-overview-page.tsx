"use client";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  FileKey2,
  Headphones,
  KeyRound,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useAccountOverview } from "@/hooks/use-tenant-account";
import { ErrorState } from "@/components/shared/dashboard-ui";
import {
  accountDate,
  accountStatusLabels,
  label,
  phone,
  profileStatusLabels,
  residenceStatusLabels,
} from "@/constants/tenant-account";
import {
  AccountAvatar,
  AccountLoading,
  AccountMenu,
  ConfirmDialog,
  StatusPill,
} from "./account-ui";
import { useState } from "react";
const quick = [
  ["Hồ sơ cá nhân", "/tenant/account/profile", UserRound],
  ["Đổi mật khẩu", "/tenant/account/change-password", KeyRound],
  ["Bảo mật", "/tenant/account/security", ShieldCheck],
  ["Thông báo", "/tenant/notifications/settings", Bell],
] as const;
export function AccountOverviewPage() {
  const { user, logout } = useAuth(),
    query = useAccountOverview(user?.activeRole === "TENANT"),
    [confirm, setConfirm] = useState(false);
  if (query.isLoading) return <AccountLoading />;
  if (query.isError || !query.data)
    return (
      <main className="mx-auto max-w-7xl p-6">
        <ErrorState onRetry={() => void query.refetch()} />
      </main>
    );
  const x = query.data,
    p = x.profile;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-28 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-blue-600">
            Trang chủ / Tài khoản
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Tài khoản của tôi
          </h1>
          <p className="mt-1 text-slate-500">
            Quản lý thông tin cá nhân, bảo mật và tùy chọn sử dụng.
          </p>
        </div>
        <Link
          href="/tenant/account/profile"
          className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
        >
          Chỉnh sửa hồ sơ
        </Link>
      </div>
      <section className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-500 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <AccountAvatar name={p.fullName} avatarUrl={p.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-blue-100">{p.tenantCode}</p>
            <h2 className="text-2xl font-black">{p.fullName}</h2>
            <p className="mt-1 text-blue-50">
              {x.account.email} · {phone(x.account.phone)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill tone="green">
                {label(accountStatusLabels, x.account.status)}
              </StatusPill>
              <StatusPill>
                {label(profileStatusLabels, p.profileStatus)}
              </StatusPill>
              <StatusPill tone="slate">
                {label(
                  residenceStatusLabels,
                  x.residence?.temporaryResidenceStatus,
                )}
              </StatusPill>
            </div>
            <p className="mt-3 text-xs text-blue-100">
              Tham gia {accountDate(x.account.createdAt)}
            </p>
          </div>
        </div>
        {p.completionPercent < 100 && (
          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <div className="flex justify-between text-sm font-bold">
              <span>Hoàn thiện hồ sơ</span>
              <span>{p.completionPercent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${p.completionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-blue-50">
              Còn thiếu: {p.missingFields.join(", ")}
            </p>
          </div>
        )}
      </section>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Thông tin cư trú hiện tại</h2>
            {x.residence ? (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Info label="Nhà trọ" value={x.residence.propertyName} />
                  <Info label="Địa chỉ" value={x.residence.address} />
                  <Info
                    label="Dãy / tầng"
                    value={[x.residence.buildingName, x.residence.floorName]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <Info label="Phòng" value={x.residence.roomCode} />
                  <Info
                    label="Vai trò cư trú"
                    value={label(
                      residenceStatusLabels,
                      x.residence.residenceRole,
                    )}
                  />
                  <Info
                    label="Ngày chuyển vào"
                    value={accountDate(x.residence.moveInDate)}
                  />
                  <Info label="Hợp đồng" value={x.contract?.contractCode} />
                  <Info
                    label="Thời hạn"
                    value={
                      x.contract
                        ? `${accountDate(x.contract.startDate)} – ${accountDate(x.contract.endDate)}`
                        : undefined
                    }
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {x.residence.roomId && (
                    <Link
                      href={`/tenant/co-occupants`}
                      className="rounded-xl border px-4 py-2 text-sm font-bold"
                    >
                      Xem người ở cùng
                    </Link>
                  )}
                  {x.contract && (
                    <Link
                      href={`/tenant/contracts/${x.contract.id}`}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      Xem hợp đồng
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 p-5 text-slate-500">
                Bạn chưa có thông tin cư trú đang hoạt động.
              </p>
            )}
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            {quick.map(([name, href, Icon]) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm hover:border-blue-300"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="size-5" />
                </span>
                <b className="flex-1">{name}</b>
                <ChevronRight className="size-4 text-slate-400" />
              </Link>
            ))}
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-2xl border bg-white p-3 shadow-sm">
            <AccountMenu />
          </section>
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-black">Cần xử lý</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <FileKey2 className="mr-2 inline size-4 text-amber-600" />
                {x.pendingActions.documentCount} giấy tờ cần chú ý
              </p>
              <p>
                <SlidersHorizontal className="mr-2 inline size-4 text-blue-600" />
                {x.pendingActions.profileUpdateRequestCount} yêu cầu đang chờ
              </p>
            </div>
          </section>
          <Link
            href="/tenant/account/support"
            className="flex items-center gap-3 rounded-2xl border bg-white p-4 font-bold"
          >
            <Headphones className="text-blue-600" />
            Hỗ trợ tài khoản
          </Link>
          <button
            onClick={() => setConfirm(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700"
          >
            <LogOut />
            Đăng xuất
          </button>
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Đăng xuất khỏi tài khoản?"
        description="Phiên đăng nhập hiện tại sẽ bị thu hồi và bạn sẽ được chuyển về trang đăng nhập."
        confirmLabel="Đăng xuất"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => void logout()}
      />
    </main>
  );
}
function Info({ label: caption, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {caption}
      </p>
      <p className="mt-1 font-semibold text-slate-800">
        {value || "Chưa cập nhật"}
      </p>
    </div>
  );
}
