"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LoaderCircle, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { roleHome, roleLabel, type Role } from "@/types/auth";

export function ProtectedPage({
  allowedRole,
  title,
  children,
}: {
  allowedRole: Role;
  title: string;
  children?: React.ReactNode;
}) {
  const { user, isBootstrapping, logout } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (isBootstrapping) return;
    if (!user)
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (user.activeRole !== allowedRole) router.replace("/403");
  }, [allowedRole, isBootstrapping, pathname, router, user]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = sessionStorage.getItem("auth:notice");
      if (value) {
        setNotice(value);
        sessionStorage.removeItem("auth:notice");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (isBootstrapping || !user || user.activeRole !== allowedRole)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <LoaderCircle className="size-6 animate-spin text-blue-600" />
          Đang kiểm tra phiên đăng nhập...
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button
            onClick={() => router.push(roleHome[user.activeRole])}
            className="flex items-center gap-2 font-bold text-blue-700"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white">
              <Building2 className="size-5" />
            </span>
            SmartHome AI
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">
                {user.fullName}
              </p>
              <p className="text-xs text-slate-500">
                {roleLabel[user.activeRole]} · {user.email}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-blue-100 text-blue-700">
              <UserRound className="size-5" />
            </span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Bạn có chắc chắn muốn đăng xuất không?"))
                  void logout();
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {notice}
          </div>
        )}
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
          {roleLabel[user.activeRole]}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {children ?? (
            <p className="text-slate-600">
              Phiên đăng nhập của bạn đã được xác thực và phân quyền an toàn.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
