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

const schema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email.").email("Email không đúng định dạng."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
  requestedRole: z.enum(roles, { error: "Vui lòng chọn vai trò truy cập." }),
});
type LoginValues = z.infer<typeof schema>;
const errorMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không chính xác.", ROLE_NOT_ALLOWED: "Tài khoản không có quyền truy cập với vai trò đã chọn.",
  ACCOUNT_LOCKED: "Tài khoản đã bị khóa hoặc ngừng hoạt động.", ACCOUNT_INACTIVE: "Tài khoản đã bị khóa hoặc ngừng hoạt động.",
};

export function LoginForm() {
  const { user, isBootstrapping, login } = useAuth();
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(schema), defaultValues: { email: "", password: "" },
  });
  useEffect(() => { if (!isBootstrapping && user) router.replace(roleHome[user.activeRole]); }, [isBootstrapping, router, user]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const reason = new URLSearchParams(window.location.search).get("reason");
      if (reason === "logout") setNotice("Đăng xuất thành công.");
      if (reason === "expired") setApiError("Phiên đăng nhập đã hết hạn.");
      if (reason === "registered") {
        setNotice("Đăng ký thành công. Vui lòng đăng nhập bằng tài khoản vừa tạo.");
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
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      const safePrefix = `/${currentUser.activeRole.toLowerCase()}/`;
      sessionStorage.setItem("auth:notice", "Đăng nhập thành công.");
      router.replace(redirect?.startsWith(safePrefix) ? redirect : roleHome[currentUser.activeRole]);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.errorCode as string | undefined;
        setApiError(code && errorMessages[code] ? errorMessages[code] : error.code === "ECONNABORTED"
          ? "Yêu cầu quá thời gian. Vui lòng thử lại." : !error.response
            ? "Không thể kết nối đến máy chủ. Vui lòng thử lại." : "Đăng nhập không thành công. Vui lòng thử lại.");
      } else setApiError("Đăng nhập không thành công. Vui lòng thử lại.");
    }
  }

  return <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white px-5 py-8 shadow-2xl shadow-slate-300/60 sm:px-10 sm:py-10">
    <Brand />
    <div className="mt-9"><h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Chào mừng trở lại</h1>
      <p className="mt-2 text-base text-slate-500 sm:text-lg">Vui lòng nhập thông tin để truy cập hệ thống.</p></div>
    <form className="mt-7 space-y-5" onSubmit={handleSubmit(submit)} noValidate>
      {notice && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {apiError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>}
      <div><label htmlFor="email" className="mb-2 block font-semibold text-slate-700">Email đăng nhập</label>
        <input id="email" type="email" autoComplete="email" disabled={isSubmitting} placeholder="manager@smarthome.ai" {...register("email")}
          className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60" />
        {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email.message}</p>}</div>
      <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="font-semibold text-slate-700">Mật khẩu</label>
        <Link href="/forgot-password" className="font-semibold text-blue-700 hover:underline">Quên mật khẩu?</Link></div>
        <PasswordInput id="password" autoComplete="current-password" disabled={isSubmitting} {...register("password")} />
        {errors.password && <p className="mt-1.5 text-sm text-red-600">{errors.password.message}</p>}</div>
      <fieldset><legend className="mb-3 font-semibold text-slate-700">Chọn vai trò truy cập</legend>
        <RoleSelector value={selectedRole} disabled={isSubmitting} onChange={(role: Role) => setValue("requestedRole", role, { shouldValidate: true })} />
        {errors.requestedRole && <p className="mt-1.5 text-sm text-red-600">{errors.requestedRole.message}</p>}</fieldset>
      <button type="submit" disabled={isSubmitting || isBootstrapping}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? <><LoaderCircle className="size-5 animate-spin" />Đang đăng nhập</> : <>Đăng nhập ngay<ArrowRight className="size-5" /></>}
      </button>
    </form>
    <p className="mt-8 text-center text-slate-500">Chưa có tài khoản? <Link href="/register" className="font-semibold text-blue-700 hover:underline">Đăng ký khách thuê</Link></p>
  </div>;
}
