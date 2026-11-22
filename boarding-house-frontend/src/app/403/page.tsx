"use client";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { roleHome } from "@/types/auth";
export default function ForbiddenPage() {
  const { user } = useAuth();
  return (
    <main className="grid min-h-screen place-items-center bg-muted px-4">
      <div className="max-w-md text-center">
        <ShieldX className="mx-auto size-16 text-link" />
        <h1 className="mt-5 text-3xl font-bold text-foreground">
          Không có quyền truy cập
        </h1>
        <p className="mt-3 text-secondary-foreground">
          Tài khoản của bạn không được phép truy cập khu vực này.
        </p>
        <Link
          href={user ? roleHome[user.activeRole] : "/login"}
          className="mt-6 inline-flex rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 font-semibold text-white"
        >
          Quay về trang phù hợp
        </Link>
      </div>
    </main>
  );
}
