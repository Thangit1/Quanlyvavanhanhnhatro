"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  FileKey2,
  Headphones,
  KeyRound,
  LoaderCircle,
  MonitorCog,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { tenantAccountService } from "@/services/tenant-account.service";
const menu = [
  [
    "Hồ sơ cá nhân",
    "/tenant/account/profile",
    UserRound,
    "Thông tin liên hệ và cá nhân",
  ],
  [
    "Giấy tờ và hồ sơ",
    "/tenant/account/documents",
    FileKey2,
    "Giấy tờ xác minh và tạm trú",
  ],
  [
    "Bảo mật tài khoản",
    "/tenant/account/security",
    ShieldCheck,
    "Mật khẩu và trạng thái bảo mật",
  ],
  [
    "Phiên đăng nhập",
    "/tenant/account/sessions",
    KeyRound,
    "Thiết bị đang đăng nhập",
  ],
  [
    "Tùy chọn giao diện",
    "/tenant/account/preferences",
    MonitorCog,
    "Ngôn ngữ, giao diện và múi giờ",
  ],
  [
    "Lịch sử hoạt động",
    "/tenant/account/activity",
    Activity,
    "Các thao tác gần đây",
  ],
  [
    "Hỗ trợ",
    "/tenant/account/support",
    Headphones,
    "Liên hệ quản lý và hỗ trợ tài khoản",
  ],
] as const;
export function AccountPageLayout({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 pb-28 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/tenant/account"
            className="inline-flex items-center gap-1 text-sm font-bold text-blue-600"
          >
            <ArrowLeft className="size-4" />
            Tài khoản
          </Link>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
          <p className="mt-1 text-slate-500">{description}</p>
        </div>
        {actions}
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="hidden rounded-2xl border bg-white p-3 shadow-sm lg:block">
          <AccountMenu current={pathname} />
        </aside>
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </main>
  );
}
export function AccountMenu({ current = "" }: { current?: string }) {
  return (
    <nav aria-label="Menu tài khoản" className="space-y-1">
      {menu.map(([name, href, Icon, description]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl p-3 ${current === href ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}
        >
          <Icon className="size-5 shrink-0" />
          <span className="min-w-0 flex-1">
            <b className="block text-sm">{name}</b>
            <small className="line-clamp-1 text-slate-500">{description}</small>
          </span>
          <ChevronRight className="size-4" />
        </Link>
      ))}
    </nav>
  );
}
export function AccountAvatar({
  name,
  avatarUrl,
  size = "size-24",
}: {
  name: string;
  avatarUrl?: string;
  size?: string;
}) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!avatarUrl) return;
    let active = true,
      url = "";
    tenantAccountService
      .avatar()
      .then((value) => {
        url = value;
        if (active) setSrc(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [avatarUrl]);
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-blue-100 text-2xl font-black text-blue-700 ${size}`}
    >
      {src ? (
        <Image
          src={src}
          alt={`Ảnh đại diện của ${name}`}
          width={96}
          height={96}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}
export function StatusPill({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
export function AccountLoading() {
  return (
    <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
      <LoaderCircle className="mx-auto mb-2 size-6 animate-spin text-blue-600" />
      Đang tải dữ liệu tài khoản...
    </div>
  );
}
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  danger = false,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/50 p-0 sm:place-items-center sm:p-4"
    >
      <section className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <h2 id="confirm-title" className="text-xl font-black">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            autoFocus
            onClick={onClose}
            className="rounded-xl border px-4 py-3 font-bold"
          >
            Hủy
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-3 font-bold text-white disabled:opacity-50 ${danger ? "bg-red-600" : "bg-blue-600"}`}
          >
            {busy ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
