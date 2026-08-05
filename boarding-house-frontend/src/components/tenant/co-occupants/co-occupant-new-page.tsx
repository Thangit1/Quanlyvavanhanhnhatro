"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useCoOccupantOverview,
  useCreateCoOccupant,
} from "@/hooks/use-tenant-co-occupants";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import type { CreateCoOccupant } from "@/types/tenant-co-occupant";

const steps = [
  "Thông tin cá nhân",
  "Liên hệ",
  "Giấy tờ tùy thân",
  "Thông tin cư trú",
  "Hồ sơ tạm trú",
  "Kiểm tra và gửi",
];
const empty: CreateCoOccupant = {
  fullName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  permanentAddress: "",
  hometown: "",
  nationality: "Việt Nam",
  occupation: "",
  workplace: "",
  relationship: "",
  emergencyContact: { fullName: "", phone: "", relationship: "" },
  identityDocument: {
    type: "CITIZEN_ID",
    number: "",
    issuedDate: "",
    expiresDate: "",
    issuedPlace: "",
  },
  expectedMoveInDate: "",
  expectedMoveOutDate: "",
  previousAddress: "",
  reason: "",
  note: "",
  requestAccount: false,
};
type Selected = { type: string; file: File; preview?: string };
const today = new Date().toISOString().slice(0, 10);
const input =
  "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
function Field({
  labelText,
  children,
  required,
}: {
  labelText: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {labelText}
      {required && <span className="text-red-600"> *</span>}
      {children}
    </label>
  );
}
export function CoOccupantNewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const overview = useCoOccupantOverview(user?.activeRole === "TENANT");
  const create = useCreateCoOccupant();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState<Selected[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const key = useRef("");
  const set = <K extends keyof CreateCoOccupant>(
    name: K,
    value: CreateCoOccupant[K],
  ) => setForm((x) => ({ ...x, [name]: value }));
  const setIdentity = (
    name: keyof CreateCoOccupant["identityDocument"],
    value: string,
  ) =>
    setForm((x) => ({
      ...x,
      identityDocument: { ...x.identityDocument, [name]: value },
    }));
  const setEmergency = (
    name: "fullName" | "phone" | "relationship",
    value: string,
  ) =>
    setForm((x) => ({
      ...x,
      emergencyContact: {
        fullName: "",
        phone: "",
        relationship: "",
        ...x.emergencyContact,
        [name]: value,
      },
    }));
  const validation = useMemo(
    () => validate(step, form, accepted),
    [step, form, accepted],
  );
  if (overview.isLoading) return <PageLoading />;
  if (overview.isError || !overview.data)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void overview.refetch()} />
      </main>
    );
  if (!overview.data.permissions.canCreateOccupantRequest)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link href="/tenant/co-occupants" className="text-blue-700">
          ← Quay lại
        </Link>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h1 className="text-2xl font-black">
            Không thể đăng ký người ở cùng
          </h1>
          <p className="mt-2 text-amber-800">
            {overview.data.permissions.createDisabledReason}
          </p>
        </div>
      </main>
    );
  const next = () => {
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setStep((x) => Math.min(5, x + 1));
  };
  const submit = async () => {
    const message = validate(5, form, accepted);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    if (!key.current) key.current = globalThis.crypto.randomUUID();
    try {
      const created = await create.mutateAsync({
        payload: normalize(form),
        key: key.current,
        files,
      });
      router.replace(`/tenant/co-occupants/requests/${created.id}`);
    } catch (e) {
      setError(apiErrorMessage(e, "Không thể gửi yêu cầu. Vui lòng thử lại."));
    }
  };
  return (
    <main className="mx-auto max-w-6xl p-4 pb-28 sm:p-6 lg:pb-8">
      <Link
        href="/tenant/co-occupants"
        className="inline-flex items-center gap-2 font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Người ở cùng
      </Link>
      <div className="mt-4">
        <h1 className="text-3xl font-black">Đăng ký người ở cùng</h1>
        <p className="mt-1 text-slate-500">
          Yêu cầu chỉ có hiệu lực sau khi được quản lý phê duyệt.
        </p>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden rounded-2xl border bg-white p-4 lg:block">
          {steps.map((x, i) => (
            <div
              key={x}
              className={`flex gap-3 border-l-2 px-3 py-3 ${i === step ? "border-blue-600 bg-blue-50 font-bold text-blue-700" : i < step ? "border-emerald-500 text-emerald-700" : "border-slate-200 text-slate-500"}`}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs">
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              {x}
            </div>
          ))}
        </aside>
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 lg:hidden">
            <div className="flex justify-between text-sm font-bold">
              <span>Bước {step + 1}/6</span>
              <span>{steps[step]}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-600"
                style={{ width: `${((step + 1) / 6) * 100}%` }}
              />
            </div>
          </div>
          <h2 className="text-xl font-black">{steps[step]}</h2>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <div className="mt-5">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field labelText="Họ và tên" required>
                  <input
                    value={form.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    className={input}
                  />
                </Field>
                <Field labelText="Ngày sinh" required>
                  <input
                    type="date"
                    max={today}
                    value={form.dateOfBirth}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                    className={input}
                  />
                </Field>
                <Field labelText="Giới tính">
                  <select
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                    className={input}
                  >
                    <option value="">Không cung cấp</option>
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </Field>
                <Field labelText="Quan hệ với người đại diện" required>
                  <input
                    value={form.relationship}
                    onChange={(e) => set("relationship", e.target.value)}
                    className={input}
                    placeholder="Ví dụ: Vợ, chồng, bạn bè..."
                  />
                </Field>
                <Field labelText="Nghề nghiệp">
                  <input
                    value={form.occupation}
                    onChange={(e) => set("occupation", e.target.value)}
                    className={input}
                  />
                </Field>
                <Field labelText="Nơi làm việc / trường học">
                  <input
                    value={form.workplace}
                    onChange={(e) => set("workplace", e.target.value)}
                    className={input}
                  />
                </Field>
                <Field labelText="Quốc tịch">
                  <input
                    value={form.nationality}
                    onChange={(e) => set("nationality", e.target.value)}
                    className={input}
                  />
                </Field>
                <Field labelText="Quê quán">
                  <input
                    value={form.hometown}
                    onChange={(e) => set("hometown", e.target.value)}
                    className={input}
                  />
                </Field>
              </div>
            )}
            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field labelText="Số điện thoại" required>
                  <input
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    className={input}
                  />
                </Field>
                <Field labelText="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={input}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field labelText="Địa chỉ thường trú" required>
                    <textarea
                      rows={3}
                      value={form.permanentAddress}
                      onChange={(e) => set("permanentAddress", e.target.value)}
                      className={input}
                    />
                  </Field>
                </div>
                <Field labelText="Người liên hệ khẩn cấp">
                  <input
                    value={form.emergencyContact?.fullName}
                    onChange={(e) => setEmergency("fullName", e.target.value)}
                    className={input}
                  />
                </Field>
                <Field labelText="Số điện thoại khẩn cấp">
                  <input
                    inputMode="tel"
                    value={form.emergencyContact?.phone}
                    onChange={(e) => setEmergency("phone", e.target.value)}
                    className={input}
                  />
                </Field>
                <Field labelText="Quan hệ với người liên hệ">
                  <input
                    value={form.emergencyContact?.relationship}
                    onChange={(e) =>
                      setEmergency("relationship", e.target.value)
                    }
                    className={input}
                  />
                </Field>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field labelText="Loại giấy tờ" required>
                    <select
                      value={form.identityDocument.type}
                      onChange={(e) => setIdentity("type", e.target.value)}
                      className={input}
                    >
                      <option value="CITIZEN_ID">Căn cước công dân</option>
                      <option value="PASSPORT">Hộ chiếu</option>
                      <option value="BIRTH_CERTIFICATE">Giấy khai sinh</option>
                      <option value="OTHER">Giấy tờ khác</option>
                    </select>
                  </Field>
                  <Field labelText="Số giấy tờ" required>
                    <input
                      autoComplete="off"
                      value={form.identityDocument.number}
                      onChange={(e) => setIdentity("number", e.target.value)}
                      className={input}
                    />
                  </Field>
                  <Field labelText="Ngày cấp">
                    <input
                      type="date"
                      value={form.identityDocument.issuedDate}
                      onChange={(e) =>
                        setIdentity("issuedDate", e.target.value)
                      }
                      className={input}
                    />
                  </Field>
                  <Field labelText="Ngày hết hạn">
                    <input
                      type="date"
                      value={form.identityDocument.expiresDate}
                      onChange={(e) =>
                        setIdentity("expiresDate", e.target.value)
                      }
                      className={input}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field labelText="Nơi cấp">
                      <input
                        value={form.identityDocument.issuedPlace}
                        onChange={(e) =>
                          setIdentity("issuedPlace", e.target.value)
                        }
                        className={input}
                      />
                    </Field>
                  </div>
                </div>
                <FilePicker files={files} setFiles={setFiles} />
              </div>
            )}
            {step === 3 && (
              <div className="space-y-5">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <b>
                    {overview.data.room.propertyName} · Phòng{" "}
                    {overview.data.room.roomCode}
                  </b>
                  <p className="mt-1 text-slate-500">
                    {overview.data.room.currentOccupantCount}/
                    {overview.data.room.maximumOccupants} người · Hợp đồng{" "}
                    {overview.data.contract.code}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field labelText="Ngày dự kiến chuyển vào" required>
                    <input
                      type="date"
                      min={today}
                      value={form.expectedMoveInDate}
                      onChange={(e) =>
                        set("expectedMoveInDate", e.target.value)
                      }
                      className={input}
                    />
                  </Field>
                  <Field labelText="Ngày dự kiến chuyển đi">
                    <input
                      type="date"
                      value={form.expectedMoveOutDate}
                      onChange={(e) =>
                        set("expectedMoveOutDate", e.target.value)
                      }
                      className={input}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field labelText="Lý do ở cùng" required>
                      <textarea
                        rows={4}
                        value={form.reason}
                        onChange={(e) => set("reason", e.target.value)}
                        className={input}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field labelText="Ghi chú">
                      <textarea
                        rows={3}
                        value={form.note}
                        onChange={(e) => set("note", e.target.value)}
                        className={input}
                      />
                    </Field>
                  </div>
                  <label className="sm:col-span-2 flex gap-3 rounded-xl border p-4 text-sm">
                    <input
                      type="checkbox"
                      checked={form.requestAccount}
                      onChange={(e) => set("requestAccount", e.target.checked)}
                      className="size-4"
                    />
                    <span>
                      <b>Đề nghị tạo tài khoản SmartHome AI</b>
                      <br />
                      <span className="text-slate-500">
                        Việc chọn không đồng nghĩa tài khoản được tạo tự động.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <Field labelText="Nơi ở trước đây">
                  <textarea
                    rows={3}
                    value={form.previousAddress}
                    onChange={(e) => set("previousAddress", e.target.value)}
                    className={input}
                  />
                </Field>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  Thông tin được sử dụng để hỗ trợ quản lý hồ sơ cư trú. Trạng
                  thái khai báo chỉ được cập nhật sau khi quản lý xác nhận.
                </div>
                <p className="text-sm text-slate-500">
                  Các giấy tờ tạm trú bổ sung có thể chọn ở bước giấy tờ hoặc
                  tải thêm sau khi gửi yêu cầu.
                </p>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-5">
                <div className="grid gap-4 rounded-2xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
                  <Review name="Họ tên" value={form.fullName} />
                  <Review
                    name="Ngày sinh"
                    value={formatDate(form.dateOfBirth)}
                  />
                  <Review name="Điện thoại" value={form.phone} />
                  <Review name="Email" value={form.email || "Không cung cấp"} />
                  <Review name="Giấy tờ" value={form.identityDocument.type} />
                  <Review
                    name="Số giấy tờ"
                    value={maskIdentity(form.identityDocument.number)}
                  />
                  <Review name="Phòng" value={overview.data.room.roomCode} />
                  <Review
                    name="Chuyển vào"
                    value={formatDate(form.expectedMoveInDate)}
                  />
                  <Review name="Quan hệ" value={form.relationship} />
                  <Review name="Tệp đính kèm" value={`${files.length} tệp`} />
                </div>
                <label className="flex gap-3 rounded-xl border p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    Tôi xác nhận thông tin đã cung cấp là chính xác và hiểu rằng
                    yêu cầu cần được quản lý phê duyệt trước khi người này được
                    ghi nhận là đang cư trú.
                  </span>
                </label>
              </div>
            )}
          </div>
          <div className="mt-8 flex justify-between gap-3">
            <button
              disabled={step === 0 || create.isPending}
              onClick={() => {
                setError("");
                setStep((x) => Math.max(0, x - 1));
              }}
              className="rounded-xl border px-5 py-3 font-semibold disabled:opacity-30"
            >
              Quay lại
            </button>
            {step < 5 ? (
              <button
                onClick={next}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
              >
                Tiếp tục
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                disabled={create.isPending || !accepted}
                onClick={() => void submit()}
                className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-40"
              >
                {create.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
function Review({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{name}</p>
      <p className="font-semibold">{value || "—"}</p>
    </div>
  );
}
function maskIdentity(v: string) {
  return v ? "********" + v.slice(-4) : "—";
}
function normalize(x: CreateCoOccupant): CreateCoOccupant {
  return {
    ...x,
    fullName: x.fullName.trim(),
    phone: x.phone.trim(),
    email: x.email?.trim() || undefined,
    permanentAddress: x.permanentAddress.trim(),
    hometown: x.hometown?.trim() || undefined,
    nationality: x.nationality?.trim() || undefined,
    occupation: x.occupation?.trim() || undefined,
    workplace: x.workplace?.trim() || undefined,
    relationship: x.relationship.trim(),
    previousAddress: x.previousAddress?.trim() || undefined,
    note: x.note?.trim() || undefined,
    expectedMoveOutDate: x.expectedMoveOutDate || undefined,
    emergencyContact: x.emergencyContact?.fullName
      ? x.emergencyContact
      : undefined,
    identityDocument: {
      ...x.identityDocument,
      issuedDate: x.identityDocument.issuedDate || undefined,
      expiresDate: x.identityDocument.expiresDate || undefined,
      issuedPlace: x.identityDocument.issuedPlace?.trim() || undefined,
    },
  };
}
function validate(step: number, x: CreateCoOccupant, accepted: boolean) {
  const phone = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/;
  if (
    step === 0 &&
    (!x.fullName.trim() ||
      !/[\p{L}]/u.test(x.fullName) ||
      !x.dateOfBirth ||
      !x.relationship.trim())
  )
    return "Vui lòng nhập đầy đủ và đúng thông tin cá nhân bắt buộc.";
  if (
    step === 1 &&
    (!phone.test(x.phone.trim()) ||
      !x.permanentAddress.trim() ||
      (x.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email)) ||
      (x.emergencyContact?.phone && !phone.test(x.emergencyContact.phone)))
  )
    return "Vui lòng kiểm tra số điện thoại, email và địa chỉ thường trú.";
  if (
    step === 2 &&
    (!x.identityDocument.type || !x.identityDocument.number.trim())
  )
    return "Vui lòng nhập loại và số giấy tờ tùy thân.";
  if (
    step === 3 &&
    (!x.expectedMoveInDate ||
      x.reason.trim().length < 10 ||
      (x.expectedMoveOutDate && x.expectedMoveOutDate <= x.expectedMoveInDate))
  )
    return "Vui lòng kiểm tra ngày cư trú và nhập lý do ít nhất 10 ký tự.";
  if (step === 5 && !accepted)
    return "Bạn cần xác nhận thông tin trước khi gửi.";
  return "";
}
function FilePicker({
  files,
  setFiles,
}: {
  files: Selected[];
  setFiles: React.Dispatch<React.SetStateAction<Selected[]>>;
}) {
  const add = (type: string, list: FileList | null) => {
    if (!list) return;
    const next: Selected[] = Array.from(list)
      .filter(
        (f) =>
          ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
            f.type,
          ) && f.size <= 5 * 1024 * 1024,
      )
      .slice(0, 5 - files.length)
      .map((file) => ({ type, file }));
    setFiles((x) => [...x, ...next]);
    next.forEach((item) => {
      if (!item.file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () =>
        setFiles((current) =>
          current.map((value) =>
            value.file === item.file
              ? { ...value, preview: String(reader.result) }
              : value,
          ),
        );
      reader.readAsDataURL(item.file);
    });
  };
  return (
    <div>
      <p className="text-sm font-semibold">
        Ảnh và tài liệu (JPG, PNG, WEBP, PDF; tối đa 5MB/tệp)
      </p>
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-sm font-semibold text-blue-700 focus-within:ring-4 focus-within:ring-blue-100">
        <Upload className="size-5" />
        Chọn hoặc chụp giấy tờ
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(e) => add("OTHER", e.target.files)}
        />
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {files.map((x, i) => (
          <div
            key={`${x.file.name}-${i}`}
            className="flex items-center gap-3 rounded-xl border p-2"
          >
            <FilePreview item={x} />
            <span className="min-w-0 flex-1 truncate text-xs">
              {x.file.name}
            </span>
            <button
              aria-label={`Xóa ${x.file.name}`}
              onClick={() => setFiles((v) => v.filter((_, j) => j !== i))}
              className="rounded-lg p-2 text-red-600"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
function FilePreview({ item }: { item: Selected }) {
  return item.preview ? (
    <Image
      src={item.preview}
      alt={`Xem trước ${item.file.name}`}
      width={44}
      height={44}
      unoptimized
      className="size-11 rounded-lg object-cover"
    />
  ) : (
    <span className="grid size-11 place-items-center rounded-lg bg-red-50 text-red-600">
      <FileText className="size-5" />
    </span>
  );
}
