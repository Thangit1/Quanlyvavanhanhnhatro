"use client";
import Link from "next/link";
import { PropertyImage } from "@/components/shared/image-upload";
import { useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import {
  usePropertyMutations,
  usePropertyOptions,
} from "@/hooks/use-admin-properties";
import {
  useManagementProperty,
  useManagementScope,
} from "@/providers/management-scope";
import { useAuth } from "@/providers/auth-provider";
import { adminPropertyService } from "@/services/admin-property.service";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import {
  ActionMenu,
  ConfirmDialog,
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
import type { PropertyRow } from "@/types/admin-property";

const field =
  "min-h-11 w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2 text-sm";
export function PropertyListPage() {
  const { user } = useAuth();
  const scope = useManagementScope();
  const [propertyId, setPropertyId] = useManagementProperty();
  const options = usePropertyOptions();
  const query = useScopedQuery({
    queryKey: ["admin-properties", "directory"],
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => {
      const first = await adminPropertyService.list(
        { page: 0, size: 100 },
        signal,
      );
      const rows = [...first.page.items];
      for (let page = 1; page < first.page.totalPages; page++) {
        const next = await adminPropertyService.list(
          { page, size: 100 },
          signal,
        );
        if (
          next.page.totalElements !== first.page.totalElements ||
          !next.page.items.length
        )
          throw Error("Danh sách nhà trọ vừa thay đổi. Vui lòng tải lại.");
        rows.push(...next.page.items);
      }
      if (new Set(rows.map((r) => r.id)).size !== first.page.totalElements)
        throw Error("Danh sách chưa đầy đủ. Vui lòng tải lại.");
      return { summary: first.summary, rows };
    },
  });
  const [keyword, setKeyword] = useState("");
  const [address, setAddress] = useState("");
  const [company, setCompany] = useState("");
  const [area, setArea] = useState("");
  const [manager, setManager] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState("cards");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PropertyRow>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mutation = usePropertyMutations(selected?.id);
  const contexts = options.data?.contexts ?? [];
  const context = (id: number) => contexts.find((c) => c.propertyId === id);
  const rows = query.isError ? [] : (query.data?.rows ?? []);
  const companies = Array.from(
    new Map(
      contexts
        .filter((c) => c.organizationId != null)
        .map((c) => [c.organizationId!, c.organizationName!]),
    ),
  );
  const areas = Array.from(
    new Map(
      contexts
        .filter(
          (c) =>
            c.areaId != null &&
            (!company || String(c.organizationId) === company),
        )
        .map((c) => [c.areaId!, c.areaName!]),
    ),
  );
  const managers = Array.from(
    new Map(
      contexts.flatMap((c) =>
        c.managers.map((m) => [m.id, m.fullName] as const),
      ),
    ),
  );
  const folded = (s: string) => s.toLocaleLowerCase("vi");
  const filtered = rows.filter((p) => {
    const c = context(p.id);
    return (
      (!propertyId || p.id === propertyId) &&
      (!status || p.status === status) &&
      (!keyword ||
        folded(`${p.propertyCode} ${p.name} ${p.address}`).includes(
          folded(keyword.trim()),
        )) &&
      (!address || folded(p.address).includes(folded(address.trim()))) &&
      (!company || String(c?.organizationId) === company) &&
      (!area || String(c?.areaId) === area) &&
      (!manager || c?.managers.some((m) => String(m.id) === manager))
    );
  });
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 12) - 1),
  );
  const visible = filtered.slice(currentPage * 12, currentPage * 12 + 12);
  function actions(p: PropertyRow) {
    return (
      <ActionMenu>
        <Link
          href={`/admin/properties/${p.id}`}
          className="block rounded-lg p-2 text-sm"
        >
          Xem chi tiết
        </Link>
        <Link
          href={`/admin/rooms?propertyId=${p.id}`}
          className="block rounded-lg p-2 text-sm"
        >
          Quản lý phòng
        </Link>
        {user?.activeRole !== "ACCOUNTANT" && (
          <Link
            href={`/admin/properties/${p.id}/edit`}
            className="block rounded-lg p-2 text-sm"
          >
            Chỉnh sửa thông tin
          </Link>
        )}
        {user?.activeRole === "OWNER" && (
          <>
            <Link
              href={`/admin/properties/${p.id}?tab=staff`}
              className="block rounded-lg p-2 text-sm"
            >
              Nhân viên phụ trách
            </Link>
            <button
              onClick={() => {
                setError("");
                setSelected(p);
              }}
              className="block w-full rounded-lg p-2 text-left text-sm text-danger"
            >
              {p.status === "ACTIVE" ? "Ngừng hoạt động" : "Hoạt động trở lại"}
            </button>
          </>
        )}
        {(context(p.id)?.canReadFinance ?? scope.canReadFinanceFor(p.id)) && (
          <Link
            href={`/admin/properties/${p.id}?tab=reports`}
            className="block rounded-lg p-2 text-sm"
          >
            Xem báo cáo
          </Link>
        )}
      </ActionMenu>
    );
  }
  async function changeStatus() {
    if (!selected) return;
    setError("");
    try {
      await mutation.status.mutateAsync({
        status: selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        version: selected.version,
      });
      setSelected(undefined);
      setNotice("Đã cập nhật trạng thái nhà trọ.");
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }
  return (
    <AdminShell title="Nhà trọ và cơ sở" readOnly>
      <div className="space-y-5">
        <PageHeader
          title="Quản lý nhà trọ"
          description="Tập trung phòng, nhân sự và tình trạng khai thác của từng cơ sở."
        >
          {user?.activeRole === "OWNER" && (
            <Link
              href="/admin/properties/new"
              className="rounded-lg bg-primary hover:bg-primary-hover px-4 py-2.5 text-sm font-medium text-white"
            >
              + Thêm nhà trọ
            </Link>
          )}
        </PageHeader>
        <div className="flex gap-2">
          <button
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
            className="rounded-lg border bg-card px-3 py-2 text-sm"
          >
            Dạng thẻ
          </button>
          <button
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
            className="rounded-lg border bg-card px-3 py-2 text-sm"
          >
            Dạng bảng
          </button>
          <Link
            href="/admin/rooms"
            className="ml-auto px-3 py-2 text-sm font-medium text-link"
          >
            Quản lý phòng →
          </Link>
        </div>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="Nhà trọ phù hợp" value={filtered.length} />
          <SummaryCard
            label="Tổng phòng"
            value={filtered.reduce((n, p) => n + p.totalRooms, 0)}
          />
          <SummaryCard
            label="Đang thuê"
            value={filtered.reduce((n, p) => n + p.occupiedRooms, 0)}
          />
          <SummaryCard
            label="Còn trống"
            value={filtered.reduce((n, p) => n + p.vacantRooms, 0)}
          />
        </section>
        <section
          aria-label="Bộ lọc nhà trọ"
          className="grid items-end gap-3 surface-card p-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SearchInput
            aria-label="Tìm nhà trọ"
            placeholder="Tên, mã hoặc địa chỉ nhà trọ…"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(0);
            }}
          />
          <Select
            label="Công ty"
            value={company}
            items={companies}
            onChange={(v) => {
              setCompany(v);
              setArea("");
              setPage(0);
            }}
          />
          <Select
            label="Khu quản lý"
            value={area}
            items={areas}
            onChange={(v) => {
              setArea(v);
              setPage(0);
            }}
          />
          <Select
            label="Người quản lý"
            value={manager}
            items={managers}
            onChange={(v) => {
              setManager(v);
              setPage(0);
            }}
          />
          <label className="text-xs text-muted-foreground">
            Tỉnh/thành trong địa chỉ
            <input
              aria-label="Tỉnh thành trong địa chỉ"
              className={`${field} mt-1`}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setPage(0);
              }}
              placeholder="Tìm theo địa chỉ đã khai báo"
            />
          </label>
          <Select
            label="Nhà trọ"
            value={String(propertyId ?? "")}
            items={scope.properties.map((p) => [p.id, p.name])}
            onChange={(v) => {
              setPropertyId(v ? Number(v) : undefined);
              setPage(0);
            }}
          />
          <Select
            label="Trạng thái hoạt động"
            value={status}
            items={[
              ["ACTIVE", "Đang hoạt động"],
              ["INACTIVE", "Ngừng hoạt động"],
            ]}
            onChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Địa chỉ chưa tách tỉnh/thành; tìm theo nội dung lưu thực tế.
          </p>
        </section>
        {notice && (
          <p
            role="status"
            className="rounded-lg bg-success-muted p-3 text-sm text-success"
          >
            {notice}
          </p>
        )}
        {query.isLoading && <LoadingSkeleton />}
        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
        {options.isError && (
          <ErrorState
            onRetry={() => void options.refetch()}
            message="Không tải được công ty, khu và quản lý. Các bộ lọc này chưa khả dụng."
          />
        )}
        {!query.isLoading &&
          !query.isError &&
          (!visible.length ? (
            <EmptyState text="Không có nhà trọ phù hợp." />
          ) : view === "cards" ? (
            <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {visible.map((p) => (
                <article
                  key={p.id}
                  className="min-w-0 surface-card p-5 sm:p-6"
                >
                  <PropertyImage
                    src={p.thumbnailUrl}
                    alt={`Ảnh nhà trọ ${p.name}`}
                    className="mb-4 h-40 w-full"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {p.propertyCode}
                      </p>
                      <Link
                        href={`/admin/properties/${p.id}`}
                        className="mt-1 block truncate text-xl font-bold text-foreground"
                      >
                        {p.name}
                      </Link>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{p.address}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {context(p.id)?.organizationName ??
                      "Chưa có công ty quản lý"}{" "}
                    / {context(p.id)?.areaName ?? "Chưa phân khu"}
                  </p>
                  <p className="mt-2 text-xs text-secondary-foreground">
                    Quản lý:{" "}
                    {context(p.id)
                      ?.managers.map((m) => m.fullName)
                      .join(", ") ||
                      p.manager?.fullName ||
                      "Chưa phân công"}
                  </p>
                  <dl className="my-4 grid grid-cols-4 gap-2 rounded-xl bg-muted p-3">
                    {[
                      ["Phòng", p.totalRooms],
                      ["Đang thuê", p.occupiedRooms],
                      ["Trống", p.vacantRooms],
                      ["Bảo trì", p.maintenanceRooms],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[11px] text-muted-foreground">{label}</dt>
                        <dd className="mt-1 font-bold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mb-4 flex justify-between text-xs">
                    <span className="text-muted-foreground">Tỷ lệ lấp đầy</span>
                    <strong>{p.occupancyRate}%</strong>
                  </div>
                  {(context(p.id)?.canReadFinance ??
                    scope.canReadFinanceFor(p.id)) && (
                    <p className="mb-4 text-xs text-muted-foreground">
                      Thực thu tháng:{" "}
                      <strong className="text-foreground">
                        {formatCurrency(p.currentRevenue)}
                      </strong>{" "}
                      · Công nợ: {formatCurrency(p.outstandingDebt)}
                    </p>
                  )}
                  <div className="flex items-center justify-between border-t pt-3">
                    <Link
                      href={`/admin/rooms?propertyId=${p.id}`}
                      className="text-sm font-semibold text-link"
                    >
                      Quản lý phòng →
                    </Link>
                    {actions(p)}
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <div className="rounded-xl border bg-card p-3">
              <DataTable
                caption="Nhà trọ được phân quyền"
                rows={visible}
                rowKey={(p) => p.id}
                columns={[
                  {
                    label: "Nhà trọ / địa chỉ",
                    render: (p) => (
                      <Link
                        href={`/admin/properties/${p.id}`}
                        className="font-semibold text-link"
                      >
                        <PropertyImage
                          src={p.thumbnailUrl}
                          alt={`Ảnh nhà trọ ${p.name}`}
                          className="mb-2 h-20 w-28"
                          canView={false}
                        />
                        {p.name}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {p.address}
                        </span>
                      </Link>
                    ),
                  },
                  {
                    label: "Công ty / khu",
                    render: (p) => (
                      <>
                        {context(p.id)?.organizationName ?? "—"}
                        <span className="block text-xs">
                          {context(p.id)?.areaName ?? "—"}
                        </span>
                      </>
                    ),
                  },
                  {
                    label: "Phòng / trống",
                    render: (p) => `${p.totalRooms} / ${p.vacantRooms}`,
                  },
                  { label: "Lấp đầy", render: (p) => `${p.occupancyRate}%` },
                  {
                    label: "Trạng thái",
                    render: (p) => <StatusBadge status={p.status} />,
                  },
                  { label: "Thao tác", render: actions },
                ]}
              />
            </div>
          ))}
        <Pagination
          page={currentPage}
          totalPages={Math.ceil(filtered.length / 12)}
          onChange={setPage}
        />
        {selected && (
          <>
            <ConfirmDialog
              open
              title={
                selected.status === "ACTIVE"
                  ? "Ngừng hoạt động nhà trọ?"
                  : "Mở lại nhà trọ?"
              }
              description={`Cơ sở ${selected.name}. Hệ thống sẽ kiểm tra hợp đồng, booking và điều kiện vận hành trước khi cập nhật. Không xóa phòng hay lịch sử tài chính.`}
              busy={mutation.status.isPending}
              onClose={() => setSelected(undefined)}
              onConfirm={() => void changeStatus()}
              danger={selected.status === "ACTIVE"}
            />
            {error && (
              <p
                role="alert"
                className="fixed bottom-5 left-4 right-4 z-[60] rounded-xl border border-danger-border bg-danger-muted p-4 text-sm text-danger lg:left-72"
              >
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
function Select({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: (readonly [string | number, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 text-xs text-muted-foreground">
      {label}
      <select
        aria-label={label}
        className={`${field} mt-1`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Tất cả</option>
        {items.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
