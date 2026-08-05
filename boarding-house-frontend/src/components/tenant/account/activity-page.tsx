"use client";
import { useState } from "react";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useAccountActivity } from "@/hooks/use-tenant-account";
import { accountDate, activityLabels, label } from "@/constants/tenant-account";
import { AccountLoading, AccountPageLayout, StatusPill } from "./account-ui";
import { EmptyState, ErrorState } from "@/components/shared/dashboard-ui";
export function ActivityPage() {
  const { user } = useAuth(),
    [page, setPage] = useState(0),
    query = useAccountActivity(user?.activeRole === "TENANT", page);
  if (query.isLoading) return <AccountLoading />;
  return (
    <AccountPageLayout
      title="Lịch sử hoạt động"
      description="Các hoạt động công khai liên quan đến tài khoản của bạn."
    >
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !query.data?.content.length ? (
        <EmptyState text="Chưa có lịch sử hoạt động." />
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {query.data.content.map((x) => (
            <article
              key={x.id}
              className="flex gap-4 border-b p-5 last:border-0"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700">
                <Activity className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black">
                    {label(activityLabels, x.action)}
                  </h2>
                  <StatusPill tone="green">Thành công</StatusPill>
                </div>
                <p className="mt-1 text-sm text-slate-600">{x.description}</p>
                <time
                  dateTime={x.createdAt}
                  className="mt-1 block text-xs text-slate-400"
                >
                  {accountDate(x.createdAt, true)}
                </time>
              </div>
            </article>
          ))}
        </section>
      )}
      {(query.data?.totalPages ?? 0) > 1 && (
        <div className="flex justify-center gap-3">
          <button
            disabled={page === 0}
            onClick={() => setPage((v) => v - 1)}
            className="rounded-xl border p-2 disabled:opacity-40"
            aria-label="Trang trước"
          >
            <ChevronLeft />
          </button>
          <span className="py-2 text-sm font-bold">
            Trang {page + 1}/{query.data?.totalPages}
          </span>
          <button
            disabled={page + 1 === (query.data?.totalPages ?? 0)}
            onClick={() => setPage((v) => v + 1)}
            className="rounded-xl border p-2 disabled:opacity-40"
            aria-label="Trang sau"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </AccountPageLayout>
  );
}
