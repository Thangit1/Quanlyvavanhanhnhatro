"use client";
import Link from "next/link";
import { PropertyImage } from "@/components/shared/image-upload";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { ArrowUpRight, Download, X } from "lucide-react";
import { CurrencyInput, NumberInput } from "@/components/ui/number-input";
import { ActionMenu } from "@/components/shared/management-ui";
import { StatusBadge } from "@/components/shared/dashboard-ui";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api-error";
import {
  canStartRental,
  expiringInDays,
  previewRoomCodes,
  roomStatusColors,
  roomsCsv,
} from "@/lib/room-presentation";
import { useManagementScope } from "@/providers/management-scope";
import { useAuth } from "@/providers/auth-provider";
import {
  usePropertyOptions,
  useRoomMutations,
} from "@/hooks/use-admin-properties";
import { adminPropertyService } from "@/services/admin-property.service";
import { currentSessionEpoch } from "@/services/api-client";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { rentalLifecycleService } from "@/services/rental-lifecycle.service";
import type { RoomFilters, RoomRow } from "@/types/admin-property";

const field =
  "min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm";
export function WorkspaceTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <nav
      aria-label="Các mục chi tiết"
      className="flex max-w-full gap-2 overflow-x-auto border-b border-border pb-2"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          aria-current={value === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
          className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium ${value === tab.id ? "bg-primary hover:bg-primary-hover text-white" : "bg-card text-secondary-foreground hover:bg-muted"}`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
export function RoomActions({ room }: { room: RoomRow }) {
  const { user } = useAuth();
  const scope = useManagementScope();
  const write = user?.activeRole === "OWNER" || user?.activeRole === "MANAGER";
  const finance = scope.canReadFinanceFor(room.propertyId);
  const context = `propertyId=${room.propertyId}&roomId=${room.id}`;
  const links: [string, string][] = [
    ["Xem chi tiết", `/admin/rooms/${room.id}`],
  ];
  if (write)
    links.push(["Sửa thông tin phòng", `/admin/rooms/${room.id}/edit`]);
  if (write && canStartRental(room))
    links.push(
      ["Giữ phòng", `/admin/rental-lifecycle?${context}&action=booking`],
      ["Lập hợp đồng trực tiếp", `/admin/contracts/new?${context}`],
    );
  if (room.currentContract) {
    links.push(["Xem hợp đồng", `/admin/contracts/${room.currentContract.id}`]);
    if (write)
      links.push(
        ["Người đang ở", `/admin/tenants?${context}`],
        [
          "Quy trình trả phòng",
          `/admin/rental-lifecycle?${context}&tab=checkout`,
        ],
      );
  }
  if (finance) links.push(["Hóa đơn và công nợ", `/admin/invoices?${context}`]);
  if (write)
    links.push(
      ["Điện nước", `/admin/rooms/${room.id}?tab=utilities`],
      ["Yêu cầu bảo trì", `/admin/maintenance/new?${context}`],
    );
  if (room.status === "RESERVED" && write)
    links.push([
      "Phiếu giữ phòng / gia hạn / hủy",
      `/admin/rental-lifecycle?${context}&tab=booking`,
    ]);
  if ((room.status === "MAINTENANCE" || room.openMaintenanceCount > 0) && write)
    links.push(["Theo dõi sửa chữa", `/admin/maintenance?${context}`]);
  return (
    <ActionMenu>
      {links.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className="block rounded-lg px-3 py-2 text-sm text-secondary-foreground hover:bg-accent"
        >
          {label}
        </Link>
      ))}
    </ActionMenu>
  );
}
export function RoomCard({
  room,
  workflow,
}: {
  room: RoomRow;
  workflow?: ReactNode;
}) {
  const finance = useManagementScope().canReadFinanceFor(room.propertyId);
  const days = expiringInDays(room.currentContract?.endDate);
  return (
    <article
      className="min-w-0 rounded-xl border border-border border-t-4 bg-card p-4"
      style={{ borderTopColor: roomStatusColors[room.status] ?? "#94a3b8" }}
    >
      <PropertyImage
        src={room.thumbnailUrl}
        alt={`Ảnh phòng ${room.roomCode}`}
        className="mb-3 h-40 w-full"
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/admin/rooms/${room.id}`}
          className="min-w-0 font-bold text-foreground hover:text-link"
        >
          {room.roomCode}
          <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
            {room.name}
          </span>
        </Link>
        <StatusBadge status={room.status} />
      </div>
      <p className="mt-3 text-xl font-bold text-link">
        {formatCurrency(room.monthlyRent)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          / tháng
        </span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {room.area == null ? "Chưa khai báo diện tích" : `${room.area} m²`} ·{" "}
        {room.currentOccupants}/{room.maxOccupants} người
      </p>
      <p className="mt-3 truncate text-sm">
        {room.representativeTenant?.fullName ?? "Chưa có người đại diện"}
      </p>
      {room.currentContract && (
        <Link
          href={`/admin/contracts/${room.currentContract.id}`}
          className="mt-1 block text-xs text-link"
        >
          {room.currentContract.code} · Đến{" "}
          {formatDate(room.currentContract.endDate)}
        </Link>
      )}
      <div
        className="mt-3 space-y-1 text-xs"
        aria-label="Cảnh báo độc lập với trạng thái phòng"
      >
        {days != null && (
          <p className="text-warning">Hợp đồng hết hạn trong {days} ngày</p>
        )}
        {room.openMaintenanceCount > 0 && (
          <p className="text-orange-700">
            {room.openMaintenanceCount} bảo trì chưa hoàn tất
          </p>
        )}
        {finance && (room.overdueInvoiceCount ?? 0) > 0 && (
          <p className="text-danger">
            {room.overdueInvoiceCount} hóa đơn quá hạn
          </p>
        )}
        {finance && room.outstandingDebt > 0 && (
          <p className="text-danger">
            Còn phải thu {formatCurrency(room.outstandingDebt)}
          </p>
        )}
        {workflow}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Link
          href={`/admin/rooms/${room.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-link"
        >
          Chi tiết
          <ArrowUpRight className="size-3.5" />
        </Link>
        <RoomActions room={room} />
      </div>
    </article>
  );
}
export function GroupedRoomCards({ rooms }: { rooms: RoomRow[] }) {
  const { user } = useAuth();
  const scope = useManagementScope();
  const propertyId =
    rooms.length && rooms.every((r) => r.propertyId === rooms[0].propertyId)
      ? rooms[0].propertyId
      : scope.propertyId;
  const workflow = useScopedQuery({
    queryKey: ["room-workflow-notices", propertyId],
    queryFn: ({ signal }) => rentalLifecycleService.board(propertyId, signal),
    enabled: !!user && ["OWNER", "MANAGER"].includes(user.activeRole),
  });
  const groups = new Map<string, { label: string; rooms: RoomRow[] }>();
  for (const room of rooms) {
    const key = `${room.propertyId}:${room.buildingId ?? "none"}:${room.floorId ?? "none"}`;
    const group = groups.get(key) ?? {
      label: [room.propertyName, room.buildingName, room.floorName]
        .filter(Boolean)
        .join(" / "),
      rooms: [],
    };
    group.rooms.push(room);
    groups.set(key, group);
  }
  return (
    <div className="space-y-6 p-3">
      {workflow.isError && (
        <p className="text-xs text-warning">
          Chưa tải được lịch giữ, nhận và trả phòng. Các trạng thái phòng bên
          dưới vẫn lấy từ API phòng.
        </p>
      )}
      {Array.from(groups, ([key, group]) => (
        <section key={key}>
          <h2 className="mb-3 text-sm font-semibold text-secondary-foreground">
            {group.label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {group.rooms.length} phòng trên trang này
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {group.rooms.map((r) => {
              const checkin = workflow.isError
                ? undefined
                : workflow.data?.checkins.find(
                    (c) =>
                      c.roomId === r.id &&
                      !c.actualCheckinAt &&
                      !["CANCELLED", "COMPLETED"].includes(c.status),
                  );
              const checkout = workflow.isError
                ? undefined
                : workflow.data?.checkouts.find(
                    (c) =>
                      c.roomId === r.id &&
                      !c.actualCheckoutAt &&
                      !["CANCELLED", "COMPLETED"].includes(c.status),
                  );
              const booking = workflow.isError
                ? undefined
                : workflow.data?.bookings.find(
                    (b) =>
                      b.roomId === r.id &&
                      ["RESERVED", "CONFIRMED", "ACTIVE", "PENDING"].includes(
                        b.status,
                      ),
                  );
              return (
                <RoomCard
                  key={r.id}
                  room={r}
                  workflow={
                    <>
                      {booking && (
                        <p className="text-warning">
                          Giữ chỗ đến {formatDate(booking.reservationEnd)}
                        </p>
                      )}
                      {checkin && (
                        <p className="text-link">
                          Chờ nhận phòng {formatDate(checkin.scheduledDate)}
                        </p>
                      )}
                      {checkout && (
                        <p className="text-orange-700">
                          Đang xử lý trả phòng{" "}
                          {formatDate(checkout.requestedDate)}
                        </p>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
export function ExportRoomsButton({ filters }: { filters: RoomFilters }) {
  const { user } = useAuth();
  const options = usePropertyOptions();
  const contexts = options.isError ? [] : (options.data?.contexts ?? []);
  const canExport =
    user?.activeRole === "OWNER" ||
    (user?.activeRole === "MANAGER" &&
      (filters.propertyId
        ? contexts.some(
            (p) => p.propertyId === filters.propertyId && p.canExport,
          )
        : contexts.length > 0 && contexts.every((p) => p.canExport)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function download() {
    setBusy(true);
    setError("");
    const epoch = currentSessionEpoch();
    controller.current = new AbortController();
    try {
      const rows: RoomRow[] = [];
      let total = 0;
      for (let page = 0; ; page++) {
        const result = await adminPropertyService.rooms(
          { ...filters, page, size: 100 },
          controller.current.signal,
        );
        if (epoch !== currentSessionEpoch())
          throw Error("Phiên làm việc đã thay đổi. Vui lòng xuất lại.");
        if (page === 0) total = result.page.totalElements;
        if (total !== result.page.totalElements)
          throw Error(
            "Danh sách vừa thay đổi. Vui lòng xuất lại để tránh thiếu dữ liệu.",
          );
        rows.push(...result.page.items);
        if (page + 1 >= result.page.totalPages) break;
        if (!result.page.items.length)
          throw Error("Dữ liệu xuất chưa đầy đủ. Vui lòng thử lại.");
      }
      if (
        rows.length !== total ||
        new Set(rows.map((r) => r.id)).size !== total
      )
        throw Error("Danh sách vừa thay đổi. Vui lòng xuất lại.");
      const url = URL.createObjectURL(
        new Blob([roomsCsv(rows, (s) => statusLabel(s))], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "danh-sach-phong.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (!controller.current?.signal.aborted)
        setError(
          apiErrorMessage(
            e,
            e instanceof Error ? e.message : "Không thể xuất danh sách phòng.",
          ),
        );
    } finally {
      setBusy(false);
    }
  }
  if (!canExport) return null;
  return (
    <div>
      <button
        disabled={busy}
        onClick={() => void download()}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        <Download className="size-4" />
        {busy ? "Đang xuất…" : "Xuất CSV (Excel)"}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-sm text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
export function BulkRoomsDialog({
  propertyId,
  onClose,
  onCreated,
}: {
  propertyId?: number;
  onClose: () => void;
  onCreated?: (count: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const options = usePropertyOptions();
  const mutations = useRoomMutations();
  const [property, setProperty] = useState(propertyId ?? 0);
  const [building, setBuilding] = useState(0);
  const [floor, setFloor] = useState(0);
  const [prefix, setPrefix] = useState("P");
  const [start, setStart] = useState("101");
  const [count, setCount] = useState("5");
  const [rent, setRent] = useState("");
  const [area, setArea] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const preview = previewRoomCodes(prefix, Number(start), Number(count));
  const buildings =
    options.data?.buildings.filter((b) => b.parentId === property) ?? [];
  const floors =
    options.data?.floors.filter((f) => f.parentId === building) ?? [];
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (
      !preview.length ||
      !property ||
      !confirmed ||
      rent === "" ||
      !Number.isFinite(Number(rent)) ||
      Number(rent) < 0 ||
      (area !== "" && (!Number.isFinite(Number(area)) || Number(area) < 0)) ||
      !Number.isInteger(Number(capacity)) ||
      Number(capacity) < 1 ||
      Number(capacity) > 100
    ) {
      setError(
        "Kiểm tra số phòng, nhà trọ, giá thuê, sức chứa và xác nhận bản xem trước.",
      );
      return;
    }
    try {
      const created = await mutations.bulk.mutateAsync({
        propertyId: property,
        buildingId: building || undefined,
        floorId: floor || undefined,
        prefix,
        fromNumber: Number(start),
        toNumber: Number(start) + Number(count) - 1,
        padding: 3,
        monthlyRent: Number(rent),
        area: area === "" ? undefined : Number(area),
        capacity: Number(capacity),
      });
      if (onCreated) onCreated(created.length);
      else onClose();
    } catch (e) {
      setError(
        apiErrorMessage(
          e,
          "Không thể tạo nhiều phòng. Toàn bộ giao dịch được hoàn tác nếu có lỗi.",
        ),
      );
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        if (mutations.bulk.isPending) e.preventDefault();
        else onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border-0 bg-card p-5 shadow-xl backdrop:bg-slate-950/40"
      aria-labelledby="bulk-title"
    >
      <div className="flex items-center justify-between">
        <h2 id="bulk-title" className="text-lg font-bold">
          Thêm nhiều phòng
        </h2>
        <button
          disabled={mutations.bulk.isPending}
          onClick={onClose}
          aria-label="Đóng tạo nhiều phòng"
          className="rounded-lg p-2"
        >
          <X />
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Tối đa 200 phòng mỗi lần. Mã trùng hoặc dữ liệu sai sẽ hủy toàn bộ giao
        dịch. Phòng mới chưa có đồng hồ và tài sản.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset
          disabled={mutations.bulk.isPending}
          onChange={() => setConfirmed(false)}
          className="grid gap-3 sm:grid-cols-3"
        >
          <L label="Nhà trọ">
            <select
              required
              aria-label="Nhà trọ tạo nhiều phòng"
              className={field}
              value={property || ""}
              onChange={(e) => {
                setProperty(Number(e.target.value));
                setBuilding(0);
                setFloor(0);
              }}
            >
              <option value="">Chọn nhà trọ</option>
              {options.data?.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </L>
          <L label="Dãy / tòa (tùy chọn)">
            <select
              className={field}
              value={building}
              onChange={(e) => {
                setBuilding(Number(e.target.value));
                setFloor(0);
              }}
            >
              <option value={0}>Không có dãy</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </L>
          <L label="Tầng (tùy chọn)">
            <select
              className={field}
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
            >
              <option value={0}>Không có tầng</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </L>
          <L label="Tiền tố">
            <input
              required
              maxLength={20}
              pattern="[A-Za-z0-9_-]+"
              className={field}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            />
          </L>
          <L label="Số bắt đầu">
            <NumberInput
              required
              min={1}
              max={999999}
              className={field}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </L>
          <L label="Số lượng">
            <NumberInput
              required
              min={1}
              max={200}
              className={field}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </L>
          <L label="Giá thuê chung">
            <CurrencyInput
              required
              min={0}
              className={field}
              value={rent}
              onChange={(e) => setRent(e.target.value)}
            />
          </L>
          <L label="Diện tích (m²)">
            <NumberInput
              min={0}
              step="0.1"
              className={field}
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </L>
          <L label="Sức chứa">
            <NumberInput
              required
              min={1}
              max={100}
              className={field}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </L>
        </fieldset>
        <div className="rounded-xl bg-muted p-4">
          <h3 className="text-sm font-semibold">
            Xem trước {preview.length} mã phòng
          </h3>
          <p className="mt-2 max-h-24 overflow-y-auto break-words text-sm text-secondary-foreground">
            {preview.length
              ? preview.join(", ")
              : "Số bắt đầu, số lượng hoặc tiền tố không hợp lệ."}
          </p>
        </div>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={mutations.bulk.isPending}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Tôi đã kiểm tra danh sách mã và thông tin chung.
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-muted p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={mutations.bulk.isPending}
            onClick={onClose}
            className="rounded-lg border px-4 py-2"
          >
            Hủy
          </button>
          <button
            disabled={
              !confirmed ||
              !preview.length ||
              mutations.bulk.isPending ||
              options.isError
            }
            className="rounded-lg bg-primary hover:bg-primary-hover px-4 py-2 text-white disabled:opacity-50"
          >
            {mutations.bulk.isPending
              ? "Đang tạo…"
              : `Tạo ${preview.length} phòng`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function L({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
