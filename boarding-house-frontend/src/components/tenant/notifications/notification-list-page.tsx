"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useNotificationActions,
  useNotificationSummary,
  useTenantNotifications,
} from "@/hooks/use-tenant-notifications";
import {
  notificationCategories,
  notificationSeverities,
  relativeNotificationTime,
} from "@/constants/tenant-notification";
import type {
  NotificationQuery,
  TenantNotification,
} from "@/types/tenant-notification";
import { EmptyState, ErrorState } from "@/components/shared/dashboard-ui";
import {
  categoryLabel,
  fullNotificationTime,
  NotificationIcon,
  SeverityBadge,
} from "./notification-ui";

const tabs = [
  { id: "ALL", label: "Tất cả" },
  { id: "UNREAD", label: "Chưa đọc" },
  { id: "ACTION", label: "Cần xử lý" },
  { id: "INVOICE", label: "Hóa đơn" },
  { id: "MAINTENANCE", label: "Sửa chữa" },
  { id: "ANNOUNCEMENT", label: "Thông báo chung" },
  { id: "ARCHIVED", label: "Lưu trữ" },
] as const;

export function NotificationListPage() {
  const { user } = useAuth();
  const enabled = user?.activeRole === "TENANT";
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("ALL"),
    [keyword, setKeyword] = useState(""),
    [category, setCategory] = useState(""),
    [severity, setSeverity] = useState(""),
    [readStatus, setReadStatus] = useState(""),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<number[]>([]),
    [feedback, setFeedback] = useState("");
  const query = useMemo<NotificationQuery>(
    () => ({
      keyword,
      category: (
        ["INVOICE", "MAINTENANCE", "ANNOUNCEMENT"] as string[]
      ).includes(tab)
        ? tab
        : category,
      severity,
      readStatus: tab === "UNREAD" ? "UNREAD" : readStatus,
      requiresAction: tab === "ACTION" ? true : undefined,
      archived: tab === "ARCHIVED",
      sort,
      page,
      size: 12,
    }),
    [keyword, category, severity, readStatus, sort, page, tab],
  );
  const summary = useNotificationSummary(enabled),
    list = useTenantNotifications(enabled, query),
    actions = useNotificationActions();
  const chooseTab = (value: (typeof tabs)[number]["id"]) => {
    setTab(value);
    setPage(0);
    setSelected([]);
  };
  const bulk = (action: string) => {
    if (!selected.length) return;
    actions.bulk.mutate(
      { ids: selected, action },
      {
        onSuccess: () => {
          setFeedback("Đã cập nhật các thông báo đã chọn.");
          setSelected([]);
        },
        onError: () =>
          setFeedback("Không thể cập nhật thông báo. Vui lòng thử lại."),
      },
    );
  };
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            Trang chủ / Thông báo
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Trung tâm thông báo
          </h1>
          <p className="mt-1 text-slate-500">
            Theo dõi hóa đơn, hợp đồng và những việc cần bạn xử lý.
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
            href="/tenant/notifications/settings"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white"
          >
            <Settings2 className="size-4" />
            Cài đặt
          </Link>
        </div>
      </div>
      {summary.isError ? (
        <ErrorState onRetry={() => void summary.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard title="Chưa đọc" value={summary.data?.totalUnread} />
          <SummaryCard
            title="Cần xử lý"
            value={summary.data?.requiresActionCount}
          />
          <SummaryCard
            title="Hóa đơn"
            value={summary.data?.invoiceNotificationCount}
          />
          <SummaryCard
            title="Sửa chữa"
            value={summary.data?.maintenanceNotificationCount}
          />
          <SummaryCard
            title="Trong tháng"
            value={summary.data?.currentMonthNotificationCount}
          />
        </div>
      )}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((x) => (
            <button
              key={x.id}
              onClick={() => chooseTab(x.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${tab === x.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <label className="relative">
            <Search className="absolute left-3 top-3 size-5 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(0);
              }}
              aria-label="Tìm kiếm thông báo"
              placeholder="Mã, tiêu đề hoặc nội dung..."
              className="w-full rounded-xl border py-2.5 pl-10 pr-3"
            />
          </label>
          <select
            aria-label="Danh mục"
            value={category}
            disabled={(
              ["INVOICE", "MAINTENANCE", "ANNOUNCEMENT"] as string[]
            ).includes(tab)}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border px-3 disabled:bg-slate-100"
          >
            <option value="">Tất cả danh mục</option>
            {Object.entries(notificationCategories).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <select
            aria-label="Mức độ"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border px-3"
          >
            <option value="">Tất cả mức độ</option>
            {Object.entries(notificationSeverities).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <select
            aria-label="Sắp xếp"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border px-3"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="severity">Ưu tiên cao</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <select
              aria-label="Trạng thái đọc"
              value={readStatus}
              onChange={(e) => {
                setReadStatus(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Đã đọc và chưa đọc</option>
              <option value="UNREAD">Chưa đọc</option>
              <option value="READ">Đã đọc</option>
            </select>
            {(keyword || category || severity || readStatus) && (
              <button
                onClick={() => {
                  setKeyword("");
                  setCategory("");
                  setSeverity("");
                  setReadStatus("");
                  setPage(0);
                }}
                className="text-sm font-bold text-blue-600"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
          <button
            disabled={!summary.data?.totalUnread || actions.allRead.isPending}
            onClick={() =>
              actions.allRead.mutate(undefined, {
                onSuccess: () => setFeedback("Đã đánh dấu tất cả là đã đọc."),
              })
            }
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 disabled:opacity-40"
          >
            <CheckCheck className="size-4" />
            Đọc tất cả
          </button>
        </div>
      </section>
      {selected.length > 0 && (
        <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 p-3 text-white shadow-xl">
          <b className="mr-auto">Đã chọn {selected.length}</b>
          <button
            onClick={() => bulk("MARK_READ")}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm"
          >
            Đánh dấu đã đọc
          </button>
          <button
            onClick={() => bulk("MARK_UNREAD")}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm"
          >
            Chưa đọc
          </button>
          <button
            onClick={() => bulk(tab === "ARCHIVED" ? "RESTORE" : "ARCHIVE")}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm"
          >
            {tab === "ARCHIVED" ? "Khôi phục" : "Lưu trữ"}
          </button>
        </div>
      )}
      {feedback && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800"
        >
          {feedback}
        </p>
      )}
      {list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : list.isLoading ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-slate-500">
          Đang tải thông báo...
        </div>
      ) : !list.data?.content.length ? (
        <EmptyState text="Không có thông báo phù hợp với bộ lọc." />
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex items-center border-b bg-slate-50 px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={selected.length === list.data.content.length}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? list.data!.content.map((x) => x.id) : [],
                  )
                }
              />
              Chọn trang này
            </label>
            <span className="ml-auto text-sm text-slate-500">
              {list.data.totalElements} thông báo
            </span>
          </div>
          {list.data.content.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              checked={selected.includes(item.id)}
              onCheck={(checked) =>
                setSelected((current) =>
                  checked
                    ? [...new Set([...current, item.id])]
                    : current.filter((id) => id !== item.id),
                )
              }
            />
          ))}
        </section>
      )}
      {(list.data?.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage((v) => v - 1)}
            className="rounded-lg border bg-white p-2 disabled:opacity-40"
            aria-label="Trang trước"
          >
            <ChevronLeft />
          </button>
          <span className="text-sm font-semibold">
            Trang {page + 1}/{list.data?.totalPages}
          </span>
          <button
            disabled={page + 1 === (list.data?.totalPages ?? 0)}
            onClick={() => setPage((v) => v + 1)}
            className="rounded-lg border bg-white p-2 disabled:opacity-40"
            aria-label="Trang sau"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </main>
  );
}
function SummaryCard({ title, value = 0 }: { title: string; value?: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
function NotificationRow({
  item,
  checked,
  onCheck,
}: {
  item: TenantNotification;
  checked: boolean;
  onCheck: (checked: boolean) => void;
}) {
  return (
    <article
      className={`flex gap-3 border-b p-4 last:border-0 hover:bg-slate-50 ${item.read ? "" : "bg-blue-50/50"}`}
    >
      <input
        type="checkbox"
        aria-label={`Chọn ${item.title}`}
        checked={checked}
        onChange={(e) => onCheck(e.target.checked)}
        className="mt-4 size-4"
      />
      <NotificationIcon category={item.category} severity={item.severity} />
      <Link
        href={`/tenant/notifications/${item.id}`}
        className="min-w-0 flex-1"
      >
        <div className="flex flex-wrap items-start gap-2">
          <h2
            className={`min-w-0 flex-1 ${item.read ? "font-semibold" : "font-black"}`}
          >
            {item.title}
          </h2>
          <SeverityBadge severity={item.severity} />
          {!item.read && (
            <span
              className="mt-2 size-2 rounded-full bg-blue-600"
              aria-label="Chưa đọc"
            />
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
          {item.summary}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{categoryLabel(item.category)}</span>
          {item.place?.roomCode && <span>Phòng {item.place.roomCode}</span>}
          <time
            title={fullNotificationTime(item.createdAt)}
            dateTime={item.createdAt}
          >
            {relativeNotificationTime(item.createdAt)}
          </time>
          {item.requiresAction && (
            <span className="font-bold text-amber-700">Cần xử lý</span>
          )}
          <span className="font-mono">{item.notificationCode}</span>
        </div>
      </Link>
      {item.archived && (
        <Archive
          className="mt-3 size-4 text-slate-400"
          aria-label="Đã lưu trữ"
        />
      )}
    </article>
  );
}
