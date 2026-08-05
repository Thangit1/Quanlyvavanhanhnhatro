"use client";
import { useRef, useState } from "react";
import { Download, FileCheck2, Upload } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useAccountActions,
  useTenantDocuments,
  useTenantProfile,
} from "@/hooks/use-tenant-account";
import { tenantAccountService } from "@/services/tenant-account.service";
import { apiErrorMessage } from "@/lib/api-error";
import {
  accountDate,
  documentLabels,
  label,
  residenceStatusLabels,
} from "@/constants/tenant-account";
import { AccountLoading, AccountPageLayout, StatusPill } from "./account-ui";
import { EmptyState, ErrorState } from "@/components/shared/dashboard-ui";
export function DocumentsPage() {
  const { user } = useAuth(),
    query = useTenantDocuments(user?.activeRole === "TENANT"),
    profile = useTenantProfile(user?.activeRole === "TENANT"),
    actions = useAccountActions(),
    fileRef = useRef<HTMLInputElement>(null),
    [file, setFile] = useState<File>(),
    [type, setType] = useState("IDENTITY_CARD"),
    [number, setNumber] = useState(""),
    [side, setSide] = useState("FRONT"),
    [note, setNote] = useState(""),
    [message, setMessage] = useState("");
  if (query.isLoading) return <AccountLoading />;
  const upload = () => {
    if (!file) return;
    actions.uploadDocument.mutate(
      {
        documentType: type,
        documentNumber: number,
        documentSide: side,
        note,
        file,
      },
      {
        onSuccess: () => {
          setFile(undefined);
          setNumber("");
          setNote("");
          if (fileRef.current) fileRef.current.value = "";
          setMessage("Giấy tờ đã được tải lên và đang chờ xác minh.");
        },
        onError: (e) => setMessage(apiErrorMessage(e)),
      },
    );
  };
  const download = async (id: number, name: string) => {
    try {
      const url = await tenantAccountService.downloadDocument(id);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage(apiErrorMessage(e));
    }
  };
  return (
    <AccountPageLayout
      title="Giấy tờ và hồ sơ"
      description="Theo dõi giấy tờ xác minh và hồ sơ tạm trú."
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
        <h2 className="text-lg font-black">Hồ sơ tạm trú</h2>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-4">
          <div>
            <p className="font-bold">Trạng thái hiện tại</p>
            <p className="mt-1 text-sm text-slate-500">
              Trạng thái chỉ được cập nhật sau khi quản lý xác nhận hồ sơ.
            </p>
          </div>
          <StatusPill tone="amber">
            {label(
              residenceStatusLabels,
              profile.data?.temporaryResidenceStatus,
            )}
          </StatusPill>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Bổ sung giấy tờ</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Loại giấy tờ
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 font-normal"
            >
              {[
                "IDENTITY_CARD",
                "PASSPORT",
                "BIRTH_CERTIFICATE",
                "TEMPORARY_RESIDENCE",
                "OTHER",
              ].map((v) => (
                <option key={v} value={v}>
                  {documentLabels[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Mặt giấy tờ
            <select
              value={side}
              onChange={(e) => setSide(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 font-normal"
            >
              <option value="FRONT">Mặt trước</option>
              <option value="BACK">Mặt sau</option>
              <option value="SINGLE">Một tệp</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            Số giấy tờ
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border p-2.5 font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            Tệp
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              onChange={(e) => {
                const next = e.target.files?.[0];
                if (next && next.size > 5 * 1024 * 1024) {
                  setMessage("Tệp không được vượt quá 5 MB.");
                  e.target.value = "";
                  return;
                }
                setFile(next);
              }}
              className="mt-1 block w-full rounded-xl border p-2 text-sm font-normal"
            />
          </label>
          <label className="sm:col-span-2 text-sm font-bold">
            Ghi chú
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border p-3 font-normal"
            />
          </label>
        </div>
        <button
          disabled={!file || actions.uploadDocument.isPending}
          onClick={upload}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40"
        >
          <Upload className="size-4" />
          {actions.uploadDocument.isPending ? "Đang tải lên..." : "Gửi giấy tờ"}
        </button>
      </section>
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState text="Bạn chưa có giấy tờ nào." />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2">
          {query.data.map((d) => (
            <article
              key={d.id}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <FileCheck2 />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-black">
                    {label(documentLabels, d.documentType)}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {d.maskedNumber || "Số giấy tờ được bảo vệ"}
                  </p>
                </div>
                <StatusPill
                  tone={
                    d.verificationStatus === "VERIFIED"
                      ? "green"
                      : d.verificationStatus === "REJECTED"
                        ? "red"
                        : "amber"
                  }
                >
                  {label(documentLabels, d.verificationStatus)}
                </StatusPill>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Tải lên</dt>
                  <dd className="font-semibold">
                    {accountDate(d.uploadedAt, true)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Hết hạn</dt>
                  <dd className="font-semibold">{accountDate(d.expiresAt)}</dd>
                </div>
              </dl>
              {d.publicNote && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {d.publicNote}
                </p>
              )}
              <button
                onClick={() => void download(d.id, d.originalName)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"
              >
                <Download className="size-4" />
                Tải tệp
              </button>
            </article>
          ))}
        </section>
      )}
    </AccountPageLayout>
  );
}
