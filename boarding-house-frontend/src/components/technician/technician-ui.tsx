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
          <p className="text-sm text-slate-500">Cổng kỹ thuật / {title}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
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
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priority === "URGENT" ? "bg-red-600 text-white" : priority === "HIGH" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-600"}`}
    >
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}
export function TaskCard({ task }: { task: TaskRow }) {
  return (
    <Link
      href={`/technician/tasks/${task.id}`}
      className={`group block rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${task.priority === "URGENT" ? "border-red-200" : "border-slate-200"}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.overdue && (
              <span className="text-xs font-semibold text-red-600">
                Quá SLA
              </span>
            )}
          </div>
          <h3 className="mt-3 font-bold text-slate-950 group-hover:text-blue-700">
            {task.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {task.taskCode} · {task.category}
          </p>
        </div>
        <ChevronRight className="size-5 text-slate-300" />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-blue-600" />
          {task.property.name}
          {task.room ? ` · ${task.room.name}` : ""}
        </p>
        <p className="flex items-center gap-2">
          <CalendarClock className="size-4 text-blue-600" />
          {formatDate(task.scheduledStart ?? task.slaDueAt)}
        </p>
      </div>
      {task.progressPercent > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Tiến độ</span>
            <span>{task.progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <AlertTriangle className="mx-auto size-9 text-slate-300" />
      <p className="mt-3 font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
      <RefreshCw className="size-5 animate-spin" />
      Đang tải dữ liệu…
    </div>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
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
