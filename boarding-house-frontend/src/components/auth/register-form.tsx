"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { z } from "zod";
import { authService } from "@/services/auth.service";
import { Brand } from "./brand";
import { PasswordInput } from "./password-input";
import { requiredVietnamPhoneSchema } from "@/lib/phone-validation";

const schema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Vui lòng nhập đầy đủ họ tên.")
      .max(150, "Họ tên quá dài."),
    email: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập email.")
      .email("Email không đúng định dạng."),
    phone: requiredVietnamPhoneSchema,
    password: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
      .max(72, "Mật khẩu không được vượt quá 72 ký tự.")
      .regex(/[A-Za-z]/, "Mật khẩu phải có ít nhất một chữ cái.")
      .regex(/\d/, "Mật khẩu phải có ít nhất một chữ số."),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu."),
    acceptedTerms: z
      .boolean()
      .refine(Boolean, "Bạn cần đồng ý với điều khoản sử dụng."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp.",
  });
type RegisterValues = z.infer<typeof schema>;
const apiMessages: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: "Email đã được sử dụng.",
  PHONE_ALREADY_EXISTS: "Số điện thoại này đã được sử dụng.",
  ACCOUNT_ALREADY_EXISTS: "Email hoặc số điện thoại đã được sử dụng.",
  PASSWORD_CONFIRMATION_MISMATCH: "Mật khẩu xác nhận không khớp.",
};
const inputClass =
  "h-12 w-full rounded-xl border border-input bg-muted px-4 text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition placeholder:text-muted-foreground focus:border-blue-600 focus:bg-card focus:ring-4 focus:ring-ring disabled:opacity-60";

export function RegisterForm() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
  });

  async function submit(values: RegisterValues) {
    setApiError(null);
    try {
      await authService.register({
        ...values,
        email: values.email.trim().toLowerCase(),
        phone: values.phone,
      });
      router.replace(
        `/login?reason=registered&email=${encodeURIComponent(values.email.trim().toLowerCase())}`,
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const code = error.response?.data?.errorCode as string | undefined;
        setApiError(
          code && apiMessages[code]
            ? apiMessages[code]
            : !error.response
              ? "Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend."
              : "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.",
        );
      } else setApiError("Đăng ký không thành công. Vui lòng thử lại.");
    }
  }

  return (
    <div className="w-full max-w-2xl rounded-[2rem] border border-border bg-card px-5 py-8 shadow-2xl shadow-slate-300/60 sm:px-10 sm:py-10">
      <Brand />
      <div className="mt-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Tạo tài khoản khách thuê
        </h1>
        <p className="mt-2 text-muted-foreground">
          Đăng ký để xem phòng, hợp đồng, hóa đơn và gửi yêu cầu sửa chữa.
        </p>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-accent-border bg-accent p-4 text-sm text-link">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>
          Tài khoản tự đăng ký chỉ được cấp vai trò <strong>Khách thuê</strong>.
          Chủ nhà và nhân viên cần được quản trị viên phân quyền.
        </p>
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={handleSubmit(submit)}
        noValidate
      >
        {apiError && (
          <div
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-muted px-4 py-3 text-sm text-danger"
          >
            {apiError}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="fullName"
              className="mb-2 block font-semibold text-secondary-foreground"
            >
              Họ và tên
            </label>
            <input
              id="fullName"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              disabled={isSubmitting}
              {...register("fullName")}
              className={inputClass}
            />
            {errors.fullName && (
              <p className="mt-1.5 text-sm text-danger">
                {errors.fullName.message}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="phone"
              className="mb-2 block font-semibold text-secondary-foreground"
            >
              Số điện thoại <span className="text-danger">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0912345678"
              disabled={isSubmitting}
              {...register("phone")}
              className={`${inputClass} ${errors.phone ? "border-danger focus:border-danger focus:ring-red-100" : ""}`}
            />
            {errors.phone && (
              <p className="mt-1.5 text-sm text-danger">
                {errors.phone.message}
              </p>
            )}
          </div>
        </div>
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
            placeholder="guest@gmail.com"
            disabled={isSubmitting}
            {...register("email")}
            className={inputClass}
          />
          {errors.email && (
            <p className="mt-1.5 text-sm text-danger">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block font-semibold text-secondary-foreground"
            >
              Mật khẩu
            </label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1.5 text-sm text-danger">
                {errors.password.message}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block font-semibold text-secondary-foreground"
            >
              Nhập lại mật khẩu
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="mt-1.5 text-sm text-danger">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-muted p-4 text-sm text-secondary-foreground">
          <p className="font-semibold text-secondary-foreground">Mật khẩu an toàn cần:</p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              Ít nhất 8 ký tự
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              Có chữ cái và chữ số
            </span>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-secondary-foreground">
          <input
            type="checkbox"
            disabled={isSubmitting}
            {...register("acceptedTerms")}
            className="mt-0.5 size-4 rounded border-input accent-blue-600"
          />
          <span>
            Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của
            SmartHome AI.
          </span>
        </label>
        {errors.acceptedTerms && (
          <p className="-mt-3 text-sm text-danger">
            {errors.acceptedTerms.message}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-lg font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="size-5 animate-spin" />
              Đang tạo tài khoản
            </>
          ) : (
            <>
              Tạo tài khoản
              <ArrowRight className="size-5" />
            </>
          )}
        </button>
      </form>
      <p className="mt-7 text-center text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="font-semibold text-link hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
