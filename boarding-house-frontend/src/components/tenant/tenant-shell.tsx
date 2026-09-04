"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  CircleDollarSign,
  FileText,
  Gauge,
  Home,
  Menu,
  Receipt,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { roleHome } from "@/types/auth";
import { PageLoading } from "@/components/shared/dashboard-ui";
import {
  NotificationBell,
  UnreadBadge,
} from "@/components/tenant/notifications/notification-bell";
import { TenantUserMenu } from "@/components/tenant/tenant-user-menu";
import { useAccountPreferences } from "@/hooks/use-tenant-account";

const nav = [
  ["Tổng quan", "/tenant/home", Home],
  ["Hợp đồng", "/tenant/contracts", FileText],
  ["Hóa đơn", "/tenant/invoices", Receipt],
  ["Thanh toán", "/tenant/payments", CircleDollarSign],
  ["Điện nước", "/tenant/utilities", Gauge],
  ["Yêu cầu sửa chữa", "/tenant/maintenance", Wrench],
  ["Người ở cùng", "/tenant/co-occupants", Users],
  ["Thông báo", "/tenant/notifications", Bell],
  ["Tài khoản", "/tenant/account", UserRound],
] as const;

export function TenantShell({ children }: { children: React.ReactNode }) {
  const { user, isBootstrapping } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const allowed = !!user && user.activeRole === "TENANT";
  useEffect(() => {
    if (isBootstrapping) return;
    if (!user)
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (user.activeRole !== "TENANT")
      router.replace(roleHome[user.activeRole]);
  }, [isBootstrapping, pathname, router, user]);
  if (isBootstrapping || !allowed) return <PageLoading />;

  const items = (
    <nav className="space-y-1">
      {nav.map(([label, href, Icon]) => {
        const active =
          href === "/tenant/home"
            ? pathname === href
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 ${
              active
                ? "bg-blue-600 font-semibold text-white shadow-md shadow-blue-200"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="size-5" />
            {label}
            {href === "/tenant/notifications" && (
              <UnreadBadge className="ml-auto" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0">
      <TenantPreferenceBridge />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block print:hidden">
        <Link
          href="/tenant/home"
          className="flex items-center gap-3 text-xl font-extrabold text-blue-700"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white">
            <Building2 />
          </span>
          SmartHome AI
        </Link>
        <div className="mt-8">{items}</div>
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <button
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Đóng menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-72 overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between font-extrabold text-blue-700">
              SmartHome AI
              <button
                aria-label="Đóng menu"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X />
              </button>
            </div>
            <div className="mt-6">{items}</div>
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <button
              aria-label="Mở menu"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 lg:hidden"
            >
              <Menu />
            </button>
            <Link
              href="/tenant/home"
              className="flex flex-1 items-center gap-2 font-extrabold text-blue-700 lg:hidden"
            >
              <Building2 className="size-5" />
              SmartHome AI
            </Link>
            <div className="hidden flex-1 lg:block">
              <p className="text-sm font-semibold text-slate-800">
                Cổng thông tin khách thuê
              </p>
              <p className="text-xs text-slate-500">
                Quản lý thông tin thuê phòng của bạn
              </p>
            </div>
            <NotificationBell />
            <TenantUserMenu />
          </div>
        </header>
        {children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        {[
          ["Trang chủ", "/tenant/home", Home],
          ["Hóa đơn", "/tenant/invoices", Receipt],
          ["Sửa chữa", "/tenant/maintenance", Wrench],
          ["Thông báo", "/tenant/notifications", Bell],
          ["Tài khoản", "/tenant/account", UserRound],
        ].map(([label, href, Icon]) => {
          const active =
            href === "/tenant/home"
              ? pathname === href
              : pathname.startsWith(href as string);
          return (
            <Link
              key={href as string}
              href={href as string}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "font-semibold text-blue-700" : "text-slate-500"}`}
            >
              <span className="relative">
                <Icon className="size-5" />
                {href === "/tenant/notifications" && (
                  <UnreadBadge className="absolute -right-3 -top-2" />
                )}
              </span>
              {label as string}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function TenantPreferenceBridge() {
  const preferences = useAccountPreferences(true);
  useEffect(() => {
    if (!preferences.data) return;
    const { theme, reducedMotion } = preferences.data;
    const dark =
      theme === "DARK" ||
      (theme === "SYSTEM" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.setAttribute("data-theme", theme.toLowerCase());
    document.documentElement.setAttribute(
      "data-reduced-motion",
      reducedMotion ? "true" : "false",
    );
  }, [preferences.data]);
  return null;
}
