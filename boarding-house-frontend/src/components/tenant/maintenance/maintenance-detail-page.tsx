"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Download,
  Paperclip,
  RotateCcw,
  Send,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { statusLabels } from "@/constants/tenant-maintenance";
import {
  useMaintenanceActions,
  useTenantMaintenanceDetail,
} from "@/hooks/use-tenant-maintenance";
import { tenantMaintenanceService } from "@/services/tenant-maintenance.service";
import { apiErrorMessage } from "@/lib/api-error";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import {
  PriorityBadge,
  StatusBadge,
  areaLabel,
  categoryLabel,
  fmtDate,
} from "./maintenance-ui";
type Dialog = "additional" | "cancel" | "reschedule" | "reopen" | null;
export function MaintenanceDetailPage({ requestId }: { requestId: number }) {
  const { user } = useAuth();
  const q = useTenantMaintenanceDetail(
    user?.activeRole === "TENANT",
    requestId,
  );
  const a = useMaintenanceActions(requestId);
  const [dialog, setDialog] = useState<Dialog>(null),
    [text, setText] = useState(""),
    [phone, setPhone] = useState(""),
    [dateValue, setDateValue] = useState(""),
    [priority, setPriority] = useState("MEDIUM"),
    [message, setMessage] = useState(""),
    [notice, setNotice] = useState(""),
    [files, setFiles] = useState<File[]>([]);
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void q.refetch()} />
      </main>
    );
  const d = q.data;
  async function action() {
    setNotice("");
    try {
      if (dialog === "additional")
        await a.additional.mutateAsync({
          content: text,
          contactPhone: phone || undefined,
          version: d.version,
        });
      if (dialog === "cancel")
        await a.cancel.mutateAsync({
          reason: "OTHER",
          note: text,
          version: d.version,
        });
      if (dialog === "reschedule")
        await a.schedule.mutateAsync({
          response: "REQUEST_RESCHEDULE",
          preferredStart: dateValue,
          note: text,
          version: d.version,
        });
      if (dialog === "reopen")
        await a.reopen.mutateAsync({
          reason: text,
          recurringAt: dateValue || undefined,
          currentPriority: priority,
          version: d.version,
        });
      setDialog(null);
      setText("");
      setNotice("Thao tác đã được ghi nhận.");
    } catch (e) {
      setNotice(apiErrorMessage(e, "Không thể xử lý yêu cầu."));
    }
  }
  async function confirmSchedule() {
    try {
      await a.schedule.mutateAsync({
        response: "CONFIRMED",
        version: d.version,
      });
      setNotice("Lịch xử lý đã được xác nhận.");
    } catch (e) {
      setNotice(apiErrorMessage(e));
    }
  }
  async function send() {
    if (!message.trim()) return;
    try {
      await a.message.mutateAsync(message.trim());
      setMessage("");
    } catch (e) {
      setNotice(apiErrorMessage(e, "Không thể gửi tin nhắn."));
    }
  }
  async function upload() {
    if (!files.length) return;
    try {
      await a.upload.mutateAsync(files);
      setFiles([]);
      setNotice("Đã bổ sung tệp minh chứng.");
    } catch (e) {
      setNotice(apiErrorMessage(e, "Không thể tải tệp."));
    }
  }
  async function download(id: number, name: string) {
    try {
      const r = await tenantMaintenanceService.attachment(id),
        url = URL.createObjectURL(r.data),
        el = document.createElement("a");
      el.href = url;
      el.download = name;
      el.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setNotice(apiErrorMessage(e, "Không thể tải tệp."));
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <Link
        href="/tenant/maintenance"
        className="inline-flex items-center gap-2 font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Danh sách yêu cầu
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-blue-600">{d.requestCode}</p>
          <h1 className="mt-1 text-3xl font-black">{d.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={d.status} />
            <PriorityBadge priority={d.tenantReportedPriority} />
            <span className="text-sm text-slate-500">
              Phòng {d.location.roomCode} · {areaLabel(d.location.areaCode)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.permissions.canAddInformation && (
            <button
              onClick={() => setDialog("additional")}
              className="rounded-xl border px-4 py-2 font-semibold"
            >
              Bổ sung thông tin
            </button>
          )}
          {d.permissions.canCancel && (
            <button
              onClick={() => setDialog("cancel")}
              className="rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-700"
            >
              Hủy yêu cầu
            </button>
          )}
          {d.permissions.canProvideFeedback && (
            <Link
              href={`/tenant/maintenance/${d.id}/feedback`}
              className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white"
            >
              Xác nhận kết quả
            </Link>
          )}
          {d.permissions.canReopen && (
            <button
              onClick={() => setDialog("reopen")}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 font-bold text-white"
            >
              <RotateCcw className="size-4" />
              Mở lại
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-800"
        >
          {notice}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Section title="Thông tin yêu cầu">
            <Grid
              rows={[
                ["Loại sự cố", categoryLabel(d.category)],
                [
                  "Vị trí",
                  `${d.location.propertyName} · Phòng ${d.location.roomCode} · ${areaLabel(d.location.areaCode)}`,
                ],
                ["Thiết bị", d.asset?.name ?? "Không xác định"],
                ["Thời điểm phát hiện", fmtDate(d.detectedAt, true)],
                ["Ảnh hưởng an toàn", d.safetyRisk ? "Có" : "Không"],
                ["Xảy ra liên tục", d.continuousIssue ? "Có" : "Không"],
              ]}
            />
            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-slate-700">
              {d.description}
            </p>
          </Section>
          <Section title="Tiến độ xử lý">
            {d.publicTimeline.length ? (
              <ol className="relative ml-3 border-l border-blue-200">
                {d.publicTimeline.map((x, i) => (
                  <li key={x.id} className="mb-5 ml-6">
                    <span className="absolute -left-2 grid size-4 place-items-center rounded-full bg-blue-600" />
                    <div className="flex flex-wrap items-center gap-2">
                      <b>
                        {x.newStatus ? (
                          <>{statusText(x.newStatus)}</>
                        ) : (
                          x.description
                        )}
                      </b>
                      <span className="text-xs text-slate-500">
                        {fmtDate(x.createdAt, true)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {x.description}
                    </p>
                    {i === d.publicTimeline.length - 1 && (
                      <span className="text-xs text-slate-400">
                        {x.actorName}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState text="Chưa có cập nhật tiến độ." />
            )}
          </Section>
          <Section title="Hình ảnh và tài liệu">
            <div className="grid gap-2 sm:grid-cols-2">
              {d.attachments.map((x) => (
                <button
                  key={x.id}
                  onClick={() => download(x.id, x.fileName)}
                  className="flex items-center justify-between rounded-xl border p-3 text-left"
                >
                  <span className="min-w-0">
                    <Paperclip className="mr-2 inline size-4 text-blue-600" />
                    <span className="truncate">{x.fileName}</span>
                    <small className="block text-slate-500">
                      {(x.fileSize / 1024 / 1024).toFixed(1)} MB ·{" "}
                      {fmtDate(x.createdAt, true)}
                    </small>
                  </span>
                  <Download className="size-4" />
                </button>
              ))}
            </div>
            {!d.attachments.length && (
              <EmptyState text="Chưa có tệp minh chứng." />
            )}
            {d.permissions.canUpload && (
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  aria-label="Chọn tệp bổ sung"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="max-w-full rounded-lg border p-2 text-sm"
                />
                <button
                  disabled={!files.length || a.upload.isPending}
                  onClick={upload}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Tải lên
                </button>
              </div>
            )}
          </Section>
          <Section title="Trao đổi">
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {d.messages.map((x) => (
                <div
                  key={x.id}
                  className={`flex ${x.mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${x.mine ? "bg-blue-600 text-white" : "bg-slate-100"}`}
                  >
                    <b className="text-xs">{x.mine ? "Bạn" : x.senderName}</b>
                    <p className="whitespace-pre-wrap text-sm">{x.content}</p>
                    <span className="text-[10px] opacity-70">
                      {fmtDate(x.createdAt, true)}
                    </span>
                  </div>
                </div>
              ))}
              {!d.messages.length && <EmptyState text="Chưa có trao đổi." />}
            </div>
            {d.permissions.canSendMessage && (
              <div className="mt-4 flex gap-2">
                <textarea
                  aria-label="Nội dung tin nhắn"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="min-w-0 flex-1 rounded-xl border p-3"
                  placeholder="Nhập tin nhắn..."
                />
                <button
                  aria-label="Gửi tin nhắn"
                  disabled={!message.trim() || a.message.isPending}
                  onClick={send}
                  className="self-end rounded-xl bg-blue-600 p-3 text-white disabled:opacity-40"
                >
                  <Send className="size-5" />
                </button>
              </div>
            )}
          </Section>
        </div>
        <aside className="space-y-5">
          <Section title="Lịch hẹn">
            {d.schedule ? (
              <>
                <Grid
                  rows={[
                    ["Bắt đầu", fmtDate(d.schedule.scheduledStart, true)],
                    ["Thời lượng", `${d.schedule.durationMinutes} phút`],
                    [
                      "Cần bạn có mặt",
                      d.schedule.tenantPresenceRequired ? "Có" : "Không",
                    ],
                    [
                      "Phản hồi",
                      d.schedule.tenantResponse
                        ? statusText(d.schedule.tenantResponse)
                        : "Chưa phản hồi",
                    ],
                  ]}
                />
                {d.permissions.canConfirmSchedule &&
                  !d.schedule.tenantResponse && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={confirmSchedule}
                        className="flex-1 rounded-xl bg-blue-600 px-3 py-2 font-semibold text-white"
                      >
                        Xác nhận lịch
                      </button>
                      <button
                        onClick={() => setDialog("reschedule")}
                        className="flex-1 rounded-xl border px-3 py-2 font-semibold"
                      >
                        Đổi lịch
                      </button>
                    </div>
                  )}
              </>
            ) : (
              <EmptyState text="Chưa có lịch hẹn chính thức." />
            )}
          </Section>
          <Section title="Nhân viên phụ trách">
            {d.technician ? (
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-blue-100 text-blue-700">
                  <UserRound />
                </span>
                <div>
                  <b>{d.technician.fullName}</b>
                  <p className="text-sm text-slate-500">
                    {d.technician.position}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState text="Chưa phân công nhân viên." />
            )}
          </Section>
          {(d.diagnosis || d.resolution) && (
            <Section title="Kết quả sửa chữa">
              {d.diagnosis && (
                <p>
                  <b>Chẩn đoán công khai:</b> {d.diagnosis}
                </p>
              )}
              {d.resolution && (
                <p className="mt-2">
                  <b>Đã thực hiện:</b> {d.resolution}
                </p>
              )}
            </Section>
          )}
          {d.tenantCost && (
            <Section title="Chi phí đã phê duyệt">
              <p className="text-2xl font-black text-blue-700">
                {new Intl.NumberFormat("vi-VN").format(d.tenantCost.amount)}đ
              </p>
              <p className="text-sm text-slate-500">
                Khoản này sẽ được quản lý đưa vào hóa đơn theo nghiệp vụ.
              </p>
            </Section>
          )}
        </aside>
      </div>
      {dialog && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") setDialog(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-xl font-black">
              {dialog === "additional"
                ? "Bổ sung thông tin"
                : dialog === "cancel"
                  ? "Hủy yêu cầu"
                  : dialog === "reschedule"
                    ? "Yêu cầu đổi lịch"
                    : "Mở lại yêu cầu"}
            </h2>
            {["reschedule", "reopen"].includes(dialog) && (
              <label className="mt-4 block text-sm font-semibold">
                Thời gian mong muốn
                <input
                  autoFocus
                  type="datetime-local"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                />
              </label>
            )}
            {dialog === "reopen" && (
              <label className="mt-3 block text-sm font-semibold">
                Mức độ hiện tại
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                >
                  <option value="LOW">Thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Cao</option>
                  <option value="URGENT">Khẩn cấp</option>
                </select>
              </label>
            )}
            <label className="mt-4 block text-sm font-semibold">
              {dialog === "additional" ? "Nội dung bổ sung" : "Lý do và mô tả"}
              <textarea
                autoFocus={!["reschedule", "reopen"].includes(dialog)}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-xl border p-3"
              />
            </label>
            {dialog === "additional" && (
              <label className="mt-3 block text-sm font-semibold">
                Số điện thoại (không bắt buộc)
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full rounded-xl border p-3"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDialog(null)}
                className="rounded-xl border px-4 py-2"
              >
                Đóng
              </button>
              <button
                disabled={
                  !text.trim() || (dialog === "reschedule" && !dateValue)
                }
                onClick={action}
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="font-semibold">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
function statusText(v: string) {
  return (
    (
      {
        CONFIRMED: "Đã xác nhận",
        REQUEST_RESCHEDULE: "Đã yêu cầu đổi lịch",
      } as Record<string, string>
    )[v] ??
    statusLabels[v] ??
    "Đang cập nhật"
  );
}
