"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Download,
  Plus,
  RotateCcw,
  Search,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { useManagementProperty } from "@/providers/management-scope";
import {
  EmptyState,
  ErrorState,
  PageLoading,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import { useAdminTenants } from "@/hooks/use-admin-tenants";
import { adminTenantService } from "@/services/admin-tenant.service";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { SummaryCard } from "@/components/shared/management-ui";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { adminPropertyService } from "@/services/admin-property.service";
import { useManagementScope } from "@/providers/management-scope";
import { CreateAccountWizard } from "@/components/admin/accounts/create-account-wizard";
import type { TenantRow } from "@/types/admin-tenant";

export function TenantListPage() {
  const params = useSearchParams();
  const { user } = useAuth();
  const scope = useManagementScope();
  const directory = useScopedQuery({
    queryKey: ["tenant-property-context"],
    queryFn: ({ signal }) => adminPropertyService.options(signal),
  });
  const [organizationId, setOrganization] = useState<number>();
  const [areaId, setArea] = useState<number>();
  const contexts = directory.data?.contexts ?? [];
  const organizations = [
    ...new Map(
      contexts
        .filter((c) => c.organizationId != null)
        .map((c) => [c.organizationId!, c.organizationName]),
    ).entries(),
  ];
  const areas = [
    ...new Map(
      contexts
        .filter(
          (c) =>
            c.areaId != null &&
            (!organizationId || c.organizationId === organizationId),
        )
        .map((c) => [c.areaId!, c.areaName]),
    ).entries(),
  ];
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [propertyId, setPropertyId] = useManagementProperty(
    Number(params.get("propertyId")) || undefined,
  );
  const [roomId, setRoomId] = useState<number | undefined>(
    Number(params.get("roomId")) || undefined,
  );
  const [status, setStatus] = useState("");
  const [debtStatus, setDebtStatus] = useState("");
  const [contractStatus, setContractStatus] = useState("");
  const [page, setPage] = useState(0);
  const [moveInFrom, setFrom] = useState("");
  const [moveInTo, setTo] = useState("");
  const [accountStatus, setAccount] = useState("");
  const [view, setView] = useState("table");
  const [accountProfile, setAccountProfile] = useState<TenantRow>();
  const [previousProperty, setPreviousProperty] = useState(propertyId);
  if (previousProperty !== propertyId) {
    setPreviousProperty(propertyId);
    setPage(0);
    setRoomId(
      propertyId === Number(params.get("propertyId"))
        ? Number(params.get("roomId")) || undefined
        : undefined,
    );
  }
  const [sort, setSort] = useState("fullName");
  const [direction, setDirection] = useState("asc");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const filters = useMemo(
    () => ({
      propertyId,
      roomId,
      moveInFrom: moveInFrom || undefined,
      moveInTo: moveInTo || undefined,
      accountStatus: accountStatus || undefined,
      organizationId,
      areaId,
      status: status || undefined,
      debtStatus: debtStatus || undefined,
      contractStatus: contractStatus || undefined,
      keyword: keyword || undefined,
      sort,
      direction,
      page,
      size: 20,
    }),
    [
      contractStatus,
      moveInFrom,
      moveInTo,
      accountStatus,
      organizationId,
      areaId,
      debtStatus,
      direction,
      keyword,
      page,
      propertyId,
      roomId,
      sort,
      status,
    ],
  );
  const query = useAdminTenants(filters);
  if (query.isLoading) return <PageLoading />;
  const data = query.data;
  const canWrite = ["OWNER", "MANAGER"].includes(user?.activeRole ?? "");

  const resetFilters = () => {
    setKeywordInput("");
    setKeyword("");
    setPropertyId(undefined);
    setRoomId(undefined);
    setStatus("");
    setDebtStatus("");
    setContractStatus("");
    setFrom("");
    setTo("");
    setAccount("");
    setOrganization(undefined);
    setArea(undefined);
    setPage(0);
  };

  return (
    <AdminShell
      title="Khách hàng / Người thuê"
      subtitle="Hồ sơ cư trú và toàn bộ vòng đời thuê"
      readOnly
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Theo dõi khách thuê từ lúc chờ nhận phòng đến khi hoàn tất trả
            phòng, cùng hợp đồng và công nợ thực tế.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                void adminTenantService.exportCsv({ propertyId, keyword })
              }
              className={outlineButton}
            >
              <Download className="size-4" /> Xuất CSV
            </button>
            {canWrite && (
              <>
                <Link href="/admin/tenants/intake" className={outlineButton}>
                  Tiếp nhận khách
                </Link>
                <Link href="/admin/tenants/new" className={primaryButton}>
                  <Plus className="size-4" /> Tạo hồ sơ
                </Link>
              </>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-end gap-3 surface-card p-4">
          <label className="text-xs text-muted-foreground">
            Công ty
            <select
              className={inputClass}
              value={organizationId ?? ""}
              onChange={(e) => {
                setOrganization(Number(e.target.value) || undefined);
                setArea(undefined);
                setPropertyId(undefined);
                setPage(0);
              }}
            >
              <option value="">Tất cả được phân quyền</option>
              {organizations.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Khu
            <select
              className={inputClass}
              value={areaId ?? ""}
              onChange={(e) => {
                setArea(Number(e.target.value) || undefined);
                setPropertyId(undefined);
                setPage(0);
              }}
            >
              <option value="">Tất cả khu</option>
              {areas.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Tài khoản
            <select
              className={inputClass}
              value={accountStatus}
              onChange={(e) => {
                setAccount(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả</option>
              <option value="NO_ACCOUNT">Chưa có</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="LOCKED">Đã khóa</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Vào ở từ
            <input
              type="date"
              className={inputClass}
              value={moveInFrom}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Đến ngày
            <input
              type="date"
              min={moveInFrom}
              className={inputClass}
              value={moveInTo}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <button
            className={outlineButton}
            onClick={() => setView(view === "table" ? "cards" : "table")}
          >
            {view === "table" ? "Dạng thẻ" : "Dạng bảng"}
          </button>
        </div>
        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <SummaryCard label="Tổng hồ sơ" value={data.summary.total} />
              <SummaryCard label="Đã trả phòng" value={data.summary.movedOut} />
              <Metric
                label="Tổng khách đang thuê"
                value={data.summary.active}
                icon={UserCheck}
                tone="emerald"
              />
              <Metric
                label="Sắp hết hạn hợp đồng"
                value={data.summary.expiringContracts}
                icon={CalendarClock}
                tone="amber"
              />
              <Metric
                label="Khách có hóa đơn quá hạn"
                value={scope.canReadFinance ? data.summary.overdueDebt : "—"}
                icon={WalletCards}
                tone="red"
              />
              <Metric
                label="Chờ nhận phòng"
                value={data.summary.pendingCheckin}
                icon={Users}
                tone="blue"
              />
            </section>

            <section className="surface-card p-4 ">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <label className="relative xl:col-span-2">
                  <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <input
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    className={`${inputClass} w-full pl-9`}
                    placeholder="Tên, SĐT, email, mã khách, hợp đồng, phòng..."
                  />
                </label>
                <Select
                  value={propertyId ?? ""}
                  placeholder="Tất cả tòa nhà"
                  options={data.properties.map((item) => [item.id, item.name])}
                  onChange={(value) => {
                    setPropertyId(value ? Number(value) : undefined);
                    setRoomId(undefined);
                    setPage(0);
                  }}
                />
                <Select
                  value={roomId ?? ""}
                  placeholder="Tất cả phòng"
                  options={data.rooms
                    .filter(
                      (room) => !propertyId || room.propertyId === propertyId,
                    )
                    .map((room) => [room.id, `Phòng ${room.code}`])}
                  onChange={(value) => {
                    setRoomId(value ? Number(value) : undefined);
                    setPage(0);
                  }}
                />
                <Select
                  value={status}
                  placeholder="Tất cả trạng thái"
                  options={[
                    ["ACTIVE", "Đang thuê"],
                    ["PENDING", "Chờ nhận phòng"],
                    ["NOTICE", "Sắp trả phòng"],
                    ["CHECKED_OUT", "Đã trả phòng"],
                    ["EXPIRED", "Hết hạn"],
                    ["INACTIVE", "Không hoạt động"],
                  ]}
                  onChange={(value) => {
                    setStatus(String(value));
                    setPage(0);
                  }}
                />
                <Select
                  value={debtStatus}
                  placeholder="Tất cả công nợ"
                  options={[
                    ["NO_DEBT", "Không nợ"],
                    ["WITH_DEBT", "Còn công nợ"],
                    ["OVERDUE", "Quá hạn"],
                  ]}
                  onChange={(value) => {
                    setDebtStatus(String(value));
                    setPage(0);
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={contractStatus}
                    placeholder="Tất cả hợp đồng"
                    options={[
                      ["ACTIVE", "Còn hiệu lực"],
                      ["EXPIRING", "Sắp hết hạn"],
                      ["EXPIRED", "Đã hết hạn"],
                    ]}
                    onChange={(value) => {
                      setContractStatus(String(value));
                      setPage(0);
                    }}
                  />
                  <button onClick={resetFilters} className={outlineButton}>
                    <RotateCcw className="size-4" /> Đặt lại bộ lọc
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Sắp xếp
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className="rounded-lg border border-input px-2 py-1.5"
                  >
                    <option value="fullName">Họ tên</option>
                    <option value="contractEndDate">Hạn hợp đồng</option>
                    <option value="outstandingDebt">Công nợ</option>
                  </select>
                  <button
                    onClick={() =>
                      setDirection((value) =>
                        value === "asc" ? "desc" : "asc",
                      )
                    }
                    className="rounded-lg border border-border px-3 py-1.5 font-semibold"
                  >
                    {direction === "asc" ? "Tăng" : "Giảm"}
                  </button>
                </div>
              </div>
            </section>

            {!data.page.items.length ? (
              <EmptyState text="Chưa có khách hàng phù hợp. Thêm khách hàng đầu tiên để bắt đầu quản lý cư dân." />
            ) : (
              <>
                <section
                  className={
                    view === "table"
                      ? "hidden overflow-hidden surface-card lg:block"
                      : "hidden"
                  }
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1280px] text-left text-sm">
                      <thead className="bg-muted text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Khách hàng</th>
                          <th>Liên hệ</th>
                          <th>Tòa nhà</th>
                          <th>Phòng</th>
                          <th>Hợp đồng</th>
                          <th>Ngày vào ở</th>
                          <th>Hết hạn</th>
                          <th>Công nợ</th>
                          <th>Trạng thái</th>
                          <th className="pr-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.page.items.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-border hover:bg-accent/30"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-bold text-link">
                                  {row.fullName.trim().charAt(0).toUpperCase()}
                                </span>
                                <div>
                                  <Link
                                    href={`/admin/tenants/${row.id}`}
                                    className="font-bold text-foreground hover:text-link"
                                  >
                                    {row.fullName}
                                  </Link>
                                  <p className="text-xs text-muted-foreground">
                                    {row.tenantCode}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td>{row.phone}</td>
                            <td className="font-medium">{row.propertyName}</td>
                            <td>
                              {row.roomCode ? `Phòng ${row.roomCode}` : "—"}
                            </td>
                            <td>
                              {row.contractId ? (
                                <Link
                                  className="text-link"
                                  href={`/admin/contracts/${row.contractId}`}
                                >
                                  {row.contractCode}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>{formatDate(row.moveInDate)}</td>
                            <td>{formatDate(row.contractEndDate)}</td>
                            <td>
                              <p
                                className={
                                  row.outstandingDebt > 0
                                    ? "font-bold text-danger"
                                    : "text-muted-foreground"
                                }
                              >
                                {row.propertyId &&
                                scope.canReadFinanceFor(row.propertyId)
                                  ? formatCurrency(row.outstandingDebt)
                                  : "Không có quyền xem"}
                              </p>
                              {row.financialStatus === "OVERDUE" && (
                                <span className="text-xs font-semibold text-danger">
                                  Quá hạn
                                </span>
                              )}
                            </td>
                            <td>
                              <StatusBadge status={row.status} />
                              <p className="mt-1 text-xs text-muted-foreground">
                                {row.hasAccount
                                  ? `Tài khoản: ${row.accountStatus}`
                                  : "Chưa có tài khoản"}
                              </p>
                            </td>
                            <td className="pr-4 text-right">
                              <Link
                                href={`/admin/tenants/${row.id}`}
                                className="font-semibold text-link"
                              >
                                Xem
                              </Link>
                              {canWrite && (
                                <Link
                                  href={`/admin/tenants/${row.id}/edit`}
                                  className="ml-3 font-semibold text-secondary-foreground"
                                >
                                  Sửa
                                </Link>
                              )}
                              {canWrite && !row.hasAccount && (
                                <button
                                  className="mt-2 block text-xs font-semibold text-link"
                                  onClick={() => setAccountProfile(row)}
                                >
                                  Cấp tài khoản
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section
                  className={
                    view === "cards"
                      ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                      : "grid gap-3 lg:hidden"
                  }
                >
                  {data.page.items.map((row) => (
                    <Link
                      href={`/admin/tenants/${row.id}`}
                      key={row.id}
                      className="rounded-2xl border border-border bg-card p-4 shadow-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{row.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.tenantCode} · {row.phone}
                          </p>
                        </div>
                        <StatusBadge status={row.status} />
                      </div>
                      <p className="mt-3 text-sm font-semibold">
                        {row.propertyName} ·{" "}
                        {row.roomCode
                          ? `Phòng ${row.roomCode}`
                          : "Chưa gán phòng"}
                      </p>
                      <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                        <span>{row.contractCode ?? "Chưa có hợp đồng"}</span>
                        <span
                          className={
                            row.outstandingDebt > 0
                              ? "font-semibold text-danger"
                              : ""
                          }
                        >
                          {row.propertyId &&
                          scope.canReadFinanceFor(row.propertyId)
                            ? `Nợ ${formatCurrency(row.outstandingDebt)}`
                            : "Không có quyền xem tài chính"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </section>
                <Pagination
                  page={data.page.page}
                  totalPages={data.page.totalPages}
                  total={data.page.totalElements}
                  onChange={setPage}
                />
              </>
            )}
          </>
        )}
      </div>
      {accountProfile && (
        <CreateAccountWizard
          profile={{
            profile_id: accountProfile.id,
            full_name: accountProfile.fullName,
            phone: accountProfile.phone,
            email: accountProfile.email,
          }}
          onClose={() => setAccountProfile(undefined)}
          onCreated={async () => {
            await query.refetch();
          }}
        />
      )}
    </AdminShell>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  tone: "blue" | "emerald" | "amber" | "red";
}) {
  const colors = {
    blue: "bg-accent text-link",
    emerald: "bg-success-muted text-success",
    amber: "bg-warning-muted text-warning",
    red: "bg-danger-muted text-danger",
  };
  return (
    <article className="surface-card p-5 sm:p-6 ">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-foreground">{value}</p>
        </div>
        <span
          className={`grid size-10 place-items-center rounded-xl ${colors[tone]}`}
        >
          <Icon className="size-5" />
        </span>
      </div>
    </article>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | number;
  onChange: (value: string | number) => void;
  options: (string | number)[][];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    >
      <option value="">{placeholder}</option>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm text-secondary-foreground">
      <span>
        {total} kết quả · Trang {Math.min(page + 1, Math.max(totalPages, 1))}/
        {Math.max(totalPages, 1)}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
          className={pageButton}
        >
          Trước
        </button>
        <button
          disabled={page + 1 >= totalPages}
          onClick={() => onChange(page + 1)}
          className={pageButton}
        >
          Sau
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "min-w-40 rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring";
const outlineButton =
  "inline-flex items-center gap-2 rounded-xl border border-input bg-card px-4 py-2.5 text-sm font-semibold text-secondary-foreground hover:border-blue-300";
const primaryButton =
  "inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary-hover";
const pageButton =
  "rounded-lg border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40";
