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
        <div className="surface-card p-10 text-center text-muted-foreground">
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
          className="inline-flex items-center gap-2 font-bold text-link"
        >
          <ArrowLeft className="size-4" />
          Trở lại thông báo
        </Link>
        <div className="flex gap-2">
          {item.archived ? (
            <button
              onClick={() => actions.restore.mutate(id)}
              disabled={actions.restore.isPending}
              className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 font-semibold"
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
              className="inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2 font-semibold"
            >
              <Archive className="size-4" />
              Lưu trữ
            </button>
          )}
          {item.permissions.canMarkUnread && (
            <button
              onClick={() => actions.unread.mutate(id)}
              className="rounded-xl border bg-card px-4 py-2 font-semibold"
            >
              Đánh dấu chưa đọc
            </button>
          )}
        </div>
      </div>
      <article className="overflow-hidden rounded-3xl border bg-card shadow-card">
        <header className="border-b bg-muted p-5 sm:p-7">
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
                  <span className="rounded-full bg-warning-muted px-2.5 py-1 text-xs font-bold text-warning">
                    Cần xử lý
                  </span>
                )}
                {item.acknowledgedAt && (
                  <span className="rounded-full bg-success-muted px-2.5 py-1 text-xs font-bold text-success">
                    Đã xác nhận
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-black text-foreground sm:text-3xl">
                {item.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
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
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-secondary-foreground">
            {item.content}
          </div>
          {item.place && (item.place.propertyName || item.place.roomCode) && (
            <div className="mt-6 rounded-xl bg-muted p-4 text-sm">
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
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold ${action.primary ? "bg-primary hover:bg-primary-hover text-white" : "border bg-card text-link"}`}
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
                  className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 font-bold text-white"
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
              <p className="mt-4 text-sm text-warning">
                Liên kết xử lý này chưa khả dụng. Dữ liệu thông báo vẫn được giữ
                nguyên.
              </p>
            )}
        </div>
      </article>
    </main>
  );
}
