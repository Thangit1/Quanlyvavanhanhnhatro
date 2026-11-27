"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Brand } from "@/components/auth/brand";
import { PasswordInput } from "@/components/auth/password-input";
import { authService } from "@/services/auth.service";
import { authErrorMessage } from "@/services/auth-error";
import { useAuth } from "@/providers/auth-provider";

export default function ResetPasswordPage() {
  const { discardSession, isBootstrapping } = useAuth();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const capturedToken = useRef<string | null>(null);
  useEffect(() => {
    const value =
      capturedToken.current ??
      new URLSearchParams(window.location.hash.slice(1)).get("token") ??
      "";
    capturedToken.current = value;
    // Remove the bearer secret from the address bar/history; retain it only in component memory.
    window.history.replaceState(null, "", window.location.pathname);
    const timer = window.setTimeout(() => {
      setToken(value);
      if (!/^[A-Za-z0-9_-]{43}$/.test(value))
        setError("Liên kết không hợp lệ. Vui lòng yêu cầu liên kết mới.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      new TextEncoder().encode(password).length > 72
    ) {
      setError("Mật khẩu cần ít nhất 8 ký tự, có chữ và số, tối đa 72 byte.");
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setLoading(true);
    try {
      const result = await authService.resetPassword(
        token,
        password,
        confirmation,
      );
      discardSession();
      setMessage(result.message);
      setToken("");
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-muted px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
        <Brand />
        <h1 className="mt-8 text-2xl font-bold">Đặt lại mật khẩu</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Liên kết chỉ sử dụng một lần và có hiệu lực trong 15 phút.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-danger">
            {error}
          </p>
        )}
        {message ? (
          <p role="status" className="mt-4 text-green-700">
            {message}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block" htmlFor="new-password">
              Mật khẩu mới
            </label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="block" htmlFor="confirm-password">
              Xác nhận mật khẩu
            </label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              required
              disabled={loading}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <button
              disabled={
                isBootstrapping || loading || !/^[A-Za-z0-9_-]{43}$/.test(token)
              }
              className="h-12 w-full rounded-xl bg-primary font-bold text-white disabled:opacity-60"
            >
              {loading ? "Đang lưu…" : "Lưu mật khẩu mới"}
            </button>
          </form>
        )}
        <Link href="/login" className="mt-6 block text-link">
          Quay lại đăng nhập
        </Link>
        <Link href="/forgot-password" className="mt-3 block text-link">
          Yêu cầu liên kết mới
        </Link>
      </div>
    </main>
  );
}
