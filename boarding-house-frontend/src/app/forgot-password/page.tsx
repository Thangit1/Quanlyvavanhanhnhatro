"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, LoaderCircle, Mail } from "lucide-react";
import { Brand } from "@/components/auth/brand";
import { authService } from "@/services/auth.service";
import { authErrorMessage } from "@/services/auth-error";

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
    setMessage(null);
    try {
      const result = await authService.forgotPassword(normalized);
      setMessage(result.message);
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-muted px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl sm:p-9">
        <Brand />
        <div className="mt-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-link">
            <Mail className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-foreground">
            Quên mật khẩu?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
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
              className="rounded-xl border border-danger-border bg-danger-muted p-3 text-sm text-danger"
            >
              {error}
            </div>
          )}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-semibold text-secondary-foreground"
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
              className="h-12 w-full rounded-xl border border-input bg-muted px-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-blue-600 focus:ring-4 focus:ring-ring"
            />
          </div>
          <button
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover font-bold text-white disabled:opacity-60"
          >
            {loading && <LoaderCircle className="size-5 animate-spin" />}Gửi yêu
            cầu
          </button>
        </form>
        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-2 font-semibold text-link"
        >
          <ArrowLeft className="size-4" />
          Quay lại đăng nhập
        </Link>
      </div>
    </main>
  );
}
