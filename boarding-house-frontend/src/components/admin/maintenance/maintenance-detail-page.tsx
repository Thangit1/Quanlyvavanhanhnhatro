"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  Coins,
  HardHat,
  PackagePlus,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageLoading } from "@/components/shared/dashboard-ui";
import {
  PriorityBadge,
  StatusBadge,
  categoryLabel,
} from "./maintenance-shared";
import {
  useMaintenanceData,
  useMaintenanceDetail,
  useMaintenanceMutations,
} from "@/hooks/use-admin-maintenance";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";
export function MaintenanceDetailPage({ id }: { id: number }) {
  const query = useMaintenanceDetail(id);
  const mutations = useMaintenanceMutations(id);
  const { options } = useMaintenanceData({ page: 0, size: 10 });
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  if (query.isLoading) return <PageLoading />;
  if (query.error || !query.data)
    return (
      <AdminShell title="Chi tiết bảo trì">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {apiErrorMessage(query.error, "Không tìm thấy yêu cầu bảo trì.")}
          <button onClick={() => query.refetch()} className="ml-3 font-bold">
            Thử lại
          </button>
        </div>
      </AdminShell>
    );
  const d = query.data,
    r = d.request;
  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      setAction("");
    } catch (x) {
      setError(apiErrorMessage(x, "Không thể thực hiện thao tác."));
    }
  };
  return (
    <AdminShell title={r.requestCode} subtitle={r.title} readOnly>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/maintenance"
              className="rounded-xl border border-slate-200 bg-white p-2"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <p className="text-sm text-slate-500">
                Bảo trì / {r.requestCode}
              </p>
              <h1 className="text-2xl font-black text-slate-950">{r.title}</h1>
              <div className="mt-2 flex gap-2">
                <PriorityBadge priority={r.priority} />
                <StatusBadge status={r.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.permissions.canTriage && (
              <Action
                icon={ClipboardCheck}
                label="Phân loại"
                onClick={() => setAction("triage")}
              />
            )}{" "}
            {d.permissions.canAssign && (
              <Action
                icon={HardHat}
                label="Phân công"
                onClick={() => setAction("assign")}
              />
            )}{" "}
            {d.permissions.canSchedule && (
              <Action
                icon={CalendarClock}
                label="Lên lịch"
                onClick={() => setAction("schedule")}
              />
            )}{" "}
            {d.permissions.canStart && (
              <Action
                icon={Play}
                label="Bắt đầu"
                primary
                onClick={() =>
                  act(() => mutations.start.mutateAsync(r.version))
                }
              />
            )}{" "}
            {d.permissions.canUpdateProgress && (
              <Action
                icon={RefreshCw}
                label="Cập nhật"
                onClick={() => setAction("progress")}
              />
            )}{" "}
            {d.permissions.canComplete && (
              <Action
                icon={ShieldCheck}
                label="Hoàn thành"
                primary
                onClick={() => setAction("complete")}
              />
            )}
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <main className="space-y-6">
            <Card title="Tổng quan">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Info label="Mã yêu cầu" value={r.requestCode} />
                <Info label="Loại sự cố" value={categoryLabel(r.category)} />
                <Info label="Khu trọ" value={r.property.name} />
                <Info
                  label="Phòng / khu vực"
                  value={r.room?.name ?? "Khu vực chung"}
                />
                <Info label="Người báo" value={r.reporter?.name ?? "Quản lý"} />
                <Info
                  label="Người phụ trách"
                  value={r.assignee?.name ?? "Chưa phân công"}
                />
                <Info label="Tạo lúc" value={formatDate(r.createdAt)} />
                <Info
                  label="Hạn SLA"
                  value={r.slaDueAt ? formatDate(r.slaDueAt) : "Chưa thiết lập"}
                />
              </dl>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">
                  Mô tả
                </p>
                <p className="mt-2 whitespace-pre-wrap text-slate-700">
                  {d.description}
                </p>
              </div>
              {r.safetyRisk && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
                  Yêu cầu có nguy cơ ảnh hưởng an toàn, cần ưu tiên kiểm tra.
                </div>
              )}
            </Card>
            <Card title="Tiến độ và nhật ký">
              {!d.workLogs.length ? (
                <Empty text="Chưa có nhật ký xử lý." />
              ) : (
                <div className="space-y-4">
                  {d.workLogs.map((x) => (
                    <div key={x.id} className="border-l-2 border-blue-200 pl-4">
                      <div className="flex justify-between gap-3">
                        <p className="font-bold">
                          Tiến độ {x.progressPercent}% · {x.actor.name}
                        </p>
                        <span className="text-xs text-slate-500">
                          {formatDate(x.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {x.workPerformed || x.note || x.actionType}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Vật tư và chi phí">
              <div className="mb-4 flex flex-wrap gap-2">
                {d.permissions.canAddMaterial && (
                  <Action
                    icon={PackagePlus}
                    label="Thêm vật tư"
                    onClick={() => setAction("material")}
                  />
                )}{" "}
                {d.permissions.canSubmitCost && (
                  <Action
                    icon={Coins}
                    label="Ghi nhận chi phí"
                    onClick={() => setAction("cost")}
                  />
                )}
              </div>
              {d.materials.map((x) => (
                <div
                  key={x.id}
                  className="flex justify-between border-t border-slate-100 py-3 text-sm"
                >
                  <span>
                    {x.name} · {x.quantity} {x.unit}
                  </span>
                  <b>{formatCurrency(x.amount)}</b>
                </div>
              ))}
              {d.costs.map((x) => (
                <div key={x.id} className="mt-3 rounded-xl bg-blue-50 p-4">
                  <div className="flex justify-between">
                    <b>Tổng chi phí</b>
                    <b className="text-blue-700">
                      {formatCurrency(x.totalCost)}
                    </b>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Trách nhiệm: {x.responsibility} · {x.approvalStatus}
                  </p>
                </div>
              ))}
            </Card>
            <Card title="Nghiệm thu">
              {d.permissions.canInspect && (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => setAction("inspect-pass")}
                    className="btn-primary"
                  >
                    Nghiệm thu đạt
                  </button>
                  <button
                    onClick={() => setAction("inspect-fail")}
                    className="btn-secondary"
                  >
                    Không đạt / Mở lại
                  </button>
                </div>
              )}
              {d.inspections.map((x) => (
                <div key={x.id} className="rounded-xl bg-slate-50 p-4">
                  <p className="font-bold">
                    {x.result === "PASSED" ? "Nghiệm thu đạt" : "Không đạt"} ·{" "}
                    {x.inspector.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {x.comment || "Không có ghi chú"}
                  </p>
                </div>
              ))}
            </Card>
          </main>
          <aside className="space-y-6">
            <Card title="Kế hoạch xử lý">
              {!d.schedules.length ? (
                <Empty text="Chưa có lịch xử lý." />
              ) : (
                d.schedules.map((x) => (
                  <div key={x.id} className="rounded-xl bg-blue-50 p-4 text-sm">
                    <b>{formatDate(x.start)}</b>
                    <p className="mt-1 text-slate-600">
                      Dự kiến {x.durationMinutes} phút
                    </p>
                  </div>
                ))
              )}
            </Card>
            <Card title="Chi phí">
              <p className="text-sm text-slate-500">Dự kiến</p>
              <p className="text-xl font-black">
                {formatCurrency(r.estimatedCost)}
              </p>
              <p className="mt-3 text-sm text-slate-500">Thực tế</p>
              <p className="text-xl font-black text-blue-700">
                {formatCurrency(r.actualCost)}
              </p>
            </Card>
            <Card title="Lịch sử">
              <div className="space-y-4">
                {d.history.map((x) => (
                  <div key={x.id}>
                    <p className="text-sm font-semibold">{x.description}</p>
                    <p className="text-xs text-slate-500">
                      {x.actor.name} · {formatDate(x.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
            {d.permissions.canReopen && (
              <Action
                icon={RefreshCw}
                label="Mở lại yêu cầu"
                onClick={() => setAction("reopen")}
              />
            )}{" "}
            {d.permissions.canCancel && (
              <Action
                icon={XCircle}
                label="Hủy yêu cầu"
                onClick={() => setAction("cancel")}
              />
            )}
          </aside>
        </div>
        {action && (
          <ActionDialog
            action={action}
            version={r.version}
            technicians={options.data?.technicians ?? []}
            close={() => setAction("")}
            submit={async (payload) => {
              const map: Record<string, () => Promise<unknown>> = {
                triage: () => mutations.triage.mutateAsync(payload),
                assign: () => mutations.assign.mutateAsync(payload),
                schedule: () => mutations.schedule.mutateAsync(payload),
                progress: () => mutations.workLog.mutateAsync(payload),
                material: () => mutations.material.mutateAsync(payload),
                cost: () => mutations.cost.mutateAsync(payload),
                complete: () => mutations.complete.mutateAsync(payload),
                "inspect-pass": () => mutations.inspect.mutateAsync(payload),
                "inspect-fail": () => mutations.inspect.mutateAsync(payload),
                reopen: () => mutations.reopen.mutateAsync(payload),
                cancel: () => mutations.cancel.mutateAsync(payload),
              };
              await act(map[action]);
            }}
          />
        )}
      </div>
    </AdminShell>
  );
}
function ActionDialog({
  action,
  version,
  technicians,
  close,
  submit,
}: {
  action: string;
  version: number;
  technicians: Array<{ id: number; name: string }>;
  close: () => void;
  submit: (p: any) => Promise<void>;
}) {
  const now = DEFAULT_SCHEDULE_START;
  const [form, setForm] = useState<any>({
    version,
    category: "OTHER",
    priority: "MEDIUM",
    slaDueAt: now,
    technicianId: technicians[0]?.id,
    scheduledStart: now,
    scheduledEnd: DEFAULT_SCHEDULE_END,
    estimatedDurationMinutes: 60,
    tenantPresenceRequired: false,
    actionType: "PROGRESS",
    progressPercent: 50,
    materialName: "",
    quantity: 1,
    unit: "cái",
    unitPrice: 0,
    laborCost: 0,
    materialCost: 0,
    externalServiceCost: 0,
    otherCost: 0,
    responsibility: "OWNER",
    tenantShareAmount: 0,
    diagnosis: "",
    resolution: "",
    result: action === "inspect-pass" ? "PASSED" : "FAILED",
    rating: 5,
    assetWorking: true,
    costConfirmed: true,
    reason: "",
    comment: "",
  });
  const fields =
    action === "triage" ? (
      <>
        <Select
          label="Loại sự cố"
          value={form.category}
          onChange={(v: string) => setForm({ ...form, category: v })}
          options={[
            ["OTHER", "Khác"],
            ["ELECTRICAL", "Điện"],
            ["WATER", "Nước"],
            ["AIR_CONDITIONER", "Điều hòa"],
            ["SECURITY", "An ninh"],
            ["FIRE_SAFETY", "PCCC"],
          ]}
        />
        <Select
          label="Mức độ"
          value={form.priority}
          onChange={(v: string) => setForm({ ...form, priority: v })}
          options={[
            ["LOW", "Thấp"],
            ["MEDIUM", "Trung bình"],
            ["HIGH", "Cao"],
            ["URGENT", "Khẩn cấp"],
          ]}
        />
        <Input
          label="Hạn SLA"
          type="datetime-local"
          value={form.slaDueAt}
          onChange={(v: string) => setForm({ ...form, slaDueAt: v })}
        />
      </>
    ) : action === "assign" ? (
      <Select
        label="Nhân viên kỹ thuật"
        value={form.technicianId}
        onChange={(v: string) => setForm({ ...form, technicianId: Number(v) })}
        options={technicians.map((x) => [String(x.id), x.name])}
      />
    ) : action === "schedule" ? (
      <>
        <Input
          label="Bắt đầu"
          type="datetime-local"
          value={form.scheduledStart}
          onChange={(v: string) => setForm({ ...form, scheduledStart: v })}
        />
        <Input
          label="Kết thúc"
          type="datetime-local"
          value={form.scheduledEnd}
          onChange={(v: string) => setForm({ ...form, scheduledEnd: v })}
        />
      </>
    ) : action === "progress" ? (
      <>
        <Input
          label="Tiến độ (%)"
          type="number"
          value={form.progressPercent}
          onChange={(v: string) =>
            setForm({ ...form, progressPercent: Number(v) })
          }
        />
        <Input
          label="Công việc đã thực hiện"
          value={form.workPerformed ?? ""}
          onChange={(v: string) => setForm({ ...form, workPerformed: v })}
        />
      </>
    ) : action === "material" ? (
      <>
        <Input
          label="Tên vật tư"
          value={form.materialName}
          onChange={(v: string) => setForm({ ...form, materialName: v })}
        />
        <Input
          label="Số lượng"
          type="number"
          value={form.quantity}
          onChange={(v: string) => setForm({ ...form, quantity: Number(v) })}
        />
        <Input
          label="Đơn giá"
          type="number"
          value={form.unitPrice}
          onChange={(v: string) => setForm({ ...form, unitPrice: Number(v) })}
        />
      </>
    ) : action === "cost" ? (
      <>
        <Input
          label="Nhân công"
          type="number"
          value={form.laborCost}
          onChange={(v: string) => setForm({ ...form, laborCost: Number(v) })}
        />
        <Input
          label="Vật tư"
          type="number"
          value={form.materialCost}
          onChange={(v: string) =>
            setForm({ ...form, materialCost: Number(v) })
          }
        />
        <Input
          label="Dịch vụ ngoài"
          type="number"
          value={form.externalServiceCost}
          onChange={(v: string) =>
            setForm({ ...form, externalServiceCost: Number(v) })
          }
        />
      </>
    ) : action === "complete" ? (
      <>
        <Input
          label="Nguyên nhân"
          value={form.diagnosis}
          onChange={(v: string) => setForm({ ...form, diagnosis: v })}
        />
        <Input
          label="Cách xử lý"
          value={form.resolution}
          onChange={(v: string) => setForm({ ...form, resolution: v })}
        />
      </>
    ) : action.startsWith("inspect") ? (
      <Input
        label="Nhận xét nghiệm thu"
        value={form.comment}
        onChange={(v: string) => setForm({ ...form, comment: v })}
      />
    ) : (
      <Input
        label="Lý do"
        value={form.reason}
        onChange={(v: string) => setForm({ ...form, reason: v })}
      />
    );
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="mb-5 text-xl font-black">Cập nhật yêu cầu bảo trì</h2>
        <div className="space-y-4">{fields}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={close} className="btn-secondary">
            Đóng
          </button>
          <button onClick={() => submit(form)} className="btn-primary">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
const DEFAULT_SCHEDULE_START = new Date(Date.now() + 3600000)
  .toISOString()
  .slice(0, 16);
const DEFAULT_SCHEDULE_END = new Date(Date.now() + 7200000)
  .toISOString()
  .slice(0, 16);
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}
function Action({
  icon: Icon,
  label,
  onClick,
  primary = false,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={primary ? "btn-primary" : "btn-secondary"}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      >
        {options.map((x) => (
          <option key={x[0]} value={x[0]}>
            {x[1]}
          </option>
        ))}
      </select>
    </label>
  );
}
