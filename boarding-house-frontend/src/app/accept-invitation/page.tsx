"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/providers/auth-provider";
import { ownerAccountsService } from "@/services/owner-accounts.service";
import { apiErrorMessage } from "@/lib/api-error";
export default function Page() {
  const { user, isBootstrapping, logout } = useAuth();
  const [token, setToken] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() =>
      setToken(
        new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
      ),
    );
    return () => window.cancelAnimationFrame(id);
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    if (!user && password !== data.get("confirm")) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await ownerAccountsService.accept(token!, user ? undefined : password);
      window.history.replaceState(null, "", window.location.pathname);
      setDone(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const field = "min-h-11 w-full rounded-xl border border-slate-300 p-3";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-blue-600">SmartHome AI</p>
        <h1 className="text-2xl font-extrabold">Kích hoạt tài khoản</h1>
        {isBootstrapping || token === null ? (
          <p role="status">Đang kiểm tra phiên đăng nhập...</p>
        ) : done ? (
          <>
            <p role="status" className="text-emerald-700">
              Đã chấp nhận lời mời. Vui lòng đăng nhập lại để nhận vai trò mới.
            </p>
            <button
              className="inline-block font-bold text-blue-600"
              onClick={() => {
                if (user) void logout();
                else window.location.assign("/login");
              }}
            >
              Đến trang đăng nhập
            </button>
          </>
        ) : !token ? (
          <p role="alert">
            Liên kết không hợp lệ. Liên hệ chủ sở hữu để nhận lời mời mới.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            {user ? (
              <p className="text-sm text-slate-600">
                Bạn đang đăng nhập bằng {user.email}. Xác nhận tham gia với tài
                khoản này; mật khẩu được giữ nguyên.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Nếu email đã có tài khoản, hãy{" "}
                  <Link
                    href={`/login#invitation=${token}`}
                    className="font-bold text-blue-600"
                  >
                    đăng nhập
                  </Link>{" "}
                  trước khi chấp nhận. Với tài khoản mới, đặt mật khẩu bên dưới.
                </p>
                <label className="block space-y-2 text-sm font-semibold">
                  Mật khẩu mới
                  <input
                    className={field}
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                    pattern="(?=.*[A-Za-z])(?=.*[0-9]).+"
                  />
                </label>
                <label className="block space-y-2 text-sm font-semibold">
                  Xác nhận mật khẩu
                  <input
                    className={field}
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </label>
              </>
            )}
            <button
              disabled={busy}
              className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50"
            >
              {busy ? "Đang kích hoạt..." : "Chấp nhận lời mời"}
            </button>
            {user && (
              <button
                type="button"
                className="text-sm font-bold text-blue-600"
                onClick={() =>
                  void logout().then(() =>
                    window.location.assign(`/login#invitation=${token}`),
                  )
                }
              >
                Đăng nhập bằng tài khoản khác
              </button>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
