"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { authService } from "@/services/auth.service";
import { Brand } from "./brand";
import { PasswordInput } from "./password-input";

const schema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập đầy đủ họ tên.").max(150, "Họ tên quá dài."),
  email: z.string().trim().min(1, "Vui lòng nhập email.").email("Email không đúng định dạng."),
  phone: z.string().trim().refine((value) => !value || /^[0-9+]{9,15}$/.test(value), "Số điện thoại không đúng định dạng."),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự.").max(72, "Mật khẩu không được vượt quá 72 ký tự.")
    .regex(/[A-Za-z]/, "Mật khẩu phải có ít nhất một chữ cái.").regex(/\d/, "Mật khẩu phải có ít nhất một chữ số."),
  confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu."),
  acceptedTerms: z.boolean().refine(Boolean, "Bạn cần đồng ý với điều khoản sử dụng."),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"], message: "Mật khẩu xác nhận không khớp.",
});
type RegisterValues = z.infer<typeof schema>;
const apiMessages: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: "Email đã được sử dụng.",
  PHONE_ALREADY_EXISTS: "Số điện thoại đã được sử dụng.",
  ACCOUNT_ALREADY_EXISTS: "Email hoặc số điện thoại đã được sử dụng.",
  PASSWORD_CONFIRMATION_MISMATCH: "Mật khẩu xác nhận không khớp.",
};
const inputClass = "h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60";

export function RegisterForm() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", confirmPassword: "", acceptedTerms: false },
  });

  async function submit(values: RegisterValues) {
    setApiError(null);
    try {
      await authService.register({ ...values, email: values.email.trim().toLowerCase(), phone: values.phone || undefined });
      router.replace(`/login?reason=registered&email=${encodeURIComponent(values.email.trim().toLowerCase())}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.errorCode as string | undefined;
        setApiError(code && apiMessages[code] ? apiMessages[code] : !error.response
          ? "Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend."
          : "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.");
      } else setApiError("Đăng ký không thành công. Vui lòng thử lại.");
    }
  }

  return <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white px-5 py-8 shadow-2xl shadow-slate-300/60 sm:px-10 sm:py-10">
    <Brand />
    <div className="mt-8"><h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Tạo tài khoản khách thuê</h1>
      <p className="mt-2 text-slate-500">Đăng ký để xem phòng, hợp đồng, hóa đơn và gửi yêu cầu sửa chữa.</p></div>

    <div className="mt-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
      <ShieldCheck className="mt-0.5 size-5 shrink-0" /><p>Tài khoản tự đăng ký chỉ được cấp vai trò <strong>Khách thuê</strong>.
        Chủ nhà và nhân viên cần được quản trị viên phân quyền.</p>
    </div>

    <form className="mt-6 space-y-5" onSubmit={handleSubmit(submit)} noValidate>
      {apiError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</div>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="fullName" className="mb-2 block font-semibold text-slate-700">Họ và tên</label>
          <input id="fullName" autoComplete="name" placeholder="Nguyễn Văn A" disabled={isSubmitting} {...register("fullName")} className={inputClass} />
          {errors.fullName && <p className="mt-1.5 text-sm text-red-600">{errors.fullName.message}</p>}</div>
        <div><label htmlFor="phone" className="mb-2 block font-semibold text-slate-700">Số điện thoại <span className="font-normal text-slate-400">(không bắt buộc)</span></label>
          <input id="phone" type="tel" autoComplete="tel" placeholder="0912345678" disabled={isSubmitting} {...register("phone")} className={inputClass} />
          {errors.phone && <p className="mt-1.5 text-sm text-red-600">{errors.phone.message}</p>}</div>
      </div>
      <div><label htmlFor="email" className="mb-2 block font-semibold text-slate-700">Email đăng nhập</label>
        <input id="email" type="email" autoComplete="email" placeholder="guest@gmail.com" disabled={isSubmitting} {...register("email")} className={inputClass} />
        {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email.message}</p>}</div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="password" className="mb-2 block font-semibold text-slate-700">Mật khẩu</label>
          <PasswordInput id="password" autoComplete="new-password" disabled={isSubmitting} {...register("password")} />
          {errors.password && <p className="mt-1.5 text-sm text-red-600">{errors.password.message}</p>}</div>
        <div><label htmlFor="confirmPassword" className="mb-2 block font-semibold text-slate-700">Nhập lại mật khẩu</label>
          <PasswordInput id="confirmPassword" autoComplete="new-password" disabled={isSubmitting} {...register("confirmPassword")} />
          {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-600">{errors.confirmPassword.message}</p>}</div>
      </div>
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-700">Mật khẩu an toàn cần:</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2"><span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" />Ít nhất 8 ký tự</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" />Có chữ cái và chữ số</span></div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" disabled={isSubmitting} {...register("acceptedTerms")} className="mt-0.5 size-4 rounded border-slate-300 accent-blue-600" />
        <span>Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của SmartHome AI.</span>
      </label>
      {errors.acceptedTerms && <p className="-mt-3 text-sm text-red-600">{errors.acceptedTerms.message}</p>}
      <button type="submit" disabled={isSubmitting}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? <><LoaderCircle className="size-5 animate-spin" />Đang tạo tài khoản</> : <>Tạo tài khoản<ArrowRight className="size-5" /></>}
      </button>
    </form>
    <p className="mt-7 text-center text-slate-500">Đã có tài khoản? <Link href="/login" className="font-semibold text-blue-700 hover:underline">Đăng nhập</Link></p>
  </div>;
}
