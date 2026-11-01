"use client";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";

export function InitialRoomMeterForm({ roomId }: { roomId: number }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user || !["OWNER", "MANAGER"].includes(user.activeRole)) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
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
        Lắp đồng hồ ban đầu
      </button>
      {open && (
        <form
          onSubmit={(event) => void submit(event)}
          className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"
        >
          <p>
            Chỉ dùng khi chưa có đồng hồ và phòng chưa có người sử dụng. Thay
            đồng hồ đang dùng phải theo quy trình tháo/lắp theo kỳ.
          </p>
          <label>
            Loại
            <select name="type" className="ml-2 rounded-lg border p-2">
              <option value="ELECTRICITY">Điện</option>
              <option value="WATER">Nước</option>
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
              <input
                required
                name={field.name}
                type={field.type}
                min={field.type === "number" ? 0 : undefined}
                step={field.type === "number" ? "0.01" : undefined}
                maxLength={field.name === "code" ? 50 : 500}
                className="rounded-lg border border-slate-200 bg-white p-2"
              />
            </label>
          ))}
          <button disabled={busy} className="btn-primary">
            {busy ? "Đang lưu..." : "Ghi nhận lắp đặt"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
