"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useNotificationActions,
  useRecentNotifications,
  useUnreadNotifications,
} from "@/hooks/use-tenant-notifications";
import {
  categoryIcon,
  relativeNotificationTime,
} from "@/constants/tenant-notification";
export function UnreadBadge({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const q = useUnreadNotifications(user?.activeRole === "TENANT");
  const count = Math.max(0, q.data?.unreadCount ?? 0);
  if (!count) return null;
  return (
    <span
      aria-label={`${count} thông báo chưa đọc`}
      className={`grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-5 text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const recent = useRecentNotifications(user?.activeRole === "TENANT" && open);
  const unread = useUnreadNotifications(user?.activeRole === "TENANT");
  const actions = useNotificationActions();
  return (
    <div className="relative">
      <button
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
        className="relative grid size-10 place-items-center rounded-full hover:bg-slate-100 focus:ring-4 focus:ring-blue-100"
      >
        <Bell className="size-5" />
        <UnreadBadge className="absolute -right-1 -top-1" />
      </button>
      {open && (
        <>
          <button
            aria-label="Đóng thông báo"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <section
            role="dialog"
            aria-label="Thông báo gần đây"
            className="fixed inset-x-3 top-16 z-40 max-h-[75vh] overflow-hidden rounded-2xl border bg-white shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96"
          >
            <header className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="font-black">Thông báo</h2>
                <p className="text-xs text-slate-500">
                  {unread.data?.unreadCount ?? 0} thông báo chưa đọc
                </p>
              </div>
              <button
                aria-label="Đóng"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="max-h-[55vh] overflow-y-auto">
              {recent.isLoading ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  Đang tải thông báo...
                </p>
              ) : recent.data?.length ? (
                recent.data.map((item) => {
                  const Icon = categoryIcon(item.category);
                  return (
                    <Link
                      key={item.id}
                      href={`/tenant/notifications/${item.id}`}
                      onClick={() => setOpen(false)}
                      className={`flex gap-3 border-b p-4 hover:bg-slate-50 ${item.read ? "bg-white" : "bg-blue-50/70"}`}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex gap-2">
                          <p
                            className={`line-clamp-1 flex-1 text-sm ${item.read ? "font-semibold" : "font-black"}`}
                          >
                            {item.title}
                          </p>
                          {!item.read && (
                            <span
                              aria-label="Thông báo chưa đọc"
                              className="mt-1 size-2 shrink-0 rounded-full bg-blue-600"
                            />
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {item.summary}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {relativeNotificationTime(item.createdAt)}
                        </p>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="p-8 text-center text-sm text-slate-500">
                  Bạn chưa có thông báo nào.
                </p>
              )}
            </div>
            <footer className="grid grid-cols-2 gap-2 border-t p-3">
              <button
                disabled={
                  !unread.data?.unreadCount || actions.allRead.isPending
                }
                onClick={() => actions.allRead.mutate()}
                className="inline-flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-bold text-blue-700 disabled:opacity-40"
              >
                <CheckCheck className="size-4" />
                Đọc tất cả
              </button>
              <Link
                href="/tenant/notifications"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-blue-600 px-2 py-2 text-center text-xs font-bold text-white"
              >
                Xem tất cả
              </Link>
            </footer>
          </section>
        </>
      )}
    </div>
  );
}
