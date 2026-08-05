"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FilePenLine,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useAccountActions,
  useProfileRequests,
  useTenantProfile,
} from "@/hooks/use-tenant-account";
import type {
  TenantProfile,
  UpdateProfilePayload,
} from "@/types/tenant-account";
import { apiErrorMessage } from "@/lib/api-error";
import {
  accountDate,
  accountStatusLabels,
  label,
  profileStatusLabels,
  residenceStatusLabels,
} from "@/constants/tenant-account";
import {
  AccountAvatar,
  AccountLoading,
  AccountPageLayout,
  StatusPill,
} from "./account-ui";
import { ErrorState } from "@/components/shared/dashboard-ui";
export function ProfilePage() {
  const { user } = useAuth(),
    profile = useTenantProfile(user?.activeRole === "TENANT"),
    requests = useProfileRequests(user?.activeRole === "TENANT");
  if (profile.isLoading) return <AccountLoading />;
  if (profile.isError || !profile.data)
    return (
      <AccountPageLayout
        title="Hồ sơ cá nhân"
        description="Cập nhật thông tin liên hệ và thông tin cá nhân của bạn."
      >
        <ErrorState onRetry={() => void profile.refetch()} />
      </AccountPageLayout>
    );
  return (
    <ProfileForm
      key={profile.data.profile.version}
      initial={profile.data}
      requests={requests.data ?? []}
    />
  );
}
function ProfileForm({
  initial,
  requests,
}: {
  initial: TenantProfile;
  requests: { id: number; status: string; reason: string; createdAt: string }[];
}) {
  const { refreshUser } = useAuth(),
    actions = useAccountActions(),
    fileRef = useRef<HTMLInputElement>(null),
    [value, setValue] = useState<UpdateProfilePayload>(() => payload(initial)),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState(0),
    [requestOpen, setRequestOpen] = useState(false),
    [legalName, setLegalName] = useState(initial.profile.fullName),
    [reason, setReason] = useState("");
  const dirty = useMemo(
    () => JSON.stringify(value) !== JSON.stringify(payload(initial)),
    [value, initial],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (key: keyof UpdateProfilePayload, val: string) =>
    setValue((x) => ({ ...x, [key]: val }));
  const save = () =>
    actions.updateProfile.mutate(value, {
      onSuccess: (data) => {
        setValue(payload(data.profile));
        setMessage("Thông tin cá nhân đã được cập nhật.");
      },
      onError: (e) => setMessage(apiErrorMessage(e)),
    });
  const avatar = (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage("Ảnh phải là JPG, PNG hoặc WEBP và không vượt quá 5 MB.");
      return;
    }
    actions.uploadAvatar.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: async () => {
          setMessage("Ảnh đại diện đã được thay đổi.");
          setProgress(0);
          await refreshUser();
        },
        onError: (e) => setMessage(apiErrorMessage(e)),
      },
    );
  };
  return (
    <AccountPageLayout
      title="Hồ sơ cá nhân"
      description="Cập nhật thông tin liên hệ và thông tin cá nhân của bạn."
    >
      {message && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 font-semibold text-blue-800"
        >
          {message}
        </p>
      )}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Ảnh đại diện</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <AccountAvatar
            name={initial.profile.fullName}
            avatarUrl={initial.profile.avatarUrl}
          />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => avatar(e.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white"
              >
                <Camera className="size-4" />
                Thay đổi ảnh
              </button>
              {initial.profile.avatarUrl && (
                <button
                  onClick={() =>
                    actions.deleteAvatar.mutate(undefined, {
                      onSuccess: async () => {
                        setMessage("Ảnh đại diện đã được xóa.");
                        await refreshUser();
                      },
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold text-red-700"
                >
                  <Trash2 className="size-4" />
                  Xóa ảnh
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              JPG, PNG hoặc WEBP · tối đa 5 MB
            </p>
            {progress > 0 && (
              <progress value={progress} max={100} className="mt-2 w-56" />
            )}
          </div>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black">
              Thông tin do quản lý xác nhận
            </h2>
            <p className="text-sm text-slate-500">
              <LockKeyhole className="mr-1 inline size-4" />
              Các trường này không thể sửa trực tiếp.
            </p>
          </div>
          <button
            onClick={() => setRequestOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold text-blue-700"
          >
            <FilePenLine className="size-4" />
            Gửi yêu cầu cập nhật
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Read label="Họ và tên" value={initial.profile.fullName} />
          <Read
            label="Ngày sinh"
            value={accountDate(initial.profile.dateOfBirth)}
          />
          <Read label="Mã người thuê" value={initial.profile.tenantCode} />
          <Read
            label="Trạng thái hồ sơ"
            value={label(profileStatusLabels, initial.profile.profileStatus)}
          />
          <Read
            label="Vai trò cư trú"
            value={label(residenceStatusLabels, initial.residenceRole)}
          />
          <Read
            label="Phòng / hợp đồng"
            value={[initial.roomCode, initial.contractCode]
              .filter(Boolean)
              .join(" · ")}
          />
          <Read
            label="Trạng thái tài khoản"
            value={label(accountStatusLabels, initial.accountStatus)}
          />
          <Read
            label="Tạm trú"
            value={label(
              residenceStatusLabels,
              initial.temporaryResidenceStatus,
            )}
          />
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Thông tin liên hệ và nghề nghiệp</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Nghề nghiệp"
            value={value.occupation}
            onChange={(v) => change("occupation", v)}
          />
          <Field
            label="Nơi làm việc hoặc trường học"
            value={value.workplace}
            onChange={(v) => change("workplace", v)}
          />
          <Field
            label="Số điện thoại"
            value={value.phone}
            inputMode="tel"
            autoComplete="tel"
            required
            onChange={(v) => change("phone", v)}
          />
          <Field
            label="Email liên hệ"
            value={value.contactEmail}
            type="email"
            autoComplete="email"
            onChange={(v) => change("contactEmail", v)}
          />
          <label className="sm:col-span-2 text-sm font-bold">
            Địa chỉ thường trú
            <textarea
              value={value.addressDetail ?? ""}
              onChange={(e) => change("addressDetail", e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border p-3 font-normal"
            />
          </label>
        </div>
        <h3 className="mt-6 font-black">Liên hệ khẩn cấp</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="Họ và tên"
            value={value.emergencyContact.fullName}
            onChange={(v) =>
              setValue((x) => ({
                ...x,
                emergencyContact: { ...x.emergencyContact, fullName: v },
              }))
            }
          />
          <Field
            label="Quan hệ"
            value={value.emergencyContact.relationship}
            onChange={(v) =>
              setValue((x) => ({
                ...x,
                emergencyContact: { ...x.emergencyContact, relationship: v },
              }))
            }
          />
          <Field
            label="Số điện thoại"
            value={value.emergencyContact.phone}
            inputMode="tel"
            onChange={(v) =>
              setValue((x) => ({
                ...x,
                emergencyContact: { ...x.emergencyContact, phone: v },
              }))
            }
          />
          <Field
            label="Địa chỉ"
            value={value.emergencyContact.address}
            onChange={(v) =>
              setValue((x) => ({
                ...x,
                emergencyContact: { ...x.emergencyContact, address: v },
              }))
            }
          />
        </div>
      </section>
      {dirty && (
        <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-900 p-4 text-white shadow-xl lg:bottom-4">
          <b className="mr-auto">Có thay đổi chưa được lưu</b>
          <button
            onClick={() => setValue(payload(initial))}
            className="rounded-xl bg-white/10 px-4 py-2 font-bold"
          >
            Hủy thay đổi
          </button>
          <button
            disabled={actions.updateProfile.isPending}
            onClick={save}
            className="rounded-xl bg-blue-500 px-5 py-2 font-bold"
          >
            {actions.updateProfile.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      )}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-black">Yêu cầu cập nhật gần đây</h2>
        {requests.length ? (
          <div className="mt-3 space-y-2">
            {requests.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
              >
                <CheckCircle2 className="size-4 text-blue-600" />
                <span className="flex-1 text-sm">{r.reason}</span>
                <StatusPill>
                  {r.status === "PENDING" ? "Chờ duyệt" : r.status}
                </StatusPill>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Bạn chưa gửi yêu cầu cập nhật nào.
          </p>
        )}
      </section>
      {requestOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/50 sm:place-items-center"
        >
          <section className="w-full rounded-t-3xl bg-white p-5 sm:max-w-lg sm:rounded-2xl">
            <h2 className="text-xl font-black">Yêu cầu đổi họ tên pháp lý</h2>
            <p className="mt-1 text-sm text-slate-500">
              Dữ liệu chính thức chỉ thay đổi sau khi quản lý phê duyệt.
            </p>
            <Field
              label="Họ tên đề nghị"
              value={legalName}
              onChange={setLegalName}
            />
            <label className="mt-3 block text-sm font-bold">
              Lý do
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
                rows={3}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setRequestOpen(false)}
                className="rounded-xl border p-3 font-bold"
              >
                Hủy
              </button>
              <button
                disabled={
                  !legalName.trim() ||
                  !reason.trim() ||
                  actions.requestUpdate.isPending
                }
                onClick={() =>
                  actions.requestUpdate.mutate(
                    {
                      fieldChanges: {
                        fullName: {
                          oldValue: initial.profile.fullName,
                          newValue: legalName.trim(),
                        },
                      },
                      reason,
                    },
                    {
                      onSuccess: () => {
                        setRequestOpen(false);
                        setMessage("Yêu cầu cập nhật hồ sơ đã được gửi.");
                      },
                      onError: (e) => setMessage(apiErrorMessage(e)),
                    },
                  )
                }
                className="rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-40"
              >
                Gửi yêu cầu
              </button>
            </div>
          </section>
        </div>
      )}
    </AccountPageLayout>
  );
}
function payload(x: TenantProfile): UpdateProfilePayload {
  return {
    occupation: x.profile.occupation ?? "",
    workplace: x.profile.workplace ?? "",
    phone: x.phone ?? "",
    contactEmail: x.contactEmail ?? "",
    addressDetail: x.permanentAddress ?? "",
    emergencyContact: { ...x.emergencyContact },
    version: x.profile.version,
  };
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  ...props
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  [key: string]: unknown;
}) {
  return (
    <label className="mt-3 block text-sm font-bold">
      {label}
      <input
        {...props}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal"
      />
    </label>
  );
}
function Read({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-1 font-semibold">{value || "Chưa cập nhật"}</p>
    </div>
  );
}
