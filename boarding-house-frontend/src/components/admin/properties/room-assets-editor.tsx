"use client";
import { NumberInput } from "@/components/ui/number-input";
import type { Asset } from "@/types/admin-property";
export type AssetDraft = Omit<Asset, "quantity" | "id"> & {
  id?: number | string;
  quantity: number | string;
};
const input =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
export function RoomAssetsEditor({
  assets,
  onChange,
}: {
  assets: AssetDraft[];
  onChange: (assets: AssetDraft[]) => void;
}) {
  function update(index: number, patch: Partial<AssetDraft>) {
    onChange(assets.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="font-bold">Tài sản bàn giao</h2>
      <p className="mt-2 text-sm text-slate-600">
        Khai báo từng tài sản cần kiểm đếm, tình trạng và ghi chú. Tiện nghi bên
        cạnh mô tả đặc điểm phòng; không thay thế danh mục bàn giao.
      </p>
      <div className="mt-3 space-y-3">
        {assets.map((a, index) => (
          <fieldset
            key={a.id ?? `new-${index}`}
            className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"
          >
            <legend className="text-sm font-semibold">
              Tài sản {index + 1}
            </legend>
            <label className="text-sm">
              Tên tài sản
              <input
                required
                maxLength={150}
                value={a.name}
                onChange={(e) => update(index, { name: e.target.value })}
                className={input}
              />
            </label>
            <label className="text-sm">
              Số lượng
              <NumberInput
                required
                min={1}
                value={a.quantity}
                onChange={(e) => update(index, { quantity: e.target.value })}
                className={input}
              />
            </label>
            <label className="text-sm">
              Tình trạng
              <select
                required
                value={a.conditionStatus}
                onChange={(e) =>
                  update(index, { conditionStatus: e.target.value })
                }
                className={input}
              >
                {Object.entries({
                  NEW: "Mới",
                  GOOD: "Tốt",
                  FAIR: "Đã sử dụng",
                  DAMAGED: "Hư hỏng",
                  MISSING: "Thiếu",
                  ...(a.conditionStatus === "LOST"
                    ? { LOST: "Thiếu (dữ liệu cũ)" }
                    : {}),
                }).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Ghi chú / mã tham chiếu minh chứng
              <textarea
                maxLength={500}
                value={a.note ?? ""}
                onChange={(e) => update(index, { note: e.target.value })}
                className={input}
              />
            </label>
            <button
              type="button"
              className="justify-self-start text-sm text-red-700 underline"
              aria-label={`Xóa tài sản ${index + 1}: ${a.name}`}
              onClick={() => onChange(assets.filter((_, i) => i !== index))}
            >
              Xóa tài sản
            </button>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
        onClick={() =>
          onChange([
            ...assets,
            { name: "", quantity: 1, conditionStatus: "GOOD", note: "" },
          ])
        }
      >
        Thêm tài sản
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Tài sản đã gắn biên bản được chốt cần giữ liên kết lịch sử; có thể sửa
        tình trạng và ghi chú, không xóa trực tiếp.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Minh chứng có thể ghi mã tham chiếu trong ghi chú. Hệ thống hiện chưa có
        dịch vụ tải ảnh riêng cho tài sản phòng.
      </p>
    </div>
  );
}
