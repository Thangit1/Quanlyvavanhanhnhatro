"use client";
import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageCircleMore,
  Plus,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useMaintenanceSummary,
  useTenantMaintenance,
} from "@/hooks/use-tenant-maintenance";
import { categories } from "@/constants/tenant-maintenance";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import {
  PriorityBadge,
  StatusBadge,
  areaLabel,
  categoryLabel,
  fmtDate,
} from "./maintenance-ui";
const tabs = [
  ["ALL", "Tất cả"],
  ["ACTIVE", "Đang xử lý"],
  ["NEEDS_RESPONSE", "Cần tôi phản hồi"],
  ["INSPECTION", "Chờ xác nhận"],
  ["DONE", "Đã hoàn thành"],
  ["CANCELLED", "Đã hủy"],
];
export function MaintenanceListPage() {
  const { user } = useAuth();
  const enabled = user?.activeRole === "TENANT";
  const [status, setStatus] = useState("ALL"),
    [keyword, setKeyword] = useState(""),
    [category, setCategory] = useState(""),
    [priority, setPriority] = useState(""),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(0);
  const summary = useMaintenanceSummary(enabled);
  const list = useTenantMaintenance(enabled, {
    status,
    keyword,
    category,
    priority,
    sort,
    page,
    size: 10,
  });
  if (summary.isLoading || list.isLoading) return <PageLoading />;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">
            Trang chủ / Yêu cầu sửa chữa
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Yêu cầu sửa chữa
          </h1>
          <p className="mt-1 text-slate-500">
            Gửi và theo dõi tình trạng xử lý các sự cố trong phòng của bạn.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void summary.refetch();
              void list.refetch();
            }}
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-semibold"
          >
            <RefreshCw className="size-4" />
            Làm mới
          </button>
          <Link
            href="/tenant/maintenance/new"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white"
          >
            <Plus className="size-4" />
            Gửi yêu cầu mới
          </Link>
        </div>
      </div>
      {summary.isError ? (
        <ErrorState onRetry={() => void summary.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card
            icon={Wrench}
            title="Đang mở"
            value={summary.data?.openRequestCount ?? 0}
          />
          <Card
            icon={Clock3}
            title="Đang xử lý"
            value={summary.data?.inProgressRequestCount ?? 0}
          />
          <Card
            icon={MessageCircleMore}
            title="Cần phản hồi"
            value={summary.data?.needsTenantResponseCount ?? 0}
          />
          <Card
            icon={AlertCircle}
            title="Chờ xác nhận"
            value={summary.data?.inspectionPendingCount ?? 0}
          />
          <Card
            icon={CheckCircle2}
            title="Hoàn thành tháng này"
            value={summary.data?.resolvedThisMonthCount ?? 0}
          />
        </div>
      )}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([v, t]) => (
            <button
              key={v}
              onClick={() => {
                setStatus(v);
                setPage(0);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${status === v ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="absolute left-3 top-3 size-5 text-slate-400" />
            <input
              aria-label="Tìm kiếm"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(0);
              }}
              placeholder="Mã, tiêu đề hoặc nội dung..."
              className="w-full rounded-xl border py-2.5 pl-10 pr-3"
            />
          </label>
          <select
            aria-label="Loại sự cố"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border px-3"
          >
            <option value="">Tất cả loại sự cố</option>
            {categories.map((x) => (
              <option key={x[0]} value={x[0]}>
                {x[1]}
              </option>
            ))}
          </select>
          <select
            aria-label="Mức độ"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border px-3"
          >
            <option value="">Tất cả mức độ</option>
            <option value="LOW">Thấp</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HIGH">Cao</option>
            <option value="URGENT">Khẩn cấp</option>
          </select>
          <select
            aria-label="Sắp xếp"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border px-3"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="updated">Cập nhật gần nhất</option>
            <option value="priority">Mức độ cao nhất</option>
            <option value="schedule">Lịch hẹn gần nhất</option>
          </select>
        </div>
        {(keyword || category || priority || status !== "ALL") && (
          <button
            onClick={() => {
              setKeyword("");
              setCategory("");
              setPriority("");
              setStatus("ALL");
              setPage(0);
            }}
            className="mt-3 text-sm font-semibold text-blue-600"
          >
            Xóa bộ lọc
          </button>
        )}
      </section>
      {list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.content.length ? (
        <EmptyState text="Bạn chưa có yêu cầu sửa chữa phù hợp." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.data.content.map((x) => (
            <article
              key={x.id}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-blue-600">
                    {x.requestCode}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {x.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {categoryLabel(x.category)} · Phòng {x.roomCode} ·{" "}
                    {areaLabel(x.areaCode)}
                  </p>
                </div>
                <PriorityBadge priority={x.priority} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusBadge status={x.status} />
                <span className="text-xs text-slate-500">
                  Gửi {fmtDate(x.createdAt, true)}
                </span>
              </div>
              {x.scheduledAt && (
                <p className="mt-3 rounded-lg bg-blue-50 p-2 text-sm text-blue-800">
                  Lịch hẹn: <b>{fmtDate(x.scheduledAt, true)}</b>
                </p>
              )}
              {x.technicianName && (
                <p className="mt-2 text-sm text-slate-600">
                  Phụ trách: <b>{x.technicianName}</b>
                </p>
              )}
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-slate-500">
                  Cập nhật {fmtDate(x.updatedAt, true)}
                </span>
                <Link
                  href={`/tenant/maintenance/${x.id}`}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Xem chi tiết
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      {(list.data?.totalPages ?? 0) > 1 && (
        <div className="flex justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage((v) => v - 1)}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
          >
            Trang trước
          </button>
          <span className="py-2">
            {page + 1}/{list.data?.totalPages}
          </span>
          <button
            disabled={page + 1 === list.data?.totalPages}
            onClick={() => setPage((v) => v + 1)}
            className="rounded-lg border px-4 py-2 disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      )}
    </main>
  );
}
function Card({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Wrench;
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <Icon className="size-5 text-blue-600" />
      <p className="mt-2 text-sm text-slate-500">{title}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}
