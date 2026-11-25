"use client";
import Link from "next/link";
import { CommunicationBell } from "@/components/shared/communication-bell";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  LayoutDashboard,
  Menu,
  Receipt,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useManagementScope } from "@/providers/management-scope";
import { PageLoading } from "@/components/shared/dashboard-ui";
import { PropertySelector } from "@/components/shared/management-ui";
import { AdminUserMenu } from "./admin-user-menu";
import { roleHome, roleLabel } from "@/types/auth";
type Item = [string, string, LucideIcon];
export function AdminShell({
  title,
  subtitle,
  children,
  readOnly = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  readOnly?: boolean;
}) {
  const { user, isBootstrapping } = useAuth();
  const scope = useManagementScope();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const allowed =
    !!user &&
    (["OWNER", "MANAGER"].includes(user.activeRole) ||
      (readOnly && user.activeRole === "ACCOUNTANT"));
  useEffect(() => {
    if (isBootstrapping) return;
    if (!user)
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(roleHome[user.activeRole]);
  }, [allowed, isBootstrapping, pathname, router, user]);
  useEffect(() => {
    if (menu) drawer.current?.showModal();
    else drawer.current?.close();
  }, [menu]);
  if (isBootstrapping || !allowed || !user) return <PageLoading />;
  const home = roleHome[user.activeRole];
  const owner = user.activeRole === "OWNER";
  const accountant = user.activeRole === "ACCOUNTANT";
  const groups: { label: string; items: Item[] }[] = accountant
    ? [
        {
          label: "Kế toán",
          items: [
            ["Dashboard", home, LayoutDashboard],
            ["Nhà trọ", "/admin/properties", Building2],
            ["Phòng", "/admin/rooms", DoorOpen],
            ["Hóa đơn", "/accountant/invoices", Receipt],
            ["Điện nước và dịch vụ", "/admin/reports/utilities", Zap],
            ["Tài chính", "/accountant/payments", Wallet],
          ],
        },
      ]
    : [
        {
          label: "Tổng quan",
          items: [
            ["Dashboard", home, LayoutDashboard],
            ["Thông báo & Công việc", "/admin/communications", Bell],
          ],
        },
        {
          label: "Quản lý vận hành",
          items: [
            ["Nhà trọ", "/admin/properties", Building2],
            ["Phòng", "/admin/rooms", DoorOpen],
            ["Người thuê", "/admin/tenants", Users],
            ["Đặt phòng và nhận phòng", "/admin/rental-lifecycle", Workflow],
            ["Hợp đồng", "/admin/contracts", ClipboardList],
            ...(scope.canReadFinance
              ? [
                  [
                    "Điện nước và dịch vụ",
                    "/admin/reports/utilities",
                    Zap,
                  ] as Item,
                ]
              : []),
            ["Bảo trì và tài sản", "/admin/maintenance", Wrench],
            ["Trả phòng", "/admin/checkouts", DoorOpen],
          ],
        },
        ...(scope.canReadFinance
          ? [
              {
                label: "Tài chính",
                items: [
                  ["Hóa đơn", "/admin/invoices", Receipt],
                  ["Thanh toán", "/admin/reports/payments", Wallet],
                  ["Công nợ", "/admin/invoices/debt", Receipt],
                  ["Tiền cọc và sổ quỹ", "/admin/finance", Wallet],
                  ["Báo cáo thu chi", "/admin/reports/profit", TrendingUp],
                ] as Item[],
              },
            ]
          : []),
        {
          label: "Quản trị",
          items: [
            ["Báo cáo và thống kê", "/admin/reports", TrendingUp],
            ...(owner
              ? ([
                  ["Công ty và khu quản lý", "/admin/organizations", Building2],
                  ["Khu vực và phân quyền", "/admin/areas", Building2],
                ] as Item[])
              : []),
            ["Tài khoản và nhân viên", "/admin/accounts", Users],
            ["Cấu hình", "/admin/settings", Settings],
            ...(owner ? [["AI", "/admin/settings/ai", Bot] as Item] : []),
          ],
        },
      ];
  function navigation(compact: boolean) {
    const paths = groups
      .flatMap((g) => g.items.map(([, href]) => href))
      .filter((href) => !/[?#]/.test(href));
    const activePath = paths
      .filter(
        (href) =>
          pathname === href ||
          (href !== home && pathname.startsWith(href + "/")),
      )
      .sort((a, b) => b.length - a.length)[0];
    return (
      <nav aria-label="Điều hướng quản trị" className="space-y-5">
        {groups.map((group) => (
          <section key={group.label}>
            <p
              className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${compact ? "sr-only" : ""}`}
            >
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(([label, href, Icon]) => (
                <Link
                  key={href}
                  title={compact ? label : undefined}
                  aria-label={compact ? label : undefined}
                  aria-current={href === activePath ? "page" : undefined}
                  href={href}
                  onClick={() => setMenu(false)}
                  className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition focus-visible:ring-2 focus-visible:ring-ring ${href === activePath ? "bg-accent text-link" : "text-secondary-foreground hover:bg-muted"}`}
                >
                  <Icon aria-hidden className="size-4.5 shrink-0" />
                  {!compact && <span>{label}</span>}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </nav>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#page-content"
        className="sr-only z-50 rounded bg-card p-3 focus:not-sr-only focus:fixed"
      >
        Đến nội dung chính
      </a>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card lg:flex ${collapsed ? "w-20" : "w-64"}`}
      >
        <Link
          href={home}
          aria-label="SmartHome AI — Tổng quan"
          className="flex h-20 shrink-0 items-center gap-3 px-5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary hover:bg-primary-hover text-white">
            <Building2 className="size-6" />
          </span>
          {!collapsed && (
            <span className="text-lg font-extrabold text-foreground">
              SmartHome <span className="text-link">AI</span>
            </span>
          )}
        </Link>
        <div className="flex-1 overflow-y-auto px-3 pb-5">
          {navigation(collapsed)}
        </div>
        <button
          aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          className="m-3 flex min-h-10 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              Thu gọn
            </>
          )}
        </button>
      </aside>
      <dialog
        ref={drawer}
        onCancel={() => setMenu(false)}
        onClose={() => setMenu(false)}
        onClick={(e) => {
          if (e.target === drawer.current) setMenu(false);
        }}
        aria-label="Menu quản trị"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-0 bg-card p-0 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="flex items-center justify-between border-b p-5 font-bold">
          SmartHome AI
          <button
            autoFocus
            aria-label="Đóng menu"
            onClick={() => setMenu(false)}
            className="rounded-lg p-2"
          >
            <X />
          </button>
        </div>
        <div className="h-[calc(100dvh-85px)] overflow-y-auto p-4">
          {navigation(false)}
        </div>
      </dialog>
      <div className={collapsed ? "lg:pl-20" : "lg:pl-64"}>
        <header className="sticky top-0 z-20 border-b border-border bg-card backdrop-blur">
          <div className="flex min-h-20 items-center gap-3 px-4 sm:px-6">
            <button
              aria-label="Mở menu"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
              className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-muted lg:hidden"
            >
              <Menu />
            </button>
            <div className="min-w-0 flex-1">
              <nav
                aria-label="Breadcrumb"
                className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Link href={home}>{roleLabel[user.activeRole]}</Link>
                <ChevronRight className="size-3" />
                <span aria-current="page" className="truncate">
                  {title}
                </span>
              </nav>
              <p className="truncate font-semibold text-foreground">{title}</p>
            </div>
            {!accountant && (
              <div className="hidden md:block">
                <PropertySelector />
              </div>
            )}
            <CommunicationBell />
            <AdminUserMenu />
          </div>
          {!accountant && (
            <div className="border-t px-4 py-2 md:hidden">
              <PropertySelector />
            </div>
          )}
        </header>
        <main
          id="page-content"
          className="mx-auto max-w-[1800px] space-y-6 p-4 sm:p-6"
        >
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}
