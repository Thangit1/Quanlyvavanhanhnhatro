"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, UserRound } from "lucide-react";
import { ConfirmDialog } from "@/components/tenant/account/account-ui";
import { useAuth } from "@/providers/auth-provider";
import { roleLabel } from "@/types/auth";

export function AdminUserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    if (open) {
      document.addEventListener("pointerdown", closeOnOutsideClick);
      window.addEventListener("keydown", closeOnEscape);
    }
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!user) return null;

  const initial = user.fullName.trim().charAt(0).toUpperCase() || "U";

  const confirmLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          aria-label="Mở menu tài khoản"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="admin-user-menu"
          onClick={() => setOpen((value) => !value)}
          className="grid size-10 cursor-pointer place-items-center rounded-full bg-blue-100 font-bold text-blue-700 outline-none transition hover:bg-blue-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {initial}
        </button>

        {open && (
          <div
            id="admin-user-menu"
            role="menu"
            aria-label="Tài khoản người dùng"
            className="absolute right-0 top-full z-50 mt-2 w-[min(15rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10"
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                {initial}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-900">
                  {user.fullName}
                </span>
                <span className="block text-xs text-slate-500">
                  {roleLabel[user.activeRole]}
                </span>
              </span>
            </div>
            <div className="my-1 border-t border-slate-200" />
            <Link
              href="/admin/settings/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuItemClass}
            >
              <UserRound className="size-4.5" />
              Thông tin cá nhân
            </Link>
            <Link
              href="/forgot-password"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={menuItemClass}
            >
              <KeyRound className="size-4.5" />
              Đổi mật khẩu
            </Link>
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setConfirmingLogout(true);
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none"
            >
              <LogOut className="size-4.5" />
              Đăng xuất
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmingLogout}
        title="Đăng xuất"
        description="Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?"
        confirmLabel="Đăng xuất"
        danger
        busy={loggingOut}
        onClose={() => {
          if (!loggingOut) setConfirmingLogout(false);
        }}
        onConfirm={() => void confirmLogout()}
      />
    </>
  );
}

const menuItemClass =
  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none";
