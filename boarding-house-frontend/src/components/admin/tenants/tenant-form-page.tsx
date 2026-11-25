"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageLoading } from "@/components/shared/dashboard-ui";
import {
  useAdminTenant,
  useAdminTenants,
  useTenantMutations,
} from "@/hooks/use-admin-tenants";
import { useAuth } from "@/providers/auth-provider";
import type { SaveTenantPayload } from "@/types/admin-tenant";
import { adminTenantService } from "@/services/admin-tenant.service";
import type { TenantRow } from "@/types/admin-tenant";
import { apiErrorMessage } from "@/lib/api-error";
import { validateVietnamPhone } from "@/lib/phone-validation";

type FormValues = {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  permanentAddress: string;
  hometown: string;
  occupation: string;
  workplace: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  identityType: string;
  identityNumber: string;
  identityIssuedDate: string;
  identityIssuedPlace: string;
  note: string;
  propertyId: string;
  roomId: string;
  moveInDate: string;
  residenceRole: string;
};
const empty: FormValues = {
  fullName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  permanentAddress: "",
  hometown: "",
  occupation: "",
  workplace: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  identityType: "CCCD",
  identityNumber: "",
  identityIssuedDate: "",
  identityIssuedPlace: "",
  note: "",
  propertyId: "",
  roomId: "",
  moveInDate: new Date().toISOString().slice(0, 10),
  residenceRole: "REPRESENTATIVE",
};

export function TenantFormPage({ tenantId }: { tenantId?: number }) {
  const editing = !!tenantId;
  const { user } = useAuth();
  const hydrated = useRef<number | null>(null);
  const loadedVersion = useRef<number | undefined>(undefined);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [duplicates, setDuplicates] = useState<TenantRow[]>([]);
  const [duplicateNotice, setDuplicateNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const leaving = useRef(false);
  const submitting = useRef(false);
  const detail = useAdminTenant(tenantId ?? 0, editing);
  const options = useAdminTenants({ size: 10 }, true);
  const mutations = useTenantMutations(tenantId);
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    trigger,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues: empty, mode: "onChange" });
  useEffect(() => {
    if (!detail.data || hydrated.current === detail.data.id) return;
    hydrated.current = detail.data.id;
    loadedVersion.current = detail.data.version;
    const d = detail.data;
    reset({
      ...empty,
      fullName: d.fullName,
      dateOfBirth: d.dateOfBirth ?? "",
      gender: d.gender ?? "",
      phone: d.phone,
      email: d.email ?? "",
      permanentAddress: d.permanentAddress ?? "",
      hometown: d.hometown ?? "",
      occupation: d.occupation ?? "",
      workplace: d.workplace ?? "",
      emergencyContactName: d.emergencyContactName ?? "",
      emergencyContactPhone: d.emergencyContactPhone ?? "",
      identityType: d.identityType ?? "CCCD",
      identityNumber: "",
      identityIssuedDate: d.identityIssuedDate ?? "",
      identityIssuedPlace: d.identityIssuedPlace ?? "",
      note: d.note ?? "",
    });
  }, [detail.data, reset]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (isDirty && !leaving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const linkGuard = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        isDirty &&
        !leaving.current &&
        anchor &&
        anchor.origin === location.origin &&
        anchor.pathname !== location.pathname &&
        !window.confirm("Hồ sơ có thay đổi chưa lưu. Bạn muốn rời trang?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", linkGuard, true);
    window.addEventListener("beforeunload", guard);
    return () => {
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("click", linkGuard, true);
    };
  }, [isDirty]);
  const valuesPreview = useWatch({ control });
  const propertyId = Number(useWatch({ control, name: "propertyId" }));
  const residenceRole = useWatch({ control, name: "residenceRole" });
  useEffect(() => {
    if (residenceRole === "REPRESENTATIVE") setValue("roomId", "");
  }, [residenceRole, setValue]);
  const rooms = useMemo(
    () => options.data?.rooms.filter((r) => r.propertyId === propertyId) ?? [],
    [options.data?.rooms, propertyId],
  );
  if ((editing && detail.isLoading) || options.isLoading)
    return <PageLoading />;
  const next = async () => {
    const fields: (keyof FormValues)[] =
      step === 0
        ? ["fullName", "phone", "email"]
        : step === 1
          ? ["identityNumber"]
          : editing
            ? []
            : ["propertyId", "moveInDate"];
    if (await trigger(fields)) setStep((value) => Math.min(value + 1, 2));
  };
  const submit = async (values: FormValues) => {
    if (submitting.current) return;
    submitting.current = true;
    setSubmitError("");
    const payload: SaveTenantPayload = {
      ...values,
      version: editing ? loadedVersion.current : undefined,
      dateOfBirth: values.dateOfBirth || undefined,
      gender: values.gender || undefined,
      email: values.email || undefined,
      identityNumber: values.identityNumber || undefined,
      identityIssuedDate: values.identityIssuedDate || undefined,
      hometown: values.hometown || undefined,
      propertyId: values.propertyId ? Number(values.propertyId) : undefined,
      roomId: values.roomId ? Number(values.roomId) : undefined,
      moveInDate: values.roomId ? values.moveInDate : undefined,
    };
    try {
      if (editing) {
        await mutations.update.mutateAsync(payload);
        leaving.current = true;
        router.push(`/admin/tenants/${tenantId}`);
      } else {
        const created = await mutations.create.mutateAsync(payload);
        router.push(`/admin/tenants/${created.id}`);
      }
    } catch (error) {
      setSubmitError(
        apiErrorMessage(
          error,
          "Không thể lưu hồ sơ. Vui lòng kiểm tra dữ liệu trùng hoặc trường chưa hợp lệ.",
        ),
      );
    } finally {
      submitting.current = false;
    }
  };
  const busy = mutations.create.isPending || mutations.update.isPending;
  return (
    <AdminShell
      title={editing ? "Chỉnh sửa người thuê" : "Tạo hồ sơ khách thuê"}
      subtitle="Thông tin được bảo vệ theo phạm vi nhà trọ"
    >
      <div className="mx-auto max-w-5xl">
        <Link
          href={editing ? `/admin/tenants/${tenantId}` : "/admin/tenants"}
          className="inline-flex items-center gap-2 text-sm font-semibold text-secondary-foreground hover:text-link"
        >
          <ArrowLeft className="size-4" />
          Quay lại
        </Link>
        <section className="mt-5 overflow-hidden surface-card ">
          <div className="border-b border-border bg-muted p-5">
            <div className="grid grid-cols-3 gap-2">
              {[
                "Thông tin cơ bản",
                "Định danh & liên hệ",
                editing ? "Xác nhận" : "Phạm vi hồ sơ",
              ].map((label, index) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 text-xs font-semibold sm:text-sm ${index <= step ? "text-link" : "text-muted-foreground"}`}
                >
                  <span
                    className={`grid size-7 place-items-center rounded-full ${index < step ? "bg-primary hover:bg-primary-hover text-white" : index === step ? "border-2 border-blue-600 bg-card" : "bg-slate-200"}`}
                  >
                    {index < step ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <form
            onSubmit={(event) => void handleSubmit(submit)(event)}
            className="p-5 sm:p-7"
          >
            {submitError && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-danger-border bg-danger-muted px-4 py-3 text-sm text-danger"
              >
                {submitError}
              </div>
            )}
            {step === 0 && (
              <div className="mb-4 space-y-2 rounded-xl bg-muted p-3">
                <button
                  type="button"
                  disabled={checking || !valuesPreview.phone}
                  className="text-sm font-semibold text-link disabled:opacity-40"
                  onClick={async () => {
                    setChecking(true);
                    setDuplicates([]);
                    setDuplicateNotice("");
                    try {
                      const result = await adminTenantService.list({
                        keyword: valuesPreview.phone,
                        propertyId: propertyId || undefined,
                        size: 10,
                      });
                      const found = result.page.items.filter(
                        (p) => p.id !== tenantId,
                      );
                      setDuplicates(found);
                      setDuplicateNotice(
                        found.length
                          ? "Có hồ sơ tương tự, kiểm tra trước khi tạo mới."
                          : "Không thấy hồ sơ tương tự trong phạm vi hiện tại. Hệ thống kiểm tra lại khi lưu.",
                      );
                    } catch (e) {
                      setDuplicateNotice(
                        apiErrorMessage(e, "Không thể kiểm tra hồ sơ trùng."),
                      );
                    } finally {
                      setChecking(false);
                    }
                  }}
                >
                  {checking
                    ? "Đang kiểm tra…"
                    : "Kiểm tra hồ sơ trùng theo điện thoại"}
                </button>
                {duplicateNotice && (
                  <p role="status" className="text-sm text-secondary-foreground">
                    {duplicateNotice}
                  </p>
                )}
                {duplicates.map((p) => (
                  <Link
                    className="block text-sm text-link"
                    key={p.id}
                    href={`/admin/tenants/${p.id}`}
                  >
                    {p.tenantCode} · {p.fullName}
                  </Link>
                ))}
              </div>
            )}
            {step === 2 && (
              <div className="mb-5 rounded-xl border border-accent-border bg-accent p-4 text-sm">
                <strong>Xem lại hồ sơ</strong>
                <p className="mt-2">
                  {valuesPreview.fullName} · {valuesPreview.phone}
                </p>
                <p>{valuesPreview.email || "Chưa có email"}</p>
                <p className="mt-2 text-secondary-foreground">
                  {valuesPreview.roomId
                    ? "Ghi nhận thành viên theo phòng và hợp đồng hợp lệ."
                    : "Tạo hồ sơ độc lập; tiếp tục cấp tài khoản, hợp đồng và nhận phòng từ trang chi tiết."}
                </p>
              </div>
            )}
            {step === 0 && (
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Họ và tên *" error={errors.fullName?.message}>
                  <input
                    {...register("fullName", {
                      required: "Vui lòng nhập họ tên",
                      maxLength: 150,
                    })}
                    className={inputClass}
                    placeholder="Nguyễn Văn An"
                  />
                </Field>
                <Field label="Số điện thoại *" error={errors.phone?.message}>
                  <input
                    {...register("phone", {
                      validate: (value) => {
                        const result = validateVietnamPhone(value);
                        return result.valid || result.message;
                      },
                    })}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={`${inputClass} ${errors.phone ? "border-danger" : ""}`}
                  />
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  <input
                    type="email"
                    {...register("email", {
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Email không hợp lệ",
                      },
                    })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ngày sinh">
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    {...register("dateOfBirth")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Giới tính">
                  <select {...register("gender")} className={inputClass}>
                    <option value="">Chưa chọn</option>
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </Field>
                <Field label="Nghề nghiệp">
                  <input {...register("occupation")} className={inputClass} />
                </Field>
                <Field label="Nơi làm việc">
                  <input {...register("workplace")} className={inputClass} />
                </Field>
                <Field label="Địa chỉ thường trú">
                  <input
                    {...register("permanentAddress")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Quê quán">
                  <input {...register("hometown")} className={inputClass} />
                </Field>
              </div>
            )}
            {step === 1 && (
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Loại giấy tờ">
                  <select {...register("identityType")} className={inputClass}>
                    <option value="CCCD">CCCD</option>
                    <option value="PASSPORT">Hộ chiếu</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </Field>
                <Field
                  label={
                    editing
                      ? "Số giấy tờ (để trống nếu giữ nguyên)"
                      : "Số giấy tờ"
                  }
                >
                  <input
                    {...register("identityNumber", {
                      required: false,
                      maxLength: 50,
                      pattern: {
                        value: /^[A-Za-z0-9]{6,20}$/,
                        message: "Số giấy tờ gồm 6-20 chữ hoặc số",
                      },
                    })}
                    className={inputClass}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Ngày cấp">
                  <input
                    type="date"
                    {...register("identityIssuedDate")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Nơi cấp">
                  <input
                    {...register("identityIssuedPlace")}
                    className={inputClass}
                  />
                </Field>
                <Field label="Người liên hệ khẩn cấp">
                  <input
                    {...register("emergencyContactName")}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="SĐT liên hệ khẩn cấp"
                  error={errors.emergencyContactPhone?.message}
                >
                  <input
                    {...register("emergencyContactPhone", {
                      validate: (value) => {
                        const result = validateVietnamPhone(value, false);
                        return result.valid || result.message;
                      },
                    })}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={`${inputClass} ${errors.emergencyContactPhone ? "border-danger" : ""}`}
                  />
                </Field>
                <Field label="Ghi chú" className="md:col-span-2">
                  <textarea
                    {...register("note")}
                    className={`${inputClass} min-h-24`}
                  />
                </Field>
              </div>
            )}
            {step === 2 &&
              (editing ? (
                <div className="rounded-xl bg-accent p-6 text-sm text-secondary-foreground">
                  <p className="font-bold text-link">
                    Xác nhận cập nhật hồ sơ
                  </p>
                  <p className="mt-2">
                    Thông tin cư trú và hợp đồng không bị thay đổi trong thao
                    tác này.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  <Field
                    label="Nhà trọ quản lý hồ sơ"
                    error={errors.propertyId?.message}
                  >
                    <select
                      {...register("propertyId", {
                        required:
                          user?.activeRole === "MANAGER"
                            ? "Vui lòng chọn nhà trọ quản lý hồ sơ"
                            : false,
                      })}
                      className={inputClass}
                    >
                      <option value="">Chọn nhà trọ</option>
                      {options.data?.properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Phòng">
                    <select
                      {...register("roomId")}
                      disabled={residenceRole === "REPRESENTATIVE"}
                      className={inputClass}
                    >
                      <option value="">Chưa gán phòng</option>
                      {rooms
                        .filter((r) =>
                          ["OCCUPIED", "NOTICE"].includes(r.status),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            Phòng {r.code} · {r.status}
                          </option>
                        ))}
                    </select>
                    {residenceRole === "REPRESENTATIVE" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Tạo hồ sơ trước, sau đó giữ chỗ, lập hợp đồng và nhận
                        phòng tại Vòng đời thuê.
                      </p>
                    )}
                  </Field>
                  <Field
                    label="Ngày vào ở (chỉ khi thêm thành viên)"
                    error={errors.moveInDate?.message}
                  >
                    <input
                      type="date"
                      disabled={residenceRole === "REPRESENTATIVE"}
                      {...register("moveInDate", {
                        required:
                          residenceRole !== "REPRESENTATIVE"
                            ? "Vui lòng chọn ngày vào ở"
                            : false,
                      })}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Vai trò cư trú">
                    <select
                      {...register("residenceRole")}
                      className={inputClass}
                    >
                      <option value="REPRESENTATIVE">Người đại diện</option>
                      <option value="OCCUPANT">Người ở cùng</option>
                      <option value="DEPENDENT">Người phụ thuộc</option>
                    </select>
                  </Field>
                </div>
              ))}
            <div className="mt-8 flex justify-between border-t border-border pt-5">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((v) => v - 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2.5 font-semibold text-secondary-foreground disabled:opacity-40"
              >
                <ArrowLeft className="size-4" />
                Quay lại
              </button>
              {step < 2 ? (
                <button
                  type="button"
                  onClick={() => void next()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 font-semibold text-white"
                >
                  Tiếp tục
                  <ArrowRight className="size-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 font-semibold text-white disabled:opacity-60"
                >
                  <Save className="size-4" />
                  {busy ? "Đang lưu..." : "Lưu hồ sơ"}
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring focus:ring-2 focus:ring-ring";
function Field({
  label,
  error,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`block text-sm font-semibold text-secondary-foreground ${className}`}
    >
      {label}
      {children}
      {error && (
        <span className="mt-1 block text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </label>
  );
}
