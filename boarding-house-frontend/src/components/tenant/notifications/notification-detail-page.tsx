"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckCheck,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useNotificationActions,
  useTenantNotification,
} from "@/hooks/use-tenant-notifications";
import { safeNotificationRoute } from "@/constants/tenant-notification";
import { ErrorState } from "@/components/shared/dashboard-ui";
import {
  categoryLabel,
  fullNotificationTime,
  NotificationIcon,
  SeverityBadge,
} from "./notification-ui";

export function NotificationDetailPage() {
  const params = useParams<{ notificationId: string }>(),
    router = useRouter(),
    { user } = useAuth();
  const id = Number(params.notificationId),
    detail = useTenantNotification(user?.activeRole === "TENANT", id),
    actions = useNotificationActions(id);
  if (detail.isLoading)
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
          Đang tải thông báo...
        </div>
      </main>
    );
  if (detail.isError || !detail.data)
    return (
      <main className="mx-auto max-w-4xl p-6">
        <ErrorState onRetry={() => void detail.refetch()} />
      </main>
    );
  const item = detail.data;
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/tenant/notifications"
          className="inline-flex items-center gap-2 font-bold text-blue-700"
        >
          <ArrowLeft className="size-4" />
          Trở lại thông báo
        </Link>
        <div className="flex gap-2">
          {item.archived ? (
            <button
              onClick={() => actions.restore.mutate(id)}
              disabled={actions.restore.isPending}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-semibold"
            >
              <RotateCcw className="size-4" />
              Khôi phục
            </button>
          ) : (
            <button
              onClick={() =>
                actions.archive.mutate(id, {
                  onSuccess: () => router.push("/tenant/notifications"),
                })
              }
              disabled={actions.archive.isPending}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 font-semibold"
            >
              <Archive className="size-4" />
              Lưu trữ
            </button>
          )}
          {item.permissions.canMarkUnread && (
            <button
              onClick={() => actions.unread.mutate(id)}
              className="rounded-xl border bg-white px-4 py-2 font-semibold"
            >
              Đánh dấu chưa đọc
            </button>
          )}
        </div>
      </div>
      <article className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <header className="border-b bg-slate-50 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <NotificationIcon
              category={item.category}
              severity={item.severity}
              className="size-14"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={item.severity} />
                {item.requiresAction && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                    Cần xử lý
                  </span>
                )}
                {item.acknowledgedAt && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    Đã xác nhận
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">
                {item.title}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {categoryLabel(item.category)} ·{" "}
                <time dateTime={item.createdAt}>
                  {fullNotificationTime(item.createdAt)}
                </time>{" "}
                · <span className="font-mono">{item.notificationCode}</span>
              </p>
            </div>
          </div>
        </header>
        <div className="p-5 sm:p-7">
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
            {item.content}
          </div>
          {item.place && (item.place.propertyName || item.place.roomCode) && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
              <b>Địa điểm:</b>{" "}
              {[
                item.place.propertyName,
                item.place.roomCode && `Phòng ${item.place.roomCode}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            {item.actions.map((action, index) => {
              const href = safeNotificationRoute(action.type, item.reference);
              return href ? (
                <Link
                  key={`${action.type}-${index}`}
                  href={href}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold ${action.primary ? "bg-blue-600 text-white" : "border bg-white text-blue-700"}`}
                >
                  {action.label}
                  <ExternalLink className="size-4" />
                </Link>
              ) : null;
            })}
            {item.requiresAcknowledgement &&
              !item.acknowledgedAt &&
              item.permissions.canAcknowledge && (
                <button
                  onClick={() => actions.acknowledge.mutate(id)}
                  disabled={actions.acknowledge.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white"
                >
                  <CheckCheck className="size-4" />
                  Tôi đã hiểu và xác nhận
                </button>
              )}
          </div>
          {item.actions.length > 0 &&
            !item.actions.some((action) =>
              safeNotificationRoute(action.type, item.reference),
            ) && (
              <p className="mt-4 text-sm text-amber-700">
                Liên kết xử lý này chưa khả dụng. Dữ liệu thông báo vẫn được giữ
                nguyên.
              </p>
            )}
        </div>
      </article>
    </main>
  );
}
