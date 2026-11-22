"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileCheck2,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { roleHome } from "@/types/auth";
import { CommunicationBell } from "@/components/shared/communication-bell";
import {
  AccountantScopeProvider,
  useAccountantScope,
} from "./accountant-scope";

const groups = [
  {
    name: "Tổng quan",
    items: [["Bảng điều khiển", "/accountant/dashboard", LayoutDashboard]],
  },
  {
    name: "Thu tiền",
    items: [
      ["Hóa đơn", "/accountant/invoices", ReceiptText],
      ["Thanh toán", "/accountant/payments", CircleDollarSign],
      ["Minh chứng CK", "/accountant/payment-proofs", FileCheck2],
      ["Biên lai", "/accountant/receipts", FileSpreadsheet],
      ["Khoản thu khác", "/accountant/other-income", WalletCards],
    ],
  },
  {
    name: "Công nợ & tiền cọc",
    items: [
      ["Công nợ", "/accountant/debts", UsersRound],
      ["Tiền cọc", "/accountant/deposits", WalletCards],
      ["Trả phòng & quyết toán", "/accountant/checkouts", CalendarClock],
      ["Thông báo & Công việc", "/accountant/notifications", Bell],
    ],
  },
  {
    name: "Chi & đối soát",
    items: [
      ["Phiếu chi", "/accountant/payment-vouchers", FileSpreadsheet],
      ["Chi phí", "/accountant/expenses", Building2],
      ["Đối soát", "/accountant/reconciliation", ShieldCheck],
    ],
  },
  {
    name: "Sổ & báo cáo",
    items: [
      ["Sổ quỹ", "/accountant/cashbook", BookOpen],
      ["Sổ ngân hàng", "/accountant/bankbook", Landmark],
      ["Dòng tiền", "/accountant/cash-flow", ChartNoAxesCombined],
      ["Kỳ kế toán", "/accountant/periods", CalendarClock],
      ["Báo cáo", "/accountant/reports", FileSpreadsheet],
    ],
  },
] as const;
export function AccountantShell({ children }: { children: React.ReactNode }) {
  const { user, isBootstrapping, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (isBootstrapping) return;
    if (!user)
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (user.activeRole !== "ACCOUNTANT")
      router.replace(roleHome[user.activeRole]);
  }, [isBootstrapping, pathname, router, user]);
  if (isBootstrapping || !user || user.activeRole !== "ACCOUNTANT")
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Đang mở cổng kế toán…
      </div>
    );
  const links = (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.name}>
          <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {group.name}
          </p>
          <nav className="space-y-1">
            {group.items.map(([label, href, Icon]) => {
              const active =
                pathname === href ||
                (href !== "/accountant/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-accent font-semibold text-link" : "text-secondary-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <Icon className="size-4.5" />
                  <span className="flex-1">{label}</span>
                </Link>
              );
            })}
          </nav>
        </section>
      ))}
    </div>
  );
  return (
    <AccountantScopeProvider>
      <div className="min-h-screen bg-background pb-16 lg:pb-0">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 overflow-y-auto border-r border-border bg-card p-5 pb-20 lg:block">
          <Brand />
          <div className="mt-7">{links}</div>
          <button
            onClick={() =>
              window.confirm("Bạn có chắc muốn đăng xuất?") && void logout()
            }
            className="fixed bottom-4 left-5 flex min-h-11 w-62 items-center gap-3 rounded-xl bg-card px-3 text-sm text-secondary-foreground hover:bg-danger-muted hover:text-danger"
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
            <aside className="relative h-full w-80 overflow-y-auto bg-card p-5">
              <div className="flex items-center justify-between">
                <Brand />
                <button
                  aria-label="Đóng menu"
                  className="rounded-xl p-2 hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  <X />
                </button>
              </div>
              <div className="mt-7">{links}</div>
            </aside>
          </div>
        )}
        <div className="lg:pl-72">
          <Header open={() => setOpen(true)} />
          {children}
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card lg:hidden">
          {[
            ["Tổng quan", "/accountant/dashboard", LayoutDashboard],
            ["Hóa đơn", "/accountant/invoices", ReceiptText],
            ["Thu tiền", "/accountant/payments", CircleDollarSign],
            ["Công nợ", "/accountant/debts", UsersRound],
            ["Thêm", "/accountant/account", Menu],
          ].map(([label, href, Icon]) => (
            <Link
              key={String(href)}
              href={String(href)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] ${pathname.startsWith(String(href)) ? "font-semibold text-link" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" />
              {label as string}
            </Link>
          ))}
        </nav>
      </div>
    </AccountantScopeProvider>
  );
}
function Header({ open }: { open: () => void }) {
  const scope = useAccountantScope();
  return (
    <header className="sticky top-0 z-20 flex min-h-18 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2 backdrop-blur sm:px-6">
      <button
        className="rounded-xl p-2 hover:bg-muted lg:hidden"
        aria-label="Mở menu"
        onClick={open}
      >
        <Menu />
      </button>
      <div className="min-w-44 flex-1">
        <p className="font-bold text-foreground">Cổng làm việc kế toán</p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Thu chi, công nợ, đối soát và khóa sổ theo kỳ
        </p>
      </div>
      <select
        aria-label="Khu trọ"
        value={scope.propertyId ?? ""}
        onChange={(e) =>
          scope.setPropertyId(
            e.target.value ? Number(e.target.value) : undefined,
          )
        }
        className="min-h-10 rounded-xl border border-input bg-card px-3 text-sm"
      >
        <option value="">Tất cả khu trọ</option>
        {scope.properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        aria-label="Kỳ kế toán"
        type="month"
        value={scope.period}
        onChange={(e) => scope.setPeriod(e.target.value)}
        className="min-h-10 rounded-xl border border-input px-3 text-sm"
      />
      <CommunicationBell />
      <Link
        href="/accountant/account"
        className="grid size-10 place-items-center rounded-full bg-success-muted font-bold text-link"
      >
        <UserRound className="size-5" />
      </Link>
    </header>
  );
}
function Brand() {
  return (
    <Link
      href="/accountant/dashboard"
      className="flex items-center gap-3 font-extrabold text-link"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-primary text-white">
        <CircleDollarSign />
      </span>
      <span>SmartHome AI</span>
    </Link>
  );
}
