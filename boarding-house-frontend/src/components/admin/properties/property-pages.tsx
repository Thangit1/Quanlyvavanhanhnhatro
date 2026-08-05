/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  Building2,
  ChevronRight,
  DoorOpen,
  Home,
  MapPin,
  Plus,
  Search,
  Wallet,
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
  useAdminProperties,
  useAdminProperty,
  usePropertyMutations,
} from "@/hooks/use-admin-properties";
import { formatCurrency, formatDate } from "@/lib/format";
import { apiErrorMessage, normalizeAdminCode } from "@/lib/api-error";
import { useAuth } from "@/providers/auth-provider";
import type { PropertyPayload } from "@/types/admin-property";

const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
export function PropertyListPage() {
  const { user } = useAuth();
  const [typed, setTyped] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(typed.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const query = useAdminProperties({
    keyword: keyword || undefined,
    status: status || undefined,
    page,
    size: 20,
  });
  const canCreate = user?.activeRole === "OWNER";
  if (query.isLoading) return <PageLoading />;
  const data = query.data;
  return (
    <AdminShell
      title="Nhà và phòng"
      subtitle="Quản lý cơ sở, tòa, tầng và phòng"
      readOnly
    >
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl border bg-white p-1">
            <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Nhà trọ
            </span>
            <Link
              href="/admin/rooms"
              className="px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Phòng
            </Link>
          </div>
          {canCreate && (
            <Link
              href="/admin/properties/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="size-4" />
              Thêm nhà trọ
            </Link>
          )}
        </div>
        {query.isError && (
          <ErrorState onRetry={() => void query.refetch()} />
        )}{" "}
        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Stat
                label="Nhà trọ"
                value={data.summary.totalProperties}
                icon={<Building2 />}
              />
              <Stat
                label="Đang hoạt động"
                value={data.summary.activeProperties}
                icon={<Home />}
              />
              <Stat
                label="Tổng phòng"
                value={data.summary.totalRooms}
                icon={<DoorOpen />}
              />
              <Stat
                label="Đang thuê"
                value={data.summary.occupiedRooms}
                icon={<Wallet />}
              />
              <Stat
                label="Còn trống"
                value={data.summary.vacantRooms}
                icon={<DoorOpen />}
              />
              <Stat
                label="Bảo trì"
                value={data.summary.maintenanceRooms}
                icon={<Wrench />}
              />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <label className="relative">
                  <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                  <input
                    className={`${input} pl-9`}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Tìm mã, tên hoặc địa chỉ..."
                  />
                </label>
                <select
                  className={input}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Ngừng hoạt động</option>
                </select>
              </div>
            </section>
            {data.page.items.length === 0 ? (
              <EmptyState text="Chưa có nhà trọ phù hợp." />
            ) : (
              <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {data.page.items.map((p) => (
                  <Link
                    href={`/admin/properties/${p.id}`}
                    key={p.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="h-28 bg-gradient-to-br from-blue-600 to-cyan-500 p-5 text-white">
                      <div className="flex justify-between">
                        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
                          {p.propertyCode}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                      <h2 className="mt-4 truncate text-xl font-bold">
                        {p.name}
                      </h2>
                    </div>
                    <div className="space-y-4 p-5">
                      <p className="flex items-start gap-2 text-sm text-slate-500">
                        <MapPin className="mt-0.5 size-4 shrink-0" />
                        {p.address}
                      </p>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <Metric label="Phòng" value={p.totalRooms} />
                        <Metric label="Đang thuê" value={p.occupiedRooms} />
                        <Metric label="Trống" value={p.vacantRooms} />
                        <Metric label="Lấp đầy" value={`${p.occupancyRate}%`} />
                      </div>
                      <div className="flex items-center justify-between border-t pt-3 text-sm">
                        <span className="text-slate-500">Doanh thu tháng</span>
                        <strong>{formatCurrency(p.currentRevenue)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                          Quản lý: {p.manager?.fullName || "Chưa phân công"}
                        </span>
                        <ChevronRight className="size-4 text-blue-600 transition group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                ))}
              </section>
            )}
            <Pagination
              page={data.page.page}
              total={data.page.totalPages}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </AdminShell>
  );
}
function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <p className="text-base font-bold">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="block size-5 text-blue-600">{icon}</span>
      <p className="mt-3 text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
    </article>
  );
}
function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (n: number) => void;
}) {
  if (total <= 1) return null;
  return (
    <div className="flex justify-end gap-2">
      <button
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
      >
        Trước
      </button>
      <span className="px-3 py-2 text-sm">
        {page + 1}/{total}
      </span>
      <button
        disabled={page + 1 >= total}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
      >
        Sau
      </button>
    </div>
  );
}

const empty: PropertyPayload = {
  code: "",
  name: "",
  type: "BOARDING_HOUSE",
  address: "",
};
export function PropertyFormPage({ id }: { id?: number }) {
  const router = useRouter();
  const detail = useAdminProperty(id || 0);
  const mutations = usePropertyMutations(id);
  const [form, setForm] = useState<PropertyPayload>(empty);
  const [error, setError] = useState("");
  useEffect(() => {
    if (detail.data)
      setForm({
        code: detail.data.propertyCode,
        name: detail.data.name,
        type: detail.data.type,
        description: detail.data.description,
        address: detail.data.address,
        phone: detail.data.phone,
        email: detail.data.email,
        operationStartDate: detail.data.operationStartDate,
        thumbnailUrl: detail.data.thumbnailUrl,
        managerId: detail.data.manager?.id,
        version: detail.data.version,
      });
  }, [detail.data]);
  if (id && detail.isLoading) return <PageLoading />;
  const mutation = id ? mutations.update : mutations.create;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await mutation.mutateAsync(form);
      router.push(
        `/admin/properties/${id || ("id" in result ? result.id : "")}`,
      );
    } catch (requestError) {
      setError(
        apiErrorMessage(
          requestError,
          "Không thể lưu nhà trọ. Vui lòng kiểm tra dữ liệu bắt buộc.",
        ),
      );
    }
  };
  return (
    <AdminShell
      title={id ? "Cập nhật nhà trọ" : "Thêm nhà trọ"}
      subtitle="Thông tin vận hành cơ sở"
    >
      <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-bold">Thông tin cơ bản</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Mã nhà trọ *">
              <input
                required
                className={input}
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: normalizeAdminCode(e.target.value) })
                }
              />
            </Field>
            <Field label="Tên nhà trọ *">
              <input
                required
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Loại hình *">
              <select
                className={input}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="BOARDING_HOUSE">Nhà trọ</option>
                <option value="APARTMENT">Căn hộ</option>
                <option value="DORMITORY">Ký túc xá</option>
                <option value="OTHER">Khác</option>
              </select>
            </Field>
            <Field label="Ngày bắt đầu vận hành">
              <input
                type="date"
                className={input}
                value={form.operationStartDate || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    operationStartDate: e.target.value || undefined,
                  })
                }
              />
            </Field>
            <Field label="Địa chỉ *" wide>
              <input
                required
                className={input}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label="Điện thoại">
              <input
                className={input}
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={input}
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="URL ảnh đại diện" wide>
              <input
                className={input}
                value={form.thumbnailUrl || ""}
                onChange={(e) =>
                  setForm({ ...form, thumbnailUrl: e.target.value })
                }
                placeholder="https://..."
              />
            </Field>
            <Field label="Mô tả" wide>
              <textarea
                className={`${input} min-h-28`}
                value={form.description || ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </Field>
          </div>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
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
            {mutation.isPending ? "Đang lưu..." : "Lưu nhà trọ"}
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
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

export function PropertyDetailPage({ id }: { id: number }) {
  const { user } = useAuth();
  const query = useAdminProperty(id);
  const mutations = usePropertyMutations(id);
  const [modal, setModal] = useState<"building" | "floor" | null>(null);
  const [buildingId, setBuildingId] = useState(0);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [structureError, setStructureError] = useState("");
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data)
    return (
      <AdminShell title="Nhà trọ">
        <ErrorState onRetry={() => void query.refetch()} />
      </AdminShell>
    );
  const p = query.data;
  const saveStructure = async () => {
    setStructureError("");
    try {
      if (modal === "building")
        await mutations.building.mutateAsync({
          code,
          name,
          displayOrder: p.buildings.length + 1,
        });
      else
        await mutations.floor.mutateAsync({
          buildingId,
          code,
          name,
          floorNumber: undefined,
          displayOrder: 10,
        });
      setModal(null);
      setCode("");
      setName("");
    } catch (requestError) {
      setStructureError(
        apiErrorMessage(requestError, "Không thể thêm tòa hoặc tầng."),
      );
    }
  };
  return (
    <AdminShell
      title={p.name}
      subtitle={`${p.propertyCode} · ${p.address}`}
      readOnly
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/properties"
            className="text-sm font-semibold text-blue-600"
          >
            ← Danh sách nhà trọ
          </Link>
          <div className="flex gap-2">
            {user?.activeRole !== "ACCOUNTANT" && (
              <Link
                href={`/admin/properties/${id}/edit`}
                className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
              >
                Chỉnh sửa
              </Link>
            )}
            <Link
              href={`/admin/rooms?propertyId=${id}`}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Xem phòng
            </Link>
          </div>
        </div>
        <section className="rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-600 p-6 text-white">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                <span className="text-sm text-blue-100">{p.type}</span>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold">{p.name}</h1>
              <p className="mt-2 text-blue-100">{p.address}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Phòng" value={p.totalRooms} />
              <Metric label="Đang thuê" value={p.occupiedRooms} />
              <Metric label="Lấp đầy" value={`${p.occupancyRate}%`} />
            </div>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          <Info
            label="Doanh thu tháng"
            value={formatCurrency(p.currentRevenue)}
          />
          <Info label="Công nợ" value={formatCurrency(p.outstandingDebt)} />
          <Info
            label="Quản lý"
            value={p.manager?.fullName || "Chưa phân công"}
          />
          <Info label="Điện thoại" value={p.phone || "—"} />
          <Info label="Email" value={p.email || "—"} />
          <Info
            label="Bắt đầu vận hành"
            value={formatDate(p.operationStartDate)}
          />
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Cấu trúc tòa và tầng</h2>
              <p className="text-sm text-slate-500">
                {p.buildings.length} tòa ·{" "}
                {p.buildings.reduce((s, b) => s + b.floors.length, 0)} tầng
              </p>
            </div>
            {user?.activeRole !== "ACCOUNTANT" && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStructureError("");
                    setModal("building");
                  }}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold"
                >
                  + Tòa
                </button>
                <button
                  onClick={() => {
                    setStructureError("");
                    setBuildingId(p.buildings[0]?.id || 0);
                    setModal("floor");
                  }}
                  disabled={!p.buildings.length}
                  className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  + Tầng
                </button>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {p.buildings.length === 0 ? (
              <EmptyState text="Chưa có tòa nhà." />
            ) : (
              p.buildings.map((b) => (
                <div key={b.id} className="rounded-xl border p-4">
                  <div className="font-bold">
                    {b.name}{" "}
                    <span className="text-xs text-slate-400">({b.code})</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.floors.map((f) => (
                      <span
                        key={f.id}
                        className="rounded-lg bg-slate-100 px-3 py-2 text-sm"
                      >
                        {f.name} · {f.totalRooms} phòng
                      </span>
                    ))}
                    {b.floors.length === 0 && (
                      <span className="text-sm text-slate-400">
                        Chưa có tầng
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-bold">Hoạt động gần đây</h2>
          <div className="mt-4 space-y-3">
            {p.activities.slice(0, 8).map((a) => (
              <div
                key={a.id}
                className="flex justify-between gap-4 border-b pb-3 text-sm"
              >
                <span>
                  {a.description}
                  <small className="ml-2 text-slate-400">{a.actorName}</small>
                </span>
                <time className="shrink-0 text-slate-400">
                  {formatDate(a.createdAt, true)}
                </time>
              </div>
            ))}
            {!p.activities.length && (
              <p className="text-sm text-slate-400">Chưa có hoạt động.</p>
            )}
          </div>
        </section>
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold">
              Thêm {modal === "building" ? "tòa nhà" : "tầng"}
            </h3>
            {modal === "floor" && (
              <select
                className={`${input} mt-4`}
                value={buildingId}
                onChange={(e) => setBuildingId(Number(e.target.value))}
              >
                {p.buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <input
              className={`${input} mt-3`}
              value={code}
              onChange={(e) => setCode(normalizeAdminCode(e.target.value))}
              placeholder="Mã"
            />
            <input
              className={`${input} mt-3`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên hiển thị"
            />
            {structureError && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {structureError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setStructureError("");
                  setModal(null);
                }}
                className="rounded-xl border px-4 py-2"
              >
                Hủy
              </button>
              <button
                onClick={() => void saveStructure()}
                disabled={
                  !code ||
                  !name ||
                  (modal === "floor" && !buildingId) ||
                  mutations.building.isPending ||
                  mutations.floor.isPending
                }
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                {mutations.building.isPending || mutations.floor.isPending
                  ? "Đang lưu..."
                  : "Lưu"}
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
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </article>
  );
}
