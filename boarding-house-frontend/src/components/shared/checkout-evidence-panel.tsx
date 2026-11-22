"use client";
import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
type FileRow = {
  id: number;
  evidence_type: string;
  original_name: string;
  file_size: number;
  uploaded_at: string;
  dispute_id: number | null;
};
export function CheckoutEvidencePanel({
  portal,
  id,
  editable,
}: {
  portal: "admin" | "tenant" | "accountant";
  id: number;
  editable: boolean;
}) {
  const root = `/${portal}/checkout-evidence/${id}`,
    client = useQueryClient();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const inFlight = useRef(false),
    key = useRef(crypto.randomUUID());
  const query = useScopedQuery({
    queryKey: ["checkout-evidence", portal, id],
    queryFn: async ({ signal }) =>
      (await apiClient.get<ApiEnvelope<FileRow[]>>(root, { signal })).data.data,
  });
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    const form = e.currentTarget,
      data = new FormData(form);
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiClient.post(root, data, {
        headers: { "Idempotency-Key": key.current },
      });
      await client.invalidateQueries();
      setNotice(
        "Đã lưu ảnh. Ghi mã FILE vào căn cứ kiểm kê/khoản phí nếu cần tham chiếu.",
      );
      key.current = crypto.randomUUID();
      form.reset();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  async function download(file: FileRow) {
    setError("");
    try {
      const response = await apiClient.get(`${root}/${file.id}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data),
        a = document.createElement("a");
      a.href = url;
      a.download = file.original_name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">Ảnh kiểm kê, chỉ số và phản hồi</h3>
      <p className="text-xs text-muted-foreground">
        Ảnh được lưu riêng theo hồ sơ; bổ sung ảnh không đồng nghĩa đồng ý phí
        hay quyết toán. Ảnh nhận phòng nằm trong biên bản hợp đồng gốc.
      </p>
      {query.isLoading ? (
        <p role="status">Đang tải ảnh…</p>
      ) : query.isError ? (
        <button
          onClick={() => void query.refetch()}
          className="text-sm text-danger"
        >
          Không tải được ảnh. Thử lại
        </button>
      ) : query.data?.length ? (
        <ul className="space-y-2">
          {query.data.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                onClick={() => void download(file)}
                className="w-full rounded-lg bg-muted p-3 text-left text-sm text-link"
              >
                FILE-{file.id} · {file.original_name}
                <span className="block text-xs text-muted-foreground">
                  {file.evidence_type} · {formatDate(file.uploaded_at, true)} ·{" "}
                  {Math.ceil(file.file_size / 1024)} KB
                  {file.dispute_id ? ` · Phản hồi #${file.dispute_id}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Chưa có ảnh đính kèm trong hồ sơ trả phòng.
        </p>
      )}
      {editable && portal !== "accountant" && (
        <form
          onSubmit={(e) => void upload(e)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm">
            Nhóm ảnh
            <select name="type" className="mt-1 w-full rounded-lg border p-2">
              <option value="INSPECTION">Kiểm kê</option>
              <option value="UTILITY">Điện nước</option>
              <option value="HANDOVER">Bàn giao</option>
              <option value="DISPUTE">Phản hồi</option>
            </select>
          </label>
          <label className="text-sm">
            Ảnh JPEG/PNG/WebP, tối đa 10 MB
            <input
              aria-label="Ảnh bằng chứng trả phòng"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={() => {
                key.current = crypto.randomUUID();
                setError("");
              }}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <label className="text-sm">
            Mã phản hồi liên quan (nếu có)
            <input
              name="disputeId"
              inputMode="numeric"
              pattern="[0-9]+"
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <button
            disabled={busy}
            className="self-end rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : "Lưu ảnh bằng chứng"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      )}
    </section>
  );
}
