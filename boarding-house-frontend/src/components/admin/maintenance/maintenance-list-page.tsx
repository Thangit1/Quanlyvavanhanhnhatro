"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Download,
  KanbanSquare,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyMaintenance,
  PriorityBadge,
  StatusBadge,
  categoryLabel,
} from "./maintenance-shared";
import { useMaintenanceData } from "@/hooks/use-admin-maintenance";
import { adminMaintenanceService } from "@/services/admin-maintenance.service";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  MaintenanceFilters,
  MaintenanceRow,
} from "@/types/admin-maintenance";
const initial: MaintenanceFilters = { page: 0, size: 20, sort: "newest" };
const tabs = [
  "",
  "NEW",
  "UNASSIGNED",
  "SCHEDULED",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "INSPECTION_PENDING",
  "OVERDUE",
  "RESOLVED",
  "CANCELLED",
];
const tabNames = [
  "Tất cả",
  "Mới tiếp nhận",
  "Chưa phân công",
  "Đã lên lịch",
  "Đang xử lý",
  "Chờ vật tư",
  "Chờ nghiệm thu",
  "Quá hạn",
  "Đã hoàn thành",
  "Đã hủy",
];
export function MaintenanceListPage() {
  const [filters, setFilters] = useState(initial);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"table" | "kanban">("table");
  const { summary, list, options } = useMaintenanceData(filters);
  useEffect(() => {
    const t = setTimeout(
      () =>
        setFilters((f) => ({ ...f, keyword: search || undefined, page: 0 })),
      400,
    );
    return () => clearTimeout(t);
  }, [search]);
  const applyTab = (tab: string) =>
    setFilters((f) => ({
      ...f,
      status: tab && tab !== "OVERDUE" ? tab : undefined,
      overdue: tab === "OVERDUE" || undefined,
      page: 0,
    }));
  const error = summary.error || list.error || options.error;
  const summaryCards: Array<[string, string | number, LucideIcon]> =
    summary.data
      ? [
          ["Đang mở", summary.data.openRequests, Wrench],
          ["Mới tiếp nhận", summary.data.newRequests, Plus],
          ["Khẩn cấp", summary.data.urgentRequests, Zap],
          ["Quá hạn SLA", summary.data.overdueRequests, CalendarDays],
          ["Chi phí tháng", formatCurrency(summary.data.monthlyCost), Download],
        ]
      : [];
  return (
    <AdminShell
      title="Quản lý bảo trì"
      subtitle="Tiếp nhận, phân công và theo dõi các yêu cầu sửa chữa trong hệ thống."
      readOnly
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Tổng quan / Bảo trì</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Quản lý bảo trì và sửa chữa
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => adminMaintenanceService.export(filters)}
              className="btn-secondary"
            >
              <Download className="size-4" />
              Xuất dữ liệu
            </button>
            <Link href="/admin/maintenance/calendar" className="btn-secondary">
              <CalendarDays className="size-4" />
              Lịch bảo trì
            </Link>
            <Link href="/admin/maintenance/new" className="btn-primary">
              <Plus className="size-4" />
              Tạo yêu cầu
            </Link>
          </div>
        </div>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">
              {apiErrorMessage(error, "Không thể tải dữ liệu bảo trì.")}
            </p>
            <button
              onClick={() => {
                summary.refetch();
                list.refetch();
                options.refetch();
              }}
              className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <RefreshCw className="mr-2 inline size-4" />
              Thử lại
            </button>
          </div>
        )}
        {summary.data && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {summaryCards.map(([label, value, Icon]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Icon className="mb-3 size-5 text-blue-600" />
                <p className="text-sm text-slate-500">{String(label)}</p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {String(value)}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <label className="relative">
              <Search className="absolute left-3 top-3 size-5 text-slate-400" />
              <input
                aria-label="Tìm kiếm yêu cầu"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mã yêu cầu, sự cố, phòng, người báo..."
                className="input pl-10"
              />
            </label>
            <select
              aria-label="Khu trọ"
              className="input"
              value={filters.propertyId ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  propertyId: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                  page: 0,
                }))
              }
            >
              <option value="">Tất cả khu trọ</option>
              {options.data?.properties.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Mức độ"
              className="input"
              value={filters.priority ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  priority: e.target.value || undefined,
                  page: 0,
                }))
              }
            >
              <option value="">Tất cả mức độ</option>
              <option value="URGENT">Khẩn cấp</option>
              <option value="HIGH">Cao</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="LOW">Thấp</option>
            </select>
            <select
              aria-label="Loại sự cố"
              className="input"
              value={filters.category ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  category: e.target.value || undefined,
                  page: 0,
                }))
              }
            >
              <option value="">Tất cả loại</option>
              {Object.entries(categoryMap).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                aria-label="Dạng bảng"
                onClick={() => setView("table")}
                className={`rounded-lg p-2 ${view === "table" ? "bg-white text-blue-600 shadow" : "text-slate-500"}`}
              >
                <LayoutList className="size-5" />
              </button>
              <button
                aria-label="Dạng Kanban"
                onClick={() => setView("kanban")}
                className={`rounded-lg p-2 ${view === "kanban" ? "bg-white text-blue-600 shadow" : "text-slate-500"}`}
              >
                <KanbanSquare className="size-5" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((t, i) => (
              <button
                key={tabNames[i]}
                onClick={() => applyTab(t)}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${(t === "OVERDUE" ? filters.overdue : t ? filters.status === t : !filters.status && !filters.overdue) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {tabNames[i]}
              </button>
            ))}
          </div>
        </div>
        {list.isLoading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
        ) : !list.data?.content.length ? (
          <EmptyMaintenance />
        ) : view === "table" ? (
          <Table rows={list.data.content} />
        ) : (
          <Kanban rows={list.data.content} />
        )}{" "}
        {list.data && list.data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>{list.data.totalElements} yêu cầu</span>
            <div className="flex gap-2">
              <button
                disabled={filters.page === 0}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                className="btn-secondary"
              >
                Trước
              </button>
              <span className="px-3 py-2">
                {filters.page + 1}/{list.data.totalPages}
              </span>
              <button
                disabled={filters.page + 1 >= list.data.totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                className="btn-secondary"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
function Table({ rows }: { rows: MaintenanceRow[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {[
                "Mã yêu cầu",
                "Sự cố",
                "Khu trọ / Phòng",
                "Mức độ",
                "Phụ trách",
                "Lịch xử lý",
                "SLA",
                "Chi phí",
                "Trạng thái",
              ].map((x) => (
                <th key={x} className="px-4 py-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-4">
                  <Link
                    href={`/admin/maintenance/${r.id}`}
                    className="font-bold text-blue-600"
                  >
                    {r.requestCode}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <p className="max-w-64 font-semibold text-slate-800">
                    {r.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {categoryLabel(r.category)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <p>{r.property.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.room?.name ?? "Khu vực chung"}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <PriorityBadge priority={r.priority} />
                </td>
                <td className="px-4 py-4">
                  {r.assignee?.name ?? "Chưa phân công"}
                </td>
                <td className="px-4 py-4">
                  {r.scheduledStart
                    ? formatDate(r.scheduledStart)
                    : "Chưa lên lịch"}
                </td>
                <td
                  className={`px-4 py-4 font-semibold ${r.overdue ? "text-red-600" : "text-slate-600"}`}
                >
                  {r.overdue
                    ? `Quá hạn · ${r.waitingHours} giờ`
                    : r.slaDueAt
                      ? formatDate(r.slaDueAt)
                      : "—"}
                </td>
                <td className="px-4 py-4 text-right font-semibold">
                  {formatCurrency(r.actualCost || r.estimatedCost)}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <Link
            href={`/admin/maintenance/${r.id}`}
            key={r.id}
            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex justify-between gap-2">
              <p className="font-bold text-blue-600">{r.requestCode}</p>
              <PriorityBadge priority={r.priority} />
            </div>
            <h3 className="mt-2 font-bold text-slate-900">{r.title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {r.property.name} · {r.room?.name ?? "Khu vực chung"}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <StatusBadge status={r.status} />
              {r.overdue && (
                <span className="text-xs font-bold text-red-600">
                  Đã quá SLA
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
function Kanban({ rows }: { rows: MaintenanceRow[] }) {
  const statuses = [
    "NEW",
    "ASSIGNED",
    "IN_PROGRESS",
    "WAITING_PARTS",
    "INSPECTION_PENDING",
  ];
  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {statuses.map((status) => (
        <section
          key={status}
          className="min-w-72 flex-1 rounded-2xl bg-slate-100 p-3"
        >
          <div className="mb-3 flex items-center justify-between">
            <StatusBadge status={status} />
            <span className="text-xs font-bold text-slate-500">
              {rows.filter((x) => x.status === status).length}
            </span>
          </div>
          <div className="space-y-3">
            {rows
              .filter((x) => x.status === status)
              .map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/maintenance/${r.id}`}
                  className="block rounded-xl bg-white p-3 shadow-sm"
                >
                  <p className="text-xs font-bold text-blue-600">
                    {r.requestCode}
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">{r.title}</p>
                  <div className="mt-3 flex justify-between">
                    <PriorityBadge priority={r.priority} />
                    <span className="text-xs text-slate-500">
                      {r.room?.name ?? "Chung"}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
const categoryMap: Record<string, string> = {
  ELECTRICAL: "Điện",
  WATER: "Nước",
  INTERNET: "Internet",
  AIR_CONDITIONER: "Điều hòa",
  WATER_HEATER: "Bình nóng lạnh",
  DOOR_LOCK: "Cửa và khóa",
  FURNITURE: "Nội thất",
  APPLIANCE: "Thiết bị điện",
  STRUCTURE: "Kết cấu",
  LEAKAGE: "Thấm dột",
  SANITATION: "Vệ sinh",
  SECURITY: "An ninh",
  FIRE_SAFETY: "PCCC",
  COMMON_AREA: "Khu vực chung",
  ELEVATOR: "Thang máy",
  OTHER: "Khác",
};
