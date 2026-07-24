"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { z } from "zod";
import { formatDate } from "@/lib/format";
import { useExtensionRequest, useTerminationRequest } from "@/hooks/use-tenant-contracts";
import type { ContractDetail } from "@/types/tenant-contract";

function Dialog({ title, description, onClose, children }: {
  title: string; description: string; onClose: () => void; children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", escape); document.body.style.overflow = previous; };
  }, [onClose]);
  return <div className="fixed inset-0 z-[70] grid items-end sm:place-items-center" role="presentation">
    <button aria-label="Đóng hộp thoại" className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
    <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description"
      className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h2 id="dialog-title" className="text-xl font-bold text-slate-900">{title}</h2>
        <p id="dialog-description" className="mt-1 text-sm text-slate-500">{description}</p></div>
        <button ref={closeRef} type="button" aria-label="Đóng" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 focus:ring-4 focus:ring-blue-100"><X /></button></div>
      {children}
    </section>
  </div>;
}
function apiMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const code = error.response?.data?.errorCode as string | undefined;
  const messages: Record<string, string> = {
    EXTENSION_REQUEST_PENDING: "Hợp đồng đã có yêu cầu gia hạn đang chờ xử lý.",
    EXTENSION_DATE_INVALID: "Ngày kết thúc mới phải sau ngày kết thúc hiện tại.",
    TERMINATION_REQUEST_PENDING: "Hợp đồng đã có yêu cầu trả phòng đang chờ xử lý.",
    NOTICE_PERIOD_NOT_MET: error.response?.data?.message ?? "Ngày trả phòng chưa đáp ứng thời gian báo trước.",
  };
  return code && messages[code] ? messages[code] : error.response?.data?.message ?? fallback;
}

export function ExtensionRequestDialog({ contract, onClose, onSuccess }: {
  contract: ContractDetail; onClose: () => void; onSuccess: (message: string) => void;
}) {
  const mutation = useExtensionRequest(contract.id);
  const [apiError, setApiError] = useState<string | null>(null);
  const schema = useMemo(() => z.object({
    duration: z.enum(["3", "6", "12", "OTHER"]),
    requestedEndDate: z.string().min(1, "Vui lòng chọn ngày kết thúc mong muốn.")
      .refine((value) => value > contract.endDate, "Ngày mới phải sau ngày kết thúc hiện tại."),
    note: z.string().max(1000, "Ghi chú không được vượt quá 1000 ký tự."),
    confirmed: z.boolean().refine(Boolean, "Bạn cần xác nhận trước khi gửi."),
  }), [contract.endDate]);
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { duration: "6", requestedEndDate: addMonths(contract.endDate, 6), note: "", confirmed: false },
  });
  const duration = useWatch({ control, name: "duration" });
  useEffect(() => { if (duration !== "OTHER") setValue("requestedEndDate", addMonths(contract.endDate, Number(duration)), { shouldValidate: true }); },
    [contract.endDate, duration, setValue]);
  async function submit(values: Values) {
    setApiError(null);
    try {
      const result = await mutation.mutateAsync({ requestedEndDate: values.requestedEndDate, note: values.note || undefined });
      onSuccess(result.message); onClose();
    } catch (error) { setApiError(apiMessage(error, "Không thể gửi yêu cầu gia hạn. Vui lòng thử lại.")); }
  }
  return <Dialog title="Yêu cầu gia hạn hợp đồng" description={`${contract.contractCode} · Kết thúc hiện tại ${formatDate(contract.endDate)}`} onClose={onClose}>
    <form className="mt-5 space-y-4" onSubmit={handleSubmit(submit)} noValidate>
      {apiError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div>}
      <label className="block text-sm font-semibold text-slate-700">Thời gian muốn gia hạn
        <select {...register("duration")} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
          <option value="3">3 tháng</option><option value="6">6 tháng</option><option value="12">12 tháng</option><option value="OTHER">Thời gian khác</option>
        </select></label>
      <label className="block text-sm font-semibold text-slate-700">Ngày kết thúc mong muốn
        <input type="date" min={nextDay(contract.endDate)} {...register("requestedEndDate")}
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      {errors.requestedEndDate && <p className="text-sm text-red-600">{errors.requestedEndDate.message}</p>}
      <label className="block text-sm font-semibold text-slate-700">Ghi chú
        <textarea rows={3} {...register("note")} className="mt-2 w-full rounded-xl border border-slate-300 p-3" placeholder="Nhu cầu gia hạn của bạn..." /></label>
      {errors.note && <p className="text-sm text-red-600">{errors.note.message}</p>}
      <label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" {...register("confirmed")} className="mt-0.5 size-4 accent-blue-600" />
        Tôi hiểu rằng yêu cầu này cần được chủ nhà hoặc quản lý phê duyệt.</label>
      {errors.confirmed && <p className="text-sm text-red-600">{errors.confirmed.message}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold">Hủy</button>
        <button disabled={mutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          {mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}Gửi yêu cầu</button></div>
    </form>
  </Dialog>;
}

export function TerminationRequestDialog({ contract, onClose, onSuccess }: {
  contract: ContractDetail; onClose: () => void; onSuccess: (message: string) => void;
}) {
  const mutation = useTerminationRequest(contract.id);
  const [apiError, setApiError] = useState<string | null>(null);
  const earliest = addDays(todayISO(), contract.noticePeriodDays);
  const schema = useMemo(() => z.object({
    expectedMoveOutDate: z.string().min(1, "Vui lòng chọn ngày trả phòng.")
      .refine((value) => value >= earliest, `Ngày trả phòng phải báo trước ít nhất ${contract.noticePeriodDays} ngày.`),
    reason: z.string().trim().min(1, "Vui lòng nhập lý do trả phòng.").max(300, "Lý do không được vượt quá 300 ký tự."),
    note: z.string().max(1000, "Ghi chú không được vượt quá 1000 ký tự."),
    contactPhone: z.string().regex(/^[0-9+]{9,15}$/, "Số điện thoại không đúng định dạng."),
    confirmed: z.boolean().refine(Boolean, "Bạn cần xác nhận trước khi gửi."),
  }), [contract.noticePeriodDays, earliest]);
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { expectedMoveOutDate: earliest, reason: "", note: "",
      contactPhone: contract.tenant.phone ?? "", confirmed: false },
  });
  async function submit(values: Values) {
    setApiError(null);
    try {
      const result = await mutation.mutateAsync({ expectedMoveOutDate: values.expectedMoveOutDate,
        reason: values.reason, note: values.note || undefined, contactPhone: values.contactPhone });
      onSuccess(result.message); onClose();
    } catch (error) { setApiError(apiMessage(error, "Không thể gửi yêu cầu trả phòng. Vui lòng thử lại.")); }
  }
  return <Dialog title="Yêu cầu trả phòng" description={`${contract.contractCode} · Báo trước ${contract.noticePeriodDays} ngày`} onClose={onClose}>
    <form className="mt-5 space-y-4" onSubmit={handleSubmit(submit)} noValidate>
      <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="mt-0.5 size-5 shrink-0" />
        <p>Gửi yêu cầu không đồng nghĩa hợp đồng đã chấm dứt. Tiền cọc được quyết toán sau khi kiểm tra phòng, công nợ và tài sản.</p></div>
      {apiError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</div>}
      <label className="block text-sm font-semibold text-slate-700">Ngày dự kiến trả phòng
        <input type="date" min={earliest} {...register("expectedMoveOutDate")} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      {errors.expectedMoveOutDate && <p className="text-sm text-red-600">{errors.expectedMoveOutDate.message}</p>}
      <label className="block text-sm font-semibold text-slate-700">Lý do trả phòng
        <input {...register("reason")} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3" placeholder="Ví dụ: Chuyển nơi công tác" /></label>
      {errors.reason && <p className="text-sm text-red-600">{errors.reason.message}</p>}
      <label className="block text-sm font-semibold text-slate-700">Số điện thoại liên hệ
        <input type="tel" {...register("contactPhone")} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      {errors.contactPhone && <p className="text-sm text-red-600">{errors.contactPhone.message}</p>}
      <label className="block text-sm font-semibold text-slate-700">Ghi chú
        <textarea rows={3} {...register("note")} className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label>
      {errors.note && <p className="text-sm text-red-600">{errors.note.message}</p>}
      <label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" {...register("confirmed")} className="mt-0.5 size-4 accent-blue-600" />
        Tôi hiểu rằng tiền cọc sẽ được quyết toán sau khi kiểm tra phòng, công nợ và tài sản.</label>
      {errors.confirmed && <p className="text-sm text-red-600">{errors.confirmed.message}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold">Hủy</button>
        <button disabled={mutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          {mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}Gửi yêu cầu trả phòng</button></div>
    </form>
  </Dialog>;
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value}T00:00:00`); date.setMonth(date.getMonth() + months); return localISO(date);
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + days); return localISO(date);
}
function nextDay(value: string) { return addDays(value, 1); }
function todayISO() { return localISO(new Date()); }
function localISO(date: Date) {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-${String(date.getDate()).padStart(2, "0")}`;
}
