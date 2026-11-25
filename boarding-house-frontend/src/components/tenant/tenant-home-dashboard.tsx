"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Bot,
  Building2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Gauge,
  Hammer,
  House,
  Menu,
  Receipt,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTenantHome } from "@/hooks/use-dashboard";
import { formatCurrency, formatDate } from "@/lib/format";
import { roleHome } from "@/types/auth";
import {
  EmptyState,
  ErrorState,
  PageLoading,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import { TenantUserMenu } from "@/components/tenant/tenant-user-menu";
import {
  isTenantNavigationActive,
  tenantMobileNavigationItems,
  tenantNavigationItems,
} from "@/constants/tenant-navigation";
const quickActions = [
  ["Xem hóa đơn", "/tenant/invoices", Receipt],
  ["Thanh toán", "/tenant/payments", CircleDollarSign],
  ["Báo sửa chữa", "/tenant/maintenance/new", Hammer],
  ["Xem hợp đồng", "/tenant/contracts", FileText],
  ["Điện nước", "/tenant/utilities", Gauge],
  ["Người ở cùng", "/tenant/co-occupants", Users],
  ["Trả phòng", "/tenant/contracts", House],
  ["Liên hệ quản lý", "/tenant/account/support", UserRound],
] as const;

function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`surface-card p-5 sm:p-6 ${className}`}
    >
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function TenantHomeDashboard() {
  const { user, isBootstrapping } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const allowed = !!user && user.activeRole === "TENANT";
  const query = useTenantHome(!isBootstrapping && allowed);
  useEffect(() => {
    if (isBootstrapping) return;
    if (!user)
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (user.activeRole !== "TENANT")
      router.replace(roleHome[user.activeRole]);
  }, [isBootstrapping, pathname, router, user]);
  if (isBootstrapping || !allowed) return <PageLoading />;
  if (query.isLoading) return <PageLoading />;

  const data = query.data;
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Chào buổi sáng"
      : hour < 18
        ? "Chào buổi chiều"
        : "Chào buổi tối";
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-card backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="Mở menu"
              onClick={() => setMenuOpen(true)}
              className="grid size-10 place-items-center rounded-xl text-secondary-foreground hover:bg-muted lg:hidden"
            >
              <Menu />
            </button>
            <span className="grid size-9 place-items-center rounded-xl bg-primary hover:bg-primary-hover text-white">
              <Building2 className="size-5" />
            </span>
            <span className="font-extrabold text-link">SmartHome AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/tenant/notifications"
              aria-label="Thông báo"
              className="relative grid size-10 place-items-center rounded-full text-secondary-foreground hover:bg-muted"
            >
              <Bell className="size-5" />
              {!!data?.user.unreadNotificationCount && (
                <span className="absolute right-0 top-0 grid min-w-5 place-items-center rounded-full bg-danger-solid px-1 text-[10px] text-white">
                  {data.user.unreadNotificationCount}
                </span>
              )}
            </Link>
            <TenantUserMenu />
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Đóng menu"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-72 bg-card p-5 shadow-2xl">
            <div className="flex items-center justify-between font-bold text-link">
              SmartHome AI
              <button aria-label="Đóng menu" onClick={() => setMenuOpen(false)}>
                <X />
              </button>
            </div>
            <nav className="mt-6 space-y-1">
              {tenantNavigationItems.map(({ label, href, icon: Icon }) => {
                const active = isTenantNavigationActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? "bg-accent font-semibold text-link" : "text-secondary-foreground hover:bg-muted"}`}
                  >
                    <Icon className="size-5" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden surface-card p-3 lg:block">
          <nav className="sticky top-24 space-y-1">
            {tenantNavigationItems.map(({ label, href, icon: Icon }) => {
              const active = isTenantNavigationActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active ? "bg-accent font-semibold text-link" : "text-secondary-foreground hover:bg-card"}`}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 space-y-6">
          <section>
            <p className="text-sm font-semibold text-link">{greeting},</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
              {data?.user.fullName ?? user.fullName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Chúc bạn có một ngày thuận lợi.
            </p>
          </section>
          {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
          {data && (
            <>
              {!data.rental ? (
                <EmptyState text="Bạn chưa có hợp đồng thuê đang hoạt động." />
              ) : (
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card title="Phòng của bạn">
                    <div className="flex gap-4">
                      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-accent text-link">
                        {data.rental.roomImageUrl ? (
                          <span
                            role="img"
                            aria-label={`Phòng ${data.rental.roomCode}`}
                            className="size-full bg-cover bg-center"
                            style={{
                              backgroundImage: `url("${data.rental.roomImageUrl.replaceAll('"', "%22")}")`,
                            }}
                          />
                        ) : (
                          <House className="size-10" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground">
                          {data.rental.propertyName} · Phòng{" "}
                          {data.rental.roomCode}
                        </p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {data.rental.propertyAddress}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <span>
                            {data.rental.buildingName ?? "—"} ·{" "}
                            {data.rental.floorName ?? "—"}
                          </span>
                          <span>{data.rental.area ?? "—"} m²</span>
                          <span>{data.rental.occupantCount} người ở</span>
                          <strong className="text-link">
                            {formatCurrency(data.rental.monthlyRent)}/tháng
                          </strong>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <Link
                        href={data.contract?`/tenant/contracts/${data.contract.id}#room-details`:"/tenant/contracts"}
                        className="font-semibold text-link"
                      >
                        Chi tiết phòng
                      </Link>
                      <Link
                        href="/tenant/contracts"
                        className="font-semibold text-link"
                      >
                        Xem hợp đồng
                      </Link>
                    </div>
                  </Card>

                  <Card
                    title="Hóa đơn tháng này"
                    className={
                      data.currentInvoice?.status === "OVERDUE"
                        ? "border-danger-border"
                        : ""
                    }
                  >
                    {!data.currentInvoice ? (
                      <EmptyState text="Chưa có hóa đơn cho kỳ hiện tại." />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              Kỳ {data.currentInvoice.billingPeriod}
                            </p>
                            <p className="mt-1 text-3xl font-extrabold text-foreground">
                              {formatCurrency(
                                data.currentInvoice.remainingAmount,
                              )}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Còn phải thanh toán · Hạn{" "}
                              {formatDate(data.currentInvoice.dueDate)}
                            </p>
                          </div>
                          <StatusBadge status={data.currentInvoice.status} />
                        </div>
                        {data.currentInvoice.daysUntilDue < 0 && (
                          <p className="mt-3 rounded-xl bg-danger-muted p-3 text-sm font-semibold text-danger">
                            Hóa đơn đã quá hạn{" "}
                            {Math.abs(data.currentInvoice.daysUntilDue)} ngày.
                          </p>
                        )}
                        <div className="mt-5 flex gap-3">
                          <Link
                            href="/tenant/invoices"
                            className="rounded-xl border border-accent-border px-4 py-2 font-semibold text-link"
                          >
                            Chi tiết
                          </Link>
                          {data.currentInvoice.status !== "PAID" && (
                            <Link
                              href="/tenant/payments"
                              className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 font-semibold text-white"
                            >
                              Thanh toán ngay
                            </Link>
                          )}
                        </div>
                      </>
                    )}
                  </Card>
                </div>
              )}

              <Card title="Tiện ích nhanh">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {quickActions.map(([label, href, Icon]) => (
                    <Link
                      key={label}
                      href={href}
                      className="group rounded-2xl border border-border p-4 hover:border-blue-300 hover:bg-accent focus:outline-none focus:ring-4 focus:ring-ring"
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-accent text-link">
                        <Icon className="size-5" />
                      </span>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {label}
                      </p>
                    </Link>
                  ))}
                </div>
              </Card>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card title="Điện nước tháng này">
                  {!data.utilityUsage ? (
                    <EmptyState text="Chưa có chỉ số điện nước cho kỳ hiện tại." />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          ["Điện", data.utilityUsage.electricity],
                          ["Nước", data.utilityUsage.water],
                        ].map(([name, utility]) => {
                          const value =
                            utility as typeof data.utilityUsage.electricity;
                          return (
                            <div
                              key={name as string}
                              className="rounded-xl bg-muted p-4"
                            >
                              <p className="font-semibold text-secondary-foreground">
                                {name as string}
                              </p>
                              <p className="mt-2 text-2xl font-bold text-link">
                                {value.usage ?? "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {value.previousIndex ?? "—"} →{" "}
                                {value.currentIndex ?? "—"}
                              </p>
                              <p className="mt-2 text-sm font-semibold">
                                {formatCurrency(value.amount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      {!!data.utilityHistory.length && (
                        <div className="mt-5 h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.utilityHistory}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                              />
                              <XAxis dataKey="period" fontSize={11} />
                              <YAxis fontSize={11} />
                              <Tooltip />
                              <Area
                                dataKey="electricityUsage"
                                name="Điện"
                                stroke="#2563eb"
                                fill="#dbeafe"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  )}
                </Card>
                <Card title="Hợp đồng thuê">
                  {!data.contract ? (
                    <EmptyState text="Chưa có hợp đồng đang hiệu lực." />
                  ) : (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mã hợp đồng</span>
                        <strong>{data.contract.contractCode}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Thời hạn</span>
                        <span>
                          {formatDate(data.contract.startDate)} –{" "}
                          {formatDate(data.contract.endDate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tiền đặt cọc</span>
                        <strong>
                          {formatCurrency(data.contract.depositAmount)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Còn lại</span>
                        <strong>{data.contract.daysRemaining} ngày</strong>
                      </div>
                      {data.contract.daysRemaining <= 30 && (
                        <p className="rounded-xl bg-warning-muted p-3 font-semibold text-warning">
                          Hợp đồng sẽ hết hạn sau {data.contract.daysRemaining}{" "}
                          ngày.
                        </p>
                      )}
                      <Link
                        href="/tenant/contracts"
                        className="inline-flex items-center gap-1 font-semibold text-link"
                      >
                        Xem hợp đồng <ChevronRight className="size-4" />
                      </Link>
                    </div>
                  )}
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card title="Yêu cầu sửa chữa gần đây">
                  {!data.recentMaintenanceRequests.length ? (
                    <EmptyState text="Bạn chưa có yêu cầu sửa chữa." />
                  ) : (
                    <div className="space-y-3">
                      {data.recentMaintenanceRequests.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 border-b border-border pb-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.code} · {formatDate(item.createdAt)}
                            </p>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                <Card title="Thông báo gần đây">
                  {!data.recentNotifications.length ? (
                    <EmptyState text="Bạn chưa có thông báo mới." />
                  ) : (
                    <div className="space-y-3">
                      {data.recentNotifications.map((item) => (
                        <Link
                          href={`/tenant/notifications/${item.id}`}
                          key={item.id}
                          className={`block rounded-xl p-3 ${item.read ? "bg-muted" : "bg-accent"}`}
                        >
                          <div className="flex items-center gap-2">
                            {!item.read && (
                              <span className="size-2 rounded-full bg-primary hover:bg-primary-hover" />
                            )}
                            <p className="font-semibold text-foreground">
                              {item.title}
                            </p>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {item.content}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tenantMobileNavigationItems.map(({ label, href, icon: Icon }) => {
          const active = isTenantNavigationActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "font-semibold text-link" : "text-muted-foreground"}`}
            >
              <Icon className="size-5" />
              {label === "Tổng quan"
                ? "Trang chủ"
                : label === "Yêu cầu sửa chữa"
                  ? "Sửa chữa"
                  : label}
            </Link>
          );
        })}
      </nav>

      <button
        aria-label="Mở trợ lý SmartHome AI"
        onClick={() => setAiOpen((v) => !v)}
        className="fixed bottom-20 right-4 z-40 grid size-14 place-items-center rounded-full bg-primary hover:bg-primary-hover text-white shadow-xl lg:bottom-6 lg:right-6"
      >
        <Bot />
      </button>
      {aiOpen && (
        <aside className="fixed bottom-36 right-4 z-40 w-[calc(100%-2rem)] max-w-sm surface-card p-5 sm:p-6 shadow-2xl lg:bottom-24 lg:right-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-link">Trợ lý SmartHome AI</h2>
            <button aria-label="Đóng trợ lý" onClick={() => setAiOpen(false)}>
              <X className="size-5" />
            </button>
          </div>
          <p className="mt-4 rounded-xl bg-accent p-3 text-sm text-secondary-foreground">
            Trợ lý AI đang được cấu hình. Hiện tại bạn có thể dùng các tiện ích
            nhanh hoặc liên hệ quản lý.
          </p>
          <Link
            href="/tenant/account/support"
            className="mt-4 inline-flex rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white"
          >
            Liên hệ quản lý
          </Link>
        </aside>
      )}
    </div>
  );
}
