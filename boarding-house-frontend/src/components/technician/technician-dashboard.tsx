"use client";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ClipboardList,
  PackageCheck as PackageClock,
  ShieldAlert,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { useTechnicianDashboard } from "@/hooks/use-technician";
import {
  Empty,
  ErrorState,
  Loading,
  Page,
  TaskCard,
} from "@/components/technician/technician-ui";
export function TechnicianDashboard() {
  const q = useTechnicianDashboard();
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data)
    return (
      <Page title="Tổng quan">
        <ErrorState retry={() => void q.refetch()} />
      </Page>
    );
  const d = q.data;
  const cards = [
    ["Hôm nay", d.summary.todayTaskCount, ClipboardList, "text-link"],
    ["Đang xử lý", d.summary.inProgressTaskCount, Clock3, "text-indigo-600"],
    ["Khẩn cấp", d.summary.urgentTaskCount, ShieldAlert, "text-danger"],
    ["Quá SLA", d.summary.overdueTaskCount, TimerReset, "text-orange-600"],
    [
      "Chờ vật tư",
      d.summary.waitingPartsTaskCount,
      PackageClock,
      "text-warning",
    ],
    [
      "Hoàn thành tháng",
      d.summary.completedThisMonthCount,
      CheckCircle2,
      "text-success",
    ],
  ] as const;
  return (
    <Page
      title={`Chào ${d.technician.fullName}`}
      description={`${d.technician.employeeCode} · ${d.technician.workingStatus}`}
      actions={
        <Link
          href="/technician/tasks"
          className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-sm font-semibold text-white"
        >
          Xem công việc
        </Link>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(([label, value, Icon, tone]) => (
          <article
            key={label}
            className="surface-card p-4 "
          >
            <Icon className={`size-5 ${tone}`} />
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-black text-foreground">{value}</p>
          </article>
        ))}
      </section>
      {d.aiAvailable ? (
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-violet-800">
            <Sparkles className="size-5" />
            SmartHome AI hỗ trợ kỹ thuật
          </p>
          <p className="mt-1 text-sm text-violet-700">
            Gợi ý AI chỉ mang tính tham khảo và không tự thay đổi trạng thái
            công việc.
          </p>
        </section>
      ) : (
        <section className="surface-card p-4 text-sm text-secondary-foreground">
          <p className="font-semibold text-foreground">
            SmartHome AI hỗ trợ kỹ thuật
          </p>
          <p className="mt-1">
            Chưa khả dụng vì backend chưa cấu hình nhà cung cấp AI. Hệ thống
            không tạo gợi ý giả.
          </p>
        </section>
      )}
      {d.currentTask && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-foreground">
            Công việc đang xử lý
          </h2>
          <TaskCard task={d.currentTask} />
        </section>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Lịch công việc tiếp theo</h2>
            <Link
              href="/technician/calendar"
              className="text-sm font-semibold text-link"
            >
              Mở lịch
            </Link>
          </div>
          <div className="grid gap-3">
            {d.nextTasks.length ? (
              d.nextTasks.map((x) => <TaskCard key={x.id} task={x} />)
            ) : (
              <Empty title="Chưa có lịch tiếp theo" />
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl border border-danger-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-bold text-danger">
              <ShieldAlert className="size-5" />
              Ưu tiên khẩn cấp
            </h2>
            <div className="mt-4 space-y-3">
              {d.urgentTasks.length ? (
                d.urgentTasks.map((x) => (
                  <Link
                    className="block rounded-xl bg-danger-muted p-3 text-sm font-semibold text-danger"
                    key={x.id}
                    href={`/technician/tasks/${x.id}`}
                  >
                    {x.title}
                    <span className="mt-1 block text-xs font-normal">
                      {x.property.name}
                      {x.room ? ` · ${x.room.name}` : ""}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Không có công việc khẩn cấp.
                </p>
              )}
            </div>
          </section>
          <section className="surface-card p-5 sm:p-6">
            <h2 className="font-bold">Việc cần chú ý</h2>
            <div className="mt-3 space-y-2">
              {d.pendingActions.length ? (
                d.pendingActions.map((x) => (
                  <p key={x} className="flex gap-2 text-sm text-secondary-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                    {x}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Không có tác vụ tồn đọng.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </Page>
  );
}
