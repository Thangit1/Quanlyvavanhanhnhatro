"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/providers/auth-provider";
import { roleHome, roles, type Role } from "@/types/auth";
import { Brand } from "./brand";
import { PasswordInput } from "./password-input";
import { RoleSelector } from "./role-selector";
import { emailOrVietnamPhoneSchema } from "@/lib/phone-validation";
import { invitationRedirect } from "@/lib/invitation-routing";

const REMEMBERED_IDENTIFIER_KEY = "auth:remembered-identifier";

const schema = z.object({
  email: emailOrVietnamPhoneSchema,
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
  requestedRole: z.enum(roles, { error: "Vui lòng chọn vai trò truy cập." }),
});
type LoginValues = z.infer<typeof schema>;
const errorMessages: Record<string, string> = {
  PASSWORD_SETUP_EXPIRED:
    "Mật khẩu khởi tạo đã hết hạn. Liên hệ người quản trị để cấp lại mật khẩu an toàn.",
  INVALID_CREDENTIALS: "Email, số điện thoại hoặc mật khẩu không chính xác.",
  ROLE_NOT_ALLOWED: "Tài khoản không có quyền truy cập với vai trò đã chọn.",
  ACCOUNT_LOCKED: "Tài khoản đã bị khóa hoặc ngừng hoạt động.",
  ACCOUNT_INACTIVE: "Tài khoản đã bị khóa hoặc ngừng hoạt động.",
};

export function LoginForm() {
  const { user, isBootstrapping, login } = useAuth();
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rememberAccount, setRememberAccount] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { email: "", password: "", requestedRole: "OWNER" },
  });
  useEffect(() => {
    if (!isBootstrapping && user)
      router.replace(
        user.mustChangePassword
          ? "/change-password"
          : (invitationRedirect(window.location.hash) ??
              roleHome[user.activeRole]),
      );
  }, [isBootstrapping, router, user]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const rememberedIdentifier = localStorage.getItem(
        REMEMBERED_IDENTIFIER_KEY,
      );
      if (rememberedIdentifier) {
        setValue("email", rememberedIdentifier);
        setRememberAccount(true);
      }
      const reason = new URLSearchParams(window.location.search).get("reason");
      if (reason === "logout") setNotice("Đăng xuất thành công.");
      if (reason === "expired") setApiError("Phiên đăng nhập đã hết hạn.");
      if (reason === "registered") {
        setNotice(
          "Đăng ký thành công. Vui lòng đăng nhập bằng tài khoản vừa tạo.",
        );
        const email = new URLSearchParams(window.location.search).get("email");
        if (email) setValue("email", email);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setValue]);
  const selectedRole = useWatch({ control, name: "requestedRole" });

  async function submit(values: LoginValues) {
    setApiError(null);
    try {
      const currentUser = await login(values);
      if (rememberAccount) {
        localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, values.email.trim());
      } else {
        localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
      }
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      const safePrefix = `/${currentUser.activeRole.toLowerCase()}/`;
      sessionStorage.setItem("auth:notice", "Đăng nhập thành công.");
      router.replace(
        currentUser.mustChangePassword
          ? "/change-password"
          : (invitationRedirect(window.location.hash) ??
              (redirect?.startsWith(safePrefix)
                ? redirect
                : roleHome[currentUser.activeRole])),
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.errorCode as string | undefined;
        setApiError(
          code && errorMessages[code]
            ? errorMessages[code]
            : error.code === "ECONNABORTED"
              ? "Yêu cầu quá thời gian. Vui lòng thử lại."
              : !error.response
                ? "Không thể kết nối đến máy chủ. Vui lòng thử lại."
                : "Đăng nhập không thành công. Vui lòng thử lại.",
        );
      } else setApiError("Đăng nhập không thành công. Vui lòng thử lại.");
    }
  }

  return (
    <div className="w-full max-w-xl rounded-[2rem] border border-border bg-card px-5 py-8 shadow-2xl shadow-slate-300/60 sm:px-10 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Brand />
        <RoleSelector
          value={selectedRole}
          disabled={isSubmitting}
          onChange={(role: Role) =>
            setValue("requestedRole", role, { shouldValidate: true })
          }
        />
      </div>
      {errors.requestedRole && (
        <p className="mt-2 text-right text-sm text-danger">
          {errors.requestedRole.message}
        </p>
      )}
      <div className="mt-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Chào mừng trở lại
        </h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Vui lòng nhập thông tin để truy cập hệ thống.
        </p>
      </div>
      <form
        className="mt-7 space-y-5"
        onSubmit={handleSubmit(submit)}
        noValidate
      >
        {notice && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {notice}
          </div>
        )}
        {apiError && (
          <div
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-muted px-4 py-3 text-sm text-danger"
          >
            {apiError}
          </div>
        )}
        <div>
          <label
            htmlFor="email"
            className="mb-2 block font-semibold text-secondary-foreground"
          >
            Email hoặc số điện thoại
          </label>
          <input
            id="email"
            type="text"
            inputMode="text"
            autoComplete="username"
            disabled={isSubmitting}
            placeholder="Nhập email hoặc số điện thoại"
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
            className={`h-12 w-full rounded-xl border bg-muted px-4 text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition placeholder:text-muted-foreground focus:bg-card focus:ring-4 disabled:opacity-60 ${errors.email ? "border-danger focus:border-danger focus:ring-red-100" : "border-input focus:border-blue-600 focus:ring-ring"}`}
          />
          {errors.email && (
            <p className="mt-1.5 text-sm text-danger">
              {errors.email.message}
            </p>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className="font-semibold text-secondary-foreground">
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="font-semibold text-link hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            disabled={isSubmitting}
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1.5 text-sm text-danger">
              {errors.password.message}
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-secondary-foreground">
          <input
            type="checkbox"
            checked={rememberAccount}
            disabled={isSubmitting}
            onChange={(event) => {
              const checked = event.target.checked;
              setRememberAccount(checked);
              if (!checked) localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
            }}
            className="size-4 rounded border-input accent-blue-600"
          />
          Ghi nhớ tài khoản
        </label>
        <button
          type="submit"
          disabled={isSubmitting || isBootstrapping}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-lg font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="size-5 animate-spin" />
              Đang đăng nhập
            </>
          ) : (
            <>
              Đăng nhập ngay
              <ArrowRight className="size-5" />
            </>
          )}
        </button>
      </form>
      <p className="mt-8 text-center text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-semibold text-link hover:underline"
        >
          Đăng ký khách thuê
        </Link>
      </p>
    </div>
  );
}
