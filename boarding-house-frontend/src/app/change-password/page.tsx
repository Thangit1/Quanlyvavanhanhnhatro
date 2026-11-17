"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { accountProvisioningService } from "@/services/account-provisioning.service";
import { apiErrorMessage } from "@/lib/api-error";
export default function Page() {
  const { user, isBootstrapping, logout } = useAuth();
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isBootstrapping && !user) router.replace("/login");
  }, [isBootstrapping, user, router]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError("");
    if (data.get("newPassword") !== data.get("confirmPassword")) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    try {
      await accountProvisioningService.changeInitialPassword({
        currentPassword: String(data.get("currentPassword")),
        newPassword: String(data.get("newPassword")),
        confirmPassword: String(data.get("confirmPassword")),
      });
      await logout();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const input =
    "min-h-12 w-full rounded-xl border border-slate-200 p-3 text-sm";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <section className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="font-bold text-blue-600">SmartHome AI</p>
        <h1 className="text-2xl font-extrabold">Đổi mật khẩu khởi tạo</h1>
        {isBootstrapping || !user ? (
          <p role="status">Đang kiểm tra phiên đăng nhập...</p>
        ) : (
          <>
            <p className="text-sm leading-6 text-slate-600">
              {user.email || user.phone || user.fullName}: đặt mật khẩu riêng
              trước khi vào hệ thống. Sau khi đổi, đăng nhập lại bằng mật khẩu
              mới.
            </p>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <form onSubmit={submit}>
              <fieldset disabled={busy} className="space-y-5">
                <label className="block space-y-2 text-sm font-semibold">
                  Mật khẩu khởi tạo / hiện tại
                  <input
                    className={input}
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={72}
                  />
                </label>
                <label className="block space-y-2 text-sm font-semibold">
                  Mật khẩu mới
                  <input
                    className={input}
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+"
                  />
                  <span className="block text-xs font-normal text-slate-500">
                    Ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.
                  </span>
                </label>
                <label className="block space-y-2 text-sm font-semibold">
                  Xác nhận mật khẩu mới
                  <input
                    className={input}
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    maxLength={72}
                  />
                </label>
                <button className="w-full rounded-xl bg-blue-600 p-3 text-sm font-bold text-white disabled:opacity-50">
                  {busy
                    ? "Đang đổi mật khẩu..."
                    : "Đổi mật khẩu và đăng nhập lại"}
                </button>
                <button
                  type="button"
                  className="w-full text-sm font-semibold text-slate-500"
                  onClick={() => void logout()}
                >
                  Đăng xuất
                </button>
              </fieldset>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
