"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Download, KeyRound, MapPinHouse, Plus, Search,
  ShieldCheck, UserCheck, UserMinus, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState, ErrorState, PageLoading, StatusBadge } from "@/components/shared/dashboard-ui";
import { useAdminTenants } from "@/hooks/use-admin-tenants";
import { adminTenantService } from "@/services/admin-tenant.service";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

const labels: Record<string, string> = {
  ACTIVE: "Đang thuê", MOVED_OUT: "Đã rời đi", INACTIVE: "Ngừng theo dõi",
  REGISTERED: "Đã đăng ký", PENDING: "Đang xử lý", NOT_DECLARED: "Chưa khai báo",
  LOCKED: "Đã khóa", NO_ACCOUNT: "Chưa có tài khoản", REPRESENTATIVE: "Đại diện",
  OCCUPANT: "Người ở cùng", DEPENDENT: "Người phụ thuộc",
};

export function TenantListPage() {
  const { user } = useAuth();
  const [keywordInput, setKeywordInput] = useState(""); const [keyword, setKeyword] = useState("");
  const [propertyId, setPropertyId] = useState<number>(); const [roomId, setRoomId] = useState<number>();
  const [status, setStatus] = useState(""); const [temporaryStatus, setTemporaryStatus] = useState("");
  const [accountStatus, setAccountStatus] = useState(""); const [page, setPage] = useState(0);
  const [sort, setSort] = useState("fullName"); const [direction, setDirection] = useState("asc");
  useEffect(() => {
    const timer = window.setTimeout(() => { setKeyword(keywordInput.trim()); setPage(0); }, 350);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);
  const filters = useMemo(() => ({ propertyId, roomId, status: status || undefined,
    temporaryStatus: temporaryStatus || undefined, accountStatus: accountStatus || undefined,
    keyword: keyword || undefined, sort, direction, page, size: 20 }),
  [accountStatus, direction, keyword, page, propertyId, roomId, sort, status, temporaryStatus]);
  const query = useAdminTenants(filters);
  if (query.isLoading) return <PageLoading />;
  const data = query.data;
  const canWrite = user?.activeRole === "OWNER" || user?.activeRole === "MANAGER";
  const metrics = data ? [
    ["Tổng người thuê", data.summary.total, Users, "bg-blue-50 text-blue-700"],
    ["Đang thuê", data.summary.active, UserCheck, "bg-emerald-50 text-emerald-700"],
    ["HĐ sắp hết hạn", data.summary.expiringContracts, CalendarClock, "bg-amber-50 text-amber-700"],
    ["Có công nợ", data.summary.overdueDebt, ShieldCheck, "bg-red-50 text-red-700"],
    ["Đã rời đi", data.summary.movedOut, UserMinus, "bg-slate-100 text-slate-700"],
    ["Đã đăng ký tạm trú", data.summary.temporaryRegistered, MapPinHouse, "bg-cyan-50 text-cyan-700"],
    ["Tạm trú cần xử lý", data.summary.temporaryPending, Building2, "bg-orange-50 text-orange-700"],
    ["Chưa có tài khoản", data.summary.noAccount, KeyRound, "bg-violet-50 text-violet-700"],
  ] as const : [];
  return <AdminShell title="Quản lý người thuê" subtitle="Hồ sơ, cư trú, hợp đồng và tài khoản" readOnly>
    <div className="mx-auto max-w-[1600px] space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>
        <p className="text-sm text-slate-500">Quản lý tập trung toàn bộ vòng đời người thuê theo phạm vi nhà trọ.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void adminTenantService.exportCsv({ propertyId, keyword })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300">
            <Download className="size-4" />Xuất CSV</button>
          {canWrite && <Link href="/admin/tenants/new" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
            <Plus className="size-4" />Thêm người thuê</Link>}
        </div>
      </section>
      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
      {data && <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">{metrics.map(([label, value, Icon, color]) =>
        <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className={`grid size-9 place-items-center rounded-xl ${color}`}><Icon className="size-4" /></span>
          <p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p></article>)}</section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 size-4 text-slate-400" />
              <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                placeholder="Tên, mã, SĐT, email, phòng, hợp đồng..." /></label>
            <Select value={propertyId ?? ""} onChange={(value) => { setPropertyId(value ? Number(value) : undefined); setRoomId(undefined); setPage(0); }}
              options={data.properties.map((p) => [p.id, p.name])} placeholder="Tất cả nhà trọ" />
            <Select value={roomId ?? ""} onChange={(value) => { setRoomId(value ? Number(value) : undefined); setPage(0); }}
              options={data.rooms.filter((r) => !propertyId || r.propertyId === propertyId).map((r) => [r.id, `Phòng ${r.code}`])} placeholder="Tất cả phòng" />
            <Select value={status} onChange={(value) => { setStatus(String(value)); setPage(0); }}
              options={[["ACTIVE", "Đang thuê"], ["MOVED_OUT", "Đã rời đi"], ["INACTIVE", "Ngừng theo dõi"]]} placeholder="Mọi trạng thái" />
            <Select value={temporaryStatus} onChange={(value) => { setTemporaryStatus(String(value)); setPage(0); }}
              options={[["REGISTERED", "Tạm trú: Đã đăng ký"], ["PENDING", "Tạm trú: Đang xử lý"], ["NOT_DECLARED", "Tạm trú: Chưa khai báo"]]} placeholder="Mọi trạng thái tạm trú" />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <Select value={accountStatus} onChange={(value) => { setAccountStatus(String(value)); setPage(0); }}
              options={[["ACTIVE", "Tài khoản hoạt động"], ["LOCKED", "Tài khoản bị khóa"], ["NO_ACCOUNT", "Chưa có tài khoản"]]} placeholder="Mọi tài khoản" />
            <div className="flex items-center gap-2 text-sm text-slate-500">Sắp xếp
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5">
                <option value="fullName">Họ tên</option><option value="tenantCode">Mã người thuê</option>
                <option value="contractEndDate">Hạn hợp đồng</option><option value="outstandingDebt">Công nợ</option>
              </select>
              <button onClick={() => setDirection((v) => v === "asc" ? "desc" : "asc")} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold">{direction === "asc" ? "Tăng" : "Giảm"}</button>
            </div>
          </div>
        </section>
        {!data.page.items.length ? <EmptyState text="Không tìm thấy người thuê phù hợp với bộ lọc." /> : <>
          <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="px-4 py-3">Người thuê</th><th>Liên hệ</th><th>Nhà / phòng</th><th>Vai trò</th>
                <th>Hợp đồng</th><th>Công nợ</th><th>Tạm trú</th><th>Tài khoản</th><th className="pr-4 text-right">Thao tác</th>
              </tr></thead><tbody>{data.page.items.map((row) => <tr key={row.id} className="border-t border-slate-100 hover:bg-blue-50/30">
                <td className="px-4 py-3"><Link href={`/admin/tenants/${row.id}`} className="font-bold text-slate-900 hover:text-blue-700">{row.fullName}</Link>
                  <p className="text-xs text-slate-500">{row.tenantCode}</p></td>
                <td><p>{row.phone}</p><p className="max-w-44 truncate text-xs text-slate-500">{row.email ?? "Chưa có email"}</p></td>
                <td><p className="font-semibold">{row.propertyName}</p><p className="text-xs text-slate-500">{row.roomCode ? `Phòng ${row.roomCode}` : "Chưa gán phòng"}</p></td>
                <td>{labels[row.residenceRole] ?? row.residenceRole}</td>
                <td>{row.contractCode ? <><p className="font-semibold">{row.contractCode}</p><p className="text-xs text-slate-500">đến {formatDate(row.contractEndDate!)}</p></> : <span className="text-slate-400">Chưa có</span>}</td>
                <td className={row.outstandingDebt > 0 ? "font-semibold text-red-600" : "text-slate-500"}>{formatCurrency(row.outstandingDebt)}</td>
                <td><StatusBadge status={row.temporaryResidenceStatus} /></td>
                <td>{row.hasAccount ? <StatusBadge status={row.accountStatus ?? "ACTIVE"} /> : <span className="text-xs text-slate-500">Chưa có</span>}</td>
                <td className="pr-4 text-right"><Link href={`/admin/tenants/${row.id}`} className="font-semibold text-blue-700">Chi tiết</Link></td>
              </tr>)}</tbody></table></div>
          </section>
          <section className="grid gap-3 lg:hidden">{data.page.items.map((row) => <Link href={`/admin/tenants/${row.id}`} key={row.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between gap-3"><div><p className="font-bold">{row.fullName}</p>
              <p className="text-xs text-slate-500">{row.tenantCode} · {row.phone}</p></div><StatusBadge status={row.status} /></div>
            <p className="mt-3 text-sm font-semibold">{row.propertyName} · {row.roomCode ? `Phòng ${row.roomCode}` : "Chưa gán phòng"}</p>
            <div className="mt-3 flex justify-between text-xs text-slate-500"><span>{labels[row.temporaryResidenceStatus] ?? row.temporaryResidenceStatus}</span>
              <span className={row.outstandingDebt > 0 ? "font-semibold text-red-600" : ""}>Nợ {formatCurrency(row.outstandingDebt)}</span></div></Link>)}</section>
          <Pagination page={data.page.page} totalPages={data.page.totalPages} total={data.page.totalElements} onChange={setPage} />
        </>}</>}
    </div>
  </AdminShell>;
}

function Select({ value, onChange, options, placeholder }: { value: string | number; onChange: (value: string | number) => void;
  options: (string | number)[][]; placeholder: string }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
    <option value="">{placeholder}</option>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>;
}
function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (page: number) => void }) {
  return <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
    <span>{total} kết quả · Trang {Math.min(page + 1, Math.max(totalPages, 1))}/{Math.max(totalPages, 1)}</span>
    <div className="flex gap-2"><button disabled={page <= 0} onClick={() => onChange(page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button>
      <button disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div>;
}
