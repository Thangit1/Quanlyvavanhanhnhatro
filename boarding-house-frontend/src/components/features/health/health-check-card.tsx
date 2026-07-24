"use client";

import { Activity, CircleAlert, CircleCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHealth } from "@/hooks/use-health";

export function HealthCheckCard() {
  const healthQuery = useHealth();

  const isHealthy = healthQuery.data?.data.status === "UP";

  return (
    <section className="max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-5 flex items-center gap-3">
        <span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300">
          <Activity aria-hidden="true" className="size-6" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Kiểm tra kết nối backend</h2>
          <p className="text-sm text-slate-400">GET /api/v1/health</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
        {healthQuery.isPending ? (
          <RefreshCw
            aria-hidden="true"
            className="size-5 animate-spin text-sky-300"
          />
        ) : isHealthy ? (
          <CircleCheck aria-hidden="true" className="size-5 text-emerald-300" />
        ) : (
          <CircleAlert aria-hidden="true" className="size-5 text-amber-300" />
        )}

        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {healthQuery.isPending
              ? "Đang kết nối..."
              : isHealthy
                ? "Backend đang hoạt động"
                : "Chưa kết nối được backend"}
          </p>
          <p className="truncate text-sm text-slate-400">
            {healthQuery.data?.data.application ??
              (healthQuery.error instanceof Error
                ? healthQuery.error.message
                : "Hãy khởi động backend và kiểm tra cấu hình môi trường.")}
          </p>
        </div>

        {!healthQuery.isPending && !isHealthy && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => healthQuery.refetch()}
          >
            Thử lại
          </Button>
        )}
      </div>
    </section>
  );
}
