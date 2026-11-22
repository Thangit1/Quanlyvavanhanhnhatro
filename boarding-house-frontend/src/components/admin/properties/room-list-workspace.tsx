/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { PropertyImage } from "@/components/shared/image-upload";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  DataTable,
  LoadingSkeleton,
  PageHeader,
  Pagination,
  SearchInput,
  SummaryCard,
} from "@/components/shared/management-ui";
import {
  EmptyState,
  ErrorState,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import { CurrencyInput } from "@/components/ui/number-input";
import {
  useAdminRooms,
  usePropertyOptions,
} from "@/hooks/use-admin-properties";
import {
  useManagementProperty,
  useManagementScope,
} from "@/providers/management-scope";
import { useAuth } from "@/providers/auth-provider";
import { formatCurrency, statusLabel } from "@/lib/format";
import { roomStatuses } from "@/lib/room-presentation";
import {
  BulkRoomsDialog,
  ExportRoomsButton,
  GroupedRoomCards,
  RoomActions,
} from "./room-workspace-ui";
import type { RoomFilters } from "@/types/admin-property";

const input =
  "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground";
export function RoomListPage({
  embedded = false,
  fixedPropertyId,
  initialView = "cards",
}: {
  embedded?: boolean;
  fixedPropertyId?: number;
  initialView?: "cards" | "table";
} = {}) {
  const search = useSearchParams();
  const { user } = useAuth();
  const scope = useManagementScope();
  const [sharedProperty, setPropertyId] = useManagementProperty(
    fixedPropertyId ?? (Number(search.get("propertyId")) || undefined),
  );
  const propertyId = fixedPropertyId ?? sharedProperty;
  const [buildingId, setBuildingId] = useState<number>();
  const [floorId, setFloorId] = useState<number>();
  const [status, setStatus] = useState(search.get("status") ?? "");
  const [typed, setTyped] = useState("");
  const [keyword, setKeyword] = useState("");
  const [minimumRent, setMinimumRent] = useState("");
  const [maximumRent, setMaximumRent] = useState("");
  const [page, setPage] = useState(0);
  const [view, setView] = useState(initialView);
  const [bulk, setBulk] = useState(false);
  const [notice, setNotice] = useState("");
  const write = user?.activeRole === "OWNER" || user?.activeRole === "MANAGER";
  useEffect(() => {
    setBuildingId(undefined);
    setFloorId(undefined);
    setPage(0);
  }, [propertyId]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(typed.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const invalidPrice =
    minimumRent !== "" &&
    maximumRent !== "" &&
    Number(minimumRent) > Number(maximumRent);
  const filters: RoomFilters = {
    propertyId,
    buildingId,
    floorId,
    status: status || undefined,
    keyword: keyword || undefined,
    minimumRent: minimumRent === "" ? undefined : Number(minimumRent),
    maximumRent: maximumRent === "" ? undefined : Number(maximumRent),
    page,
    size: 20,
  };
  const query = useAdminRooms(filters, !invalidPrice);
  const options = usePropertyOptions();
  const buildings =
    options.data?.buildings.filter(
      (b) => !propertyId || b.parentId === propertyId,
    ) ?? [];
  const floors =
    options.data?.floors.filter((f) =>
      buildingId
        ? f.parentId === buildingId
        : buildings.some((b) => b.id === f.parentId),
    ) ?? [];
  const data = query.isError || invalidPrice ? undefined : query.data;
  const summary = data?.summary;
  const content = (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title="Quản lý phòng"
          description="Nhóm theo nhà trọ, dãy và tầng. Trạng thái phòng độc lập với hóa đơn và hợp đồng."
        >
          <Link
            href="/admin/properties"
            className="text-sm font-medium text-link"
          >
            Danh sách nhà trọ →
          </Link>
        </PageHeader>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-2" aria-label="Kiểu hiển thị phòng">
          <button
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
            className={`rounded-lg border px-3 py-2 text-sm ${view === "cards" ? "bg-primary hover:bg-primary-hover text-white" : "bg-card"}`}
          >
            Sơ đồ thẻ
          </button>
          <button
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
            className={`rounded-lg border px-3 py-2 text-sm ${view === "table" ? "bg-primary hover:bg-primary-hover text-white" : "bg-card"}`}
          >
            Bảng dữ liệu
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportRoomsButton filters={filters} />
          {write && (
            <>
              <button
                onClick={() => setBulk(true)}
                className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
              >
                Thêm nhiều phòng
              </button>
              <Link
                href={`/admin/rooms/new${propertyId ? `?propertyId=${propertyId}` : ""}`}
                className="rounded-lg bg-primary hover:bg-primary-hover px-3 py-2 text-sm font-medium text-white"
              >
                + Thêm phòng
              </Link>
            </>
          )}
        </div>
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-success-muted p-3 text-sm text-success"
        >
          {notice}
        </p>
      )}
      {summary && (
        <section
          aria-label="Thống kê phòng trong phạm vi nhà trọ"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7"
        >
          {[
            ["Tổng phòng", summary.totalRooms],
            ["Đang thuê", summary.occupiedRooms],
            ["Còn trống", summary.vacantRooms],
            ["Giữ chỗ", summary.reservedRooms],
            ["Bảo trì", summary.maintenanceRooms],
            ["Ngừng dùng", summary.inactiveRooms],
            [
              "Lấp đầy",
              `${summary.totalRooms ? ((summary.occupiedRooms / summary.totalRooms) * 100).toFixed(1) : 0}%`,
            ],
          ].map(([label, value]) => (
            <SummaryCard key={label} label={String(label)} value={value} />
          ))}
        </section>
      )}
      <section aria-label="Bộ lọc phòng" className="surface-card p-4">
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SearchInput
            aria-label="Tìm phòng"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Tìm mã hoặc tên phòng…"
          />
          <L label="Nhà trọ">
            <select
              disabled={fixedPropertyId != null}
              aria-label="Nhà trọ lọc phòng"
              className={input}
              value={propertyId ?? ""}
              onChange={(e) =>
                setPropertyId(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
            >
              <option value="">Tất cả nhà trọ</option>
              {options.data?.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </L>
          <L label="Dãy / tòa">
            <select
              aria-label="Dãy lọc phòng"
              className={input}
              value={buildingId ?? ""}
              onChange={(e) => {
                setBuildingId(
                  e.target.value ? Number(e.target.value) : undefined,
                );
                setFloorId(undefined);
                setPage(0);
              }}
            >
              <option value="">Tất cả dãy</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </L>
          <L label="Tầng">
            <select
              aria-label="Tầng lọc phòng"
              className={input}
              value={floorId ?? ""}
              onChange={(e) => {
                setFloorId(e.target.value ? Number(e.target.value) : undefined);
                setPage(0);
              }}
            >
              <option value="">Tất cả tầng</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </L>
          <L label="Trạng thái">
            <select
              aria-label="Trạng thái lọc phòng"
              className={input}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {roomStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </L>
          <L label="Giá thuê từ">
            <CurrencyInput
              aria-label="Giá thuê từ"
              min={0}
              className={input}
              value={minimumRent}
              onChange={(e) => {
                setMinimumRent(e.target.value);
                setPage(0);
              }}
            />
          </L>
          <L label="Giá thuê đến">
            <CurrencyInput
              aria-label="Giá thuê đến"
              min={0}
              className={input}
              value={maximumRent}
              onChange={(e) => {
                setMaximumRent(e.target.value);
                setPage(0);
              }}
            />
          </L>
          <button
            onClick={() => {
              setTyped("");
              setStatus("");
              setBuildingId(undefined);
              setFloorId(undefined);
              setMinimumRent("");
              setMaximumRent("");
              setPage(0);
            }}
            className="min-h-11 rounded-lg border px-3 py-2 text-sm text-secondary-foreground"
          >
            Xóa bộ lọc phụ
          </button>
        </div>
        {invalidPrice && (
          <p role="alert" className="mt-3 text-sm text-danger">
            Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Thống kê theo nhà trọ; số kết quả bên dưới áp dụng đầy đủ bộ lọc.
        </p>
      </section>
      {floors.length > 0 && (
        <nav
          aria-label="Lọc nhanh theo tầng"
          className="flex max-w-full gap-2 overflow-x-auto pb-1"
        >
          <button
            aria-pressed={!floorId}
            onClick={() => {
              setFloorId(undefined);
              setPage(0);
            }}
            className="shrink-0 rounded-lg border bg-card px-3 py-2 text-sm"
          >
            Tất cả tầng
          </button>
          {floors.map((f) => (
            <button
              key={f.id}
              aria-pressed={floorId === f.id}
              onClick={() => {
                setFloorId(f.id);
                setPage(0);
              }}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${floorId === f.id ? "bg-primary hover:bg-primary-hover text-white" : "bg-card"}`}
            >
              {f.label}
            </button>
          ))}
        </nav>
      )}
      {options.isError && (
        <ErrorState
          onRetry={() => void options.refetch()}
          message="Không tải được lựa chọn nhà trọ, dãy và tầng."
        />
      )}
      {query.isLoading && <LoadingSkeleton />}
      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.page.totalElements} phòng phù hợp
          </p>
          {!data.page.items.length ? (
            <EmptyState text="Không có phòng phù hợp với bộ lọc." />
          ) : view === "cards" ? (
            <GroupedRoomCards rooms={data.page.items} />
          ) : (
            <div className="surface-card p-3">
              <DataTable
                caption="Danh sách phòng"
                rows={data.page.items}
                rowKey={(r) => r.id}
                columns={[
                  {
                    label: "Ảnh",
                    render: (r) => (
                      <PropertyImage
                        src={r.thumbnailUrl}
                        alt={`Ảnh phòng ${r.roomCode}`}
                        className="h-16 w-24"
                      />
                    ),
                  },
                  {
                    label: "Phòng / vị trí",
                    render: (r) => (
                      <Link
                        href={`/admin/rooms/${r.id}`}
                        className="font-semibold text-link"
                      >
                        {r.roomCode}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {[r.propertyName, r.buildingName, r.floorName]
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      </Link>
                    ),
                  },
                  {
                    label: "Giá / diện tích",
                    render: (r) => (
                      <>
                        <strong>{formatCurrency(r.monthlyRent)}</strong>
                        <span className="block text-xs text-muted-foreground">
                          {r.area ?? "—"} m² · {r.currentOccupants}/
                          {r.maxOccupants} người
                        </span>
                      </>
                    ),
                  },
                  {
                    label: "Người thuê / hợp đồng",
                    render: (r) => (
                      <>
                        {r.representativeTenant?.fullName ?? "Chưa có"}
                        {r.currentContract && (
                          <Link
                            href={`/admin/contracts/${r.currentContract.id}`}
                            className="block text-xs text-link"
                          >
                            {r.currentContract.code}
                          </Link>
                        )}
                      </>
                    ),
                  },
                  {
                    label: "Trạng thái",
                    render: (r) => <StatusBadge status={r.status} />,
                  },
                  {
                    label: "Còn phải thu",
                    render: (r) =>
                      scope.canReadFinanceFor(r.propertyId)
                        ? formatCurrency(r.outstandingDebt)
                        : "Không có quyền",
                  },
                  {
                    label: "Thao tác",
                    render: (r) => <RoomActions room={r} />,
                  },
                ]}
              />
            </div>
          )}
          <Pagination
            page={page}
            totalPages={data.page.totalPages}
            onChange={setPage}
          />
        </>
      )}
      {bulk && (
        <BulkRoomsDialog
          propertyId={propertyId}
          onClose={() => setBulk(false)}
          onCreated={(count) => {
            setBulk(false);
            setNotice(`Đã tạo thành công ${count} phòng.`);
          }}
        />
      )}
    </div>
  );
  return embedded ? (
    content
  ) : (
    <AdminShell title="Danh sách phòng" readOnly>
      {content}
    </AdminShell>
  );
}
function L({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
