"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ShieldAlert, Wrench } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  useMaintenanceData,
  useMaintenanceMutations,
} from "@/hooks/use-admin-maintenance";
import { apiErrorMessage } from "@/lib/api-error";
import type { MaintenancePayload } from "@/types/admin-maintenance";
const empty: MaintenancePayload = {
  propertyId: 0,
  source: "ADMIN",
  maintenanceType: "CORRECTIVE",
  title: "",
  description: "",
  category: "OTHER",
  priority: "MEDIUM",
  safetyRisk: false,
  estimatedCost: 0,
  costResponsibility: "OWNER",
};
export function MaintenanceFormPage() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const { options } = useMaintenanceData({ page: 0, size: 10 });
  const mutations = useMaintenanceMutations();
  const rooms =
    options.data?.rooms.filter((x) => {
      if (!form.propertyId) return true;
      const floor = options.data?.floors.find((f) => f.id === x.parentId);
      const building = options.data?.buildings.find(
        (b) => b.id === floor?.parentId,
      );
      return building?.parentId === form.propertyId;
    }) ?? [];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (
      !form.propertyId ||
      !form.roomId ||
      !form.title.trim() ||
      !form.description.trim()
    ) {
      setError("Vui lòng nhập đầy đủ khu trọ, phòng, tiêu đề và mô tả.");
      return;
    }
    try {
      const result = await mutations.create.mutateAsync({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
      });
      router.push(`/admin/maintenance/${result.id}`);
    } catch (x) {
      setError(apiErrorMessage(x, "Không thể tạo yêu cầu bảo trì."));
    }
  };
  return (
    <AdminShell
      title="Tạo yêu cầu bảo trì"
      subtitle="Ghi nhận sự cố và thiết lập mức độ xử lý ban đầu."
    >
      <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/maintenance"
            className="rounded-xl border border-slate-200 bg-white p-2"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <p className="text-sm text-slate-500">Bảo trì / Tạo yêu cầu</p>
            <h1 className="text-2xl font-black">Thông tin sự cố</h1>
          </div>
        </div>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
            <Wrench className="size-5 text-blue-600" />
            Vị trí và nguồn yêu cầu
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nguồn yêu cầu">
              <select
                className="input"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                <option value="ADMIN">Quản lý</option>
                <option value="TENANT">Khách thuê</option>
                <option value="TECHNICIAN">Nhân viên kỹ thuật</option>
                <option value="PREVENTIVE">Kiểm tra định kỳ</option>
                <option value="SYSTEM">Hệ thống cảnh báo</option>
              </select>
            </Field>
            <Field label="Loại công việc">
              <select
                className="input"
                value={form.maintenanceType}
                onChange={(e) =>
                  setForm({ ...form, maintenanceType: e.target.value })
                }
              >
                <option value="CORRECTIVE">Sửa chữa phát sinh</option>
                <option value="PREVENTIVE">Bảo trì định kỳ</option>
                <option value="INSPECTION">Kiểm tra</option>
              </select>
            </Field>
            <Field label="Khu trọ *">
              <select
                className="input"
                value={form.propertyId || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    propertyId: Number(e.target.value),
                    roomId: undefined,
                    assetId: undefined,
                  })
                }
              >
                <option value="">Chọn khu trọ</option>
                {options.data?.properties.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phòng *">
              <select
                className="input"
                value={form.roomId ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    roomId: Number(e.target.value),
                    assetId: undefined,
                  })
                }
              >
                <option value="">Chọn phòng</option>
                {rooms.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.detail})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Thiết bị liên quan">
              <select
                className="input"
                value={form.assetId ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    assetId: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              >
                <option value="">Không chọn thiết bị</option>
                {options.data?.assets
                  .filter((x) => x.parentId === form.roomId)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Thời điểm mong muốn">
              <input
                type="datetime-local"
                className="input"
                onChange={(e) =>
                  setForm({
                    ...form,
                    preferredServiceTime: e.target.value || undefined,
                  })
                }
              />
            </Field>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold">Mô tả và phân loại</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tiêu đề *" wide>
              <input
                className="input"
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ví dụ: Điều hòa không làm lạnh"
              />
            </Field>
            <Field label="Mô tả chi tiết *" wide>
              <textarea
                className="input min-h-32"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Mô tả hiện tượng, thời điểm và mức độ ảnh hưởng..."
              />
            </Field>
            <Field label="Loại sự cố">
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mức độ ưu tiên">
              <select
                className="input"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="LOW">Thấp</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HIGH">Cao</option>
                <option value="URGENT">Khẩn cấp</option>
              </select>
            </Field>
            <Field label="Chi phí dự kiến">
              <input
                type="number"
                min="0"
                className="input"
                value={form.estimatedCost}
                onChange={(e) =>
                  setForm({ ...form, estimatedCost: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Bên chịu chi phí">
              <select
                className="input"
                value={form.costResponsibility}
                onChange={(e) =>
                  setForm({ ...form, costResponsibility: e.target.value })
                }
              >
                <option value="OWNER">Chủ nhà</option>
                <option value="TENANT">Người thuê</option>
                <option value="SHARED">Chia sẻ</option>
                <option value="PENDING">Chờ xác định</option>
              </select>
            </Field>
            <label className="col-span-full flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <input
                type="checkbox"
                checked={form.safetyRisk}
                onChange={(e) =>
                  setForm({ ...form, safetyRisk: e.target.checked })
                }
              />
              <ShieldAlert className="size-5 text-amber-600" />
              <span>
                <strong>Có nguy cơ mất an toàn</strong>
                <small className="block text-amber-700">
                  Đánh dấu khi có rò điện, cháy nổ, rò nước nghiêm trọng hoặc
                  nguy cơ tai nạn.
                </small>
              </span>
            </label>
          </div>
        </section>
        <div className="flex justify-end gap-3">
          <Link href="/admin/maintenance" className="btn-secondary">
            Hủy
          </Link>
          <button disabled={mutations.create.isPending} className="btn-primary">
            {mutations.create.isPending ? "Đang tạo..." : "Tạo yêu cầu"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
const categories = [
  ["ELECTRICAL", "Điện"],
  ["WATER", "Nước"],
  ["INTERNET", "Internet"],
  ["AIR_CONDITIONER", "Điều hòa"],
  ["WATER_HEATER", "Bình nóng lạnh"],
  ["DOOR_LOCK", "Cửa và khóa"],
  ["FURNITURE", "Nội thất"],
  ["APPLIANCE", "Thiết bị điện"],
  ["STRUCTURE", "Kết cấu"],
  ["LEAKAGE", "Thấm dột"],
  ["SANITATION", "Vệ sinh"],
  ["SECURITY", "An ninh"],
  ["FIRE_SAFETY", "Phòng cháy chữa cháy"],
  ["COMMON_AREA", "Khu vực chung"],
  ["ELEVATOR", "Thang máy"],
  ["OTHER", "Khác"],
];
