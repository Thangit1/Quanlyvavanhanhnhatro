"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  ShieldAlert,
  Stethoscope,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { roleHome } from "@/types/auth";
import { useTechnicianNotifications } from "@/hooks/use-technician";

const nav = [
  ["Tổng quan", "/technician/dashboard", LayoutDashboard],
  ["Công việc", "/technician/tasks", ClipboardList],
  ["Lịch làm việc", "/technician/calendar", CalendarDays],
  ["Khẩn cấp", "/technician/emergency", ShieldAlert],
  ["Bảo trì định kỳ", "/technician/preventive-maintenance", Stethoscope],
  ["Thiết bị", "/technician/assets", Wrench],
  ["Vật tư", "/technician/materials", Boxes],
  ["Yêu cầu vật tư", "/technician/material-requests", PackageCheck],
  ["Thông báo", "/technician/notifications", Bell],
  ["Hiệu suất", "/technician/performance", ChartNoAxesCombined],
  ["Tài khoản", "/technician/account", UserRound],
] as const;

export function TechnicianShell({ children }: { children: React.ReactNode }) {
  const { user, isBootstrapping, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const notifications = useTechnicianNotifications();
  useEffect(() => {
    if (isBootstrapping) return;
    if (!user)
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (user.activeRole !== "TECHNICIAN")
      router.replace(roleHome[user.activeRole]);
  }, [isBootstrapping, pathname, router, user]);
  if (isBootstrapping || !user || user.activeRole !== "TECHNICIAN")
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">
        Đang mở cổng kỹ thuật…
      </div>
    );
  const unread = notifications.data?.filter((x) => !x.read).length ?? 0;
  const links = (
    <nav className="space-y-1">
      {nav.map(([label, href, Icon]) => {
        const active =
          pathname === href ||
          (href !== "/technician/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
          >
            <Icon className="size-5" />
            <span className="flex-1">{label}</span>
            {href === "/technician/notifications" && unread > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white text-blue-700" : "bg-red-500 text-white"}`}
              >
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="min-h-screen bg-slate-50 pb-16 lg:pb-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-68 border-r border-slate-200 bg-white p-5 lg:block">
        <Brand />
        <div className="mt-7">{links}</div>
        <button
          onClick={() =>
            window.confirm("Bạn có chắc muốn đăng xuất?") && void logout()
          }
          className="absolute bottom-5 left-5 right-5 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="size-5" />
          Đăng xuất
        </button>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-72 overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                className="rounded-xl p-2 hover:bg-slate-100"
                aria-label="Đóng menu"
                onClick={() => setOpen(false)}
              >
                <X />
              </button>
            </div>
            <div className="mt-7">{links}</div>
          </aside>
        </div>
      )}
      <div className="lg:pl-68">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-xl p-2 hover:bg-slate-100 lg:hidden"
            aria-label="Mở menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className="flex-1">
            <p className="font-bold text-slate-900">Cổng làm việc kỹ thuật</p>
            <p className="hidden text-xs text-slate-500 sm:block">
              Theo dõi công việc, SLA và hồ sơ sửa chữa được giao
            </p>
          </div>
          <Link
            href="/technician/notifications"
            className="relative rounded-xl p-2 hover:bg-slate-100"
            aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ""}`}
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
            )}
          </Link>
          <Link
            href="/technician/account"
            className="grid size-10 place-items-center rounded-full bg-blue-100 font-bold text-blue-700"
          >
            {user.fullName.slice(0, 1).toUpperCase()}
          </Link>
        </header>
        {children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.slice(0, 5).map(([label, href, Icon]) => (
          <Link
            key={href}
            href={href}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] ${pathname.startsWith(href) ? "font-semibold text-blue-700" : "text-slate-500"}`}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
function Brand() {
  return (
    <Link
      href="/technician/dashboard"
      className="flex items-center gap-3 font-extrabold text-blue-700"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white">
        <Wrench />
      </span>
      <span>SmartHome AI</span>
    </Link>
  );
}
