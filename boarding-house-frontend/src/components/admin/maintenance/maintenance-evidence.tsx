"use client";
import { useState } from "react";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
type Attachment = {
  id: number;
  attachment_type: string;
  file_name: string;
  file_size: number;
  created_at: string;
};
export function MaintenanceEvidence({ taskId }: { taskId: number }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useScopedQuery({
    queryKey: ["maintenance-evidence", taskId],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Attachment[]>>(
          `/admin/operations/tasks/${taskId}/attachments`,
          { signal },
        )
      ).data.data,
  });
  async function download(file: Attachment) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiClient.get(
        `/admin/operations/tasks/${taskId}/attachments/${file.id}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="font-bold">Ảnh và bằng chứng sửa chữa</h2>
      {query.isLoading ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Đang tải bằng chứng…
        </p>
      ) : query.isError ? (
        <button
          className="mt-3 text-sm text-danger"
          onClick={() => void query.refetch()}
        >
          Không tải được bằng chứng. Thử lại
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          {query.data?.map((file) => (
            <button
              key={file.id}
              disabled={busy}
              onClick={() => void download(file)}
              className="block w-full rounded-xl border p-3 text-left text-sm text-link disabled:opacity-50"
            >
              {file.file_name} · {file.attachment_type}
              <span className="mt-1 block text-xs text-muted-foreground">
                {formatDate(file.created_at, true)} ·{" "}
                {Math.ceil(file.file_size / 1024)} KB
              </span>
            </button>
          ))}
          {!query.data?.length && (
            <p className="text-sm text-muted-foreground">Chưa có tệp đính kèm.</p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
