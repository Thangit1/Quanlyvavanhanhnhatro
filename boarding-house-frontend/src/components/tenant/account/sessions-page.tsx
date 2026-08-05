"use client";
import { useState } from "react";
import { Laptop, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useAccountActions,
  useTenantSessions,
} from "@/hooks/use-tenant-account";
import { accountDate } from "@/constants/tenant-account";
import {
  AccountLoading,
  AccountPageLayout,
  ConfirmDialog,
  StatusPill,
} from "./account-ui";
import { EmptyState, ErrorState } from "@/components/shared/dashboard-ui";
export function SessionsPage() {
  const { user } = useAuth(),
    query = useTenantSessions(user?.activeRole === "TENANT"),
    actions = useAccountActions(),
    [target, setTarget] = useState<number | "all" | null>(null);
  if (query.isLoading) return <AccountLoading />;
  const confirm = () => {
    if (target === "all")
      actions.revokeAll.mutate(true, { onSuccess: () => setTarget(null) });
    else if (typeof target === "number")
      actions.revokeSession.mutate(target, {
        onSuccess: () => setTarget(null),
      });
  };
  return (
    <AccountPageLayout
      title="Phiên đăng nhập"
      description="Kiểm tra và thu hồi các thiết bị đã đăng nhập vào tài khoản."
      actions={
        <button
          onClick={() => setTarget("all")}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-bold text-red-700"
        >
          Đăng xuất thiết bị khác
        </button>
      }
    >
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState text="Không có phiên đăng nhập nào." />
      ) : (
        <section className="space-y-3">
          {query.data.map((s) => (
            <article
              key={s.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
                {s.operatingSystem.includes("Android") ||
                s.operatingSystem.includes("iOS") ? (
                  <Smartphone />
                ) : (
                  <Laptop />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black">{s.deviceName}</h2>
                  {s.currentSession && (
                    <StatusPill tone="green">Thiết bị hiện tại</StatusPill>
                  )}
                  {!s.active && (
                    <StatusPill tone="slate">Đã hết phiên</StatusPill>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {s.maskedIpAddress} · Hoạt động{" "}
                  {accountDate(s.lastActiveAt, true)}
                </p>
                <p className="text-xs text-slate-400">
                  Đăng nhập {accountDate(s.createdAt, true)}
                </p>
              </div>
              {s.active && !s.currentSession && (
                <button
                  onClick={() => setTarget(s.id)}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold text-red-700"
                >
                  <LogOut className="size-4" />
                  Đăng xuất phiên
                </button>
              )}
              {s.currentSession && <ShieldCheck className="text-emerald-600" />}
            </article>
          ))}
        </section>
      )}
      <ConfirmDialog
        open={target !== null}
        title={
          target === "all"
            ? "Đăng xuất tất cả thiết bị khác?"
            : "Đăng xuất phiên này?"
        }
        description={
          target === "all"
            ? "Phiên hiện tại được giữ lại; các refresh token khác sẽ bị thu hồi."
            : "Thiết bị được chọn sẽ phải đăng nhập lại."
        }
        confirmLabel="Thu hồi phiên"
        danger
        busy={actions.revokeAll.isPending || actions.revokeSession.isPending}
        onClose={() => setTarget(null)}
        onConfirm={confirm}
      />
    </AccountPageLayout>
  );
}
