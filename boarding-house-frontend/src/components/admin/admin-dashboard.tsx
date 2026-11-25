"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Building2,
  CircleDollarSign,
  DoorOpen,
  RefreshCw,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { AdminShell } from "./admin-shell";
import { useAuth } from "@/providers/auth-provider";
import {
  reportingRange,
  useManagementScope,
} from "@/providers/management-scope";
import { useAdminDashboard } from "@/hooks/use-dashboard";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { adminReportService } from "@/services/admin-report.service";
import { adminInvoiceService } from "@/services/admin-invoice.service";
import { rentalLifecycleService } from "@/services/rental-lifecycle.service";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import {
  EmptyState,
  ErrorState,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import {
  DataTable,
  LoadingSkeleton,
  PageHeader,
  PageToolbar,
  Pagination,
  SearchInput,
  SummaryCard,
} from "@/components/shared/management-ui";

const colors: Record<string, string> = {
  OCCUPIED: "#2563eb",
  NOTICE: "#f59e0b",
  VACANT: "#10b981",
  READY: "#059669",
  RESERVED: "#f59e0b",
  MAINTENANCE: "#ef4444",
  CLEANING: "#06b6d4",
  INACTIVE: "#94a3b8",
};
function Panel({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="min-w-0 scroll-mt-44 surface-card p-4 sm:p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function More({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-semibold text-link"
    >
      Xem tất cả
      <ArrowUpRight className="size-3.5" />
    </Link>
  );
}
function Unavailable({ text }: { text: string }) {
  return (
    <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{text}</p>
  );
}

export function AdminDashboard() {
  const { user, isBootstrapping } = useAuth();
  const scope = useManagementScope();
  const { propertyId, period, setPeriod, canReadFinance } = scope;
  const allowed =
    !isBootstrapping &&
    !!user &&
    ["OWNER", "MANAGER"].includes(user.activeRole);
  const query = useAdminDashboard(
    allowed && !scope.loading && !scope.error,
    propertyId,
    period,
  );
  const filters = {
    ...reportingRange(period),
    propertyIds: propertyId ? [propertyId] : undefined,
  };
  const overview = useScopedQuery({
    queryKey: ["dashboard-finance", filters],
    queryFn: ({ signal }) => adminReportService.overview(filters, signal),
    enabled: allowed && canReadFinance,
  });
  const debt = useScopedQuery({
    queryKey: ["dashboard-invoice-balances", filters],
    queryFn: ({ signal }) => adminReportService.report("debt", filters, signal),
    enabled: allowed && canReadFinance,
  });
  const expenses = useScopedQuery({
    queryKey: ["dashboard-expenses", filters],
    queryFn: ({ signal }) =>
      adminReportService.report("expenses", filters, signal),
    enabled: allowed && canReadFinance,
  });
  const occupancy = useScopedQuery({
    queryKey: ["dashboard-occupancy", filters],
    queryFn: ({ signal }) =>
      adminReportService.report("occupancy", filters, signal),
    enabled: allowed,
  });
  const lifecycle = useScopedQuery({
    queryKey: ["dashboard-lifecycle", propertyId],
    queryFn: ({ signal }) => rentalLifecycleService.board(propertyId, signal),
    enabled: allowed,
  });
  const invoices = useScopedQuery({
    queryKey: ["dashboard-unpaid", propertyId],
    queryFn: ({ signal }) =>
      adminInvoiceService.list(
        { propertyId, status: "UNPAID", size: 5, page: 0 },
        signal,
      ),
    enabled: allowed && canReadFinance,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const data = query.isError || scope.error ? undefined : query.data;
  const roomStatuses =
    data?.roomStatusSummary.map((item) => ({
      ...item,
      label: statusLabel(item.status),
    })) ?? [];
  const rooms =
    data?.roomMap.filter(
      (r) =>
        (!status || r.status === status) &&
        `${r.roomCode} ${r.propertyName} ${r.tenantName ?? ""}`
          .toLocaleLowerCase("vi")
          .includes(search.trim().toLocaleLowerCase("vi")),
    ) ?? [];
  const roomPage = Math.min(page, Math.max(0, Math.ceil(rooms.length / 12) - 1));
  const visibleRooms = rooms.slice(roomPage * 12, roomPage * 12 + 12);
  const finance = overview.isError ? undefined : overview.data?.summary;
  const balances = debt.isError ? undefined : debt.data?.summary;
  const costGroups = new Map<string, number>();
  if (!expenses.isError)
    for (const row of expenses.data?.details ?? []) {
      const label = String(
        row.category ?? row.expense_category ?? "Chưa phân nhóm",
      );
      costGroups.set(
        label,
        (costGroups.get(label) ?? 0) + Number(row.amount ?? 0),
      );
    }
  const expenseGroups = Array.from(costGroups, ([label, amount]) => ({
    label,
    amount,
  }));
  const money = (value?: number) =>
    value == null ? "—" : formatCurrency(value);
  const refresh = () => {
    for (const q of [
      query,
      overview,
      debt,
      expenses,
      occupancy,
      lifecycle,
      invoices,
    ])
      if (q.isEnabled) void q.refetch();
  };
  return (
    <AdminShell
      title="Bảng điều hành"
      subtitle="Tổng quan vận hành trong phạm vi tài sản được phân quyền"
    >
      <PageHeader
        title="Tổng quan vận hành"
        description="Theo dõi phòng, dòng tiền và công việc cần xử lý."
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Kỳ báo cáo
            <select
              aria-label="Kỳ báo cáo"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 block rounded-lg border bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="MONTH">Tháng này</option>
              <option value="QUARTER">Quý này</option>
              <option value="YEAR">Năm nay</option>
            </select>
          </label>
          <button
            aria-label="Làm mới dữ liệu"
            onClick={refresh}
            className="rounded-lg border bg-card p-2.5 text-secondary-foreground"
          >
            <RefreshCw
              className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </PageHeader>
      {(query.isLoading || scope.loading) && <LoadingSkeleton />}
      {(query.isError || scope.error) && (
        <ErrorState
          onRetry={() => {
            scope.retry();
            void query.refetch();
          }}
        />
      )}
      {data && (
        <>
          {!data.availableProperties.length ? (
            <EmptyState text="Tài khoản chưa được gán nhà trọ nào." />
          ) : (
            <>
              <section
                aria-label="Thống kê vận hành"
                className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6"
              >
                <SummaryCard
                  label="Nhà trọ"
                  value={data.summary.totalProperties}
                  icon={<Building2 className="size-5" />}
                />
                <SummaryCard
                  label="Tổng số phòng"
                  value={data.summary.totalRooms}
                  icon={<DoorOpen className="size-5" />}
                />
                <SummaryCard
                  label="Đang thuê"
                  value={data.summary.occupiedRooms}
                  icon={<Users className="size-5" />}
                />
                <SummaryCard
                  label="Phòng trống"
                  value={data.summary.vacantRooms}
                  icon={<Building2 className="size-5" />}
                />
                <SummaryCard
                  label="Đang bảo trì"
                  value={data.summary.maintenanceRooms}
                  icon={<Wrench className="size-5" />}
                />
                <SummaryCard
                  label="Tỷ lệ lấp đầy"
                  value={`${data.summary.occupancyRate}%`}
                  icon={<TrendingUp className="size-5" />}
                  note="Phòng đang thuê / tổng phòng"
                />
              </section>
              {canReadFinance && (
                <>
                  <section
                    aria-label="Thống kê tài chính"
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                  >
                    <SummaryCard
                      label="Phải thu kỳ dịch vụ"
                      value={money(finance?.periodInvoiceObligations)}
                      note="Tổng nghĩa vụ hóa đơn thuộc kỳ dịch vụ"
                    />
                    <SummaryCard
                      label="Thực thu dịch vụ trong kỳ"
                      value={money(data.summary.currentRevenue)}
                      icon={<CircleDollarSign className="size-5" />}
                      note="Thanh toán xác nhận, trừ hoàn tiền; không gồm cọc"
                    />
                    <SummaryCard
                      label="Công nợ hiện tại"
                      value={money(data.summary.outstandingDebt)}
                      note="Số dư hiện tại của tất cả kỳ hóa đơn"
                    />
                    <SummaryCard
                      label="Chi phí trong kỳ"
                      value={money(finance?.confirmedCosts)}
                      note="Chi phí quản trị đã xác nhận"
                    />
                  </section>
                  {overview.isError && (
                    <ErrorState
                      message="Chưa tải được nghĩa vụ hóa đơn và chi phí trong kỳ."
                      onRetry={() => void overview.refetch()}
                    />
                  )}
                </>
              )}
              <Panel
                id="alerts"
                title="Cảnh báo và công việc"
                action={
                  <span className="text-xs text-muted-foreground">
                    Theo quy tắc vận hành hiện có
                  </span>
                }
              >
                {!data.operationalAlerts.length ? (
                  <EmptyState text="Không có cảnh báo cần xử lý." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    {data.operationalAlerts.map((a) => (
                      <Link
                        key={a.code}
                        href={a.actionUrl}
                        className="flex gap-3 rounded-xl border border-warning-border bg-warning-muted p-4"
                      >
                        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">
                            {a.title}
                          </p>
                          <p className="mt-1 text-xs text-warning">
                            {a.description}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Panel>
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel title="Phân bố trạng thái phòng">
                  {!roomStatuses.length ? (
                    <EmptyState text="Chưa có phòng." />
                  ) : (
                    <>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={roomStatuses}
                              dataKey="count"
                              nameKey="label"
                              innerRadius={55}
                              outerRadius={85}
                            >
                              {roomStatuses.map((r) => (
                                <Cell
                                  key={r.status}
                                  fill={colors[r.status] ?? "#94a3b8"}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {roomStatuses.map((r) => (
                          <div
                            key={r.status}
                            className="flex items-center gap-2"
                          >
                            <span
                              className="size-2 rounded-full"
                              style={{
                                background: colors[r.status] ?? "#94a3b8",
                              }}
                            />
                            <span className="text-muted-foreground">{r.label}</span>
                            <strong className="ml-auto">{r.count}</strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Panel>
                <Panel title="Tỷ lệ lấp đầy theo nhà trọ">
                  {occupancy.isLoading ? (
                    <LoadingSkeleton />
                  ) : occupancy.isError ? (
                    <ErrorState onRetry={() => void occupancy.refetch()} />
                  ) : !occupancy.data?.details.length ? (
                    <EmptyState text="Chưa có dữ liệu công suất." />
                  ) : (
                    <div className="max-h-80 space-y-4 overflow-y-auto">
                      {occupancy.data.details.map((r, i) => (
                        <div key={i}>
                          <div className="mb-2 flex justify-between gap-3 text-sm">
                            <span>{String(r.property_name)}</span>
                            <strong>
                              {r.occupancy_rate == null
                                ? "—"
                                : `${r.occupancy_rate}%`}
                            </strong>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary hover:bg-primary-hover"
                              style={{
                                width: `${Math.max(0, Math.min(100, Number(r.occupancy_rate ?? 0)))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Theo báo cáo công suất: không tính phòng ngừng dùng và
                        bảo trì vào mẫu số.
                      </p>
                    </div>
                  )}
                </Panel>
                {canReadFinance && (
                  <>
                    <Panel
                      title="Thực thu dịch vụ theo tháng"
                      action={
                        <span className="text-xs text-muted-foreground">
                          {period === "YEAR" ? "12" : "6"} tháng gần nhất
                        </span>
                      }
                    >
                      {!data.revenueHistory.length ? (
                        <EmptyState text="Chưa có dữ liệu thu tiền." />
                      ) : (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.revenueHistory}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                              />
                              <XAxis dataKey="period" fontSize={11} />
                              <YAxis
                                width={65}
                                tickFormatter={(v) =>
                                  `${Number(v) / 1000000}tr`
                                }
                                fontSize={11}
                              />
                              <Tooltip
                                formatter={(v) => formatCurrency(Number(v))}
                              />
                              <Bar
                                dataKey="revenue"
                                name="Thực thu dịch vụ"
                                fill="#2563eb"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </Panel>
                    <Panel
                      title="Hóa đơn đã thu và còn phải thu"
                      action={<More href="/admin/invoices" />}
                    >
                      <p className="mb-3 text-xs text-muted-foreground">
                        Theo ngày phát hành hóa đơn trong kỳ; số tiền đã thu của
                        nhóm hóa đơn này khác dòng tiền thực thu trong kỳ.
                      </p>
                      {debt.isError ? (
                        <ErrorState onRetry={() => void debt.refetch()} />
                      ) : debt.isLoading ? (
                        <LoadingSkeleton />
                      ) : !balances ? (
                        <Unavailable text="Chưa có dữ liệu hóa đơn." />
                      ) : (
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={[
                                {
                                  label: "Hóa đơn trong kỳ",
                                  paid: balances.totalPaidAmount,
                                  remaining: balances.outstandingDebt,
                                },
                              ]}
                            >
                              <CartesianGrid
                                vertical={false}
                                strokeDasharray="3 3"
                              />
                              <XAxis dataKey="label" fontSize={11} />
                              <YAxis
                                width={65}
                                tickFormatter={(v) =>
                                  `${Number(v) / 1000000}tr`
                                }
                                fontSize={11}
                              />
                              <Tooltip
                                formatter={(v) => formatCurrency(Number(v))}
                              />
                              <Legend />
                              <Bar
                                dataKey="paid"
                                name="Đã thu"
                                fill="#10b981"
                              />
                              <Bar
                                dataKey="remaining"
                                name="Còn phải thu"
                                fill="#f59e0b"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </Panel>
                    <Panel
                      title="Chi phí theo nhóm"
                      action={<More href="/admin/reports/expenses" />}
                    >
                      {expenses.isError ? (
                        <ErrorState onRetry={() => void expenses.refetch()} />
                      ) : expenses.isLoading ? (
                        <LoadingSkeleton />
                      ) : !expenseGroups.length ? (
                        <EmptyState text="Chưa có chi phí được xác nhận trong kỳ." />
                      ) : (
                        <div className="space-y-3">
                          <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={expenseGroups}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  vertical={false}
                                />
                                <XAxis dataKey="label" fontSize={11} />
                                <YAxis
                                  width={65}
                                  tickFormatter={(value) =>
                                    `${Number(value) / 1000000}tr`
                                  }
                                  fontSize={11}
                                />
                                <Tooltip
                                  formatter={(value) =>
                                    formatCurrency(Number(value))
                                  }
                                />
                                <Bar
                                  dataKey="amount"
                                  name="Chi phí đã xác nhận"
                                  fill="#f59e0b"
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>

                          {expenseGroups.map((g) => (
                            <div
                              key={g.label}
                              className="flex justify-between gap-3 rounded-lg bg-muted p-3 text-sm"
                            >
                              <span>{g.label}</span>
                              <strong>{formatCurrency(g.amount)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </Panel>
                  </>
                )}
                <Panel
                  title="Phân tích SmartHome AI"
                  action={<Bot className="size-5 text-link" />}
                >
                  {!data.aiInsights.length ? (
                    <Unavailable text="AI chưa khả dụng. Cảnh báo hiện tại sử dụng quy tắc có sẵn; chưa có dữ liệu cảnh báo phòng trống kéo dài hoặc điện nước bất thường." />
                  ) : (
                    data.aiInsights.map((a) => (
                      <div
                        key={a.label}
                        className="mb-3 rounded-xl bg-accent p-4"
                      >
                        <p className="font-medium text-link">{a.label}</p>
                        <p className="mt-2 text-sm text-secondary-foreground">
                          {a.content}
                        </p>
                      </div>
                    ))
                  )}
                </Panel>
              </div>
              <Panel title="Sơ đồ phòng" action={<More href="/admin/rooms" />}>
                <p className="mb-3 text-xs text-muted-foreground">
                  Hiển thị tối đa 100 phòng từ Dashboard. Mở danh sách phòng để
                  tìm trên toàn bộ dữ liệu.
                </p>
                <PageToolbar>
                  <SearchInput
                    aria-label="Tìm trong sơ đồ phòng"
                    placeholder="Mã phòng, nhà trọ, người thuê…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                  />
                  <label className="text-xs text-muted-foreground">
                    Trạng thái
                    <select
                      aria-label="Trạng thái phòng"
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(0);
                      }}
                      className="ml-2 rounded-lg border bg-card px-3 py-2 text-sm"
                    >
                      <option value="">Tất cả</option>
                      {roomStatuses.map((s) => (
                        <option key={s.status} value={s.status}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </PageToolbar>
                {!rooms.length ? (
                  <EmptyState text="Không có phòng phù hợp." />
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {visibleRooms.map((r) => (
                      <Link
                        href={`/admin/rooms/${r.id}`}
                        key={r.id}
                        className="min-w-0 rounded-xl border border-border border-l-4 p-4 transition hover:bg-muted"
                        style={{
                          borderLeftColor: colors[r.status] ?? "#94a3b8",
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>Phòng {r.roomCode}</strong>
                          <StatusBadge status={r.status} />
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {r.propertyName} · {r.floorName ?? "Chưa gán tầng"}
                        </p>
                        <p className="mt-3 truncate text-sm">
                          {r.tenantName ?? "Chưa có người thuê"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.contractEndDate
                            ? `Hợp đồng đến ${formatDate(r.contractEndDate)}`
                            : "Chưa có hợp đồng"}
                        </p>
                        {r.hasOpenMaintenance && (
                          <p className="mt-2 text-xs font-medium text-orange-700">
                            Có yêu cầu bảo trì
                          </p>
                        )}
                        {canReadFinance && r.outstandingDebt > 0 && (
                          <p className="mt-2 text-xs font-medium text-danger">
                            Nợ {formatCurrency(r.outstandingDebt)}
                          </p>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
                <Pagination
                  page={roomPage}
                  totalPages={Math.ceil(rooms.length / 12)}
                  onChange={setPage}
                />
              </Panel>
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel
                  title="Phòng đang trống"
                  action={<More href="/admin/rooms?status=VACANT" />}
                >
                  <p className="mb-3 text-xs text-muted-foreground">
                    Trích từ sơ đồ phòng (tối đa 100 phòng).
                  </p>
                  {!data.roomMap.some((r) =>
                    ["VACANT", "READY"].includes(r.status),
                  ) ? (
                    <EmptyState text="Không có phòng trống trong sơ đồ hiện tại." />
                  ) : (
                    data.roomMap
                      .filter((r) => ["VACANT", "READY"].includes(r.status))
                      .slice(0, 5)
                      .map((r) => (
                        <Link
                          key={r.id}
                          href={`/admin/rooms/${r.id}`}
                          className="flex justify-between gap-2 border-b border-border py-3 text-sm"
                        >
                          <span>
                            Phòng {r.roomCode} · {r.propertyName}
                          </span>
                          <StatusBadge status={r.status} />
                        </Link>
                      ))
                  )}
                </Panel>
                {canReadFinance && (
                  <Panel
                    title="Hóa đơn chưa thanh toán"
                    action={<More href="/admin/invoices" />}
                  >
                    <p className="mb-3 text-xs text-muted-foreground">
                      5 hóa đơn ở trạng thái chưa thanh toán.
                    </p>
                    {invoices.isError ? (
                      <ErrorState onRetry={() => void invoices.refetch()} />
                    ) : invoices.isLoading ? (
                      <LoadingSkeleton />
                    ) : !invoices.data?.content.length ? (
                      <EmptyState text="Không có hóa đơn chưa thanh toán." />
                    ) : (
                      invoices.data.content.map((i) => (
                        <Link
                          key={i.id}
                          href={`/admin/invoices/${i.id}`}
                          className="flex flex-wrap justify-between gap-2 border-b border-border py-3 text-sm"
                        >
                          <span className="font-medium text-link">
                            {i.invoiceCode} · {i.room.name}
                          </span>
                          <strong>{formatCurrency(i.remainingAmount)}</strong>
                        </Link>
                      ))
                    )}
                  </Panel>
                )}
                {canReadFinance && (
                  <Panel
                    title="Hóa đơn quá hạn"
                    action={<More href="/admin/invoices/debt" />}
                  >
                    <p className="mb-3 text-xs text-muted-foreground">
                      Tối đa 5 hóa đơn cần ưu tiên.
                    </p>
                    {!data.overdueInvoices.length ? (
                      <EmptyState text="Không có hóa đơn quá hạn." />
                    ) : (
                      <DataTable
                        caption="Hóa đơn quá hạn"
                        rows={data.overdueInvoices}
                        rowKey={(r) => r.id}
                        columns={[
                          {
                            label: "Hóa đơn / Phòng",
                            render: (r) => (
                              <Link
                                className="font-medium text-link"
                                href={`/admin/invoices/${r.id}`}
                              >
                                {r.code}
                                <span className="block text-xs text-muted-foreground">
                                  Phòng {r.roomCode} · {r.tenantName}
                                </span>
                              </Link>
                            ),
                          },
                          {
                            label: "Quá hạn",
                            render: (r) => (
                              <span className="text-danger">
                                {r.overdueDays} ngày
                              </span>
                            ),
                          },
                          {
                            label: "Còn nợ",
                            render: (r) => formatCurrency(r.remainingAmount),
                          },
                        ]}
                      />
                    )}
                  </Panel>
                )}
                <Panel
                  title="Hợp đồng hết hạn trong 30 ngày"
                  action={<More href="/admin/contracts" />}
                >
                  <p className="mb-3 text-xs text-muted-foreground">
                    Tối đa 5 hợp đồng cần ưu tiên.
                  </p>
                  {!data.expiringContracts.length ? (
                    <EmptyState text="Không có hợp đồng sắp hết hạn trong phạm vi dữ liệu được cấp." />
                  ) : (
                    data.expiringContracts.map((c) => (
                      <Link
                        key={c.id}
                        href={`/admin/contracts/${c.id}`}
                        className="flex justify-between gap-3 border-b border-border py-3 text-sm"
                      >
                        <span>
                          <strong className="text-link">
                            {c.code} · Phòng {c.roomCode}
                          </strong>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {c.tenantName} · {formatDate(c.endDate)}
                          </span>
                        </span>
                        <span className="shrink-0 text-warning">
                          {c.daysRemaining} ngày
                        </span>
                      </Link>
                    ))
                  )}
                </Panel>
                <Panel
                  title="Khách sắp nhận phòng"
                  action={<More href="/admin/rental-lifecycle?tab=checkin" />}
                >
                  {lifecycle.isError ? (
                    <ErrorState onRetry={() => void lifecycle.refetch()} />
                  ) : lifecycle.isLoading ? (
                    <LoadingSkeleton />
                  ) : !lifecycle.data?.checkins.some(
                      (r) => !r.actualCheckinAt && r.status !== "CANCELLED",
                    ) ? (
                    <EmptyState text="Không có khách chờ nhận phòng." />
                  ) : (
                    lifecycle.data.checkins
                      .filter(
                        (r) => !r.actualCheckinAt && r.status !== "CANCELLED",
                      )
                      .slice(0, 5)
                      .map((r) => (
                        <Link
                          key={r.id}
                          href={`/admin/contracts/${r.contractId}`}
                          className="block border-b border-border py-3 text-sm"
                        >
                          <strong className="text-link">
                            {r.tenantName} · Phòng {r.roomCode}
                          </strong>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.propertyName} · {formatDate(r.scheduledDate)}
                          </p>
                        </Link>
                      ))
                  )}
                </Panel>
                <Panel
                  title="Yêu cầu trả phòng"
                  action={<More href="/admin/rental-lifecycle?tab=checkout" />}
                >
                  {lifecycle.isError ? (
                    <ErrorState onRetry={() => void lifecycle.refetch()} />
                  ) : lifecycle.isLoading ? (
                    <LoadingSkeleton />
                  ) : !lifecycle.data?.checkouts.some(
                      (r) => !r.actualCheckoutAt && r.status !== "CANCELLED",
                    ) ? (
                    <EmptyState text="Không có yêu cầu trả phòng đang mở." />
                  ) : (
                    lifecycle.data.checkouts
                      .filter(
                        (r) => !r.actualCheckoutAt && r.status !== "CANCELLED",
                      )
                      .slice(0, 5)
                      .map((r) => (
                        <Link
                          key={r.id}
                          href={`/admin/contracts/${r.contractId}`}
                          className="block border-b border-border py-3 text-sm"
                        >
                          <strong className="text-link">
                            {r.tenantName} · Phòng {r.roomCode}
                          </strong>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.propertyName} · {formatDate(r.requestedDate)}
                          </p>
                        </Link>
                      ))
                  )}
                </Panel>
                <Panel
                  title="Bảo trì chưa hoàn tất"
                  action={<More href="/admin/maintenance" />}
                >
                  <p className="mb-3 text-xs text-muted-foreground">
                    Tối đa 5 yêu cầu ưu tiên từ Dashboard.
                  </p>
                  {!data.maintenanceRequests.length ? (
                    <EmptyState text="Không có yêu cầu bảo trì đang mở." />
                  ) : (
                    data.maintenanceRequests.map((r) => (
                      <Link
                        key={r.id}
                        href={`/admin/maintenance/${r.id}`}
                        className="block border-b border-border py-3"
                      >
                        <div className="flex justify-between gap-2 text-sm">
                          <strong className="text-link">{r.title}</strong>
                          <StatusBadge status={r.priority} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.propertyName} ·{" "}
                          {r.assigneeName ?? "Chưa phân công"} · Chờ{" "}
                          {r.waitingHours} giờ
                        </p>
                      </Link>
                    ))
                  )}
                </Panel>
                <Panel title="Hoạt động gần đây">
                  {!data.recentActivities.length ? (
                    <EmptyState text="Chưa có hoạt động vận hành." />
                  ) : (
                    data.recentActivities.map((a) => (
                      <div
                        key={a.id}
                        className="border-b border-border py-3 text-sm"
                      >
                        {a.targetUrl ? (
                          <Link className="text-link" href={a.targetUrl}>
                            {a.description}
                          </Link>
                        ) : (
                          a.description
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.actorName ?? "Hệ thống"} ·{" "}
                          {formatDate(a.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </Panel>
              </div>
            </>
          )}
        </>
      )}
    </AdminShell>
  );
}
