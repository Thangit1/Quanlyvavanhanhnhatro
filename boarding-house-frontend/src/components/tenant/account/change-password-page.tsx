"use client";
import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAccountActions } from "@/hooks/use-tenant-account";
import { apiErrorMessage } from "@/lib/api-error";
import { AccountPageLayout } from "./account-ui";
export function ChangePasswordPage() {
  const actions = useAccountActions(),
    [show, setShow] = useState(false),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [logoutOthers, setLogoutOthers] = useState(true),
    [message, setMessage] = useState("");
  const valid =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    password === confirm &&
    password !== current;
  const submit = () =>
    actions.changePassword.mutate(
      {
        currentPassword: current,
        newPassword: password,
        confirmPassword: confirm,
        logoutOtherSessions: logoutOthers,
      },
      {
        onSuccess: () => {
          setCurrent("");
          setPassword("");
          setConfirm("");
          setMessage("Mật khẩu đã được cập nhật.");
        },
        onError: (e) => setMessage(apiErrorMessage(e)),
      },
    );
  return (
    <AccountPageLayout
      title="Đổi mật khẩu"
      description="Sử dụng mật khẩu mạnh và không dùng lại mật khẩu ở dịch vụ khác."
    >
      {message && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 font-semibold text-blue-800"
        >
          {message}
        </p>
      )}
      <section className="max-w-2xl rounded-2xl border bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <Password
            label="Mật khẩu hiện tại"
            value={current}
            set={setCurrent}
            visible={show}
            autoComplete="current-password"
          />
          <Password
            label="Mật khẩu mới"
            value={password}
            set={setPassword}
            visible={show}
            autoComplete="new-password"
          />
          <Password
            label="Xác nhận mật khẩu mới"
            value={confirm}
            set={setConfirm}
            visible={show}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-700"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          </button>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <b>Yêu cầu mật khẩu:</b>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Ít nhất 8 ký tự</li>
              <li>Có chữ hoa, chữ thường và chữ số</li>
              <li>Khác mật khẩu hiện tại</li>
              <li>Xác nhận mật khẩu phải khớp</li>
            </ul>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={logoutOthers}
              onChange={(e) => setLogoutOthers(e.target.checked)}
              className="mt-1 size-4"
            />
            <span>
              <b>Thu hồi các phiên đăng nhập cũ</b>
              <small className="block text-slate-500">
                Nếu chọn, bạn có thể cần đăng nhập lại khi access token hiện tại
                hết hạn.
              </small>
            </span>
          </label>
          <button
            disabled={!current || !valid || actions.changePassword.isPending}
            onClick={submit}
            className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40"
          >
            {actions.changePassword.isPending
              ? "Đang cập nhật..."
              : "Cập nhật mật khẩu"}
          </button>
          <Link
            href="/forgot-password"
            className="block text-center text-sm font-bold text-blue-700"
          >
            Không nhớ mật khẩu hiện tại?
          </Link>
        </div>
      </section>
    </AccountPageLayout>
  );
}
function Password({
  label,
  value,
  set,
  visible,
  autoComplete,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  visible: boolean;
  autoComplete: string;
}) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => set(e.target.value)}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-xl border px-3 py-3 font-normal"
      />
    </label>
  );
}
