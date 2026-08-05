"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, LoaderCircle, Mail } from "lucide-react";
import { Brand } from "@/components/auth/brand";
import { authService } from "@/services/auth.service";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Vui lòng nhập email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Email không đúng định dạng.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await authService.forgotPassword(normalized);
      setMessage(result.message);
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
        <Brand />
        <div className="mt-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-blue-100 text-blue-700">
            <Mail className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Quên mật khẩu?
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Nhập email để nhận hướng dẫn đặt lại mật khẩu.
          </p>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {message && (
            <div
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            >
              {message}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-semibold text-slate-700"
            >
              Email đăng nhập
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              disabled={loading}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <button
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white disabled:opacity-60"
          >
            {loading && <LoaderCircle className="size-5 animate-spin" />}Gửi yêu
            cầu
          </button>
        </form>
        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-2 font-semibold text-blue-700"
        >
          <ArrowLeft className="size-4" />
          Quay lại đăng nhập
        </Link>
        <p className="mt-5 text-center text-xs text-amber-700">
          Môi trường hiện tại chưa tích hợp dịch vụ gửi email.
        </p>
      </div>
    </main>
  );
}
