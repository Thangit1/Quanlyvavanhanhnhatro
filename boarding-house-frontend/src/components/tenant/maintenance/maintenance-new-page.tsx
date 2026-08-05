"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useCreateMaintenance,
  useMaintenanceLocations,
} from "@/hooks/use-tenant-maintenance";
import { apiErrorMessage } from "@/lib/api-error";
import {
  areaLabels,
  categories,
  issueQuestions,
} from "@/constants/tenant-maintenance";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import type { CreateMaintenance } from "@/types/tenant-maintenance";
const pad = (n: number) => String(n).padStart(2, "0");
const localNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const today = () => new Date().toISOString().slice(0, 10);
const initial: CreateMaintenance = {
  roomId: 0,
  areaCode: "ROOM",
  title: "",
  description: "",
  category: "",
  reportedPriority: "MEDIUM",
  detectedAt: localNow(),
  safetyRisk: false,
  continuousIssue: false,
  preferredSchedule: {
    preferredDate: today(),
    timeSlot: "18:00-20:00",
    tenantPresenceRequired: true,
    accessPreference: "TENANT_PRESENT",
    petsPresent: false,
  },
  contactPhone: "",
};
export function MaintenanceNewPage() {
  const { user } = useAuth();
  const router = useRouter();
  const locations = useMaintenanceLocations(user?.activeRole === "TENANT");
  const create = useCreateMaintenance();
  const [step, setStep] = useState(1),
    [data, setData] = useState(initial),
    [files, setFiles] = useState<Array<{ file: File; url: string }>>([]),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState("");
  const key = useRef<string | null>(null);
  if (locations.isLoading) return <PageLoading />;
  if (locations.isError)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void locations.refetch()} />
      </main>
    );
  const selected = locations.data?.find(
      (x) => x.location.roomId === data.roomId,
    ),
    assets = selected?.assets ?? [];
  function patch<K extends keyof CreateMaintenance>(
    k: K,
    v: CreateMaintenance[K],
  ) {
    setData((x) => ({ ...x, [k]: v }));
  }
  function schedule(k: string, v: unknown) {
    setData((x) => ({
      ...x,
      preferredSchedule: { ...x.preferredSchedule, [k]: v },
    }));
  }
  function addFiles(list: FileList | null) {
    if (!list) return;
    setError("");
    const added: Array<{ file: File; url: string }> = [];
    for (const f of Array.from(list)) {
      const ok = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
        ].includes(f.type),
        limit = f.type === "video/mp4" ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
      if (!ok || f.size > limit) {
        setError(`${f.name}: định dạng hoặc dung lượng không hợp lệ.`);
        continue;
      }
      added.push({ file: f, url: URL.createObjectURL(f) });
    }
    setFiles((old) => {
      const all = [...old, ...added];
      if (all.length > 5) {
        added.forEach((x) => URL.revokeObjectURL(x.url));
        setError("Mỗi yêu cầu được tải tối đa 5 tệp.");
        return old;
      }
      return all;
    });
  }
  function valid() {
    if (step === 1) return data.roomId > 0 && !!data.areaCode;
    if (step === 2) return !!data.category;
    if (step === 3)
      return (
        data.title.trim().length >= 5 &&
        data.description.trim().length >= 10 &&
        !!data.detectedAt
      );
    if (step === 5)
      return (
        !!data.preferredSchedule.preferredDate && !!data.contactPhone.trim()
      );
    if (step === 6) return confirmed;
    return true;
  }
  async function submit() {
    if (!valid()) return;
    setError("");
    key.current ??=
      globalThis.crypto?.randomUUID?.() ??
      `maintenance-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const made = await create.mutateAsync({
        payload: data,
        key: key.current,
        files: files.map((x) => x.file),
      });
      files.forEach((x) => URL.revokeObjectURL(x.url));
      router.replace(`/tenant/maintenance/${made.id}`);
    } catch (e) {
      setError(apiErrorMessage(e, "Không thể gửi yêu cầu sửa chữa."));
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Quay lại
      </button>
      <div>
        <h1 className="text-3xl font-black">Gửi yêu cầu sửa chữa</h1>
        <p className="mt-1 text-slate-500">
          Cung cấp thông tin theo từng bước để quản lý xử lý nhanh hơn.
        </p>
      </div>
      <div className="flex gap-1" aria-label={`Bước ${step} trên 6`}>
        {[1, 2, 3, 4, 5, 6].map((x) => (
          <div
            key={x}
            className={`h-2 flex-1 rounded-full ${x <= step ? "bg-blue-600" : "bg-slate-200"}`}
          />
        ))}
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700"
        >
          {error}
        </div>
      )}
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
        {step === 1 && (
          <>
            <Title n={1} text="Chọn phòng và khu vực" />
            {!locations.data?.length ? (
              <div className="rounded-xl bg-amber-50 p-4 text-amber-800">
                Bạn chưa có hợp đồng đang hiệu lực nên chưa thể gửi yêu cầu.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {locations.data.map((x) => (
                  <button
                    key={x.location.roomId}
                    onClick={() => patch("roomId", x.location.roomId)}
                    className={`rounded-xl border p-4 text-left ${data.roomId === x.location.roomId ? "border-blue-600 bg-blue-50" : ""}`}
                  >
                    <b>
                      {x.location.propertyName} · Phòng {x.location.roomCode}
                    </b>
                    <p className="text-sm text-slate-500">
                      {x.location.propertyAddress}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <label className="mt-5 block text-sm font-semibold">
              Khu vực xảy ra sự cố
              <select
                value={data.areaCode}
                onChange={(e) => patch("areaCode", e.target.value)}
                className="mt-1 block w-full rounded-xl border p-3"
              >
                {Object.entries(areaLabels).map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <label className="mt-4 block text-sm font-semibold">
                Thiết bị liên quan
                <select
                  value={data.assetId ?? ""}
                  onChange={(e) =>
                    patch(
                      "assetId",
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                  className="mt-1 block w-full rounded-xl border p-3"
                >
                  <option value="">
                    Không xác định hoặc không liên quan thiết bị
                  </option>
                  {assets.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <Title n={2} text="Chọn loại sự cố" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(([code, name, desc, Icon]) => (
                <button
                  key={code}
                  onClick={() => patch("category", code)}
                  className={`rounded-xl border p-4 text-left ${data.category === code ? "border-blue-600 bg-blue-50" : ""}`}
                >
                  <Icon className="size-6 text-blue-600" />
                  <b className="mt-2 block">{name}</b>
                  <span className="text-sm text-slate-500">{desc}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <Title n={3} text="Mô tả chi tiết" />
            <div className="space-y-4">
              <Field
                label="Tiêu đề"
                value={data.title}
                onChange={(v) => patch("title", v)}
                placeholder="Ví dụ: Bình nóng lạnh không lên nguồn"
              />
              <label className="block text-sm font-semibold">
                Mức độ ảnh hưởng
                <select
                  value={data.reportedPriority}
                  onChange={(e) => patch("reportedPriority", e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                >
                  <option value="LOW">Thấp — ít ảnh hưởng</option>
                  <option value="MEDIUM">Trung bình — gây bất tiện</option>
                  <option value="HIGH">Cao — ảnh hưởng nghiêm trọng</option>
                  <option value="URGENT">Khẩn cấp — nguy cơ mất an toàn</option>
                </select>
              </label>
              {data.reportedPriority === "URGENT" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                  <AlertTriangle className="mr-2 inline size-5" />
                  <b>Ưu tiên an toàn:</b> ngừng sử dụng khu vực hoặc thiết bị
                  nếu có thể làm vậy an toàn và liên hệ quản lý. Hệ thống không
                  tự gọi dịch vụ khẩn cấp.
                  {selected?.managerPhone && (
                    <p className="mt-2">
                      Số quản lý: <b>{selected.managerPhone}</b>
                    </p>
                  )}
                </div>
              )}
              <label className="block text-sm font-semibold">
                Mô tả triệu chứng
                <textarea
                  value={data.description}
                  onChange={(e) => patch("description", e.target.value)}
                  rows={6}
                  maxLength={5000}
                  className="mt-1 block w-full rounded-xl border p-3"
                />
              </label>
              {issueQuestions[data.category]?.length && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <b className="text-sm">Thông tin nên bổ sung:</b>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {issueQuestions[data.category].map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Field
                type="datetime-local"
                label="Thời điểm phát hiện"
                value={data.detectedAt}
                onChange={(v) => patch("detectedAt", v)}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <Check
                  text="Xảy ra liên tục"
                  checked={data.continuousIssue}
                  onChange={(v) => patch("continuousIssue", v)}
                />
                <Check
                  text="Có nguy cơ an toàn"
                  checked={data.safetyRisk}
                  onChange={(v) => patch("safetyRisk", v)}
                />
                <Check
                  text="Thiết bị còn sử dụng được"
                  checked={data.assetUsable === true}
                  onChange={(v) => patch("assetUsable", v)}
                />
              </div>
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <Title n={4} text="Hình ảnh và video" />
            <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-8 text-blue-700">
              <Camera className="size-8" />
              <b className="mt-2">Chụp ảnh hoặc chọn tệp</b>
              <span className="text-sm">
                Ảnh tối đa 5 MB, MP4 tối đa 20 MB; tổng cộng 5 tệp
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4"
                capture="environment"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {files.map((x, i) => (
                <div
                  key={x.url}
                  className="relative overflow-hidden rounded-xl border bg-slate-50"
                >
                  {x.file.type.startsWith("image/") ? (
                    <Image
                      src={x.url}
                      alt={`Minh chứng ${i + 1}`}
                      width={320}
                      height={128}
                      unoptimized
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <video
                      src={x.url}
                      className="h-32 w-full object-cover"
                      controls
                    />
                  )}
                  <button
                    aria-label={`Xóa ${x.file.name}`}
                    onClick={() => {
                      URL.revokeObjectURL(x.url);
                      setFiles((v) => v.filter((y) => y !== x));
                    }}
                    className="absolute right-1 top-1 rounded-full bg-white p-2 text-red-600 shadow"
                  >
                    <Trash2 className="size-4" />
                  </button>
                  <p className="truncate p-2 text-xs">{x.file.name}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 5 && (
          <>
            <Title n={5} text="Thời gian thuận tiện" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                type="date"
                min={today()}
                label="Ngày mong muốn"
                value={data.preferredSchedule.preferredDate}
                onChange={(v) => schedule("preferredDate", v)}
              />
              <label className="text-sm font-semibold">
                Khung giờ
                <select
                  value={data.preferredSchedule.timeSlot}
                  onChange={(e) => schedule("timeSlot", e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                >
                  <option>08:00-10:00</option>
                  <option>10:00-12:00</option>
                  <option>13:30-15:30</option>
                  <option>15:30-17:30</option>
                  <option>18:00-20:00</option>
                </select>
              </label>
              <Field
                label="Số điện thoại liên hệ"
                value={data.contactPhone}
                onChange={(v) => patch("contactPhone", v)}
              />
              <label className="text-sm font-semibold">
                Quyền vào phòng
                <select
                  value={data.preferredSchedule.accessPreference}
                  onChange={(e) => schedule("accessPreference", e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                >
                  <option value="TENANT_PRESENT">Cần tôi có mặt</option>
                  <option value="ANYTIME">Có thể vào theo nội quy</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold">
              Ghi chú khi vào phòng
              <textarea
                value={data.preferredSchedule.accessNote ?? ""}
                onChange={(e) => schedule("accessNote", e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-xl border p-3"
              />
            </label>
            <Check
              text="Có vật nuôi trong phòng"
              checked={data.preferredSchedule.petsPresent}
              onChange={(v) => schedule("petsPresent", v)}
            />
          </>
        )}
        {step === 6 && (
          <>
            <Title n={6} text="Kiểm tra và gửi" />
            <div className="space-y-3 rounded-xl bg-slate-50 p-5 text-sm">
              <Review
                k="Vị trí"
                v={
                  selected
                    ? `${selected.location.propertyName} · Phòng ${selected.location.roomCode} · ${areaLabels[data.areaCode]}`
                    : "—"
                }
              />
              <Review
                k="Loại sự cố"
                v={categories.find((x) => x[0] === data.category)?.[1] ?? "—"}
              />
              <Review k="Tiêu đề" v={data.title} />
              <Review k="Mô tả" v={data.description} />
              <Review
                k="Mức độ"
                v={
                  {
                    LOW: "Thấp",
                    MEDIUM: "Trung bình",
                    HIGH: "Cao",
                    URGENT: "Khẩn cấp",
                  }[data.reportedPriority] ?? data.reportedPriority
                }
              />
              <Review
                k="Thời gian mong muốn"
                v={`${data.preferredSchedule.preferredDate} · ${data.preferredSchedule.timeSlot}`}
              />
              <Review k="Minh chứng" v={`${files.length} tệp`} />
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-xl border p-4">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 size-4"
              />
              <span>
                Tôi xác nhận thông tin cung cấp là đúng và đồng ý để quản lý
                liên hệ xử lý sự cố.
              </span>
            </label>
          </>
        )}
        <div className="mt-7 flex justify-between border-t pt-5">
          <button
            disabled={step === 1}
            onClick={() => setStep((x) => x - 1)}
            className="rounded-xl border px-5 py-2 font-semibold disabled:opacity-0"
          >
            Quay lại
          </button>
          {step < 6 ? (
            <button
              disabled={!valid()}
              onClick={() => setStep((x) => x + 1)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-40"
            >
              Tiếp tục
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              disabled={!confirmed || create.isPending}
              onClick={submit}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white disabled:opacity-40"
            >
              <CheckCircle2 className="size-4" />
              {create.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
function Title({ n, text }: { n: number; text: string }) {
  return (
    <h2 className="mb-5 text-xl font-black">
      Bước {n}: {text}
    </h2>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-xl border p-3 font-normal"
      />
    </label>
  );
}
function Check({
  text,
  checked,
  onChange,
}: {
  text: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-3 flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4"
      />
      {text}
    </label>
  );
}
function Review({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <b>{k}:</b>{" "}
      <span className="whitespace-pre-wrap text-slate-600">{v || "—"}</span>
    </div>
  );
}
