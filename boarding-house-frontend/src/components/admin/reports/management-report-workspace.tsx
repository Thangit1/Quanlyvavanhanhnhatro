"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { useAccountantScope } from "@/components/accountant/accountant-scope";
import {
  useManagementProperty,
  useManagementScope,
  reportingRange,
} from "@/providers/management-scope";

import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { adminReportService } from "@/services/admin-report.service";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";

import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import type { ExportJob } from "@/types/admin-report";

type Row = Record<string, string | number | boolean | null>;
type Property = {
  id: number;
  name: string;
  organizationId?: number;
  areaId?: number;
  organizationName?: string;
  areaName?: string;
};
type Report = {
  type: string;
  statuses?: string[];
  properties: Property[];
  propertyIds: number[];
  financialPropertyIds: number[];
  summary: Record<string, number | null>;
  definitions: Record<string, string>;
  rows: Row[];
  totalElements: number;
  totalPages: number;
  filteredTotals: {
    amount: number | null;
    rowCount: number;
    distinct_people?: number;
    electricity_kwh?: number;
    water_m3?: number;
    asset_units?: number;
    paid_amount?: number;
    remaining_amount?: number;
    payable?: number;
  };
  trend: Row[];
  roomStatuses: { label: string; value: number }[];
  costCategories: Row[];
  detailBasis: string;
  updatedAt: string;
};
const groups: readonly (readonly [
  string,
  readonly (readonly [string, string])[],
])[] = [
  [
    "Tổng quan",
    [
      ["overview", "Trung tâm báo cáo"],
      ["operations", "So sánh nhà trọ"],
    ],
  ],
  [
    "Tài chính",
    [
      ["revenue", "Nghĩa vụ doanh thu"],
      ["payments", "Tiền thực thu"],
      ["expenses", "Chi phí"],
      ["profit", "Kết quả thu chi"],
      ["debt", "Công nợ"],
      ["invoices", "Chi tiết hóa đơn"],
      ["deposits", "Tiền cọc"],
    ],
  ],
  [
    "Vận hành",
    [
      ["occupancy", "Phòng và lấp đầy"],
      ["tenants", "Người đang thuê"],
      ["residences", "Lịch sử cư trú"],
      ["contracts", "Hợp đồng"],
      ["bookings", "Đặt phòng"],
      ["utilities", "Điện nước"],
      ["services", "Dịch vụ"],
      ["maintenance", "Bảo trì"],
      ["assets", "Tài sản"],
    ],
  ],
  ["Dữ liệu", [["history", "Lịch sử xuất"]]],
] as const;
const labels: Record<string, string> = {
  code: "Mã / tên",
  property_name: "Nhà trọ",
  status: "Trạng thái",
  category: "Phân loại",
  event_date: "Ngày / kỳ",
  amount: "Giá trị theo cơ sở báo cáo",
  tenant_name: "Người thuê",
  room_code: "Phòng",
  contract_code: "Hợp đồng",
  paid_amount: "Đã thanh toán",
  remaining_amount: "Còn phải thu",
  due_date: "Hạn thanh toán",
  overdue_days: "Ngày quá hạn",
  issue_date: "Ngày lập",
  payment_available_from: "Mở thanh toán",
  discount_amount: "Giảm giá",
  rent_amount: "Tiền phòng trước giảm",
  electricity_amount: "Tiền điện",
  water_amount: "Tiền nước",
  service_amount: "Dịch vụ",
  cash_in: "Tiền thực thu",
  cash_out: "Tiền thực chi",
  method: "Phương thức",
  source_type: "Nguồn",
  source_id: "ID chứng từ",
  reference_code: "Mã tham chiếu",
  confirmed_by: "Người xác nhận",
  reconciliation_basis: "Căn cứ xác nhận",
  payable: "Còn phải trả",
  payee_name: "Người nhận",
  required_amount: "Cọc yêu cầu",
  received_amount: "Cọc đã nhận hợp lệ",
  balance_amount: "Cọc đang giữ",
  refunded_amount: "Đã thực hoàn",
  deducted_amount: "Đã cấn trừ",
  start_date: "Bắt đầu",
  end_date: "Kết thúc",
  days_remaining: "Ngày còn lại",
  deposit_amount: "Mức cọc",
  move_in_date: "Ngày vào",
  move_out_date: "Ngày ra",
  capacity: "Sức chứa phòng",
  reservation_start: "Bắt đầu giữ",
  reservation_end: "Hết hạn giữ",
  electricity_previous: "Điện đầu",
  electricity_current: "Điện cuối",
  electricity_kwh: "Sản lượng (kWh)",
  water_previous: "Nước đầu",
  water_current: "Nước cuối",
  water_m3: "Sản lượng (m³)",
  unit: "Đơn vị",
  quantity: "Số lượng",
  contract_count: "Hợp đồng sử dụng",
  collected_amount: "Thực thu phân bổ",
  estimated_cost: "Chi phí dự kiến",
  recorded_work_cost: "Chi phí ghi tại công việc",
  approved_cost: "Chi phí được duyệt",
  paid_cost: "Chi phí thực chi",
  assignee_name: "Người phụ trách",
  title: "Nội dung",
  priority: "Ưu tiên",
  sla_due_at: "Hạn SLA",
  condition_status: "Tình trạng",
  note: "Ghi chú",
  depreciated_value: "Giá trị sau khấu hao",
  total_rooms: "Tổng phòng",
  occupied_rooms: "Phòng đang thuê",
  occupancy_rate: "Lấp đầy (%)",
  invoice_obligations: "Nghĩa vụ hóa đơn trong kỳ",
  outstanding_debt: "Công nợ hiện tại",
  confirmed_costs: "Chi phí xác nhận",
  physical_residence: "Có cư trú thực tế",
};
const visible: Record<string, string[]> = {
  overview: [
    "code",
    "total_rooms",
    "occupied_rooms",
    "occupancy_rate",
    "invoice_obligations",
    "cash_in",
    "confirmed_costs",
    "outstanding_debt",
    "amount",
  ],
  operations: [
    "code",
    "total_rooms",
    "occupied_rooms",
    "occupancy_rate",
    "invoice_obligations",
    "cash_in",
    "cash_out",
    "confirmed_costs",
    "outstanding_debt",
    "amount",
  ],
  revenue: [
    "code",
    "property_name",
    "room_code",
    "tenant_name",
    "event_date",
    "rent_amount",
    "electricity_amount",
    "water_amount",
    "service_amount",
    "discount_amount",
    "amount",
    "paid_amount",
    "remaining_amount",
  ],
  invoices: [
    "code",
    "property_name",
    "room_code",
    "event_date",
    "issue_date",
    "payment_available_from",
    "due_date",
    "amount",
    "paid_amount",
    "remaining_amount",
    "status",
  ],
  debt: [
    "tenant_name",
    "property_name",
    "room_code",
    "contract_code",
    "code",
    "event_date",
    "amount",
    "paid_amount",
    "remaining_amount",
    "due_date",
    "overdue_days",
    "status",
  ],
  payments: [
    "code",
    "event_date",
    "property_name",
    "category",
    "method",
    "cash_in",
    "confirmed_by",
    "reconciliation_basis",
  ],
  expenses: [
    "code",
    "event_date",
    "property_name",
    "category",
    "amount",
    "paid_amount",
    "payable",
    "status",
  ],
  profit: [
    "code",
    "event_date",
    "property_name",
    "category",
    "cash_in",
    "cash_out",
    "amount",
  ],
  deposits: [
    "code",
    "property_name",
    "tenant_name",
    "category",
    "required_amount",
    "received_amount",
    "balance_amount",
    "deducted_amount",
    "refunded_amount",
    "status",
  ],
  contracts: [
    "code",
    "tenant_name",
    "property_name",
    "room_code",
    "start_date",
    "end_date",
    "days_remaining",
    "amount",
    "deposit_amount",
    "status",
  ],
  tenants: [
    "code",
    "tenant_name",
    "property_name",
    "room_code",
    "category",
    "capacity",
    "move_in_date",
    "status",
  ],
  residences: [
    "code",
    "tenant_name",
    "property_name",
    "room_code",
    "category",
    "move_in_date",
    "move_out_date",
    "status",
  ],
  bookings: [
    "code",
    "tenant_name",
    "property_name",
    "reservation_start",
    "reservation_end",
    "status",
  ],
  utilities: [
    "code",
    "property_name",
    "event_date",
    "electricity_previous",
    "electricity_current",
    "electricity_kwh",
    "electricity_amount",
    "water_previous",
    "water_current",
    "water_m3",
    "water_amount",
    "status",
  ],
  services: [
    "code",
    "property_name",
    "category",
    "unit",
    "quantity",
    "contract_count",
    "amount",
    "collected_amount",
  ],
  maintenance: [
    "code",
    "property_name",
    "title",
    "category",
    "priority",
    "assignee_name",
    "estimated_cost",
    "recorded_work_cost",
    "approved_cost",
    "paid_cost",
    "status",
  ],
  assets: [
    "code",
    "property_name",
    "room_code",
    "quantity",
    "status",
    "note",
    "depreciated_value",
  ],
  occupancy: ["code", "property_name", "status", "physical_residence"],
};
const field =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm";
const money = (key: string) =>
  /(amount|cost|payable|obligations|debt|cash_in|cash_out|value)$/.test(key) &&
  key !== "source_id";
function reportStatus(value: string) {
  return (
    (
      {
        GOOD: "Tốt",
        BROKEN: "Hỏng",
        DAMAGED: "Hư hỏng",
        NEEDS_MAINTENANCE: "Cần bảo trì",
        VERIFIED: "Đã đối soát",
        NEEDS_REVIEW: "Cần kiểm tra",
        ISSUED_SNAPSHOT: "Chi tiết đã phát hành",
      } as Record<string, string>
    )[value] ?? statusLabel(value)
  );
}
function display(key: string, value: unknown) {
  if (value == null) return "—";
  if (money(key)) return formatCurrency(Number(value));
  if (key === "status") return reportStatus(String(value));
  if (/date$|_at$/.test(key)) return formatDate(String(value));
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number")
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
      value,
    );
  return String(value);
}
export function ManagementReportWorkspace({
  portal = "admin",
  initialType = "overview",
}: {
  portal?: "admin" | "accountant";
  initialType?: string;
}) {
  return portal === "admin" ? (
    <AdminShell
      title="Báo cáo và thống kê"
      subtitle="KPI có định nghĩa, bộ lọc và chứng từ nguồn"
      readOnly
    >
      <AdminReportBody initialType={initialType} />
    </AdminShell>
  ) : (
    <AccountantReportBody initialType={initialType} />
  );
}
function AdminReportBody({ initialType }: { initialType: string }) {
  const search = useSearchParams();
  const [propertyId, setPropertyId] = useManagementProperty(
    Number(search.get("propertyId")) || undefined,
  );
  const scope = useManagementScope();
  return (
    <Body
      key={scope.period}
      portal="admin"
      initialType={initialType}
      propertyId={propertyId}
      setPropertyId={setPropertyId}
      range={reportingRange(scope.period)}
    />
  );
}
function AccountantReportBody({ initialType }: { initialType: string }) {
  const scope = useAccountantScope();
  const [y, m] = scope.period.split("-").map(Number);
  return (
    <Body
      key={scope.period}
      portal="accountant"
      initialType={initialType}
      propertyId={scope.propertyId}
      setPropertyId={scope.setPropertyId}
      range={{
        startDate: scope.period + "-01",
        endDate: localDate(new Date(y, m, 0)),
      }}
    />
  );
}
function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function Body({
  portal,
  initialType,
  propertyId,
  setPropertyId,
  range,
}: {
  portal: "admin" | "accountant";
  initialType: string;
  propertyId?: number;
  setPropertyId: (id?: number) => void;
  range: { startDate: string; endDate: string };
}) {
  const search = useSearchParams(),
    client = useQueryClient();
  const [type, setType] = useState(search.get("report") ?? initialType),
    [start, setStart] = useState(search.get("startDate") ?? range.startDate),
    [end, setEnd] = useState(search.get("endDate") ?? range.endDate);
  const [organizationId, setOrganizationId] = useState<number>(),
    [areaId, setAreaId] = useState<number>(),
    [status, setStatus] = useState(search.get("status") ?? ""),
    [category, setCategory] = useState(""),
    [roomId, setRoomId] = useState(search.get("roomId") ?? ""),
    [contractId, setContractId] = useState(""),
    [typed, setTyped] = useState(""),
    [keyword, setKeyword] = useState(""),
    [sort, setSort] = useState("date"),
    [page, setPage] = useState(0),
    [expanded, setExpanded] = useState<number>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [previousProperty, setPreviousProperty] = useState(propertyId);
  if (previousProperty !== propertyId) {
    setPreviousProperty(propertyId);
    setRoomId("");
    setContractId("");
    setPage(0);
    setExpanded(undefined);
  }
  const exportLock = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(typed.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const params = {
    type,
    propertyId,
    organizationId,
    areaId,
    startDate: start,
    endDate: end,
    status: status || undefined,
    category: category || undefined,
    roomId: roomId ? Number(roomId) : undefined,
    contractId: contractId ? Number(contractId) : undefined,
    keyword: keyword || undefined,
    sort,
    page,
    size: 20,
  };
  const base = `/${portal}/reports/workspace`;
  const choices = useScopedQuery({
    queryKey: ["management-report-choices", portal, propertyId],
    enabled: !!propertyId,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<
          ApiEnvelope<{
            rooms: { id: number; code: string }[];
            contracts: { id: number; code: string; roomId: number }[];
          }>
        >(base + "/choices", { params: { propertyId }, signal })
      ).data.data,
  });
  const options = useScopedQuery({
    queryKey: ["management-report-options", portal],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Property[]>>(base + "/options", {
          signal,
        })
      ).data.data,
  });
  const properties = options.data ?? [];
  const query = useScopedQuery({
    queryKey: ["management-reports", portal, params],
    enabled: type !== "history",
    queryFn: async ({ signal }) =>
      (await apiClient.get<ApiEnvelope<Report>>(base, { params, signal })).data
        .data,
  });
  const history = useScopedQuery({
    queryKey: ["report-exports"],
    enabled: type === "history",
    queryFn: adminReportService.exports,
  });
  const data = query.data;
  const title =
    groups.flatMap((g) => g[1]).find((t) => t[0] === type)?.[1] ?? "Báo cáo";
  function choose(next: string) {
    setType(next);
    setPage(0);
    setStatus("");
    setCategory("");
    setRoomId("");
    setContractId("");
    setExpanded(undefined);
    setError("");
  }
  async function exportReport(format: "CSV" | "XLSX") {
    if (exportLock.current) return;
    exportLock.current = true;
    setBusy(true);
    setError("");
    try {
      const job = (
        await apiClient.post<ApiEnvelope<ExportJob>>(`${base}/exports`, null, {
          params: { ...params, format },
        })
      ).data.data;
      await adminReportService.download(job);
      await client.invalidateQueries({ queryKey: ["report-exports"] });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      exportLock.current = false;
      setBusy(false);
    }
  }
  const columns = data
    ? (visible[type] ??
      Object.keys(data.rows[0] ?? {}).filter((k) => !k.endsWith("_id")))
    : [];
  const financeKpis = [
    ["periodInvoiceObligations", "Nghĩa vụ hóa đơn theo kỳ"],
    ["cashIn", "Tiền thực thu theo ngày"],
    ["confirmedCosts", "Chi phí xác nhận theo ngày"],
    ["netCashFlow", "Dòng tiền thuần theo ngày"],
    ["outstandingDebt", "Công nợ còn lại hiện tại"],
    ["heldDeposits", "Cọc đang giữ hiện tại"],
  ] as const;
  return (
    <main className="management-report mx-auto max-w-[1700px] space-y-5 p-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Báo cáo và thống kê / {title}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {start} → {end} ·{" "}
            {propertyId
              ? (properties?.find((p) => p.id === propertyId)?.name ??
                "Nhà trọ đã chọn")
              : "Toàn bộ phạm vi được cấp quyền"}
          </p>
        </div>
        {type !== "history" && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              disabled={busy || query.isError || !data}
              className="rounded-xl border bg-card px-4 py-2 text-sm disabled:opacity-40"
              onClick={() => void exportReport("XLSX")}
            >
              Xuất Excel
            </button>
            <button
              disabled={busy || query.isError || !data}
              className="rounded-xl border bg-card px-4 py-2 text-sm disabled:opacity-40"
              onClick={() => void exportReport("CSV")}
            >
              Xuất CSV
            </button>
            <button
              className="rounded-xl border bg-card px-4 py-2 text-sm"
              onClick={() => window.print()}
            >
              In trang hiện tại / Lưu PDF
            </button>
          </div>
        )}
      </div>
      <nav
        className="grid gap-3 surface-card p-4 md:grid-cols-4 print:hidden"
        aria-label="Nhóm báo cáo"
      >
        {groups.map(([name, tabs]) => (
          <section key={name}>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              {name}
            </p>
            <div className="flex flex-wrap gap-1">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  aria-current={id === type ? "page" : undefined}
                  className={`rounded-lg px-2.5 py-2 text-left text-sm ${id === type ? "bg-primary hover:bg-primary-hover font-semibold text-white" : "text-secondary-foreground hover:bg-muted"}`}
                  onClick={() => choose(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>
      {type !== "history" && (
        <section className="grid gap-3 surface-card p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <label className="text-sm">
            Công ty (nhóm vận hành hiện tại)
            <select
              aria-label="Công ty báo cáo"
              className={field}
              value={organizationId ?? ""}
              onChange={(e) => {
                setOrganizationId(Number(e.target.value) || undefined);
                setAreaId(undefined);
                setPropertyId(undefined);
                setPage(0);
              }}
            >
              <option value="">Tất cả công ty trong quyền</option>
              {[
                ...new Map(
                  properties
                    .filter((p) => p.organizationId)
                    .map((p) => [p.organizationId, p]) ?? [],
                ).values(),
              ].map((p) => (
                <option key={p.organizationId} value={p.organizationId}>
                  {p.organizationName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Khu quản lý
            <select
              aria-label="Khu quản lý báo cáo"
              className={field}
              value={areaId ?? ""}
              onChange={(e) => {
                setAreaId(Number(e.target.value) || undefined);
                setPropertyId(undefined);
                setPage(0);
              }}
            >
              <option value="">Tất cả khu trong quyền</option>
              {[
                ...new Map(
                  properties
                    .filter(
                      (p) =>
                        p.areaId &&
                        (!organizationId ||
                          p.organizationId === organizationId),
                    )
                    .map((p) => [p.areaId, p]) ?? [],
                ).values(),
              ].map((p) => (
                <option key={p.areaId} value={p.areaId}>
                  {p.areaName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Nhà trọ
            <select
              aria-label="Nhà trọ báo cáo"
              className={field}
              value={propertyId ?? ""}
              onChange={(e) => {
                setPropertyId(Number(e.target.value) || undefined);
                setPage(0);
              }}
            >
              <option value="">Tất cả nhà trọ trong quyền</option>
              {properties
                .filter(
                  (p) =>
                    (!organizationId || p.organizationId === organizationId) &&
                    (!areaId || p.areaId === areaId),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Tháng
            <input
              aria-label="Tháng báo cáo"
              className={field}
              type="month"
              value={start.slice(0, 7)}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                if (y && m) {
                  setStart(e.target.value + "-01");
                  setEnd(localDate(new Date(y, m, 0)));
                  setPage(0);
                }
              }}
            />
          </label>
          <label className="text-sm">
            Từ ngày
            <input
              aria-label="Từ ngày báo cáo"
              className={field}
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="text-sm">
            Đến ngày
            <input
              aria-label="Đến ngày báo cáo"
              className={field}
              type="date"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label className="text-sm">
            Quý / năm
            <select
              aria-label="Quý năm báo cáo"
              className={field}
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const y = Number(start.slice(0, 4)),
                  q = Number(e.target.value);
                setStart(localDate(new Date(y, q ? 3 * (q - 1) : 0, 1)));
                setEnd(localDate(new Date(y, q ? 3 * q : 12, 0)));
                setPage(0);
              }}
            >
              <option value="">Chọn kỳ trong năm {start.slice(0, 4)}</option>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Quý {q}
                </option>
              ))}
              <option value="0">Cả năm</option>
            </select>
          </label>
          <button
            className="self-end rounded-xl border px-3 py-2.5 text-sm"
            onClick={() => void query.refetch()}
          >
            Tải lại báo cáo
          </button>
        </section>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-muted p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {type === "history" ? (
        history.isLoading ? (
          <PageLoading />
        ) : history.isError ? (
          <ErrorState onRetry={() => void history.refetch()} />
        ) : (
          <section className="space-y-3 surface-card p-4">
            <h2 className="font-bold">Lịch sử xuất riêng tư</h2>
            {history.data?.length ? (
              history.data.map((job) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                  key={job.id}
                >
                  <span>
                    {job.reportType} · {job.format} · {job.status}
                    <small className="block text-muted-foreground">
                      {formatDate(job.createdAt, true)} · {job.fileName}
                    </small>
                  </span>
                  <button
                    className="rounded-lg border px-3 py-2"
                    disabled={job.status !== "COMPLETED"}
                    onClick={() =>
                      void adminReportService
                        .download(job)
                        .catch((e) => setError(apiErrorMessage(e)))
                    }
                  >
                    Tải theo quyền hiện tại
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có báo cáo đã xuất.</p>
            )}
          </section>
        )
      ) : query.isLoading ? (
        <PageLoading />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        data && (
          <>
            <details className="rounded-xl border bg-accent p-4 text-sm text-secondary-foreground">
              <summary className="cursor-pointer font-semibold">
                Định nghĩa KPI và cơ sở tính ·{" "}
                {(
                  {
                    CURRENT_SNAPSHOT: "Ảnh chụp hiện tại",
                    BILLING_PERIOD: "Theo kỳ sử dụng",
                    SOURCE_EVENT_DATE: "Theo ngày chứng từ",
                    OVERLAP_OR_CREATED_IN_RANGE:
                      "Giao kỳ / tạo trong khoảng chọn",
                  } as Record<string, string>
                )[data.detailBasis] ?? data.detailBasis}
              </summary>
              <dl className="mt-3 space-y-2">
                {Object.entries(data.definitions).map(([key, text]) => (
                  <div key={key}>
                    <dt className="font-semibold">
                      {(
                        {
                          occupancyRate: "Tỷ lệ lấp đầy",
                          roomDays: "Lấp đầy bình quân trong kỳ",
                          revenue: "Nghĩa vụ doanh thu",
                          cash: "Tiền thực thu và thực chi",
                          debt: "Công nợ",
                          deposits: "Tiền cọc",
                          financialScope: "Phạm vi tài chính",
                          history: "Lịch sử cư trú",
                          services: "Phân bổ dịch vụ",
                          maintenance: "Chi phí bảo trì",
                        } as Record<string, string>
                      )[key] ?? key}
                    </dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3">
                Phạm vi vận hành: {data.propertyIds.length} nhà; phạm vi tài
                chính được cấp: {data.financialPropertyIds.length} nhà. Cập
                nhật: {formatDate(data.updatedAt, true)}.
              </p>
            </details>
            {["overview", "operations", "occupancy"].includes(type) && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["totalProperties", "Nhà trọ hiện tại", "operations"],
                  ["totalRooms", "Phòng hiện tại", "occupancy"],
                  ["occupiedRooms", "Phòng đang thuê hiện tại", "occupancy"],
                  ["vacantRooms", "Phòng trống hiện tại", "occupancy"],
                  ["maintenanceRooms", "Phòng bảo trì hiện tại", "occupancy"],
                  ["occupancyRate", "Lấp đầy hiện tại (%)", "occupancy"],
                  [
                    "activePeople",
                    "Người cư trú phân biệt hiện tại",
                    "tenants",
                  ],
                  [
                    "expiringContracts",
                    "Hợp đồng hết hạn trong 30 ngày",
                    "contracts",
                  ],
                ].map(([key, label, target]) => (
                  <button
                    key={key}
                    className="rounded-2xl border bg-card p-4 text-left"
                    onClick={() => {
                      choose(target);
                      if (key === "expiringContracts")
                        setStatus("EXPIRING_WINDOW");
                    }}
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <strong className="mt-2 block text-xl">
                      {display(key, data.summary[key])}
                    </strong>
                  </button>
                ))}
              </div>
            )}
            {["overview", "operations", "profit"].includes(type) && (
              <section>
                <p className="mb-2 text-xs text-muted-foreground">
                  KPI tài chính trong phạm vi được cấp, tách khỏi bộ lọc chi
                  tiết bảng. Dấu — là không có quyền hoặc chưa có dữ liệu.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {financeKpis.map(([key, label]) => (
                    <button
                      key={key}
                      className="rounded-2xl border bg-card p-4 text-left"
                      onClick={() =>
                        choose(
                          key === "outstandingDebt"
                            ? "debt"
                            : key === "heldDeposits"
                              ? "deposits"
                              : key === "confirmedCosts"
                                ? "expenses"
                                : key === "periodInvoiceObligations"
                                  ? "revenue"
                                  : key === "cashIn"
                                    ? "payments"
                                    : "profit",
                        )
                      }
                    >
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <strong className="mt-2 block text-xl">
                        {data.summary[key] == null
                          ? "—"
                          : formatCurrency(data.summary[key]!)}
                      </strong>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {type === "overview" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <section className="surface-card p-4">
                  <h2 className="font-bold">
                    Nghĩa vụ và dòng tiền theo tháng
                  </h2>
                  {data.trend.length ? (
                    data.trend.map((r) => (
                      <button
                        key={String(r.period)}
                        className="mt-3 block w-full rounded-lg bg-muted p-3 text-left text-sm"
                        onClick={() => choose("payments")}
                      >
                        <strong>{r.period}</strong>
                        <div
                          className="mt-2 h-2 rounded bg-blue-500"
                          style={{
                            width:
                              (Math.max(0, Number(r.cashIn)) /
                                Math.max(
                                  1,
                                  ...data.trend.map((p) => Number(p.cashIn)),
                                )) *
                                100 +
                              "%",
                          }}
                        />
                        <p>
                          Nghĩa vụ: {formatCurrency(Number(r.obligations))} ·
                          Thu: {formatCurrency(Number(r.cashIn))} · Chi:{" "}
                          {formatCurrency(Number(r.cashOut))}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Không có dòng tiền trong phạm vi được cấp.
                    </p>
                  )}
                </section>
                <section className="surface-card p-4">
                  <h2 className="font-bold">Tình trạng phòng hiện tại</h2>
                  {data.roomStatuses.map((r) => (
                    <button
                      key={r.label}
                      className="mt-2 flex w-full justify-between rounded-lg bg-muted p-2 text-sm"
                      onClick={() => {
                        choose("occupancy");
                        setStatus(r.label);
                      }}
                    >
                      <span>{statusLabel(r.label)}</span>
                      <strong>{r.value} phòng</strong>
                    </button>
                  ))}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Không suy diễn xu hướng lấp đầy từ trạng thái hiện tại.
                  </p>
                </section>
                <section className="surface-card p-4">
                  <h2 className="font-bold">Chi phí theo nhóm</h2>
                  {data.costCategories.length ? (
                    data.costCategories.map((r) => (
                      <button
                        className="mt-2 flex w-full justify-between gap-3 rounded-lg bg-muted p-2 text-sm"
                        key={String(r.category)}
                        onClick={() => {
                          choose("expenses");
                          setCategory(String(r.category));
                        }}
                      >
                        <span>{r.category}</span>
                        <strong>{formatCurrency(Number(r.amount))}</strong>
                      </button>
                    ))
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Chưa có chi phí được xác nhận.
                    </p>
                  )}
                </section>
              </div>
            )}
            <section className="space-y-3">
              <div className="flex flex-wrap gap-2 print:hidden">
                <input
                  aria-label="Tìm chứng từ báo cáo"
                  className={`${field} max-w-sm`}
                  value={typed}
                  placeholder="Tìm mã hoặc nhà trọ (chỉ lọc bảng)"
                  onChange={(e) => setTyped(e.target.value)}
                />
                <select
                  aria-label="Trạng thái báo cáo"
                  className={field + " max-w-52"}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  {[
                    ...new Set([
                      ...(data.statuses ??
                        data.rows
                          .map((r) => String(r.status ?? ""))
                          .filter(Boolean)),
                      ...(type === "contracts" ? ["EXPIRING_WINDOW"] : []),
                    ]),
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value === "EXPIRING_WINDOW"
                        ? "Sắp hết hạn (30 ngày)"
                        : reportStatus(value)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Phân loại báo cáo"
                  className={field + " max-w-48"}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả phân loại</option>
                  {[
                    ...new Set(
                      data.rows
                        .map((r) => String(r.category ?? ""))
                        .filter(Boolean)
                        .concat(
                          type === "services"
                            ? ["SERVICE", "ELECTRICITY", "WATER"]
                            : [],
                        ),
                    ),
                  ].map((value) => (
                    <option key={value} value={value}>
                      {(
                        {
                          SERVICE: "Dịch vụ",
                          ELECTRICITY: "Điện",
                          WATER: "Nước",
                          INVOICE: "Hóa đơn",
                          RESERVATION: "Giữ phòng",
                          SECURITY: "Cọc hợp đồng",
                        } as Record<string, string>
                      )[value] ?? value}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sắp xếp báo cáo"
                  className={`${field} max-w-48`}
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="date">Ngày / kỳ mới nhất</option>
                  <option value="amount">Giá trị cao nhất</option>
                  <option value="code">Mã / tên</option>
                </select>
                {[
                  "revenue",
                  "invoices",
                  "debt",
                  "contracts",
                  "tenants",
                  "residences",
                  "utilities",
                ].includes(type) && (
                  <>
                    <select
                      aria-label="Phòng báo cáo"
                      className={field + " max-w-48"}
                      disabled={!propertyId}
                      value={roomId}
                      onChange={(e) => {
                        setRoomId(e.target.value);
                        setContractId("");
                        setPage(0);
                      }}
                    >
                      <option value="">
                        {propertyId ? "Tất cả phòng" : "Chọn nhà để lọc phòng"}
                      </option>
                      {choices.data?.rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Hợp đồng báo cáo"
                      className={field + " max-w-48"}
                      disabled={!propertyId}
                      value={contractId}
                      onChange={(e) => {
                        setContractId(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">
                        {propertyId
                          ? "Tất cả hợp đồng"
                          : "Chọn nhà để lọc hợp đồng"}
                      </option>
                      {choices.data?.contracts
                        .filter((c) => !roomId || c.roomId === Number(roomId))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code}
                          </option>
                        ))}
                    </select>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {data.totalElements} dòng theo bộ lọc bảng · Tổng cột giá trị:{" "}
                {data.filteredTotals.amount == null
                  ? "Không áp dụng / chưa có dữ liệu"
                  : formatCurrency(data.filteredTotals.amount)}
                . Số người khác số lượt cư trú; cọc và công nợ là hiện tại,
                không phải số dư lịch sử cuối kỳ. Ô trống không được coi là 0.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                {Object.entries(data.filteredTotals)
                  .filter(
                    ([key, value]) =>
                      value != null && !["amount", "rowCount"].includes(key),
                  )
                  .map(([key, value]) => (
                    <p key={key} className="rounded-xl border bg-card p-3">
                      {key === "distinct_people"
                        ? "Số người phân biệt trong bảng"
                        : key === "asset_units"
                          ? "Số đơn vị tài sản"
                          : (labels[key] ?? key)}
                      : <strong>{display(key, value)}</strong>
                    </p>
                  ))}
              </div>
              <div className="overflow-x-auto surface-card">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      {columns.map((key) => (
                        <th className="whitespace-nowrap p-3" key={key}>
                          {labels[key] ?? key}
                        </th>
                      ))}
                      <th className="p-3 print:hidden">
                        Chi tiết / chứng từ nguồn
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className="border-t align-top">
                        {columns.map((key) => (
                          <td key={key} className="max-w-sm p-3">
                            {display(key, row[key])}
                          </td>
                        ))}
                        <td className="min-w-44 space-y-2 p-3 print:hidden">
                          <SourceLinks row={row} portal={portal} />
                          {["operations", "overview"].includes(type) && (
                            <button
                              className="block text-link"
                              onClick={() => {
                                setPropertyId(Number(row.property_id));
                                choose("revenue");
                              }}
                            >
                              Theo dõi nhà này cùng kỳ
                            </button>
                          )}
                          <button
                            className="block text-link"
                            onClick={() =>
                              setExpanded(expanded === i ? undefined : i)
                            }
                          >
                            Căn cứ và trường nguồn
                          </button>
                          {expanded === i && (
                            <dl className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-muted p-2 text-xs">
                              {Object.entries(row).map(([key, value]) => (
                                <div key={key}>
                                  <dt className="font-semibold">
                                    {labels[key] ?? key}
                                  </dt>
                                  <dd>{display(key, value)}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!data.rows.length && (
                      <tr>
                        <td
                          colSpan={columns.length + 1}
                          className="p-8 text-center text-muted-foreground"
                        >
                          Không có dữ liệu trong bộ lọc và phạm vi này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm print:hidden">
                <span>
                  Trang {page + 1} / {Math.max(1, data.totalPages)}
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border bg-card px-3 py-2 disabled:opacity-40"
                    disabled={!page}
                    onClick={() => setPage(page - 1)}
                  >
                    Trước
                  </button>
                  <button
                    className="rounded-lg border bg-card px-3 py-2 disabled:opacity-40"
                    disabled={page + 1 >= data.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Sau
                  </button>
                </div>
              </div>
            </section>
          </>
        )
      )}
    </main>
  );
}
function SourceLinks({ row, portal }: { row: Row; portal: string }) {
  const prefix = portal === "accountant" ? "/accountant" : "/admin";
  const links: [string, string][] = [];
  if (row.invoice_id)
    links.push(["Hóa đơn nguồn", `${prefix}/invoices/${row.invoice_id}`]);
  if (row.contract_id && portal === "admin")
    links.push(["Hợp đồng", `/admin/contracts/${row.contract_id}`]);
  if (row.tenant_id && portal === "admin")
    links.push(["Hồ sơ người thuê", `/admin/tenants/${row.tenant_id}`]);
  if (row.room_id && portal === "admin")
    links.push(["Phòng", `/admin/rooms/${row.room_id}`]);
  if (row.maintenance_id && portal === "admin")
    links.push(["Yêu cầu bảo trì", `/admin/maintenance/${row.maintenance_id}`]);
  if (row.voucher_id)
    links.push([
      "Phiếu chi",
      portal === "accountant"
        ? `/accountant/payment-vouchers/${row.voucher_id}`
        : "/admin/finance",
    ]);
  if (row.deposit_id)
    links.push([
      "Sổ cọc",
      portal === "accountant"
        ? `/accountant/deposits/${row.deposit_id}`
        : "/admin/finance",
    ]);
  return (
    <>
      {links.map(([label, href]) => (
        <Link className="block text-link" key={label} href={href}>
          {label}
        </Link>
      ))}
    </>
  );
}
