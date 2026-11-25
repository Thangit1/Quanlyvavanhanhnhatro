"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { useTechnicianTasks } from "@/hooks/use-technician";
import {
  Empty,
  ErrorState,
  Loading,
  Page,
  TaskCard,
} from "@/components/technician/technician-ui";
import { STATUS_LABEL } from "@/constants/technician";
import type { TaskFilters } from "@/types/technician";
export function TechnicianTaskList() {
  const [filters, setFilters] = useState<TaskFilters>({
    page: 0,
    size: 20,
    sort: "schedule",
  });
  const q = useTechnicianTasks(filters);
  const set = (
    key: keyof TaskFilters,
    value: string | boolean | number | undefined,
  ) => setFilters((x) => ({ ...x, [key]: value || undefined, page: 0 }));
  return (
    <Page
      title="Công việc của tôi"
      description="Chỉ hiển thị công việc bạn được phân công chính hoặc hỗ trợ."
    >
      <section className="surface-card p-4 ">
        <div className="grid gap-3 lg:grid-cols-[2fr_repeat(3,1fr)]">
          <label className="relative">
            <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
            <input
              value={filters.keyword ?? ""}
              onChange={(e) => set("keyword", e.target.value)}
              placeholder="Mã, tiêu đề, khu trọ, phòng…"
              className="min-h-11 w-full rounded-xl border border-input pl-10 pr-3 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring focus:ring-4 focus:ring-ring"
            />
          </label>
          <Select
            value={filters.status ?? ""}
            onChange={(v) => set("status", v)}
            label="Tất cả trạng thái"
            options={Object.entries(STATUS_LABEL)}
          />
          <Select
            value={filters.priority ?? ""}
            onChange={(v) => set("priority", v)}
            label="Tất cả mức độ"
            options={[
              ["URGENT", "Khẩn cấp"],
              ["HIGH", "Cao"],
              ["MEDIUM", "Trung bình"],
              ["LOW", "Thấp"],
            ]}
          />
          <Select
            value={filters.taskType ?? ""}
            onChange={(v) => set("taskType", v)}
            label="Tất cả loại việc"
            options={[
              ["CORRECTIVE", "Sửa chữa"],
              ["PREVENTIVE", "Định kỳ"],
              ["INSPECTION", "Kiểm tra"],
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setFilters({ page: 0, size: 20, sort: "schedule" })}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-link hover:bg-accent"
          >
            <X className="size-4" />
            Xóa bộ lọc
          </button>
          <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary-foreground">
            <input
              type="checkbox"
              checked={filters.overdue ?? false}
              onChange={(e) => set("overdue", e.target.checked || undefined)}
            />
            Chỉ quá SLA
          </label>
        </div>
      </section>
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data.content.length ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {q.data.content.map((x) => (
              <TaskCard key={x.id} task={x} />
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{q.data.totalElements} công việc</span>
            <div className="flex gap-2">
              <button
                disabled={q.data.page === 0}
                onClick={() =>
                  setFilters((x) => ({
                    ...x,
                    page: Math.max(0, (x.page ?? 0) - 1),
                  }))
                }
                className="rounded-lg border px-3 py-2 disabled:opacity-40"
              >
                Trước
              </button>
              <span className="px-2 py-2">
                {q.data.page + 1}/{Math.max(1, q.data.totalPages)}
              </span>
              <button
                disabled={q.data.page + 1 >= q.data.totalPages}
                onClick={() =>
                  setFilters((x) => ({ ...x, page: (x.page ?? 0) + 1 }))
                }
                className="rounded-lg border px-3 py-2 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          title="Không có công việc phù hợp"
          description="Thử thay đổi bộ lọc hoặc chờ quản lý phân công."
        />
      )}
    </Page>
  );
}
function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (x: string) => void;
  label: string;
  options: string[][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-11 rounded-xl border border-input bg-card px-3 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring"
    >
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
