"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Menu, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { roleHome } from "@/types/auth";
import { PageLoading } from "@/components/shared/dashboard-ui";
import {
  NotificationBell,
  UnreadBadge,
} from "@/components/tenant/notifications/notification-bell";
import { TenantUserMenu } from "@/components/tenant/tenant-user-menu";
import { useAccountPreferences } from "@/hooks/use-tenant-account";
import {
  isTenantNavigationActive,
  tenantMobileNavigationItems,
  tenantNavigationItems,
} from "@/constants/tenant-navigation";

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
      {tenantNavigationItems.map(({ label, href, icon: Icon }) => {
        const active = isTenantNavigationActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-ring ${
              active
                ? "bg-accent font-semibold text-link"
                : "text-secondary-foreground hover:bg-muted"
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
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <TenantPreferenceBridge />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card p-5 lg:block print:hidden">
        <Link
          href="/tenant/home"
          className="flex items-center gap-3 text-xl font-extrabold text-link"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-primary hover:bg-primary-hover text-white">
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
          <aside className="relative h-full w-72 overflow-y-auto bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between font-extrabold text-link">
              SmartHome AI
              <button
                aria-label="Đóng menu"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X />
              </button>
            </div>
            <div className="mt-6">{items}</div>
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-card backdrop-blur print:hidden">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <button
              aria-label="Mở menu"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 place-items-center rounded-xl hover:bg-muted lg:hidden"
            >
              <Menu />
            </button>
            <Link
              href="/tenant/home"
              className="flex flex-1 items-center gap-2 font-extrabold text-link lg:hidden"
            >
              <Building2 className="size-5" />
              SmartHome AI
            </Link>
            <div className="hidden flex-1 lg:block">
              <p className="text-sm font-semibold text-foreground">
                Cổng thông tin khách thuê
              </p>
              <p className="text-xs text-muted-foreground">
                Quản lý thông tin thuê phòng của bạn
              </p>
            </div>
            <NotificationBell />
            <TenantUserMenu />
          </div>
        </header>
        {children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        {tenantMobileNavigationItems.map(({ label, href, icon: Icon }) => {
          const active = isTenantNavigationActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "font-semibold text-link" : "text-muted-foreground"}`}
            >
              <span className="relative">
                <Icon className="size-5" />
                {href === "/tenant/notifications" && (
                  <UnreadBadge className="absolute -right-3 -top-2" />
                )}
              </span>
              {label === "Tổng quan"
                ? "Trang chủ"
                : label === "Yêu cầu sửa chữa"
                  ? "Sửa chữa"
                  : label}
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
