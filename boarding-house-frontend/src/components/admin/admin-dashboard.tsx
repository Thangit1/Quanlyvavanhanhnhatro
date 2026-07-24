"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, Bell, Bot, Building2, CalendarClock, CircleDollarSign, ClipboardList, FileClock, House, LayoutDashboard, LogOut, Menu, Receipt, Search, Settings, TrendingUp, Users, Wrench, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useAdminDashboard } from "@/hooks/use-dashboard";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import { roleHome } from "@/types/auth";
import { EmptyState, ErrorState, PageLoading, StatusBadge } from "@/components/shared/dashboard-ui";

const navigation = [
  ["Tổng quan", "/owner/dashboard", LayoutDashboard], ["Nhà và phòng", "/admin/properties", Building2],
  ["Người thuê", "/admin/tenants", Users], ["Hợp đồng", "/admin/contracts", ClipboardList],
  ["Hóa đơn", "/admin/invoices", Receipt], ["Bảo trì", "/admin/maintenance", Wrench],
  ["Báo cáo", "/admin/reports", TrendingUp], ["Cài đặt", "/admin/settings", Settings],
] as const;
const roomColors: Record<string, string> = { OCCUPIED: "#2563eb", VACANT: "#10b981", RESERVED: "#f59e0b", MAINTENANCE: "#ef4444" };

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">{title}</h2>{action}</div>
    <div className="mt-4">{children}</div>
  </section>;
}
function SideNavigation({ home, onNavigate }: { home: string; onNavigate?: () => void }) {
  return <nav className="space-y-1">{navigation.map(([label, rawHref, Icon], index) =>
    <Link key={label} href={index === 0 ? home : rawHref} onClick={onNavigate}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${index === 0 ? "bg-blue-600 font-semibold text-white shadow-md shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}`}>
      <Icon className="size-5" />{label}</Link>)}</nav>;
}

export function AdminDashboard() {
  const { user, isBootstrapping, logout } = useAuth();
  const router = useRouter(); const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [propertyId, setPropertyId] = useState<number | undefined>();
  const [period, setPeriod] = useState("MONTH");
  const allowed = !!user && (user.activeRole === "OWNER" || user.activeRole === "MANAGER");
  const query = useAdminDashboard(!isBootstrapping && allowed, propertyId, period);
  const home = user?.activeRole === "MANAGER" ? "/manager/dashboard" : "/owner/dashboard";
  useEffect(() => {
    if (isBootstrapping) return;
    if (!user) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (!["OWNER", "MANAGER"].includes(user.activeRole)) router.replace(roleHome[user.activeRole]);
  }, [isBootstrapping, pathname, router, user]);
  const roomStatuses = useMemo(() => query.data?.roomStatusSummary.map((item) => ({ ...item, label: statusLabel(item.status) })) ?? [], [query.data]);
  if (isBootstrapping || !allowed || query.isLoading) return <PageLoading />;
  const data = query.data;
  const metrics = data ? [
    ["Tổng số phòng", data.summary.totalRooms, House, "text-blue-700 bg-blue-50"],
    ["Đang thuê", data.summary.occupiedRooms, Users, "text-emerald-700 bg-emerald-50"],
    ["Phòng trống", data.summary.vacantRooms, Building2, "text-cyan-700 bg-cyan-50"],
    ["Tỷ lệ lấp đầy", `${data.summary.occupancyRate}%`, TrendingUp, "text-violet-700 bg-violet-50"],
    ["Doanh thu kỳ này", formatCurrency(data.summary.currentRevenue), CircleDollarSign, "text-blue-700 bg-blue-50"],
    ["Công nợ", formatCurrency(data.summary.outstandingDebt), Receipt, "text-red-700 bg-red-50"],
    ["HĐ sắp hết hạn", data.summary.expiringContracts, FileClock, "text-amber-700 bg-amber-50"],
    ["Yêu cầu đang mở", data.summary.openMaintenanceRequests, Wrench, "text-orange-700 bg-orange-50"],
  ] as const : [];

  return <div className="min-h-screen bg-slate-50">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white p-5 lg:block">
      <Link href={home} className="flex items-center gap-3 text-xl font-extrabold text-blue-700">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white"><Building2 /></span>SmartHome AI</Link>
      <div className="mt-8"><SideNavigation home={home} /></div>
      <button onClick={() => { if (window.confirm("Bạn có chắc chắn muốn đăng xuất không?")) void logout(); }}
        className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-100"><LogOut className="size-5" />Đăng xuất</button>
    </aside>
    {menuOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-slate-950/40" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
      <aside className="relative h-full w-72 bg-white p-5 shadow-2xl"><div className="flex items-center justify-between font-extrabold text-blue-700">SmartHome AI
        <button aria-label="Đóng menu" onClick={() => setMenuOpen(false)}><X /></button></div>
        <div className="mt-6"><SideNavigation home={home} onNavigate={() => setMenuOpen(false)} /></div></aside></div>}

    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <button className="grid size-10 place-items-center rounded-xl hover:bg-slate-100 lg:hidden" aria-label="Mở menu" onClick={() => setMenuOpen(true)}><Menu /></button>
        <div className="min-w-0 flex-1"><h1 className="truncate font-bold text-slate-900">Bảng điều hành</h1>
          <p className="hidden text-xs text-slate-500 sm:block">{user.activeRole === "OWNER" ? "Chủ nhà" : "Quản lý vận hành"}</p></div>
        <label className="relative hidden max-w-xs flex-1 md:block"><span className="sr-only">Tìm kiếm</span><Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" placeholder="Tìm phòng, người thuê..." /></label>
        <Link href="/admin/notifications" aria-label="Thông báo" className="grid size-10 place-items-center rounded-full hover:bg-slate-100"><Bell className="size-5" /></Link>
        <span className="grid size-9 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">{user.fullName.trim().charAt(0).toUpperCase()}</span>
      </div></header>

      <main className="space-y-6 p-4 sm:p-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-extrabold text-slate-900">Tổng quan vận hành</h2>
          <p className="mt-1 text-sm text-slate-500">Dữ liệu tổng hợp theo phạm vi tài sản bạn được phân quyền.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row"><label className="text-xs font-semibold text-slate-500">Nhà trọ
            <select value={propertyId ?? ""} onChange={(e) => setPropertyId(e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1 block min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">Tất cả nhà trọ</option>
              {data?.availableProperties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Thời gian
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                <option value="MONTH">Tháng này</option><option value="QUARTER">Quý này</option><option value="YEAR">Năm nay</option></select></label></div>
        </section>
        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
        {data && <>{!data.availableProperties.length ? <EmptyState text="Tài khoản chưa được gán nhà trọ nào." /> : <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon, colors]) =>
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`grid size-10 place-items-center rounded-xl ${colors}`}><Icon className="size-5" /></div>
              <p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p></article>)}</section>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Doanh thu và công nợ">{!data.revenueHistory.length ? <EmptyState text="Chưa có dữ liệu tài chính trong kỳ." /> :
              <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.revenueHistory}><CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" radius={[5, 5, 0, 0]} /><Bar dataKey="outstandingDebt" name="Công nợ" fill="#f87171" radius={[5, 5, 0, 0]} />
              </BarChart></ResponsiveContainer></div>}</Panel>
            <Panel title="Trạng thái phòng">{!roomStatuses.length ? <EmptyState text="Chưa có phòng trong phạm vi quản lý." /> : <>
              <div className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={roomStatuses} dataKey="count" nameKey="label" innerRadius={52} outerRadius={82}>
                {roomStatuses.map((item) => <Cell key={item.status} fill={roomColors[item.status] ?? "#94a3b8"} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
              <div className="grid grid-cols-2 gap-2">{roomStatuses.map((item) => <div key={item.status} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: roomColors[item.status] ?? "#94a3b8" }} /><span className="text-slate-500">{item.label}</span><strong className="ml-auto">{item.count}</strong></div>)}</div></>}</Panel>
          </div>

          <Panel title="Sơ đồ phòng" action={<Link href="/admin/properties" className="text-sm font-semibold text-blue-700">Quản lý phòng</Link>}>
            {!data.roomMap.length ? <EmptyState text="Chưa có phòng để hiển thị." /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{data.roomMap.map((room) =>
              <Link href={`/admin/rooms/${room.id}`} key={room.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900">Phòng {room.roomCode}</p>
                  <p className="text-xs text-slate-500">{room.propertyName} · {room.floorName ?? "Chưa gán tầng"}</p></div><StatusBadge status={room.status} /></div>
                <p className="mt-3 truncate text-sm font-semibold text-slate-700">{room.tenantName ?? "Chưa có người thuê"}</p>
                <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{room.contractEndDate ? `HĐ: ${formatDate(room.contractEndDate)}` : "Chưa có hợp đồng"}</span>
                  {room.hasOpenMaintenance && <span className="font-semibold text-orange-600">Có bảo trì</span>}</div>
                {room.outstandingDebt > 0 && <p className="mt-2 text-xs font-semibold text-red-600">Nợ {formatCurrency(room.outstandingDebt)}</p>}</Link>)}</div>}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Hóa đơn quá hạn" action={<Link href="/admin/invoices" className="text-sm font-semibold text-blue-700">Xem tất cả</Link>}>
              {!data.overdueInvoices.length ? <EmptyState text="Không có hóa đơn quá hạn." /> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3">Mã</th><th>Phòng / người thuê</th><th>Quá hạn</th><th className="text-right">Còn nợ</th></tr></thead>
                <tbody>{data.overdueInvoices.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="py-3 font-semibold">{item.code}</td>
                  <td><p>Phòng {item.roomCode}</p><p className="text-xs text-slate-500">{item.tenantName}</p></td><td className="font-semibold text-red-600">{item.overdueDays} ngày</td>
                  <td className="text-right font-semibold">{formatCurrency(item.remainingAmount)}</td></tr>)}</tbody></table></div>}
            </Panel>
            <Panel title="Hợp đồng sắp hết hạn" action={<Link href="/admin/contracts" className="text-sm font-semibold text-blue-700">Xem tất cả</Link>}>
              {!data.expiringContracts.length ? <EmptyState text="Không có hợp đồng sắp hết hạn." /> : <div className="space-y-3">{data.expiringContracts.map((item) =>
                <Link href={`/admin/contracts/${item.id}`} key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><CalendarClock className="size-5" /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate">Phòng {item.roomCode} · {item.tenantName}</strong>
                    <span className="text-xs text-slate-500">{item.code} · {formatDate(item.endDate)}</span></span><span className="text-sm font-bold text-amber-700">{item.daysRemaining} ngày</span></Link>)}</div>}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Yêu cầu bảo trì" className="xl:col-span-2">{!data.maintenanceRequests.length ? <EmptyState text="Không có yêu cầu bảo trì đang mở." /> :
              <div className="grid gap-3 md:grid-cols-2">{data.maintenanceRequests.map((item) => <Link href={`/admin/maintenance/${item.id}`} key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between gap-2"><p className="font-semibold">{item.title}</p><StatusBadge status={item.priority} /></div>
                <p className="mt-1 text-xs text-slate-500">{item.propertyName}{item.roomCode ? ` · Phòng ${item.roomCode}` : ""}</p>
                <p className="mt-3 text-sm">Phụ trách: <strong>{item.assigneeName ?? "Chưa phân công"}</strong></p><p className="mt-1 text-xs text-slate-500">Đang chờ {item.waitingHours} giờ</p></Link>)}</div>}
            </Panel>
            <Panel title="Cảnh báo vận hành">{!data.operationalAlerts.length ? <EmptyState text="Không có cảnh báo cần xử lý." /> :
              <div className="space-y-3">{data.operationalAlerts.map((item) => <Link href={item.actionUrl} key={item.code} className="block rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" /><div><p className="text-sm font-semibold text-amber-900">{item.title}</p>
                  <p className="mt-1 text-xs text-amber-700">{item.description}</p></div></div></Link>)}</div>}
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Hoạt động gần đây">{!data.recentActivities.length ? <EmptyState text="Chưa có hoạt động vận hành." /> :
              <div className="space-y-4">{data.recentActivities.map((item) => <div key={item.id} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Activity className="size-4" /></span>
                <div className="min-w-0"><p className="text-sm text-slate-700">{item.description}</p><p className="mt-1 text-xs text-slate-500">{item.actorName ?? "Hệ thống"} · {formatDate(item.createdAt)}</p></div></div>)}</div>}
            </Panel>
            <Panel title="Phân tích SmartHome AI" action={<Bot className="size-5 text-blue-600" />}>{!data.aiInsights.length ?
              <div className="rounded-xl bg-blue-50 p-5 text-sm text-slate-700"><p className="font-semibold text-blue-800">AI chưa được cấu hình</p>
                <p className="mt-2">Khi nhà cung cấp AI sẵn sàng, khu vực này sẽ hiển thị dự báo công nợ, lấp đầy và gợi ý vận hành từ dữ liệu thật.</p></div> :
              <div className="space-y-3">{data.aiInsights.map((item) => <div key={item.label} className="rounded-xl bg-blue-50 p-3"><p className="font-semibold text-blue-800">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600">{item.content}</p></div>)}</div>}</Panel>
          </div>
          {!!data.revenueHistory.length && <Panel title="Xu hướng chi phí"><div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.revenueHistory}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Line type="monotone" dataKey="expense" name="Chi phí" stroke="#f59e0b" strokeWidth={3} /></LineChart></ResponsiveContainer></div></Panel>}
        </>}</>}
      </main>
    </div>
  </div>;
}
