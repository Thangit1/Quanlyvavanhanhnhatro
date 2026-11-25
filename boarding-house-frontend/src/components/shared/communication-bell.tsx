"use client";
import Link from "next/link";
import { WebPushPreferences } from "./web-push-preferences";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
export type CommunicationRow = Record<string, string | number | boolean | null>;
export function communicationPath(role?: string) {
  return role === "TENANT"
    ? "/tenant/notifications"
    : role === "TECHNICIAN"
      ? "/technician/notifications"
      : role === "ACCOUNTANT"
        ? "/accountant/notifications"
        : "/admin/communications";
}
export function useCommunicationUnread() {
  return useScopedQuery({
    queryKey: ["communications-unread"],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<{ unreadCount: number }>>(
          "/communications/unread",
          { signal },
        )
      ).data.data,
    refetchInterval: 60000,
  });
}
export function CommunicationBadge({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const q = useCommunicationUnread();
  if (!user || q.isError || !q.data?.unreadCount) return null;
  return (
    <span
      aria-label={`${q.data.unreadCount} thông báo chưa đọc`}
      className={`rounded-full bg-red-600 px-1.5 text-xs font-bold text-white ${className}`}
    >
      {q.data.unreadCount > 99 ? "99+" : q.data.unreadCount}
    </span>
  );
}
export function CommunicationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const unread = useCommunicationUnread();
  const recent = useScopedQuery({
    queryKey: ["communications-recent"],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<{ rows: CommunicationRow[] }>>(
          "/communications/inbox",
          { params: { page: 0, size: 5 }, signal },
        )
      ).data.data,
    enabled: open,
    refetchInterval: 60000,
  });
  if (!user) return null;
  return (
    <div className="relative">
      <button
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative grid size-10 place-items-center rounded-full border border-border bg-card"
      >
        <Bell className="size-5" />
        {!unread.isError && !!unread.data?.unreadCount && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs text-white">
            {unread.data.unreadCount > 99 ? "99+" : unread.data.unreadCount}
          </span>
        )}
        {unread.isError && (
          <span
            title="Không tải được số chưa đọc"
            className="absolute right-0 top-0 size-2 rounded-full bg-amber-500"
          />
        )}
      </button>
      {open && (
        <>
          <button
            aria-label="Đóng thông báo"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30"
          />
          <section
            role="dialog"
            aria-label="Thông báo gần đây"
            className="fixed inset-x-3 top-16 z-40 max-h-[75vh] overflow-auto surface-card p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
          >
            <h2 className="font-bold">Thông báo</h2>
            <p className="text-xs text-muted-foreground">
              {unread.isError
                ? "Không tải được số chưa đọc"
                : unread.isLoading
                  ? "Đang tải…"
                  : `${unread.data?.unreadCount ?? 0} chưa đọc`}
            </p>
            {recent.isError ? (
              <p role="alert" className="my-4 text-sm text-danger">
                {apiErrorMessage(recent.error)}{" "}
                <button onClick={() => void recent.refetch()}>Thử lại</button>
              </p>
            ) : recent.isLoading ? (
              <p className="p-4">Đang tải…</p>
            ) : recent.data?.rows.length ? (
              recent.data.rows.map((r) => (
                <Link
                  key={String(r.id)}
                  href={communicationPath(user.activeRole)}
                  onClick={() => setOpen(false)}
                  className={`my-2 block rounded-xl p-3 ${r.read_at ? "bg-muted" : "bg-accent"}`}
                >
                  <b className="text-sm">{String(r.title)}</b>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {String(r.content)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Chưa có thông báo.
              </p>
            )}
            <Link
              href={communicationPath(user.activeRole)}
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-xl bg-primary hover:bg-primary-hover p-3 text-center text-sm font-semibold text-white"
            >
              Xem tất cả
            </Link>
            <WebPushPreferences />
          </section>
        </>
      )}
    </div>
  );
}
