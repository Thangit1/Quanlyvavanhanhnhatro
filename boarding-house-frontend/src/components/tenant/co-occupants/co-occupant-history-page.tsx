"use client";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useCoOccupantHistory } from "@/hooks/use-tenant-co-occupants";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import { formatDate } from "@/lib/format";
import { Badge } from "./co-occupant-ui";
export function CoOccupantHistoryPage() {
  const { user } = useAuth();
  const q = useCoOccupantHistory(user?.activeRole === "TENANT");
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void q.refetch()} />
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 pb-28 sm:p-6">
      <Link
        href="/tenant/co-occupants"
        className="inline-flex items-center gap-2 font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Người ở cùng
      </Link>
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <History className="text-blue-600" />
          Lịch sử cư trú
        </h1>
        <p className="mt-1 text-slate-500">
          Các lần cư trú đã kết thúc được lưu lại và không thể xóa.
        </p>
      </div>
      {q.data.content.length ? (
        <div className="space-y-3">
          {q.data.content.map((x) => (
            <article
              key={x.id}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">
                    {x.propertyName} · Phòng {x.roomCode}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(x.moveInDate)} – {formatDate(x.moveOutDate)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Quan hệ: {x.relationship || "Không ghi nhận"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge kind="role" value={x.residenceRole} />
                  <Badge kind="residence" value={x.status} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState text="Chưa có lịch sử cư trú." />
      )}
    </main>
  );
}
