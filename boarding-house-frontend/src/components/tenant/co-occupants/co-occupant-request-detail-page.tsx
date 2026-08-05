"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Download,
  FilePlus2,
  MessageSquareWarning,
  Upload,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useCoOccupantActions,
  useCoOccupantRequest,
} from "@/hooks/use-tenant-co-occupants";
import { tenantCoOccupantService } from "@/services/tenant-co-occupant.service";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
import { Badge } from "./co-occupant-ui";
import { label, requestTypeLabels } from "@/constants/tenant-co-occupant";

export function CoOccupantRequestDetailPage({
  requestId,
}: {
  requestId: number;
}) {
  const { user } = useAuth();
  const q = useCoOccupantRequest(user?.activeRole === "TENANT", requestId);
  const actions = useCoOccupantActions(requestId);
  const [dialog, setDialog] = useState<"additional" | "cancel" | null>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void q.refetch()} />
      </main>
    );
  const d = q.data;
  const download = async (id: number, name: string) => {
    try {
      const { data } = await tenantCoOccupantService.download(id);
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e, "Không thể tải tài liệu."));
    }
  };
  const submit = async () => {
    setError("");
    try {
      if (dialog === "additional") {
        if (content.trim().length < 3)
          throw new Error("Vui lòng nhập nội dung bổ sung.");
        if (files.length)
          await actions.upload.mutateAsync({ type: "OTHER", files });
        await actions.additional.mutateAsync({ content, version: d.version });
      } else {
        if (content.trim().length < 3)
          throw new Error("Vui lòng nhập lý do hủy.");
        await actions.cancel.mutateAsync({
          reason: content,
          version: d.version,
        });
      }
      setDialog(null);
      setContent("");
      setFiles([]);
    } catch (e) {
      setError(
        apiErrorMessage(
          e,
          e instanceof Error ? e.message : "Không thể thực hiện thao tác.",
        ),
      );
    }
  };
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-28 sm:p-6">
      <Link
        href="/tenant/co-occupants"
        className="inline-flex items-center gap-2 font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Người ở cùng
      </Link>
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              {d.requestCode}
            </p>
            <h1 className="mt-1 text-3xl font-black">{d.person.fullName}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {label(requestTypeLabels, d.requestType)} · Gửi{" "}
              {formatDate(d.submittedAt, true)}
            </p>
          </div>
          <Badge kind="request" value={d.status} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {d.permissions.canSubmitAdditionalInformation && (
            <button
              onClick={() => setDialog("additional")}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
            >
              <FilePlus2 className="size-4" />
              Bổ sung hồ sơ
            </button>
          )}
          {d.permissions.canCancel && (
            <button
              onClick={() => setDialog("cancel")}
              className="rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700"
            >
              Hủy yêu cầu
            </button>
          )}
        </div>
      </header>
      {d.informationRequest && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h2 className="flex items-center gap-2 font-black">
            <MessageSquareWarning className="size-5" />
            Hồ sơ cần bổ sung thông tin
          </h2>
          <p className="mt-2">{d.informationRequest.message}</p>
          {d.informationRequest.deadline && (
            <p className="mt-2 text-sm font-semibold">
              Hạn bổ sung: {formatDate(d.informationRequest.deadline)}
            </p>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Thông tin cá nhân">
          <Info name="Họ tên" value={d.person.fullName} />
          <Info name="Ngày sinh" value={formatDate(d.person.dateOfBirth)} />
          <Info
            name="Giới tính"
            value={
              d.person.gender === "MALE"
                ? "Nam"
                : d.person.gender === "FEMALE"
                  ? "Nữ"
                  : "Chưa cập nhật"
            }
          />
          <Info name="Điện thoại" value={d.person.maskedPhone} />
          <Info name="Email" value={d.person.maskedEmail} />
          <Info name="Quan hệ" value={d.person.relationship} />
          <Info name="Số giấy tờ" value={d.person.maskedIdentityNumber} />
        </Section>
        <Section title="Thông tin cư trú">
          <Info name="Khu trọ" value={d.residence.propertyName} />
          <Info name="Phòng" value={d.residence.roomCode} />
          <Info
            name="Dự kiến chuyển vào"
            value={formatDate(d.residence.expectedMoveInDate)}
          />
          <Info
            name="Dự kiến chuyển đi"
            value={formatDate(d.residence.expectedMoveOutDate)}
          />
          <Info name="Lý do" value={d.residence.reason} />
          <div className="pt-2">
            <p className="text-sm text-slate-500">Tạm trú</p>
            <div className="mt-1">
              <Badge kind="temporary" value={d.temporaryResidence.status} />
            </div>
          </div>
        </Section>
      </div>
      <Section title="Giấy tờ">
        <div className="space-y-2">
          {d.documents.length ? (
            d.documents.map((x) => (
              <div
                key={x.id}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-white">
                  <FilePlus2 className="size-4 text-blue-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {x.originalName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {Math.ceil(x.fileSize / 1024)} KB ·{" "}
                    {formatDate(x.uploadedAt, true)}
                  </p>
                </div>
                {x.downloadable && (
                  <button
                    aria-label={`Tải ${x.originalName}`}
                    onClick={() => void download(x.id, x.originalName)}
                    className="rounded-lg p-2 text-blue-700"
                  >
                    <Download className="size-5" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              Chưa có tài liệu được phép hiển thị.
            </p>
          )}
        </div>
      </Section>
      <Section title="Timeline xử lý">
        <ol className="relative ml-2 border-l border-slate-200 pl-6">
          {d.publicTimeline.map((x) => (
            <li key={x.id} className="relative pb-6 last:pb-0">
              <span className="absolute -left-[29px] top-1 size-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100" />
              <p className="font-semibold">{x.description}</p>
              <p className="text-xs text-slate-500">
                {formatDate(x.occurredAt, true)}
                {x.actorName ? ` · ${x.actorName}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </Section>
      {d.publicFeedback && (
        <Section title="Phản hồi của quản lý">
          <p className="text-sm">{d.publicFeedback}</p>
        </Section>
      )}
      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="action-title"
          onKeyDown={(e) => e.key === "Escape" && setDialog(null)}
          className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center"
        >
          <div className="w-full rounded-t-3xl bg-white p-6 sm:max-w-lg sm:rounded-3xl">
            <h2 id="action-title" className="text-xl font-black">
              {dialog === "additional" ? "Bổ sung hồ sơ" : "Hủy yêu cầu"}
            </h2>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder={
                dialog === "additional"
                  ? "Mô tả nội dung đã bổ sung..."
                  : "Nhập lý do hủy..."
              }
              className="mt-4 block w-full rounded-xl border p-3"
            />
            {dialog === "additional" && (
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-semibold text-blue-700">
                <Upload className="size-4" />
                Chọn tài liệu
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  onChange={(e) =>
                    setFiles(Array.from(e.target.files ?? []).slice(0, 5))
                  }
                />
              </label>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {files.length ? `${files.length} tệp đã chọn` : ""}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDialog(null)}
                className="flex-1 rounded-xl border p-3 font-semibold"
              >
                Đóng
              </button>
              <button
                disabled={
                  actions.additional.isPending ||
                  actions.cancel.isPending ||
                  actions.upload.isPending
                }
                onClick={() => void submit()}
                className={`flex-1 rounded-xl p-3 font-bold text-white ${dialog === "cancel" ? "bg-red-600" : "bg-blue-600"}`}
              >
                Gửi
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
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
function Info({ name, value }: { name: string; value?: string | null }) {
  return (
    <div className="text-sm">
      <p className="text-slate-500">{name}</p>
      <p className="font-semibold">{value || "Chưa cập nhật"}</p>
    </div>
  );
}
