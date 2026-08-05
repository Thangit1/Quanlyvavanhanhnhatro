"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PropertyOption, ReportFilters } from "@/types/admin-report";

export const reportNav = [
  ["Tổng quan", "/admin/reports"],
  ["Vận hành phòng", "/admin/reports/occupancy"],
  ["Doanh thu", "/admin/reports/revenue"],
  ["Chi phí", "/admin/reports/expenses"],
  ["Lợi nhuận", "/admin/reports/profit"],
  ["Hóa đơn & công nợ", "/admin/reports/debt"],
  ["Hợp đồng", "/admin/reports/contracts"],
  ["Người thuê", "/admin/reports/tenants"],
  ["Điện nước", "/admin/reports/utilities"],
  ["Bảo trì", "/admin/reports/maintenance"],
  ["Tài sản", "/admin/reports/assets"],
  ["So sánh khu trọ", "/admin/reports/operations"],
  ["Lịch sử xuất", "/admin/reports/export-history"],
] as const;

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function defaultReportFilters(): ReportFilters {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: iso(first), endDate: iso(now) };
}
export function useReportFilterState() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initial = useMemo<ReportFilters>(
    () => ({
      startDate: search.get("startDate") ?? defaultReportFilters().startDate,
      endDate: search.get("endDate") ?? defaultReportFilters().endDate,
      propertyIds:
        search
          .get("propertyIds")
          ?.split(",")
          .map(Number)
          .filter(Number.isFinite) ?? [],
    }),
    [search],
  );
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const apply = () => {
    const q = new URLSearchParams();
    q.set("startDate", draft.startDate);
    q.set("endDate", draft.endDate);
    if (draft.propertyIds?.length)
      q.set("propertyIds", draft.propertyIds.join(","));
    router.replace(`${pathname}?${q}`);
    setApplied(draft);
  };
  const reset = () => {
    const value = defaultReportFilters();
    setDraft(value);
    setApplied(value);
    router.replace(pathname);
  };
  return { draft, setDraft, applied, apply, reset };
}
export function ReportNavigation() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <nav
      aria-label="Danh mục báo cáo"
      className="flex gap-2 overflow-x-auto pb-2"
    >
      {reportNav.map(([label, href]) => (
        <Link
          key={href}
          href={`${href}${search ? `?${search}` : ""}`}
          className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${pathname === href ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-600"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function ReportFilterBar({
  properties,
  state,
}: {
  properties: PropertyOption[];
  state: ReturnType<typeof useReportFilterState>;
}) {
  const [open, setOpen] = useState(false);
  const selected = state.draft.propertyIds ?? [];
  const toggle = (id: number) =>
    state.setDraft((f) => ({
      ...f,
      propertyIds: selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    }));
  const fields = (
    <>
      <fieldset className="min-w-64">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          Khu trọ
        </legend>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
          {properties.length ? (
            properties.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="size-4 accent-blue-600"
                />
                {p.name}
              </label>
            ))
          ) : (
            <p className="p-2 text-sm text-slate-500">
              Chưa có khu trọ trong phạm vi.
            </p>
          )}
        </div>
      </fieldset>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Từ ngày
        <input
          aria-label="Từ ngày"
          type="date"
          value={state.draft.startDate}
          onChange={(e) =>
            state.setDraft((f) => ({ ...f, startDate: e.target.value }))
          }
          className="input mt-2 min-w-40 text-sm font-normal normal-case"
        />
      </label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Đến ngày
        <input
          aria-label="Đến ngày"
          type="date"
          value={state.draft.endDate}
          onChange={(e) =>
            state.setDraft((f) => ({ ...f, endDate: e.target.value }))
          }
          className="input mt-2 min-w-40 text-sm font-normal normal-case"
        />
      </label>
    </>
  );
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="btn-secondary lg:hidden"
      >
        <SlidersHorizontal className="size-4" />
        Bộ lọc báo cáo
      </button>
      <div
        className={`${open ? "flex" : "hidden"} flex-col gap-4 lg:flex lg:flex-row lg:items-end`}
      >
        {fields}
        <div className="flex gap-2 lg:ml-auto">
          <button onClick={state.reset} className="btn-secondary">
            <RotateCcw className="size-4" />
            Xóa lọc
          </button>
          <button
            onClick={() => {
              state.apply();
              setOpen(false);
            }}
            className="btn-primary"
          >
            <Check className="size-4" />
            Áp dụng
          </button>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <CalendarRange className="size-4" />
        {selected.length
          ? `${selected.length} khu trọ được chọn`
          : "Tất cả khu trọ được phân quyền"}{" "}
        · {state.draft.startDate} đến {state.draft.endDate}
      </p>
    </section>
  );
}
export function ReportKpi({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      title={hint}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm text-slate-500">{label}</p>
      <p className="mt-1 break-words text-2xl font-black text-slate-950">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </article>
  );
}
export function ReportPanel({
  title,
  children,
  description,
}: {
  title: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">{title}</h2>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
export function ReportError({
  retry,
  message = "Không thể tải dữ liệu báo cáo. Vui lòng thử lại.",
}: {
  retry: () => void;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"
    >
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-5" />
        {message}
      </div>
      <button
        onClick={retry}
        className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Thử lại
      </button>
    </div>
  );
}
export function ReportSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-36 rounded-2xl bg-slate-200" />
      ))}
    </div>
  );
}
