"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MapPin,
  MessageSquare,
  PackagePlus,
  Pause,
  Phone,
  Play,
  Route,
  Save,
  Send,
  Stethoscope,
  Upload,
} from "lucide-react";
import { useTaskMutations, useTechnicianTask } from "@/hooks/use-technician";
import { apiErrorMessage } from "@/lib/api-error";
import {
  ErrorState,
  formatDate,
  formatMoney,
  Loading,
  Page,
  PriorityBadge,
  StatusBadge,
} from "@/components/technician/technician-ui";
import type { TaskDetail } from "@/types/technician";
const tabs = [
  "Tổng quan",
  "Chẩn đoán & nhật ký",
  "Checklist & ảnh",
  "Vật tư & chi phí",
  "Trao đổi & lịch sử",
] as const;
export function TechnicianTaskDetail({ id }: { id: number }) {
  const q = useTechnicianTask(id);
  const m = useTaskMutations(id);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Tổng quan");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data)
    return (
      <Page title="Chi tiết công việc">
        <ErrorState retry={() => void q.refetch()} />
      </Page>
    );
  const d = q.data;
  const run = async (action: string, payload: object) => {
    setError("");
    setNotice("");
    try {
      const result = await m.action.mutateAsync({ action, payload });
      setNotice(
        (result as { message?: string }).message ?? "Đã cập nhật công việc.",
      );
    } catch (e) {
      setError(apiErrorMessage(e, "Không thể cập nhật công việc."));
    }
  };
  return (
    <Page
      title={d.task.title}
      description={`${d.task.taskCode} · ${d.task.requestCode}`}
      actions={
        <Link
          href="/technician/tasks"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"
        >
          <ArrowLeft className="size-4" />
          Danh sách
        </Link>
      }
    >
      {d.safetyRisk && (
        <div className="flex gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800">
          <AlertTriangle className="size-6 shrink-0" />
          <div>
            <p className="font-bold">Cảnh báo rủi ro an toàn</p>
            <p className="text-sm">
              Ngắt nguồn và liên hệ quản lý theo quy trình trước khi thao tác.
              Không thực hiện thao tác nguy hiểm khi chưa đủ điều kiện.
            </p>
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={d.task.priority} />
          <StatusBadge status={d.task.status} />
          <span className="text-xs text-slate-500">
            Tiến độ {d.task.progressPercent}%
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Actions d={d} busy={m.action.isPending} run={run} />
        </div>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}
      </section>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
          {tabs.map((x) => (
            <button
              key={x}
              onClick={() => setTab(x)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === x ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      {tab === "Tổng quan" && <Overview d={d} />}{" "}
      {tab === "Chẩn đoán & nhật ký" && <DiagnosisLogs d={d} run={run} />}{" "}
      {tab === "Checklist & ảnh" && (
        <ChecklistFiles
          d={d}
          checklist={m.checklist.mutateAsync}
          upload={m.upload.mutateAsync}
          setError={setError}
          setNotice={setNotice}
        />
      )}{" "}
      {tab === "Vật tư & chi phí" && <MaterialsCosts d={d} run={run} />}{" "}
      {tab === "Trao đổi & lịch sử" && <MessagesHistory d={d} run={run} />}
    </Page>
  );
}

function Actions({
  d,
  busy,
  run,
}: {
  d: TaskDetail;
  busy: boolean;
  run: (a: string, p: object) => Promise<void>;
}) {
  const p = d.permissions,
    v = d.task.version;
  return (
    <>
      {p.canAccept && (
        <Button
          onClick={() => run("accept", { version: v })}
          icon={CheckCircle2}
          label="Tiếp nhận"
        />
      )}
      {p.canDecline && (
        <Button
          secondary
          onClick={() => {
            const reason = window.prompt("Lý do từ chối công việc?");
            if (reason) void run("decline", { version: v, reason, note: "" });
          }}
          icon={AlertTriangle}
          label="Từ chối"
        />
      )}
      {p.canStartTravel && (
        <Button
          onClick={() => run("start-travel", { version: v })}
          icon={Route}
          label="Bắt đầu di chuyển"
        />
      )}
      {p.canCheckIn && (
        <Button
          onClick={() =>
            run("check-in", {
              version: v,
              checkedInAt: new Date().toISOString(),
              note: "",
            })
          }
          icon={MapPin}
          label="Xác nhận có mặt"
        />
      )}
      {p.canStart && (
        <Button
          onClick={() => run("start", { version: v })}
          icon={Play}
          label="Bắt đầu xử lý"
        />
      )}
      {p.canPause && (
        <Button
          secondary
          onClick={() => {
            const reason = window.prompt(
              "Nhập PAUSED, WAITING_PARTS, WAITING_TENANT hoặc WAITING_APPROVAL",
              "PAUSED",
            );
            if (reason) void run("pause", { version: v, reason, note: "" });
          }}
          icon={Pause}
          label="Tạm dừng"
        />
      )}
      {p.canResume && (
        <Button
          onClick={() => run("resume", { version: v })}
          icon={Play}
          label="Tiếp tục"
        />
      )}
      {p.canRequestTransfer && (
        <Button
          secondary
          onClick={() => {
            const reason = window.prompt("Lý do cần chuyển công việc?");
            if (reason)
              void run("transfer-requests", { version: v, reason, note: "" });
          }}
          icon={Send}
          label="Yêu cầu chuyển"
        />
      )}
      <Button
        secondary
        onClick={() => {
          const start = window.prompt("Lịch đề xuất (YYYY-MM-DDTHH:mm)");
          const reason = start && window.prompt("Lý do đổi lịch?");
          if (start && reason)
            void run("reschedule-requests", {
              version: v,
              proposedStart: start,
              reason,
            });
        }}
        icon={Clock3}
        label="Đổi lịch"
        disabled={busy}
      />
    </>
  );
}
function Button({
  label,
  icon: Icon,
  onClick,
  secondary = false,
  disabled = false,
}: {
  label: string;
  icon: typeof Play;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-50 ${secondary ? "border border-slate-200 bg-white text-slate-700" : "bg-blue-600 text-white"}`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function Overview({ d }: { d: TaskDetail }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
        <Block title="Nội dung sự cố">
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {d.description}
          </p>
        </Block>
        <Block title="Địa điểm">
          <p className="flex gap-2 text-sm">
            <MapPin className="size-4 text-blue-600" />
            {d.task.property.name}
            {d.task.room ? ` · ${d.task.room.name}` : ""}
          </p>
          {d.task.asset && (
            <p className="mt-2 text-sm text-slate-600">
              Thiết bị: {d.task.asset.code} · {d.task.asset.name}
            </p>
          )}
        </Block>
        <Block title="Lịch xử lý">
          <p className="text-sm">
            {formatDate(d.schedule?.start ?? d.task.scheduledStart)}
          </p>
          {d.schedule && (
            <p className="mt-1 text-xs text-slate-500">
              Dự kiến {d.schedule.durationMinutes} phút ·{" "}
              {d.schedule.tenantPresenceRequired
                ? "Cần người thuê có mặt"
                : "Không bắt buộc người thuê có mặt"}
            </p>
          )}
        </Block>
      </section>
      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Liên hệ cần thiết</h2>
          <p className="mt-3 text-sm font-semibold">
            {d.tenantContact?.fullName ?? "Chưa có"}
          </p>
          {d.tenantContact?.phone && (
            <a
              href={`tel:${d.tenantContact.phone}`}
              className="mt-2 flex items-center gap-2 text-sm font-semibold text-blue-700"
            >
              <Phone className="size-4" />
              {d.tenantContact.phone}
            </a>
          )}
          <p className="mt-3 text-xs text-slate-500">
            {d.tenantContact?.availableTime ?? "Chưa cung cấp khung giờ"}
          </p>
          {d.tenantContact?.accessNote && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              {d.tenantContact.accessNote}
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">SLA</h2>
          <p
            className={`mt-2 text-sm font-semibold ${d.task.overdue ? "text-red-600" : "text-slate-700"}`}
          >
            {formatDate(d.task.slaDueAt)}
          </p>
        </section>
      </aside>
    </div>
  );
}

function DiagnosisLogs({
  d,
  run,
}: {
  d: TaskDetail;
  run: (a: string, p: object) => Promise<void>;
}) {
  const submitDiagnosis = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run("diagnosis", {
      version: d.task.version,
      observedCondition: f.get("observedCondition"),
      symptoms: f.get("symptoms"),
      preliminaryCause: f.get("preliminaryCause"),
      rootCause: f.get("rootCause"),
      damageLevel: f.get("damageLevel"),
      assetUsable: f.get("assetUsable") === "on",
      safetyRisk: f.get("safetyRisk") === "on",
      replacementRequired: f.get("replacementRequired") === "on",
      supportRequired: false,
      externalVendorRequired: false,
      recommendedSolution: f.get("recommendedSolution"),
    });
  };
  const submitLog = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run("work-logs", {
      version: d.task.version,
      activityType: "REPAIR",
      description: f.get("description"),
      result: f.get("result"),
      progressPercent: Number(f.get("progress")),
      durationMinutes: Number(f.get("duration")),
      note: "",
    });
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form
        onSubmit={submitDiagnosis}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h2 className="flex items-center gap-2 font-bold">
          <Stethoscope className="size-5 text-blue-600" />
          Chẩn đoán kỹ thuật
        </h2>
        <Area
          name="observedCondition"
          label="Hiện trạng quan sát"
          defaultValue={d.diagnosis?.observedCondition}
          required
        />
        <Area
          name="symptoms"
          label="Triệu chứng"
          defaultValue={d.diagnosis?.symptoms}
        />
        <Area
          name="preliminaryCause"
          label="Nguyên nhân sơ bộ"
          defaultValue={d.diagnosis?.preliminaryCause}
        />
        <Area
          name="rootCause"
          label="Nguyên nhân gốc"
          defaultValue={d.diagnosis?.rootCause}
        />
        <label className="block text-sm font-medium">
          Mức hư hỏng
          <select
            name="damageLevel"
            defaultValue={d.diagnosis?.damageLevel ?? "MEDIUM"}
            className="mt-1 min-h-11 w-full rounded-xl border px-3"
          >
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>HIGH</option>
            <option>CRITICAL</option>
          </select>
        </label>
        <Area
          name="recommendedSolution"
          label="Giải pháp đề xuất"
          defaultValue={d.diagnosis?.recommendedSolution}
          required
        />
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <label>
            <input
              type="checkbox"
              name="assetUsable"
              defaultChecked={d.diagnosis?.assetUsable}
            />{" "}
            Thiết bị còn dùng
          </label>
          <label>
            <input
              type="checkbox"
              name="safetyRisk"
              defaultChecked={d.diagnosis?.safetyRisk}
            />{" "}
            Rủi ro an toàn
          </label>
          <label>
            <input
              type="checkbox"
              name="replacementRequired"
              defaultChecked={d.diagnosis?.replacementRequired}
            />{" "}
            Cần thay thế
          </label>
        </div>
        <Submit label="Lưu chẩn đoán" />
      </form>
      <div className="space-y-5">
        <form
          onSubmit={submitLog}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="font-bold">Thêm nhật ký công việc</h2>
          <Area name="description" label="Nội dung đã thực hiện" required />
          <Area name="result" label="Kết quả" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              Tiến độ %
              <input
                name="progress"
                type="number"
                min="0"
                max="100"
                defaultValue={Math.max(10, d.task.progressPercent)}
                className="mt-1 min-h-11 w-full rounded-xl border px-3"
              />
            </label>
            <label className="text-sm font-medium">
              Số phút
              <input
                name="duration"
                type="number"
                min="1"
                max="1440"
                defaultValue="30"
                className="mt-1 min-h-11 w-full rounded-xl border px-3"
              />
            </label>
          </div>
          <Submit label="Ghi nhật ký" />
        </form>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Nhật ký gần đây</h2>
          <div className="mt-4 space-y-3">
            {d.workLogs.map((x) => (
              <div key={x.id} className="border-l-2 border-blue-200 pl-3">
                <p className="text-sm font-semibold">{x.description}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(x.createdAt)} · {x.progressPercent}% ·{" "}
                  {x.durationMinutes} phút
                </p>
              </div>
            ))}
            {!d.workLogs.length && (
              <p className="text-sm text-slate-500">Chưa có nhật ký.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ChecklistFiles({
  d,
  checklist,
  upload,
  setError,
  setNotice,
}: {
  d: TaskDetail;
  checklist: (x: object) => Promise<unknown>;
  upload: (x: {
    version: number;
    type: string;
    file: File;
    caption?: string;
  }) => Promise<unknown>;
  setError: (x: string) => void;
  setNotice: (x: string) => void;
}) {
  const save = async (itemId: number, result: string) => {
    try {
      await checklist({
        version: d.task.version,
        items: [{ checklistItemId: itemId, result, note: "" }],
      });
      setNotice("Đã cập nhật checklist.");
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };
  const up = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      file = f.get("file");
    if (!(file instanceof File) || !file.size) return;
    try {
      await upload({
        version: d.task.version,
        type: String(f.get("type")),
        file,
        caption: String(f.get("caption") ?? ""),
      });
      setNotice("Đã tải ảnh lên.");
      e.currentTarget.reset();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <ClipboardCheck className="size-5 text-blue-600" />
          Checklist bắt buộc
        </h2>
        <div className="mt-4 space-y-3">
          {d.checklist.map((x) => (
            <div
              key={x.id}
              className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
            >
              <p className="flex-1 text-sm font-medium">
                {x.label}
                {x.required && <span className="text-red-500"> *</span>}
              </p>
              <select
                value={x.result ?? ""}
                onChange={(e) => void save(x.id, e.target.value)}
                className="min-h-10 rounded-lg border px-2"
              >
                <option value="">Chưa kiểm tra</option>
                <option value="PASSED">Đạt</option>
                <option value="FAILED">Không đạt</option>
                <option value="NOT_APPLICABLE">Không áp dụng</option>
              </select>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-5">
        <form
          onSubmit={up}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="flex items-center gap-2 font-bold">
            <Camera className="size-5 text-blue-600" />
            Ảnh hiện trường và kết quả
          </h2>
          <select
            name="type"
            className="min-h-11 w-full rounded-xl border px-3"
          >
            <option value="BEFORE">Trước xử lý</option>
            <option value="DURING">Trong xử lý</option>
            <option value="AFTER">Sau xử lý / kết quả</option>
            <option value="DOCUMENT">Tài liệu</option>
          </select>
          <input
            name="caption"
            placeholder="Mô tả ảnh"
            className="min-h-11 w-full rounded-xl border px-3"
          />
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-sm"
          />
          <p className="text-xs text-slate-500">
            JPEG, PNG hoặc WebP; tối đa 10 MB. Backend kiểm tra chữ ký tệp thực
            tế.
          </p>
          <Submit label="Tải ảnh lên" icon={Upload} />
        </form>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Tệp đã tải</h2>
          <div className="mt-3 space-y-2">
            {d.attachments.map((x) => (
              <div
                key={x.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"
              >
                <span className="min-w-0 truncate">{x.name}</span>
                <span className="ml-3 text-xs font-semibold text-blue-700">
                  {x.type}
                </span>
              </div>
            ))}
            {!d.attachments.length && (
              <p className="text-sm text-slate-500">Chưa có tệp.</p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function MaterialsCosts({
  d,
  run,
}: {
  d: TaskDetail;
  run: (a: string, p: object) => Promise<void>;
}) {
  const material = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run("material-requests", {
      version: d.task.version,
      items: [
        {
          materialId: null,
          materialName: f.get("name"),
          quantity: Number(f.get("quantity")),
          unit: f.get("unit"),
          reason: f.get("reason"),
        },
      ],
      urgency: f.get("urgency"),
      neededAt: null,
      note: "",
    });
  };
  const cost = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run("cost-proposals", {
      version: d.task.version,
      items: [
        {
          costType: f.get("type"),
          name: f.get("name"),
          quantity: Number(f.get("quantity")),
          unitPrice: Number(f.get("price")),
          reason: f.get("reason"),
        },
      ],
      proposedResponsibility: f.get("responsibility"),
      note: "",
    });
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <form
          onSubmit={material}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="flex items-center gap-2 font-bold">
            <PackagePlus className="size-5 text-blue-600" />
            Yêu cầu vật tư
          </h2>
          <Input name="name" label="Tên vật tư" required />
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="quantity"
              label="Số lượng"
              type="number"
              defaultValue="1"
              required
            />
            <Input name="unit" label="Đơn vị" defaultValue="cái" required />
          </div>
          <Input name="reason" label="Lý do" required />
          <label className="block text-sm font-medium">
            Mức gấp
            <select
              name="urgency"
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            >
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>URGENT</option>
            </select>
          </label>
          <Submit label="Gửi yêu cầu" />
        </form>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Vật tư đã sử dụng</h2>
          {d.materials.map((x) => (
            <p key={x.id} className="mt-3 flex justify-between text-sm">
              <span>
                {x.name} · {x.quantity} {x.unit}
              </span>
              <span>{formatMoney(x.amount)}</span>
            </p>
          ))}
          {!d.materials.length && (
            <p className="mt-3 text-sm text-slate-500">Chưa ghi nhận vật tư.</p>
          )}
        </section>
      </div>
      <div className="space-y-5">
        <form
          onSubmit={cost}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="font-bold">Đề xuất chi phí</h2>
          <label className="block text-sm font-medium">
            Loại chi phí
            <select
              name="type"
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            >
              <option value="MATERIAL">Vật tư</option>
              <option value="LABOR">Nhân công</option>
              <option value="EXTERNAL_SERVICE">Dịch vụ ngoài</option>
              <option value="OTHER">Khác</option>
            </select>
          </label>
          <Input name="name" label="Nội dung" required />
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="quantity"
              label="Số lượng"
              type="number"
              defaultValue="1"
              required
            />
            <Input
              name="price"
              label="Đơn giá"
              type="number"
              defaultValue="0"
              required
            />
          </div>
          <Input name="reason" label="Lý do" required />
          <label className="block text-sm font-medium">
            Bên dự kiến chịu
            <select
              name="responsibility"
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            >
              <option value="OWNER">Chủ nhà</option>
              <option value="TENANT">Người thuê</option>
              <option value="SHARED">Chia sẻ</option>
              <option value="PENDING_REVIEW">Chờ xác định</option>
            </select>
          </label>
          <Submit label="Gửi chờ phê duyệt" />
        </form>
        {d.costs.map((x) => (
          <section
            key={x.id}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex justify-between">
              <h2 className="font-bold">{formatMoney(x.totalCost)}</h2>
              <span className="text-xs font-semibold text-amber-700">
                {x.approvalStatus}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {x.responsibility} · Kỹ thuật viên không thể tự phê duyệt
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}

function MessagesHistory({
  d,
  run,
}: {
  d: TaskDetail;
  run: (a: string, p: object) => Promise<void>;
}) {
  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run("messages", {
      content: f.get("content"),
      internal: f.get("internal") === "on",
    });
    e.currentTarget.reset();
  };
  const complete = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run("complete", {
      version: d.task.version,
      rootCause: f.get("rootCause"),
      resolution: f.get("resolution"),
      startedAt: null,
      completedAt: new Date().toISOString(),
      assetConditionAfter: f.get("condition"),
      testResult: f.get("testResult"),
      followUpRequired: f.get("followUp") === "on",
      followUpDate: f.get("followUpDate") || null,
      recommendation: f.get("recommendation"),
      note: "",
    });
  };
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <form
          onSubmit={send}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="flex items-center gap-2 font-bold">
            <MessageSquare className="size-5 text-blue-600" />
            Trao đổi công việc
          </h2>
          <Area name="content" label="Nội dung" required />
          <label className="text-sm">
            <input name="internal" type="checkbox" /> Ghi chú nội bộ (người thuê
            không thấy)
          </label>
          <Submit label="Gửi tin nhắn" icon={Send} />
        </form>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="space-y-3">
            {d.messages.map((x) => (
              <div
                key={x.id}
                className={`rounded-xl p-3 text-sm ${x.internal ? "bg-amber-50" : "bg-slate-50"}`}
              >
                <p>{x.content}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {x.senderName} · {x.internal ? "Nội bộ" : "Công khai"} ·{" "}
                  {formatDate(x.createdAt)}
                </p>
              </div>
            ))}
            {!d.messages.length && (
              <p className="text-sm text-slate-500">Chưa có trao đổi.</p>
            )}
          </div>
        </section>
      </div>
      <div className="space-y-5">
        {d.permissions.canComplete && (
          <form
            onSubmit={complete}
            className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
          >
            <h2 className="font-bold text-emerald-900">Báo hoàn thành</h2>
            <p className="text-xs text-emerald-800">
              Cần chẩn đoán, nhật ký, checklist bắt buộc và ảnh sau xử lý. Kết
              quả sẽ chuyển sang chờ nghiệm thu.
            </p>
            <Area
              name="rootCause"
              label="Nguyên nhân gốc"
              defaultValue={d.diagnosis?.rootCause}
              required
            />
            <Area name="resolution" label="Cách xử lý" required />
            <Input
              name="condition"
              label="Tình trạng thiết bị sau xử lý"
              defaultValue="GOOD"
              required
            />
            <Area name="testResult" label="Kết quả chạy thử" required />
            <label className="text-sm">
              <input name="followUp" type="checkbox" /> Cần theo dõi lại
            </label>
            <Input name="followUpDate" label="Ngày theo dõi" type="date" />
            <Area name="recommendation" label="Khuyến nghị" />
            <Submit label="Báo hoàn thành" icon={CheckCircle2} />
          </form>
        )}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Lịch sử công khai</h2>
          <div className="mt-4 space-y-3">
            {d.history.map((x) => (
              <div key={x.id} className="border-l-2 border-slate-200 pl-3">
                <p className="text-sm font-medium">{x.description}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(x.createdAt)} · {x.newStatus}
                </p>
              </div>
            ))}
          </div>
        </section>
        {d.inspection && (
          <section className="rounded-2xl border border-purple-200 bg-purple-50 p-5">
            <h2 className="font-bold text-purple-900">
              Kết quả nghiệm thu (chỉ xem)
            </h2>
            <p className="mt-2 text-sm">
              {d.inspection.result} · {d.inspection.rating ?? "—"}/5
            </p>
            <p className="mt-1 text-sm text-purple-800">
              {d.inspection.comment}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </div>
  );
}
function Area({
  name,
  label,
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        rows={3}
        className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500"
      />
    </label>
  );
}
function Input({
  name,
  label,
  type = "text",
  defaultValue,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500"
      />
    </label>
  );
}
function Submit({
  label,
  icon: Icon = Save,
}: {
  label: string;
  icon?: typeof Save;
}) {
  return (
    <button className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">
      <Icon className="size-4" />
      {label}
    </button>
  );
}
