/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createElement,
  FormEvent,
  type ElementType,
  useEffect,
  useState,
} from "react";
import {
  BedDouble,
  Building2,
  CalendarClock,
  DoorOpen,
  Plus,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyState,
  ErrorState,
  PageLoading,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import {
  useAdminRoom,
  useAdminRooms,
  usePropertyOptions,
  useRoomMutations,
} from "@/hooks/use-admin-properties";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import { apiErrorMessage, normalizeAdminCode } from "@/lib/api-error";
import { useAuth } from "@/providers/auth-provider";
import type { RoomPayload } from "@/types/admin-property";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
function localToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function RoomListPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const preset = Number(searchParams.get("propertyId")) || undefined;
  const [typed, setTyped] = useState("");
  const [keyword, setKeyword] = useState("");
  const [propertyId, setPropertyId] = useState<number | undefined>(preset);
  const [buildingId, setBuildingId] = useState<number>();
  const [floorId, setFloorId] = useState<number>();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const options = usePropertyOptions();
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(typed.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const query = useAdminRooms({
    propertyId,
    buildingId,
    floorId,
    status: status || undefined,
    keyword: keyword || undefined,
    page,
    size: 20,
  });
  if (query.isLoading || options.isLoading) return <PageLoading />;
  const data = query.data;
  const buildings =
    options.data?.buildings.filter(
      (b) => !propertyId || b.parentId === propertyId,
    ) || [];
  const floors =
    options.data?.floors.filter(
      (f) => !buildingId || f.parentId === buildingId,
    ) || [];
  return (
    <AdminShell
      title="Danh sách phòng"
      subtitle="Theo dõi công suất, giá thuê và trạng thái phòng"
      readOnly
    >
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl border bg-white p-1">
            <Link
              href="/admin/properties"
              className="px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Nhà trọ
            </Link>
            <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Phòng
            </span>
          </div>
          {user?.activeRole !== "ACCOUNTANT" && (
            <div className="flex gap-2">
              <Link
                href="/admin/rooms/new"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="size-4" />
                Thêm phòng
              </Link>
            </div>
          )}
        </div>
        {query.isError && (
          <ErrorState onRetry={() => void query.refetch()} />
        )}{" "}
        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ["Tổng phòng", data.summary.totalRooms, DoorOpen],
                ["Đang thuê", data.summary.occupiedRooms, Users],
                ["Còn trống", data.summary.vacantRooms, BedDouble],
                ["Giữ chỗ", data.summary.reservedRooms, CalendarClock],
                ["Bảo trì", data.summary.maintenanceRooms, Wrench],
                ["Ngừng dùng", data.summary.inactiveRooms, Building2],
              ].map(([label, value, Icon]) => (
                <article
                  key={String(label)}
                  className="rounded-2xl border bg-white p-4 shadow-sm"
                >
                  {createElement(Icon as ElementType, {
                    className: "size-5 text-blue-600",
                  })}
                  <p className="mt-3 text-xs text-slate-500">
                    {label as string}
                  </p>
                  <p className="text-2xl font-extrabold">{value as number}</p>
                </article>
              ))}
            </section>
            <section className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="relative">
                  <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                  <input
                    className={`${input} pl-9`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Tìm mã hoặc tên phòng..."
                  />
                </label>
                <Select
                  value={propertyId}
                  placeholder="Tất cả nhà trọ"
                  items={options.data?.properties || []}
                  onChange={(v) => {
                    setPropertyId(v);
                    setBuildingId(undefined);
                    setFloorId(undefined);
                    setPage(0);
                  }}
                />
                <Select
                  value={buildingId}
                  placeholder="Tất cả tòa"
                  items={buildings}
                  onChange={(v) => {
                    setBuildingId(v);
                    setFloorId(undefined);
                    setPage(0);
                  }}
                />
                <Select
                  value={floorId}
                  placeholder="Tất cả tầng"
                  items={floors}
                  onChange={(v) => {
                    setFloorId(v);
                    setPage(0);
                  }}
                />
                <select
                  className={input}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  {[
                    "VACANT",
                    "RESERVED",
                    "OCCUPIED",
                    "MAINTENANCE",
                    "INACTIVE",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </div>
            </section>
            {data.page.items.length === 0 ? (
              <EmptyState text="Chưa có phòng phù hợp." />
            ) : (
              <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <Th>Phòng</Th>
                        <Th>Vị trí</Th>
                        <Th>Giá thuê</Th>
                        <Th>Sức chứa</Th>
                        <Th>Người đại diện</Th>
                        <Th>Công nợ</Th>
                        <Th>Trạng thái</Th>
                        <Th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.page.items.map((r) => (
                        <tr key={r.id} className="border-t hover:bg-blue-50/30">
                          <Td>
                            <strong>{r.roomCode}</strong>
                            <p className="text-xs text-slate-500">{r.name}</p>
                          </Td>
                          <Td>
                            {r.propertyName}
                            <p className="text-xs text-slate-500">
                              {r.buildingName} · {r.floorName}
                            </p>
                          </Td>
                          <Td>
                            <strong>{formatCurrency(r.monthlyRent)}</strong>
                            <p className="text-xs text-slate-500">
                              Cọc {formatCurrency(r.depositAmount)}
                            </p>
                          </Td>
                          <Td>
                            {r.currentOccupants}/{r.maxOccupants}
                          </Td>
                          <Td>{r.representativeTenant?.fullName || "—"}</Td>
                          <Td>
                            <span
                              className={
                                r.outstandingDebt > 0
                                  ? "font-bold text-red-600"
                                  : "text-slate-500"
                              }
                            >
                              {formatCurrency(r.outstandingDebt)}
                            </span>
                          </Td>
                          <Td>
                            <StatusBadge status={r.status} />
                            {r.openMaintenanceCount > 0 && (
                              <p className="mt-1 text-xs text-orange-600">
                                {r.openMaintenanceCount} bảo trì
                              </p>
                            )}
                          </Td>
                          <Td>
                            <Link
                              className="font-semibold text-blue-600"
                              href={`/admin/rooms/${r.id}`}
                            >
                              Chi tiết →
                            </Link>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 p-3 md:hidden">
                  {data.page.items.map((r) => (
                    <Link
                      href={`/admin/rooms/${r.id}`}
                      key={r.id}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex justify-between">
                        <strong>
                          {r.roomCode} · {r.name}
                        </strong>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {r.propertyName} · {r.buildingName} · {r.floorName}
                      </p>
                      <div className="mt-3 flex justify-between text-sm">
                        <strong>{formatCurrency(r.monthlyRent)}</strong>
                        <span>
                          {r.currentOccupants}/{r.maxOccupants} người
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            <div className="flex justify-end gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
              >
                Trước
              </button>
              <span className="px-3 py-2 text-sm">
                {page + 1}/{Math.max(data.page.totalPages, 1)}
              </span>
              <button
                disabled={page + 1 >= data.page.totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
function Select({
  value,
  placeholder,
  items,
  onChange,
}: {
  value?: number;
  placeholder: string;
  items: { id: number; label: string }[];
  onChange: (v?: number) => void;
}) {
  return (
    <select
      className={input}
      value={value || ""}
      onChange={(e) =>
        onChange(e.target.value ? Number(e.target.value) : undefined)
      }
    >
      <option value="">{placeholder}</option>
      {items.map((x) => (
        <option key={x.id} value={x.id}>
          {x.label}
        </option>
      ))}
    </select>
  );
}
function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}

const blank: RoomPayload = {
  propertyId: 0,
  buildingId: 0,
  floorId: 0,
  code: "",
  name: "",
  monthlyRent: 0,
  depositAmount: 0,
  capacity: 1,
  amenityIds: [],
  assets: [],
};
export function RoomFormPage({ id }: { id?: number }) {
  const router = useRouter();
  const options = usePropertyOptions();
  const detail = useAdminRoom(id || 0);
  const mutations = useRoomMutations(id);
  const [form, setForm] = useState<RoomPayload>(blank);
  const [assetName, setAssetName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (detail.data) {
      const d = detail.data;
      setForm({
        propertyId: d.room.propertyId,
        buildingId: d.room.buildingId || 0,
        floorId: d.room.floorId || 0,
        code: d.room.roomCode,
        name: d.room.name,
        roomType: d.room.roomType,
        description: d.description,
        area: d.room.area,
        monthlyRent: d.room.monthlyRent,
        depositAmount: d.room.depositAmount,
        capacity: d.room.maxOccupants,
        imageUrl: d.room.thumbnailUrl,
        amenityIds: d.amenities.map((a) => a.id),
        assets: d.assets,
        version: d.room.version,
      });
    }
  }, [detail.data]);
  if (options.isLoading || (id && detail.isLoading)) return <PageLoading />;
  const buildings =
    options.data?.buildings.filter((b) => b.parentId === form.propertyId) || [];
  const floors =
    options.data?.floors.filter((f) => f.parentId === form.buildingId) || [];
  const mutation = id ? mutations.update : mutations.create;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await mutation.mutateAsync(form);
      router.push(
        id
          ? `/admin/rooms/${id}`
          : `/admin/rooms/${"id" in result ? result.id : ""}`,
      );
    } catch (requestError) {
      setError(
        apiErrorMessage(
          requestError,
          "Không thể lưu phòng. Hãy kiểm tra vị trí và các trường bắt buộc.",
        ),
      );
    }
  };
  const addAsset = () => {
    if (!assetName.trim()) return;
    setForm({
      ...form,
      assets: [
        ...form.assets,
        { name: assetName.trim(), quantity: 1, conditionStatus: "GOOD" },
      ],
    });
    setAssetName("");
  };
  return (
    <AdminShell
      title={id ? "Cập nhật phòng" : "Thêm phòng"}
      subtitle="Cấu hình vị trí, giá, tiện nghi và tài sản"
    >
      <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">Thông tin phòng</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nhà trọ *">
              <Select
                value={form.propertyId || undefined}
                placeholder="Chọn nhà trọ"
                items={options.data?.properties || []}
                onChange={(v) =>
                  setForm({
                    ...form,
                    propertyId: v || 0,
                    buildingId: 0,
                    floorId: 0,
                  })
                }
              />
            </Field>
            <Field label="Tòa *">
              <Select
                value={form.buildingId || undefined}
                placeholder="Chọn tòa"
                items={buildings}
                onChange={(v) =>
                  setForm({ ...form, buildingId: v || 0, floorId: 0 })
                }
              />
            </Field>
            <Field label="Tầng *">
              <Select
                value={form.floorId || undefined}
                placeholder="Chọn tầng"
                items={floors}
                onChange={(v) => setForm({ ...form, floorId: v || 0 })}
              />
            </Field>
            <Field label="Mã phòng *">
              <input
                required
                className={input}
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: normalizeAdminCode(e.target.value) })
                }
              />
            </Field>
            <Field label="Tên phòng *">
              <input
                required
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Loại phòng">
              <input
                className={input}
                value={form.roomType || ""}
                onChange={(e) => setForm({ ...form, roomType: e.target.value })}
                placeholder="Studio, khép kín..."
              />
            </Field>
            <Field label="Diện tích (m²)">
              <input
                type="number"
                min="0"
                step="0.1"
                className={input}
                value={form.area ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    area: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </Field>
            <Field label="Giá thuê/tháng *">
              <input
                required
                type="number"
                min="0"
                className={input}
                value={form.monthlyRent}
                onChange={(e) =>
                  setForm({ ...form, monthlyRent: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Tiền cọc">
              <input
                type="number"
                min="0"
                className={input}
                value={form.depositAmount || 0}
                onChange={(e) =>
                  setForm({ ...form, depositAmount: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Số người tối đa *">
              <input
                required
                type="number"
                min="1"
                max="100"
                className={input}
                value={form.capacity}
                onChange={(e) =>
                  setForm({ ...form, capacity: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="URL ảnh đại diện" wide>
              <input
                className={input}
                value={form.imageUrl || ""}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </Field>
            <Field label="Mô tả" wide>
              <textarea
                className={`${input} min-h-24`}
                value={form.description || ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="font-bold">Tiện nghi</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {options.data?.amenities.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 rounded-xl border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.amenityIds.includes(a.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        amenityIds: e.target.checked
                          ? [...form.amenityIds, a.id]
                          : form.amenityIds.filter((x) => x !== a.id),
                      })
                    }
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="font-bold">Tài sản bàn giao</h2>
            <div className="mt-4 flex gap-2">
              <input
                className={input}
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="Tên tài sản"
              />
              <button
                type="button"
                onClick={addAsset}
                className="rounded-xl bg-slate-900 px-4 text-white"
              >
                Thêm
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {form.assets.map((a, index) => (
                <div
                  key={`${a.name}-${index}`}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 p-2"
                >
                  <span className="flex-1 text-sm">{a.name}</span>
                  <input
                    type="number"
                    min="1"
                    className="w-16 rounded-lg border px-2 py-1"
                    value={a.quantity}
                    onChange={(e) => {
                      const assets = [...form.assets];
                      assets[index] = {
                        ...a,
                        quantity: Number(e.target.value),
                      };
                      setForm({ ...form, assets });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        assets: form.assets.filter((_, i) => i !== index),
                      })
                    }
                    className="px-2 text-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border bg-white px-5 py-2.5 font-semibold"
          >
            Hủy
          </button>
          <button
            disabled={mutation.isPending}
            className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {mutation.isPending ? "Đang lưu..." : "Lưu phòng"}
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

export function RoomDetailPage({ id }: { id: number }) {
  const query = useAdminRoom(id);
  const mutations = useRoomMutations(id);
  const [dialog, setDialog] = useState<"price" | "status" | null>(null);
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data)
    return (
      <AdminShell title="Chi tiết phòng">
        <ErrorState onRetry={() => void query.refetch()} />
      </AdminShell>
    );
  const d = query.data,
    r = d.room;
  const submit = async () => {
    setActionError("");
    try {
      if (dialog === "price")
        await mutations.price.mutateAsync({
          newPrice: price,
          effectiveDate: localToday(),
          reason,
          version: r.version,
        });
      else
        await mutations.status.mutateAsync({
          status,
          reason,
          version: r.version,
        });
      setDialog(null);
      setReason("");
    } catch (requestError) {
      setActionError(
        apiErrorMessage(requestError, "Không thể cập nhật phòng."),
      );
    }
  };
  return (
    <AdminShell
      title={`${r.roomCode} · ${r.name}`}
      subtitle={`${r.propertyName} · ${r.buildingName} · ${r.floorName}`}
      readOnly
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap justify-between gap-3">
          <Link
            href="/admin/rooms"
            className="text-sm font-semibold text-blue-600"
          >
            ← Danh sách phòng
          </Link>
          {d.canEdit && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setActionError("");
                  setPrice(r.monthlyRent);
                  setDialog("price");
                }}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
              >
                Đổi giá
              </button>
              <button
                onClick={() => {
                  setActionError("");
                  setStatus("");
                  setDialog("status");
                }}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
              >
                Đổi trạng thái
              </button>
              <Link
                href={`/admin/rooms/${id}/edit`}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Chỉnh sửa
              </Link>
            </div>
          )}
        </div>
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-5 sm:flex-row">
            <div>
              <StatusBadge status={r.status} />
              <h1 className="mt-3 text-3xl font-extrabold">{r.name}</h1>
              <p className="mt-2 text-slate-500">
                {r.roomType || "Chưa phân loại"} · {r.area || "—"} m² · tối đa{" "}
                {r.maxOccupants} người
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-slate-500">Giá thuê hiện tại</p>
              <p className="text-3xl font-extrabold text-blue-700">
                {formatCurrency(r.monthlyRent)}
              </p>
              <p className="text-sm text-slate-500">
                Cọc {formatCurrency(r.depositAmount)}
              </p>
            </div>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info
            label="Người đang ở"
            value={`${r.currentOccupants}/${r.maxOccupants}`}
          />
          <Info label="Hợp đồng" value={r.currentContract?.code || "Chưa có"} />
          <Info label="Công nợ" value={formatCurrency(r.outstandingDebt)} />
          <Info
            label="Yêu cầu bảo trì"
            value={String(r.openMaintenanceCount)}
          />
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <Card title="Người đang ở">
            {d.occupants.length ? (
              d.occupants.map((x, i) => (
                <div
                  key={`${x.fullName}-${i}`}
                  className="flex justify-between border-b py-3 text-sm"
                >
                  <span>
                    <strong>{x.fullName}</strong>
                    <small className="ml-2 text-slate-400">
                      {x.representative ? "Đại diện" : "Ở cùng"}
                    </small>
                  </span>
                  <span className="text-slate-500">{x.phone}</span>
                </div>
              ))
            ) : (
              <EmptyState text="Chưa có người ở." />
            )}
          </Card>
          <Card title="Tiện nghi & tài sản">
            <div className="flex flex-wrap gap-2">
              {d.amenities.map((a) => (
                <span
                  key={a.id}
                  className="rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-700"
                >
                  {a.name}
                </span>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {d.assets.map((a, i) => (
                <div
                  key={`${a.name}-${i}`}
                  className="flex justify-between rounded-lg bg-slate-50 p-2 text-sm"
                >
                  <span>{a.name}</span>
                  <span>
                    x{a.quantity} · {a.conditionStatus}
                  </span>
                </div>
              ))}
            </div>
            {!d.amenities.length && !d.assets.length && (
              <EmptyState text="Chưa khai báo tiện nghi hoặc tài sản." />
            )}
          </Card>
          <Card title="Công tơ">
            <div className="space-y-2">
              {d.meters.map((m) => (
                <div key={m.id} className="rounded-xl border p-3 text-sm">
                  <strong>
                    {m.meterType} · {m.meterCode}
                  </strong>
                  <p className="mt-1 text-slate-500">
                    Chỉ số {m.currentReading} · {formatDate(m.readingDate)}
                  </p>
                </div>
              ))}
              {!d.meters.length && <EmptyState text="Chưa gắn công tơ." />}
            </div>
          </Card>
          <Card title="Lịch sử giá">
            <div className="space-y-3">
              {d.priceHistory.map((h) => (
                <div key={h.id} className="border-b pb-3 text-sm">
                  <strong>
                    {formatCurrency(Number(h.fromValue))} →{" "}
                    {formatCurrency(Number(h.toValue))}
                  </strong>
                  <p className="text-slate-500">
                    Áp dụng {formatDate(h.effectiveDate)} ·{" "}
                    {h.reason || "Không có ghi chú"}
                  </p>
                </div>
              ))}
              {!d.priceHistory.length && (
                <EmptyState text="Chưa có thay đổi giá." />
              )}
            </div>
          </Card>
        </section>
        <Card title="Lịch sử trạng thái & hoạt động">
          <div className="grid gap-3 md:grid-cols-2">
            {d.statusHistory.map((h) => (
              <div key={`s-${h.id}`} className="rounded-xl border p-3 text-sm">
                <strong>
                  {statusLabel(h.fromValue)} → {statusLabel(h.toValue)}
                </strong>
                <p className="mt-1 text-slate-500">
                  {h.reason || "Không có ghi chú"} ·{" "}
                  {formatDate(h.createdAt, true)}
                </p>
              </div>
            ))}
            {d.activities.slice(0, 8).map((a) => (
              <div key={`a-${a.id}`} className="rounded-xl border p-3 text-sm">
                <strong>{a.description}</strong>
                <p className="mt-1 text-slate-500">
                  {a.actorName} · {formatDate(a.createdAt, true)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold">
              {dialog === "price"
                ? "Thay đổi giá phòng"
                : "Thay đổi trạng thái"}
            </h3>
            {dialog === "price" ? (
              <input
                type="number"
                min="0"
                className={`${input} mt-4`}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            ) : (
              <select
                className={`${input} mt-4`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Chọn trạng thái mới</option>
                {[
                  "VACANT",
                  "RESERVED",
                  "OCCUPIED",
                  "MAINTENANCE",
                  "INACTIVE",
                ].map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            )}
            <textarea
              className={`${input} mt-3 min-h-20`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do / ghi chú"
            />
            {actionError && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {actionError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setActionError("");
                  setDialog(null);
                }}
                className="rounded-xl border px-4 py-2"
              >
                Hủy
              </button>
              <button
                onClick={() => void submit()}
                disabled={
                  (dialog === "price" ? price < 0 : !status) ||
                  mutations.price.isPending ||
                  mutations.status.isPending
                }
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </article>
  );
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
