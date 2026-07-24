"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageLoading } from "@/components/shared/dashboard-ui";
import { useAdminTenant, useAdminTenants, useTenantMutations } from "@/hooks/use-admin-tenants";
import type { SaveTenantPayload } from "@/types/admin-tenant";

type FormValues = {
  fullName: string; dateOfBirth: string; gender: string; phone: string; email: string;
  permanentAddress: string; occupation: string; workplace: string; emergencyContactName: string;
  emergencyContactPhone: string; identityType: string; identityNumber: string;
  identityIssuedDate: string; identityIssuedPlace: string; note: string; propertyId: string;
  roomId: string; moveInDate: string; residenceRole: string;
};
const empty: FormValues = { fullName: "", dateOfBirth: "", gender: "", phone: "", email: "",
  permanentAddress: "", occupation: "", workplace: "", emergencyContactName: "",
  emergencyContactPhone: "", identityType: "CCCD", identityNumber: "", identityIssuedDate: "",
  identityIssuedPlace: "", note: "", propertyId: "", roomId: "", moveInDate: new Date().toISOString().slice(0, 10),
  residenceRole: "REPRESENTATIVE" };

export function TenantFormPage({ tenantId }: { tenantId?: number }) {
  const editing = !!tenantId; const router = useRouter(); const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState(""); const detail = useAdminTenant(tenantId ?? 0, editing);
  const options = useAdminTenants({ size: 10 }, true); const mutations = useTenantMutations(tenantId);
  const { register, handleSubmit, control, reset, trigger, formState: { errors } } = useForm<FormValues>({ defaultValues: empty });
  useEffect(() => {
    if (!detail.data) return;
    const d = detail.data; reset({ ...empty, fullName: d.fullName, dateOfBirth: d.dateOfBirth ?? "",
      gender: d.gender ?? "", phone: d.phone, email: d.email ?? "", permanentAddress: d.permanentAddress ?? "",
      occupation: d.occupation ?? "", workplace: d.workplace ?? "", emergencyContactName: d.emergencyContactName ?? "",
      emergencyContactPhone: d.emergencyContactPhone ?? "", identityType: d.identityType ?? "CCCD",
      identityNumber: "", identityIssuedDate: d.identityIssuedDate ?? "", identityIssuedPlace: d.identityIssuedPlace ?? "",
      note: d.note ?? "" });
  }, [detail.data, reset]);
  const propertyId = Number(useWatch({ control, name: "propertyId" }));
  const rooms = useMemo(() => options.data?.rooms.filter((r) => r.propertyId === propertyId) ?? [],
    [options.data?.rooms, propertyId]);
  if ((editing && detail.isLoading) || options.isLoading) return <PageLoading />;
  const next = async () => {
    const fields: (keyof FormValues)[] = step === 0 ? ["fullName", "phone", "email"] :
      step === 1 ? ["identityNumber"] : editing ? [] : ["propertyId", "moveInDate"];
    if (await trigger(fields)) setStep((value) => Math.min(value + 1, 2));
  };
  const submit = async (values: FormValues) => {
    setSubmitError("");
    const payload: SaveTenantPayload = {
      ...values, dateOfBirth: values.dateOfBirth || undefined, gender: values.gender || undefined,
      email: values.email || undefined, identityNumber: values.identityNumber || undefined,
      identityIssuedDate: values.identityIssuedDate || undefined, propertyId: values.propertyId ? Number(values.propertyId) : undefined,
      roomId: values.roomId ? Number(values.roomId) : undefined, moveInDate: values.moveInDate || undefined,
    };
    try {
      if (editing) { await mutations.update.mutateAsync(payload); router.push(`/admin/tenants/${tenantId}`); }
      else { const created = await mutations.create.mutateAsync(payload); router.push(`/admin/tenants/${created.id}`); }
    } catch {
      setSubmitError("Không thể lưu hồ sơ. Vui lòng kiểm tra dữ liệu trùng hoặc trường chưa hợp lệ.");
    }
  };
  const busy = mutations.create.isPending || mutations.update.isPending;
  return <AdminShell title={editing ? "Chỉnh sửa người thuê" : "Thêm người thuê"} subtitle="Thông tin được bảo vệ theo phạm vi nhà trọ">
    <div className="mx-auto max-w-5xl"><Link href={editing ? `/admin/tenants/${tenantId}` : "/admin/tenants"}
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"><ArrowLeft className="size-4" />Quay lại</Link>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 p-5"><div className="grid grid-cols-3 gap-2">
          {["Thông tin cơ bản", "Định danh & liên hệ", editing ? "Xác nhận" : "Phòng & cư trú"].map((label, index) =>
            <div key={label} className={`flex items-center gap-2 text-xs font-semibold sm:text-sm ${index <= step ? "text-blue-700" : "text-slate-400"}`}>
              <span className={`grid size-7 place-items-center rounded-full ${index < step ? "bg-blue-600 text-white" : index === step ? "border-2 border-blue-600 bg-white" : "bg-slate-200"}`}>
                {index < step ? <Check className="size-4" /> : index + 1}</span><span className="hidden sm:inline">{label}</span></div>)}</div></div>
        <form onSubmit={handleSubmit(submit)} className="p-5 sm:p-7">
          {submitError && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}
          {step === 0 && <div className="grid gap-5 md:grid-cols-2">
            <Field label="Họ và tên *" error={errors.fullName?.message}><input {...register("fullName", { required: "Vui lòng nhập họ tên", maxLength: 150 })} className={inputClass} placeholder="Nguyễn Văn An" /></Field>
            <Field label="Số điện thoại *" error={errors.phone?.message}><input {...register("phone", { required: "Vui lòng nhập số điện thoại", pattern: { value: /^[0-9+ .()-]{8,20}$/, message: "Số điện thoại không hợp lệ" } })} className={inputClass} /></Field>
            <Field label="Email" error={errors.email?.message}><input type="email" {...register("email", { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email không hợp lệ" } })} className={inputClass} /></Field>
            <Field label="Ngày sinh"><input type="date" max={new Date().toISOString().slice(0, 10)} {...register("dateOfBirth")} className={inputClass} /></Field>
            <Field label="Giới tính"><select {...register("gender")} className={inputClass}><option value="">Chưa chọn</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></Field>
            <Field label="Nghề nghiệp"><input {...register("occupation")} className={inputClass} /></Field>
            <Field label="Nơi làm việc"><input {...register("workplace")} className={inputClass} /></Field>
            <Field label="Địa chỉ thường trú"><input {...register("permanentAddress")} className={inputClass} /></Field>
          </div>}
          {step === 1 && <div className="grid gap-5 md:grid-cols-2">
            <Field label="Loại giấy tờ"><select {...register("identityType")} className={inputClass}><option value="CCCD">CCCD</option><option value="PASSPORT">Hộ chiếu</option><option value="OTHER">Khác</option></select></Field>
            <Field label={editing ? "Số giấy tờ (để trống nếu giữ nguyên)" : "Số giấy tờ"}><input {...register("identityNumber", { maxLength: 50 })} className={inputClass} autoComplete="off" /></Field>
            <Field label="Ngày cấp"><input type="date" {...register("identityIssuedDate")} className={inputClass} /></Field>
            <Field label="Nơi cấp"><input {...register("identityIssuedPlace")} className={inputClass} /></Field>
            <Field label="Người liên hệ khẩn cấp"><input {...register("emergencyContactName")} className={inputClass} /></Field>
            <Field label="SĐT liên hệ khẩn cấp"><input {...register("emergencyContactPhone")} className={inputClass} /></Field>
            <Field label="Ghi chú" className="md:col-span-2"><textarea {...register("note")} className={`${inputClass} min-h-24`} /></Field>
          </div>}
          {step === 2 && (editing ? <div className="rounded-xl bg-blue-50 p-6 text-sm text-slate-700">
            <p className="font-bold text-blue-800">Xác nhận cập nhật hồ sơ</p><p className="mt-2">Thông tin cư trú và hợp đồng không bị thay đổi trong thao tác này.</p>
          </div> : <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nhà trọ *" error={errors.propertyId?.message}><select {...register("propertyId", { required: "Vui lòng chọn nhà trọ" })} className={inputClass}>
              <option value="">Chọn nhà trọ</option>{options.data?.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Phòng"><select {...register("roomId")} className={inputClass}><option value="">Chưa gán phòng</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>Phòng {r.code} · {r.status}</option>)}</select></Field>
            <Field label="Ngày vào ở *" error={errors.moveInDate?.message}><input type="date" {...register("moveInDate", { required: "Vui lòng chọn ngày vào ở" })} className={inputClass} /></Field>
            <Field label="Vai trò cư trú"><select {...register("residenceRole")} className={inputClass}><option value="REPRESENTATIVE">Người đại diện</option><option value="OCCUPANT">Người ở cùng</option><option value="DEPENDENT">Người phụ thuộc</option></select></Field>
          </div>)}
          <div className="mt-8 flex justify-between border-t border-slate-100 pt-5">
            <button type="button" disabled={step === 0} onClick={() => setStep((v) => v - 1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 disabled:opacity-40"><ArrowLeft className="size-4" />Quay lại</button>
            {step < 2 ? <button type="button" onClick={() => void next()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white">Tiếp tục<ArrowRight className="size-4" /></button> :
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60"><Save className="size-4" />{busy ? "Đang lưu..." : "Lưu hồ sơ"}</button>}
          </div>
        </form>
      </section>
    </div>
  </AdminShell>;
}
const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
function Field({ label, error, className = "", children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <label className={`block text-sm font-semibold text-slate-700 ${className}`}>{label}{children}
    {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}</label>;
}
