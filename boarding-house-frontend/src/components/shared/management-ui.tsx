"use client";

import { Search } from "lucide-react";
import type { ReactNode, InputHTMLAttributes } from "react";
import { useManagementScope } from "@/providers/management-scope";
export { EmptyState, StatusBadge } from "./dashboard-ui";
export { ConfirmDialog } from "@/components/tenant/account/account-ui";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-page-secondary">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
export function PageToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 surface-card p-4">
      {children}
    </div>
  );
}
export const FilterBar = PageToolbar;
export function PropertySelector() {
  const scope = useManagementScope();
  return (
    <label className="block min-w-0 text-xs font-medium text-muted-foreground">
      Công ty / khu / nhà trọ
      <select
        aria-label="Phạm vi nhà trọ"
        disabled={scope.loading || scope.error}
        value={scope.propertyId ?? ""}
        onChange={(e) =>
          scope.setPropertyId(
            e.target.value ? Number(e.target.value) : undefined,
          )
        }
        className="mt-1 block w-full max-w-64 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground disabled:opacity-50"
      >
        <option value="">
          {scope.loading
            ? "Đang tải phạm vi…"
            : scope.error
              ? "Không tải được phạm vi"
              : "Tất cả nhà trọ được phân quyền"}
        </option>
        {scope.propertyGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {scope.error && (
        <button
          type="button"
          onClick={scope.retry}
          className="mt-1 text-danger underline"
        >
          Thử lại
        </button>
      )}
    </label>
  );
}
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{props["aria-label"] ?? "Tìm kiếm"}</span>
      <Search
        aria-hidden
        className="absolute left-3 top-3 size-4 text-muted-foreground"
      />
      <input
        {...props}
        className={`w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:ring-2 focus:ring-ring ${props.className ?? ""}`}
      />
    </label>
  );
}
export function SummaryCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  note?: string;
}) {
  return (
    <article className="min-w-0 surface-card p-4 ">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="shrink-0 text-link">{icon}</span>
      </div>
      <p className="mt-3 break-words text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </article>
  );
}
export function LoadingSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Đang tải dữ liệu</span>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-slate-200"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}
export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Phân trang"
      className="mt-4 flex items-center justify-end gap-3 text-sm"
    >
      <button
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border bg-card px-3 py-2 disabled:opacity-40"
      >
        Trước
      </button>
      <span>
        {totalPages ? page + 1 : 0} / {totalPages}
      </span>
      <button
        disabled={page + 1 >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border bg-card px-3 py-2 disabled:opacity-40"
      >
        Sau
      </button>
    </nav>
  );
}
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
}: {
  rows: T[];
  columns: { label: string; render: (row: T) => ReactNode }[];
  rowKey: (row: T) => string | number;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-divider bg-muted text-xs text-secondary-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.label} scope="col" className="px-2 py-3">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-divider transition-colors last:border-0 hover:bg-muted/70"
            >
              {columns.map((c) => (
                <td key={c.label} className="px-2 py-3">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ActionMenu({ children }: { children: ReactNode }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-lg border bg-card px-3 py-2 text-sm">
        Thao tác
      </summary>
      <div className="mt-2 min-w-40 rounded-xl border bg-card p-2 shadow-lg">
        {children}
      </div>
    </details>
  );
}
