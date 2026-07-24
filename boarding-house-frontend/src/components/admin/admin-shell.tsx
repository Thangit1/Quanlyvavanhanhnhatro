"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Building2, ClipboardList, LayoutDashboard, LogOut, Menu, Receipt, Settings,
  TrendingUp, Users, Wrench, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { PageLoading } from "@/components/shared/dashboard-ui";
import { roleHome } from "@/types/auth";

const nav = [
  ["Tổng quan", "dashboard", LayoutDashboard], ["Nhà và phòng", "/admin/properties", Building2],
  ["Người thuê", "/admin/tenants", Users], ["Hợp đồng", "/admin/contracts", ClipboardList],
  ["Hóa đơn", "/admin/invoices", Receipt], ["Bảo trì", "/admin/maintenance", Wrench],
  ["Báo cáo", "/admin/reports", TrendingUp], ["Cài đặt", "/admin/settings", Settings],
] as const;

export function AdminShell({ title, subtitle, children, readOnly = false }: {
  title: string; subtitle?: string; children: React.ReactNode; readOnly?: boolean;
}) {
  const { user, isBootstrapping, logout } = useAuth();
  const pathname = usePathname(); const router = useRouter(); const [menu, setMenu] = useState(false);
  const allowed = !!user && (["OWNER", "MANAGER"].includes(user.activeRole)
    || (readOnly && user.activeRole === "ACCOUNTANT"));
  useEffect(() => {
    if (isBootstrapping) return;
    if (!user) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(roleHome[user.activeRole]);
  }, [allowed, isBootstrapping, pathname, router, user]);
  if (isBootstrapping || !allowed || !user) return <PageLoading />;
  const home = roleHome[user.activeRole];
  const navigation = <nav className="space-y-1">{nav.map(([label, href, Icon]) => {
    const target = href === "dashboard" ? home : href;
    const active = href === "dashboard" ? pathname === home : pathname.startsWith(href);
    return <Link key={label} href={target} onClick={() => setMenu(false)}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
        active ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}`}>
      <Icon className="size-5" />{label}</Link>;
  })}</nav>;
  return <div className="min-h-screen bg-slate-50">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block">
      <Link href={home} className="flex items-center gap-3 text-xl font-extrabold text-blue-700">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white"><Building2 /></span>SmartHome AI</Link>
      <div className="mt-8">{navigation}</div>
      <button onClick={() => void logout()} className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-100">
        <LogOut className="size-5" />Đăng xuất</button>
    </aside>
    {menu && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Đóng menu" className="absolute inset-0 bg-slate-950/40" onClick={() => setMenu(false)} />
      <aside className="relative h-full w-72 bg-white p-5 shadow-2xl"><div className="flex items-center justify-between font-extrabold text-blue-700">SmartHome AI
        <button aria-label="Đóng menu" onClick={() => setMenu(false)}><X /></button></div><div className="mt-6">{navigation}</div></aside></div>}
    <div className="lg:pl-64"><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6"><button aria-label="Mở menu" className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 lg:hidden" onClick={() => setMenu(true)}><Menu /></button>
        <div className="min-w-0 flex-1"><p className="truncate font-bold text-slate-900">{title}</p>
          {subtitle && <p className="hidden text-xs text-slate-500 sm:block">{subtitle}</p>}</div>
        <button aria-label="Thông báo" className="grid size-10 place-items-center rounded-full hover:bg-slate-100"><Bell className="size-5" /></button>
        <span className="grid size-9 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">{user.fullName.charAt(0).toUpperCase()}</span>
      </div></header><main className="p-4 sm:p-6">{children}</main></div>
  </div>;
}
