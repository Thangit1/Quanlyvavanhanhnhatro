"use client";
import Link from "next/link";
import {
  CheckCircle2,
  KeyRound,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useAccountOverview } from "@/hooks/use-tenant-account";
import { accountDate } from "@/constants/tenant-account";
import { AccountLoading, AccountPageLayout, StatusPill } from "./account-ui";
import { ErrorState } from "@/components/shared/dashboard-ui";
export function SecurityPage() {
  const { user } = useAuth(),
    query = useAccountOverview(user?.activeRole === "TENANT");
  if (query.isLoading) return <AccountLoading />;
  if (query.isError || !query.data)
    return (
      <AccountPageLayout
        title="Bảo mật tài khoản"
        description="Kiểm tra mật khẩu và các phiên đăng nhập."
      >
        <ErrorState onRetry={() => void query.refetch()} />
      </AccountPageLayout>
    );
  const x = query.data;
  return (
    <AccountPageLayout
      title="Bảo mật tài khoản"
      description="Kiểm tra mật khẩu và các phiên đăng nhập."
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <Card
          icon={KeyRound}
          title="Mật khẩu"
          value={
            x.security.passwordChangedAt
              ? `Đổi lần cuối ${accountDate(x.security.passwordChangedAt)}`
              : "Chưa có lịch sử thay đổi"
          }
          action="Đổi mật khẩu"
          href="/tenant/account/change-password"
        />
        <Card
          icon={MonitorSmartphone}
          title="Phiên đăng nhập"
          value={`${x.security.activeSessionCount} phiên đang hoạt động`}
          action="Quản lý phiên"
          href="/tenant/account/sessions"
        />
        <Card
          icon={CheckCircle2}
          title="Email"
          value={x.account.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
        />
        <Card
          icon={CheckCircle2}
          title="Số điện thoại"
          value={x.account.phoneVerified ? "Đã xác minh" : "Chưa xác minh"}
        />
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 size-6 text-amber-600" />
          <div>
            <h2 className="font-black">Xác thực hai bước</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Backend hiện chưa hỗ trợ thiết lập và xác minh 2FA, vì vậy chức
              năng này chưa được bật để tránh tạo cảm giác bảo mật giả.
            </p>
            <StatusPill tone="slate">Chưa được hệ thống hỗ trợ</StatusPill>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-black">Thiết bị hiện tại</h2>
        <p className="mt-2 text-sm text-slate-600">
          {x.security.currentDevice}
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
          <ShieldCheck className="size-4" />
          Nếu thấy hoạt động lạ, hãy đổi mật khẩu và thu hồi các phiên khác.
        </p>
      </section>
    </AccountPageLayout>
  );
}
function Card({
  icon: Icon,
  title,
  value,
  action,
  href,
}: {
  icon: typeof KeyRound;
  title: string;
  value: string;
  action?: string;
  href?: string;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <Icon className="size-6 text-blue-600" />
      <h2 className="mt-3 font-black">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{value}</p>
      {href && (
        <Link href={href} className="mt-4 inline-block font-bold text-blue-700">
          {action} →
        </Link>
      )}
    </article>
  );
}
