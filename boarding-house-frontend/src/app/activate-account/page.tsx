"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiClient } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";

export default function ActivateAccountPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const readToken = useRef(false);
  useEffect(() => {
    if (readToken.current) return;
    readToken.current = true;
    const raw =
      new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    window.history.replaceState(null, "", window.location.pathname);
    // Token stays only in component memory; the URL fragment never reaches the server or referrer.
    setToken(raw);
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!token)
        throw Error(
          "Không có liên kết kích hoạt. Vui lòng mở email mới nhất hoặc yêu cầu chủ nhà gửi lại.",
        );
      if (password !== confirm) throw Error("Mật khẩu xác nhận không khớp.");
      await apiClient.post("/auth/password-setup", {
        token,
        newPassword: password,
        confirmPassword: confirm,
      });
      setToken("");
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch (e) {
      setError(
        apiErrorMessage(
          e,
          "Không thể thiết lập mật khẩu. Liên kết có thể đã dùng hoặc hết hạn.",
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <section className="surface-card w-full max-w-lg space-y-5 p-6 sm:p-8">
        <p className="font-bold text-link">SmartHome AI</p>
        <h1 className="text-2xl font-bold">Thiết lập mật khẩu lần đầu</h1>
        {done ? (
          <>
            <p role="status">
              Đã kích hoạt thông tin đăng nhập. Hãy đăng nhập với vai trò Khách
              thuê để xem hợp đồng chờ xác nhận.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-xl bg-primary px-5 py-3 font-semibold text-white"
            >
              Đến trang đăng nhập
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Liên kết dùng một lần, có hiệu lực 24 giờ từ khi email được gửi.
              Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <label className="block space-y-2">
                <span>Mật khẩu mới</span>
                <input
                  aria-label="Mật khẩu mới"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border bg-card p-3"
                />
              </label>
              <label className="block space-y-2">
                <span>Xác nhận mật khẩu</span>
                <input
                  aria-label="Xác nhận mật khẩu"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border bg-card p-3"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <button
                disabled={busy}
                className="w-full rounded-xl bg-primary p-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Đang thiết lập…" : "Thiết lập mật khẩu"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
