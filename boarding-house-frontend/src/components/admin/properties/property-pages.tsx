/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { PropertyManagersPanel } from "./property-managers-panel";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useManagementScope } from "@/providers/management-scope";
import { WorkspaceTabs } from "./room-workspace-ui";
import { PropertyRelatedTab } from "./property-room-details";
import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyState,
  ErrorState,
  PageLoading,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import {
  useAdminProperty,
  usePropertyMutations,
} from "@/hooks/use-admin-properties";
import { formatCurrency, formatDate } from "@/lib/format";
import { apiErrorMessage, normalizeAdminCode } from "@/lib/api-error";
import { validateVietnamPhone } from "@/lib/phone-validation";
import { useAuth } from "@/providers/auth-provider";
import type { PropertyPayload } from "@/types/admin-property";
import { ImageUpload, PropertyImage } from "@/components/shared/image-upload";

const input =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring focus:ring-2 focus:ring-ring";
export { PropertyListPage } from "./property-list-workspace";
function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-muted p-2 text-foreground">
      <p className="text-base font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageChecking, setImageChecking] = useState(false);
  const [imageProgress, setImageProgress] = useState<number>();
  const [hydratedId, setHydratedId] = useState<number>();
  useEffect(() => {
    if (detail.data && hydratedId !== id) {
      setHydratedId(id);
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
        version: detail.data.version,
      });
    }
  }, [detail.data, hydratedId, id]);
  if (id && detail.isLoading) return <PageLoading />;
  const mutation = id ? mutations.update : mutations.create;
  const phoneValidation = validateVietnamPhone(form.phone || "", false);
  const phoneError = phoneValidation.valid ? "" : phoneValidation.message;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mutation.isPending || imageChecking) return;
    setError("");
    if (phoneError) {
      setError(phoneError);
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        ...form,
        imageFile: imageFile || undefined,
        onImageProgress: imageFile ? setImageProgress : undefined,
      });
      router.push(
        `/admin/properties/${id || ("id" in result ? result.id : "")}`,
      );
    } catch (requestError) {
      setImageProgress(undefined);
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
        <fieldset disabled={mutation.isPending} className="contents">
          <div className="surface-card p-5 sm:p-7">
            <h2 className="text-lg font-bold">Thông tin cơ bản</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Mã nhà trọ *">
                <input
                  required
                  className={input}
                  value={form.code}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      code: normalizeAdminCode(e.target.value),
                    })
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
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </Field>
              <Field label="Điện thoại">
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className={`${input} ${phoneError ? "border-danger" : ""}`}
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                {phoneError && (
                  <span className="mt-1 block text-xs text-danger">
                    {phoneError}
                  </span>
                )}
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={input}
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <ImageUpload
                currentImage={form.thumbnailUrl}
                file={imageFile}
                onChange={setImageFile}
                onRemove={() => setForm({ ...form, thumbnailUrl: "" })}
                disabled={mutation.isPending}
                progress={imageProgress}
                onValidationChange={setImageChecking}
              />
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
              <p className="mt-4 rounded-xl bg-danger-muted p-3 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border bg-card px-5 py-2.5 font-semibold"
            >
              Hủy
            </button>
            <button
              disabled={mutation.isPending || imageChecking}
              className="rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {mutation.isPending ? "Đang lưu..." : "Lưu nhà trọ"}
            </button>
          </div>
        </fieldset>
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
      <span className="mb-1.5 block text-sm font-semibold text-secondary-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function PropertyDetailPage({ id }: { id: number }) {
  const params = useSearchParams();
  const scope = useManagementScope();
  const [tab, setTab] = useState(params.get("tab") ?? "overview");
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
            className="text-sm font-semibold text-link"
          >
            ← Danh sách nhà trọ
          </Link>
          <div className="flex gap-2">
            {user?.activeRole !== "ACCOUNTANT" && (
              <Link
                href={`/admin/properties/${id}/edit`}
                className="rounded-xl border bg-card px-4 py-2 text-sm font-semibold"
              >
                Chỉnh sửa
              </Link>
            )}
            <Link
              href={`/admin/rooms?propertyId=${id}`}
              className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white"
            >
              Xem phòng
            </Link>
          </div>
        </div>
        <section className="surface-card p-5 sm:p-6">
          <PropertyImage
            src={p.thumbnailUrl}
            alt={`Ảnh nhà trọ ${p.name}`}
            className="mb-5 h-64 w-full"
          />
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                <span className="text-sm text-muted-foreground">{p.type}</span>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold">{p.name}</h1>
              <p className="mt-2 text-muted-foreground">{p.address}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Phòng" value={p.totalRooms} />
              <Metric label="Đang thuê" value={p.occupiedRooms} />
              <Metric label="Lấp đầy" value={`${p.occupancyRate}%`} />
            </div>
          </div>
        </section>
        <WorkspaceTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "overview", label: "Tổng quan" },
            { id: "map", label: "Sơ đồ phòng" },
            { id: "rooms", label: "Danh sách phòng" },
            ...(user?.activeRole === "OWNER"
              ? [{ id: "staff", label: "Nhân sự quản lý" }]
              : []),
            ...(scope.canReadFinanceFor(id)
              ? [
                  { id: "services", label: "Dịch vụ và đơn giá" },
                  { id: "reports", label: "Báo cáo" },
                ]
              : []),
            ...(user?.activeRole !== "ACCOUNTANT"
              ? [
                  { id: "assets", label: "Tài sản" },
                  { id: "settings", label: "Cấu hình" },
                ]
              : []),
          ]}
        />
        {user?.activeRole === "OWNER" && (
          <div hidden={tab !== "staff"}>
            <PropertyManagersPanel key={id} propertyId={id} />
          </div>
        )}
        <div hidden={tab !== "overview"} className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3">
            {scope.canReadFinanceFor(id) && (
              <>
                <Info
                  label="Thực thu dịch vụ tháng"
                  value={formatCurrency(p.currentRevenue)}
                />
                <Info
                  label="Công nợ hiện tại"
                  value={formatCurrency(p.outstandingDebt)}
                />
              </>
            )}
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
          <section className="surface-card p-5 sm:p-6 ">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Cấu trúc tòa và tầng</h2>
                <p className="text-sm text-muted-foreground">
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
                    className="rounded-xl bg-primary hover:bg-primary-hover px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
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
                      <span className="text-xs text-muted-foreground">({b.code})</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {b.floors.map((f) => (
                        <span
                          key={f.id}
                          className="rounded-lg bg-muted px-3 py-2 text-sm"
                        >
                          {f.name} · {f.totalRooms} phòng
                        </span>
                      ))}
                      {b.floors.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          Chưa có tầng
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="surface-card p-5 sm:p-6 ">
            <h2 className="font-bold">Hoạt động gần đây</h2>
            <div className="mt-4 space-y-3">
              {p.activities.slice(0, 8).map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between gap-4 border-b pb-3 text-sm"
                >
                  <span>
                    {a.description}
                    <small className="ml-2 text-muted-foreground">{a.actorName}</small>
                  </span>
                  <time className="shrink-0 text-muted-foreground">
                    {formatDate(a.createdAt, true)}
                  </time>
                </div>
              ))}
              {!p.activities.length && (
                <p className="text-sm text-muted-foreground">Chưa có hoạt động.</p>
              )}
            </div>
          </section>
        </div>
        {(tab === "services" || tab === "reports"
          ? scope.canReadFinanceFor(id)
          : user?.activeRole !== "ACCOUNTANT" ||
            tab === "map" ||
            tab === "rooms") && (
          <PropertyRelatedTab tab={tab} propertyId={id} />
        )}
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6">
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
              <p className="mt-3 rounded-xl bg-danger-muted p-3 text-sm text-danger">
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
                className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 font-semibold text-white disabled:opacity-40"
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
    <article className="surface-card p-4 ">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold text-foreground">{value}</p>
    </article>
  );
}
