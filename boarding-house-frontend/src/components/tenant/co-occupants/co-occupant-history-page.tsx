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
        className="inline-flex items-center gap-2 font-semibold text-secondary-foreground"
      >
        <ArrowLeft className="size-4" />
        Người ở cùng
      </Link>
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <History className="text-link" />
          Lịch sử cư trú
        </h1>
        <p className="mt-1 text-muted-foreground">
          Các lần cư trú đã kết thúc được lưu lại và không thể xóa.
        </p>
      </div>
      {q.data.content.length ? (
        <div className="space-y-3">
          {q.data.content.map((x) => (
            <article
              key={x.id}
              className="surface-card p-5 sm:p-6 "
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">
                    {x.propertyName} · Phòng {x.roomCode}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(x.moveInDate)} – {formatDate(x.moveOutDate)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
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
