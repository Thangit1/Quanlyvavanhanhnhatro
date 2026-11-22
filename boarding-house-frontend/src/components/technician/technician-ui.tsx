"use client";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  MapPin,
  RefreshCw,
} from "lucide-react";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/constants/technician";
import type { TaskRow } from "@/types/technician";
export function Page({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Cổng kỹ thuật / {title}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </main>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status] ?? "bg-muted text-secondary-foreground"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priority === "URGENT" ? "bg-red-600 text-white" : priority === "HIGH" ? "bg-orange-50 text-orange-700" : "bg-muted text-secondary-foreground"}`}
    >
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}
export function TaskCard({ task }: { task: TaskRow }) {
  return (
    <Link
      href={`/technician/tasks/${task.id}`}
      className={`group block rounded-2xl border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-md ${task.priority === "URGENT" ? "border-danger-border" : "border-border"}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.overdue && (
              <span className="text-xs font-semibold text-danger">
                Quá SLA
              </span>
            )}
          </div>
          <h3 className="mt-3 font-bold text-foreground group-hover:text-link">
            {task.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {task.taskCode} · {task.category}
          </p>
        </div>
        <ChevronRight className="size-5 text-slate-300" />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-secondary-foreground sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-link" />
          {task.property.name}
          {task.room ? ` · ${task.room.name}` : ""}
        </p>
        <p className="flex items-center gap-2">
          <CalendarClock className="size-4 text-link" />
          {formatDate(task.scheduledStart ?? task.slaDueAt)}
        </p>
      </div>
      {task.progressPercent > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Tiến độ</span>
            <span>{task.progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary hover:bg-primary-hover"
              style={{ width: `${task.progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  description = "Dữ liệu sẽ xuất hiện khi có công việc phù hợp.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-input bg-card px-6 py-14 text-center">
      <AlertTriangle className="mx-auto size-9 text-slate-300" />
      <p className="mt-3 font-semibold text-secondary-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <RefreshCw className="size-5 animate-spin" />
      Đang tải dữ liệu…
    </div>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="rounded-2xl border border-danger-border bg-danger-muted p-8 text-center text-danger">
      <AlertTriangle className="mx-auto size-8" />
      <p className="mt-3 font-semibold">Không thể tải dữ liệu.</p>
      <button
        onClick={retry}
        className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Thử lại
      </button>
    </div>
  );
}
export const formatDate = (x?: string | null) =>
  x
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(x))
    : "Chưa xếp lịch";
export const formatMoney = (x: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(x);
