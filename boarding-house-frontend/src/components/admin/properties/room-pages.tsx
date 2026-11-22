/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import {
  parseNumericFields,
  parseNumericValue,
  type NumericDraftFields,
} from "@/lib/numeric-input";
import { NumberInput, CurrencyInput } from "@/components/ui/number-input";
import Link from "next/link";
import {
  RoomImages,
  type RoomImageDraft,
} from "@/components/shared/room-images";
import { RoomMeterManagement } from "@/components/shared/room-meter-management";
import { RoomAssetsEditor } from "./room-assets-editor";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  ErrorState,
  PageLoading,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import {
  useAdminRoom,
  usePropertyOptions,
  useRoomMutations,
} from "@/hooks/use-admin-properties";
import { formatCurrency, statusLabel } from "@/lib/format";
import { apiErrorMessage, normalizeAdminCode } from "@/lib/api-error";
import { useManagementScope } from "@/providers/management-scope";
import { RoomDetailSections } from "./property-room-details";
import type { RoomPayload } from "@/types/admin-property";

const input =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring focus:ring-2 focus:ring-ring";
function localToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export { RoomListPage } from "./room-list-workspace";
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
  const searchParams = useSearchParams();
  const selectedProperty = Number(searchParams.get("propertyId")) || undefined;
  const options = usePropertyOptions();
  const detail = useAdminRoom(id || 0);
  const mutations = useRoomMutations(id);
  const [form, setForm] = useState<
    NumericDraftFields<
      RoomPayload,
      "area" | "monthlyRent" | "depositAmount" | "capacity" | "assets"
    >
  >({ ...blank, propertyId: selectedProperty ?? 0 });
  const [images, setImages] = useState<RoomImageDraft[]>([]);
  const [cover, setCover] = useState("");
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number>();
  const saveLock = useRef(false);
  const retry = useRef({ fingerprint: "", key: "" });
  const [hydratedId, setHydratedId] = useState<number>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (detail.data && hydratedId !== id) {
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
      const urls = [
        ...new Set(
          [...d.images, d.room.thumbnailUrl].filter((x): x is string => !!x),
        ),
      ];
      setImages(urls.map((url) => ({ id: url, url })));
      setCover(d.room.thumbnailUrl || urls[0] || "");
      setHydratedId(id);
    }
  }, [detail.data, hydratedId, id]);
  if (options.isLoading || (id && detail.isLoading)) return <PageLoading />;
  if (options.isError || (id && detail.isError))
    return (
      <ErrorState
        onRetry={() => {
          void options.refetch();
          if (id) void detail.refetch();
        }}
      />
    );
  const buildings =
    options.data?.buildings.filter((b) => b.parentId === form.propertyId) || [];
  const floors =
    options.data?.floors.filter((f) => f.parentId === form.buildingId) || [];
  const mutation = id ? mutations.update : mutations.create;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saveLock.current || validating) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    setProgress(0);
    try {
      const files: File[] = [];
      const items = images.map((item) => {
        if (!item.file) return item.url;
        files.push(item.file);
        return `upload:${files.length - 1}`;
      });
      const gallery = {
        items,
        cover: Math.max(
          0,
          images.findIndex((item) => item.id === cover),
        ),
      };
      const fingerprint = JSON.stringify([
        form,
        gallery,
        images.map((item) => [
          item.id,
          item.file?.name,
          item.file?.size,
          item.file?.lastModified,
        ]),
      ]);
      if (retry.current.fingerprint !== fingerprint)
        retry.current = { fingerprint, key: crypto.randomUUID() };
      const result = await mutation.mutateAsync({
        ...parseNumericFields<RoomPayload>(
          form,
          ["area", "monthlyRent", "depositAmount", "capacity", "quantity"],
          ["area"],
          { depositAmount: 0 },
        ),
        gallery,
        imageFiles: files,
        requestKey: retry.current.key,
        onImageProgress: setProgress,
      });
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
    } finally {
      saveLock.current = false;
      setSaving(false);
      setProgress(undefined);
    }
  };
  return (
    <AdminShell
      title={id ? "Cập nhật phòng" : "Thêm phòng"}
      subtitle="Cấu hình vị trí, giá, tiện nghi và tài sản"
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <form onSubmit={submit} className="space-y-5">
          <section className="surface-card p-6 ">
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
              <Field label="Dãy / tòa (tùy chọn)">
                <Select
                  value={form.buildingId || undefined}
                  placeholder="Không có dãy / tòa"
                  items={buildings}
                  onChange={(v) =>
                    setForm({ ...form, buildingId: v || 0, floorId: 0 })
                  }
                />
              </Field>
              <Field label="Tầng (tùy chọn)">
                <Select
                  value={form.floorId || undefined}
                  placeholder="Không có tầng"
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
                    setForm({
                      ...form,
                      code: normalizeAdminCode(e.target.value),
                    })
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
                  onChange={(e) =>
                    setForm({ ...form, roomType: e.target.value })
                  }
                  placeholder="Studio, khép kín..."
                />
              </Field>
              <Field label="Diện tích (m²)">
                <NumberInput
                  type="number"
                  min="0"
                  step="0.1"
                  className={input}
                  value={form.area ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      area: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Giá thuê/tháng *">
                <CurrencyInput
                  required
                  type="number"
                  min="0"
                  className={input}
                  value={form.monthlyRent}
                  onChange={(e) =>
                    setForm({ ...form, monthlyRent: e.target.value })
                  }
                />
              </Field>
              <Field label="Tiền cọc">
                <CurrencyInput
                  type="number"
                  min="0"
                  className={input}
                  value={form.depositAmount ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, depositAmount: e.target.value })
                  }
                />
              </Field>
              <Field label="Số người tối đa *">
                <NumberInput
                  required
                  type="number"
                  min="1"
                  max="100"
                  className={input}
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
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
          <RoomImages
            value={images}
            cover={cover}
            onChange={setImages}
            onCover={setCover}
            disabled={saving}
            progress={progress}
            onValidating={setValidating}
          />
          <p className="rounded-xl bg-accent p-4 text-sm text-link">
            Phòng mới được tạo ở trạng thái còn trống. Đồng hồ điện nước và điều
            kiện bàn giao phải được khai báo, kiểm tra riêng trên trang chi tiết
            trước khi nhận phòng.
          </p>
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="surface-card p-6 ">
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
            <RoomAssetsEditor
              assets={form.assets}
              onChange={(assets) => setForm({ ...form, assets })}
            />
          </section>
          {error && (
            <p className="rounded-xl bg-danger-muted p-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border bg-card px-5 py-2.5 font-semibold"
            >
              Hủy
            </button>
            <button
              disabled={saving || validating || mutation.isPending}
              className="rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu phòng"}
            </button>
          </div>
        </form>
        {id && detail.data && <RoomMeterManagement detail={detail.data} />}
      </div>
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
      <span className="mb-1.5 block text-sm font-semibold text-secondary-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function RoomDetailPage({ id }: { id: number }) {
  const scope = useManagementScope();
  const query = useAdminRoom(id);
  const mutations = useRoomMutations(id);
  const [dialog, setDialog] = useState<"price" | "status" | null>(null);
  const [price, setPrice] = useState<number | string>(0);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [readinessConfirmed, setReadinessConfirmed] = useState(false);
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
          newPrice: parseNumericValue(price)!,
          effectiveDate: localToday(),
          reason,
          version: r.version,
        });
      else
        await mutations.status.mutateAsync({
          status,
          reason,
          version: r.version,
          readinessConfirmed,
        });
      setDialog(null);
      setReason("");
    } catch (requestError) {
      void query.refetch();
      setActionError(
        apiErrorMessage(requestError, "Không thể cập nhật phòng."),
      );
    }
  };
  return (
    <AdminShell
      title={`${r.roomCode} · ${r.name}`}
      subtitle={[r.propertyName, r.buildingName, r.floorName]
        .filter(Boolean)
        .join(" / ")}
      readOnly
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap justify-between gap-3">
          <Link href="/admin/rooms" className="text-sm font-semibold text-link">
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
                className="rounded-xl border bg-card px-4 py-2 text-sm font-semibold"
              >
                Đổi giá
              </button>
              {d.canChangeStatus &&
                [
                  "VACANT",
                  "READY",
                  "CLEANING",
                  "MAINTENANCE",
                  "INACTIVE",
                ].includes(r.status) && (
                  <button
                    onClick={() => {
                      setActionError("");
                      setStatus("");
                      setReadinessConfirmed(false);
                      setDialog("status");
                    }}
                    className="rounded-xl border bg-card px-4 py-2 text-sm font-semibold"
                  >
                    Đổi trạng thái
                  </button>
                )}
              <Link
                href={`/admin/rooms/${id}/edit`}
                className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white"
              >
                Chỉnh sửa
              </Link>
            </div>
          )}
        </div>
        <section className="surface-card p-6 ">
          <div className="flex flex-col justify-between gap-5 sm:flex-row">
            <div>
              <StatusBadge status={r.status} />
              {(!["VACANT", "READY"].includes(r.status) ||
                r.currentContract ||
                r.openMaintenanceCount > 0) && (
                <p className="mt-2 text-sm text-warning">
                  Chưa nhận giữ chỗ:{" "}
                  {r.currentContract
                    ? "còn hợp đồng cam kết"
                    : r.openMaintenanceCount > 0
                      ? "còn công việc bảo trì chưa nghiệm thu"
                      : statusLabel(r.status)}
                  . Nhận/trả phòng phải qua Vòng đời thuê.
                </p>
              )}
              <h1 className="mt-3 text-3xl font-extrabold">{r.name}</h1>
              <p className="mt-2 text-muted-foreground">
                {r.roomType || "Chưa phân loại"} · {r.area || "—"} m² · tối đa{" "}
                {r.maxOccupants} người
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-muted-foreground">Giá thuê hiện tại</p>
              <p className="text-3xl font-extrabold text-link">
                {formatCurrency(r.monthlyRent)}
              </p>
              <p className="text-sm text-muted-foreground">
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
          {scope.canReadFinanceFor(r.propertyId) && (
            <Info label="Công nợ" value={formatCurrency(r.outstandingDebt)} />
          )}
          <Info
            label="Yêu cầu bảo trì"
            value={String(r.openMaintenanceCount)}
          />
        </section>
        <RoomDetailSections detail={d} />
      </div>
      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6">
            <h3 className="text-lg font-bold">
              {dialog === "price"
                ? "Thay đổi giá phòng"
                : "Thay đổi trạng thái"}
            </h3>
            {dialog === "price" ? (
              <CurrencyInput
                type="number"
                min="0"
                className={`${input} mt-4`}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            ) : (
              <select
                className={`${input} mt-4`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Chọn trạng thái mới</option>
                {(
                  {
                    VACANT: ["READY", "MAINTENANCE", "INACTIVE"],
                    READY: ["VACANT", "MAINTENANCE", "INACTIVE"],
                    CLEANING: ["READY", "MAINTENANCE"],
                    MAINTENANCE: ["READY", "CLEANING", "INACTIVE"],
                    INACTIVE: ["VACANT", "MAINTENANCE"],
                  } as Record<string, string[]>
                )[r.status]?.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            )}
            {dialog === "status" && status === "READY" && (
              <label className="mt-3 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={readinessConfirmed}
                  onChange={(e) => setReadinessConfirmed(e.target.checked)}
                />{" "}
                Đã kiểm tra vệ sinh, tài sản và nghiệm thu điều kiện khai thác
              </label>
            )}
            <textarea
              className={`${input} mt-3 min-h-20`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do / ghi chú"
            />
            {actionError && (
              <p className="mt-3 rounded-xl bg-danger-muted p-3 text-sm text-danger">
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
                  (dialog === "price"
                    ? price === "" || Number(price) < 0
                    : !status) ||
                  (dialog === "status" &&
                    (!reason.trim() ||
                      (status === "READY" && !readinessConfirmed))) ||
                  mutations.price.isPending ||
                  mutations.status.isPending
                }
                className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 font-semibold text-white disabled:opacity-40"
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
    <article className="surface-card p-4 ">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </article>
  );
}
