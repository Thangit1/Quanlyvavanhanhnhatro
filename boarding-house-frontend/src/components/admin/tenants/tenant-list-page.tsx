"use client";

import Link from "next/link";
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

export function TenantListPage() {
  const { user } = useAuth();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [propertyId, setPropertyId] = useState<number>();
  const [roomId, setRoomId] = useState<number>();
  const [status, setStatus] = useState("");
  const [debtStatus, setDebtStatus] = useState("");
  const [contractStatus, setContractStatus] = useState("");
  const [page, setPage] = useState(0);
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
          <p className="max-w-2xl text-sm text-slate-500">
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
              <Link href="/admin/tenants/new" className={primaryButton}>
                <Plus className="size-4" /> Thêm khách hàng
              </Link>
            )}
          </div>
        </section>

        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
        {data && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                label="Khách có công nợ"
                value={data.summary.customersWithDebt}
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

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <label className="relative xl:col-span-2">
                  <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                  <input
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    className={`${inputClass} w-full pl-9`}
                    placeholder="Tên, SĐT, email, CCCD, mã khách, HĐ, phòng..."
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
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  Sắp xếp
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1.5"
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
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold"
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
                <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1280px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                            className="border-t border-slate-100 hover:bg-blue-50/30"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                                  {row.fullName.trim().charAt(0).toUpperCase()}
                                </span>
                                <div>
                                  <Link
                                    href={`/admin/tenants/${row.id}`}
                                    className="font-bold text-slate-900 hover:text-blue-700"
                                  >
                                    {row.fullName}
                                  </Link>
                                  <p className="text-xs text-slate-500">
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
                            <td>{row.contractCode ?? "—"}</td>
                            <td>{formatDate(row.moveInDate)}</td>
                            <td>{formatDate(row.contractEndDate)}</td>
                            <td>
                              <p
                                className={
                                  row.outstandingDebt > 0
                                    ? "font-bold text-red-600"
                                    : "text-slate-500"
                                }
                              >
                                {formatCurrency(row.outstandingDebt)}
                              </p>
                              {row.financialStatus === "OVERDUE" && (
                                <span className="text-xs font-semibold text-red-600">
                                  Quá hạn
                                </span>
                              )}
                            </td>
                            <td>
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="pr-4 text-right">
                              <Link
                                href={`/admin/tenants/${row.id}`}
                                className="font-semibold text-blue-700"
                              >
                                Xem
                              </Link>
                              {canWrite && (
                                <Link
                                  href={`/admin/tenants/${row.id}/edit`}
                                  className="ml-3 font-semibold text-slate-600"
                                >
                                  Sửa
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="grid gap-3 lg:hidden">
                  {data.page.items.map((row) => (
                    <Link
                      href={`/admin/tenants/${row.id}`}
                      key={row.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{row.fullName}</p>
                          <p className="text-xs text-slate-500">
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
                      <div className="mt-3 flex justify-between text-xs text-slate-500">
                        <span>{row.contractCode ?? "Chưa có hợp đồng"}</span>
                        <span
                          className={
                            row.outstandingDebt > 0
                              ? "font-semibold text-red-600"
                              : ""
                          }
                        >
                          Nợ {formatCurrency(row.outstandingDebt)}
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
  value: number;
  icon: typeof Users;
  tone: "blue" | "emerald" | "amber" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{value}</p>
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
    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
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
  "min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500";
const outlineButton =
  "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300";
const primaryButton =
  "inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700";
const pageButton =
  "rounded-lg border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40";
