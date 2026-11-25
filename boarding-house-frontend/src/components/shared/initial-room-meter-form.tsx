"use client";
import { FormInput } from "@/components/ui/number-input";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";

export function InitialRoomMeterForm({
  roomId,
  installableTypes,
}: {
  roomId: number;
  installableTypes?: string[];
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  if (
    !user ||
    !["OWNER", "MANAGER"].includes(user.activeRole) ||
    installableTypes?.length === 0
  )
    return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.post(`/admin/rooms/${roomId}/meters`, {
        type: form.get("type"),
        code: form.get("code"),
        reading: Number(form.get("reading")),
        reference: form.get("reference"),
        reason: form.get("reason"),
      });
      await client.invalidateQueries();
      setOpen(false);
      setSuccess(
        "Đã lắp công tơ. Chỉ số bàn giao vẫn cần kiểm tra thực tế; chưa xác nhận bàn giao.",
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-3">
      <button
        type="button"
        className="btn-primary"
        onClick={() => setOpen(!open)}
      >
        Lắp công tơ ban đầu
      </button>
      {open && (
        <form
          onSubmit={(event) => void submit(event)}
          className="grid gap-3 rounded-xl border border-border bg-muted p-4 text-sm"
        >
          <p>
            Chỉ dùng khi chưa có đồng hồ và phòng chưa có người sử dụng. Thay
            đồng hồ đang dùng phải theo quy trình tháo/lắp theo kỳ.
          </p>
          <label>
            Loại
            <select name="type" className="ml-2 rounded-lg border p-2">
              {(installableTypes ?? ["ELECTRICITY", "WATER"]).map((type) => (
                <option key={type} value={type}>
                  {type === "ELECTRICITY" ? "Điện" : "Nước"}
                </option>
              ))}
            </select>
          </label>
          {[
            { name: "code", label: "Mã đồng hồ", type: "text" },
            { name: "reading", label: "Chỉ số lúc lắp", type: "number" },
            { name: "reference", label: "Mã biên bản / ảnh lắp", type: "text" },
            { name: "reason", label: "Lý do và căn cứ lắp đặt", type: "text" },
          ].map((field) => (
            <label key={field.name} className="grid gap-1">
              {field.label}
              <FormInput
                required
                name={field.name}
                type={field.type}
                min={field.type === "number" ? 0 : undefined}
                step={field.type === "number" ? "0.01" : undefined}
                maxLength={field.name === "code" ? 50 : 500}
                className="rounded-lg border border-border bg-card p-2"
              />
            </label>
          ))}
          <button disabled={busy} className="btn-primary">
            {busy ? "Đang lưu..." : "Ghi nhận lắp đặt"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-success">
          {success}
        </p>
      )}
    </div>
  );
}
