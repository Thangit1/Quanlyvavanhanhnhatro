"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { DepositLedgerPanel } from "./deposit-ledger-panel";
import { VoucherEvidence } from "./management-finance-panel";
import { ErrorState, PageLoading } from "./dashboard-ui";
import { CurrencyInput, IntegerInput } from "@/components/ui/number-input";
import { useManagementProperty } from "@/providers/management-scope";
import {
  useManagementScope,
  reportingRange,
} from "@/providers/management-scope";
import { useAccountantScope } from "@/components/accountant/accountant-scope";
import { useAuth } from "@/providers/auth-provider";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";

type Row = Record<string, string | number | boolean | null>;
type Data = {
  summary: Record<string, number>;
  properties: {
    id: number;
    name: string;
    organizationId?: number;
    areaId?: number;
    organizationName?: string;
    areaName?: string;
  }[];
  propertyIds: number[];
  funds: Row[];
  rows: Row[];
  totalElements: number;
  totalPages: number;
  ledger: {
    opening: number;
    incoming: number;
    outgoing: number;
    closing: number;
    verified: boolean;
  };
  trend: Row[];
  costCategories: Row[];
  byProperty: Row[];
  permissions: { createVoucher: boolean; recordIncome: boolean };
};
const tabs = [
  ["overview", "Tổng quan"],
  ["deposits", "Tiền cọc"],
  ["receipts", "Phiếu thu"],
  ["vouchers", "Phiếu chi"],
  ["expenses", "Chi phí"],
  ["cashbook", "Sổ tiền mặt"],
  ["bankbook", "Sổ ngân hàng"],
  ["reconciliation", "Đối soát"],
  ["periods", "Kỳ tài chính"],
  ["history", "Lịch sử chứng từ"],
] as const;
const statuses: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt, chưa chi",
  PAID: "Đã thực chi",
  REJECTED: "Từ chối",
  REVERSED: "Đã đảo",
  CONFIRMED: "Đã ghi nhận",
  OPEN: "Đang mở",
  CLOSED: "Đã khóa",
  NEEDS_REVIEW: "Cần kiểm tra",
  CHECKED: "Đã kiểm tra nguồn",
};
const categories: Record<string, string> = {
  REPAIR: "Sửa chữa",
  MAINTENANCE: "Bảo trì",
  MATERIAL: "Vật tư",
  UTILITIES: "Điện nước / internet",
  PAYROLL: "Lương / phụ cấp",
  OPERATING: "Vận hành / vệ sinh / thuê mặt bằng",
  OUTSOURCING: "Dịch vụ ngoài",
  ASSET_PURCHASE: "Mua tài sản",
  OTHER: "Chi khác",
  SERVICE_COLLECTION: "Thu hóa đơn",
  DEPOSIT_COLLECTION: "Thu cọc",
  DEPOSIT_REFUND: "Hoàn cọc",
  EXPENSE_PAYMENT: "Thực chi vận hành",
  ASSET_PAYMENT: "Thực chi tài sản",
  CUSTOMER_REFUND: "Hoàn thanh toán",
  CUSTOMER_ADVANCE: "Khách trả trước",
  PASS_THROUGH: "Thu hộ",
  OTHER_COLLECTION: "Thu khác",
  LEGACY_UNCLASSIFIED: "Chi phí cũ chưa phân loại",
};
const field =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm";
function date(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function FinanceWorkspace({
  portal = "admin",
  initialTab = "overview",
  initialPropertyId,
}: {
  portal?: "admin" | "accountant";
  initialTab?: string;
  initialPropertyId?: number;
}) {
  const content =
    portal === "admin" ? (
      <AdminFinanceBody
        initialTab={initialTab}
        initialPropertyId={initialPropertyId}
      />
    ) : (
      <AccountantFinanceBody initialTab={initialTab} />
    );
  return portal === "admin" ? (
    <AdminShell
      title="Tài chính và sổ quỹ"
      subtitle="Tiền thực tế, nghĩa vụ và chứng từ nguồn"
      readOnly
    >
      {content}
    </AdminShell>
  ) : (
    content
  );
}
function AdminFinanceBody({
  initialTab,
  initialPropertyId,
}: {
  initialTab: string;
  initialPropertyId?: number;
}) {
  const [propertyId, setPropertyId] = useManagementProperty(initialPropertyId);
  const scope = useManagementScope();
  return (
    <WorkspaceBody
      key={scope.period}
      portal="admin"
      initialTab={initialTab}
      propertyId={propertyId}
      setPropertyId={setPropertyId}
      initialPeriod={date().slice(0, 7)}
      initialRange={reportingRange(scope.period)}
    />
  );
}
function AccountantFinanceBody({ initialTab }: { initialTab: string }) {
  const scope = useAccountantScope();
  return (
    <WorkspaceBody
      key={scope.period}
      portal="accountant"
      initialTab={initialTab}
      propertyId={scope.propertyId}
      setPropertyId={scope.setPropertyId}
      initialPeriod={scope.period}
    />
  );
}
function WorkspaceBody({
  portal,
  initialTab,
  propertyId,
  setPropertyId,
  initialPeriod,
  initialRange,
}: {
  portal: "admin" | "accountant";
  initialTab: string;
  propertyId?: number;
  setPropertyId: (id?: number) => void;
  initialPeriod?: string;
  initialRange?: { startDate: string; endDate: string };
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [organizationId, setOrganizationId] = useState<number>();
  const [areaId, setAreaId] = useState<number>();
  const [tab, setTab] = useState(initialTab),
    [start, setStart] = useState(
      () =>
        initialRange?.startDate ??
        (initialPeriod
          ? `${initialPeriod}-01`
          : date(new Date(new Date().getFullYear(), new Date().getMonth(), 1))),
    ),
    [end, setEnd] = useState(
      () =>
        initialRange?.endDate ??
        (initialPeriod && initialPeriod !== date().slice(0, 7)
          ? date(
              new Date(
                Number(initialPeriod.slice(0, 4)),
                Number(initialPeriod.slice(5, 7)),
                0,
              ),
            )
          : date()),
    );
  const [keyword, setKeyword] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [method, setMethod] = useState(""),
    [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<{ kind: string; row?: Row }>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [received, setReceived] = useState(false),
    [expanded, setExpanded] = useState<string>();
  const latch = useRef(false),
    attempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const base = `/${portal}/finance`;
  const params = {
    propertyId,
    organizationId,
    areaId,
    startDate: start,
    endDate: end,
    tab,
    keyword: keyword || undefined,
    status: status || undefined,
    category: category || undefined,
    method: method || undefined,
    page,
    size: 20,
  };
  const query = useQuery({
    queryKey: ["finance-workspace", portal, user?.id, user?.activeRole, params],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<Data>>(`${base}/workspace`, { params }))
        .data.data,
  });
  const closingCheck = useQuery({
    queryKey: ["finance-closing-check", dialog?.row?.id],
    enabled: dialog?.kind === "closePeriod",
    queryFn: async () =>
      (
        await apiClient.get<
          ApiEnvelope<{ blockingCount: number; findings?: unknown[] }>
        >("/accountant/periods/" + dialog?.row?.id + "/closing-check")
      ).data.data,
  });
  const data = query.data;
  const ledger = tab === "cashbook" || tab === "bankbook";
  function changeTab(value: string) {
    setTab(value);
    setMethod("");
    setPage(0);
    setStatus("");
    setCategory("");
    setKeyword("");
    setExpanded(undefined);
  }
  function open(kind: string, row?: Row) {
    setDialog({ kind, row });
    setReceived(false);
    setError("");
    attempt.current = undefined;
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (latch.current || !dialog) return;
    latch.current = true;
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget),
        value = (name: string) => String(form.get(name) || "");
      const kind = dialog.kind;
      let path = "",
        payload: object = {};
      if (kind === "voucher") {
        path = "/workspace/vouchers";
        payload = {
          propertyId: Number(value("property")),
          payeeName: value("payee"),
          amount: Number(value("amount")),
          category: value("category"),
          paymentMethod: value("method"),
          voucherDate: value("date"),
          description: value("reason"),
          expenseId: value("expense") ? Number(value("expense")) : undefined,
        };
      } else if (kind === "income") {
        if (!received) throw Error("Cần xác nhận đã nhận tiền thực tế.");
        path = "/workspace/income";
        payload = {
          propertyId: Number(value("property")),
          amount: Number(value("amount")),
          category: value("category"),
          paymentMethod: value("method"),
          incomeDate: value("date"),
          description: value("reason"),
          referenceCode: value("reference") || undefined,
        };
      } else if (kind === "reconcile") {
        if (!propertyId) throw Error("Chọn một nhà trọ để đối soát.");
        path = `/reconciliation?propertyId=${propertyId}&startDate=${start}&endDate=${end}`;
      } else if (kind === "period") {
        path = "/periods";
        payload = {
          propertyId: Number(value("property")),
          period: value("period"),
        };
      } else if (kind === "closePeriod") {
        path = "/periods/" + dialog.row?.id + "/close";
        payload = { version: dialog.row?.version, note: value("reason") };
        if (!closingCheck.data || closingCheck.data.blockingCount > 0)
          throw Error("Cần xử lý các lỗi đối soát trước khi khóa.");
      } else if (kind === "reverseIncome") {
        path = "/workspace/income/" + dialog.row?.source_id + "/reverse";
        payload = { version: 0, reason: value("reason") };
      } else {
        const row = dialog.row!;
        path =
          kind === "submit"
            ? `/workspace/vouchers/${row.id}/submit`
            : `/vouchers/${row.id}/${kind}`;
        payload =
          kind === "pay"
            ? {
                version: row.version,
                paidAt: value("at"),
                reference: value("reference"),
                evidence: value("reason"),
              }
            : { version: row.version, reason: value("reason") };
        if (kind === "pay" && !received)
          throw Error("Chỉ ghi sổ khi đã trả tiền thực tế.");
      }
      const signature = JSON.stringify({ path, payload });
      if (attempt.current?.signature !== signature)
        attempt.current = { signature, key: crypto.randomUUID() };
      await apiClient.post(
        kind === "closePeriod" ? `/accountant${path}` : `${base}${path}`,
        payload,
        {
          headers: { "Idempotency-Key": attempt.current.key },
        },
      );
      await client.invalidateQueries();
      setDialog(undefined);
      attempt.current = undefined;
    } catch (e) {
      setError(apiErrorMessage(e, e instanceof Error ? e.message : undefined));
    } finally {
      latch.current = false;
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      const r = await apiClient.get<Blob>(`${base}/workspace/export`, {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(r.data),
        a = document.createElement("a");
      a.href = url;
      a.download = `tai-chinh-${tab}-${start}-${end}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-[1650px] space-y-5 p-2 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Tài chính / {tabs.find((t) => t[0] === tab)?.[1]}
          </p>
          <h1 className="text-2xl font-bold">Tài chính và sổ quỹ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi tiền thực tế và nghĩa vụ từ cùng chứng từ nguồn
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            className={field}
            disabled={busy}
            onClick={() => void download()}
          >
            {tab === "deposits"
              ? "Xuất sổ cọc (toàn bộ phạm vi)"
              : "Xuất Excel"}
          </button>
          <button className={field} onClick={() => window.print()}>
            In trang hiện tại / Lưu PDF
          </button>
        </div>
      </div>
      <nav
        className="flex flex-wrap gap-2 print:hidden"
        aria-label="Phân hệ tài chính"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === id ? "bg-primary hover:bg-primary-hover text-white" : "border bg-card"}`}
            onClick={() => changeTab(id)}
          >
            {label}
          </button>
        ))}
        <Link
          className="rounded-xl border px-3 py-2 text-sm"
          href={
            portal === "admin" ? "/admin/invoices/debt" : "/accountant/debts"
          }
        >
          Công nợ và hóa đơn
        </Link>
      </nav>
      <section className="grid gap-3 surface-card p-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        <label className="text-sm">
          Công ty (nhóm vận hành hiện tại)
          <select
            aria-label="Công ty tài chính"
            className={field}
            value={organizationId ?? ""}
            onChange={(e) => {
              setOrganizationId(Number(e.target.value) || undefined);
              setAreaId(undefined);
              setPropertyId(undefined);
              setPage(0);
            }}
          >
            <option value="">Tất cả công ty trong phạm vi quyền</option>
            {[
              ...new Map(
                data?.properties
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
            aria-label="Khu quản lý tài chính"
            className={field}
            value={areaId ?? ""}
            onChange={(e) => {
              setAreaId(Number(e.target.value) || undefined);
              setPropertyId(undefined);
              setPage(0);
            }}
          >
            <option value="">Tất cả khu trong phạm vi quyền</option>
            {[
              ...new Map(
                data?.properties
                  .filter(
                    (p) =>
                      p.areaId &&
                      (!organizationId || p.organizationId === organizationId),
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
            aria-label="Nhà trọ tài chính"
            className={field}
            value={propertyId ?? ""}
            onChange={(e) => {
              setPropertyId(Number(e.target.value) || undefined);
              setPage(0);
            }}
          >
            <option value="">Tất cả trong phạm vi quyền</option>
            {data?.properties
              .filter(
                (p) =>
                  (!organizationId || p.organizationId === organizationId) &&
                  (!areaId || p.areaId === areaId),
              )
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm">
          Từ ngày
          <input
            aria-label="Từ ngày"
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
            aria-label="Đến ngày"
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
          Chọn tháng
          <input
            type="month"
            className={field}
            value={start.slice(0, 7)}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              if (y && m) {
                setStart(`${e.target.value}-01`);
                setEnd(date(new Date(y, m, 0)));
                setPage(0);
              }
            }}
          />
        </label>
      </section>
      <p className="rounded-xl bg-muted p-3 text-sm text-secondary-foreground">
        Báo cáo quản trị nội bộ, không phải lợi nhuận kế toán hay số dư ngân
        hàng được xác nhận. Thu/chi tính theo ngày nhận/trả; nghĩa vụ theo kỳ
        hóa đơn. Cọc đang giữ và công nợ là số hiện tại, không cộng vào doanh
        thu thuê.
      </p>
      {error && !dialog && (
        <p role="alert" className="rounded-xl bg-danger-muted p-3 text-danger">
          {error}
        </p>
      )}
      {query.isLoading ? (
        <PageLoading />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        data && (
          <>
            {tab === "overview" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["periodInvoiceObligations", "Nghĩa vụ hóa đơn kỳ sử dụng"],
                    ["cashIn", "Tiền thực thu trong kỳ"],
                    ["outstandingDebt", "Công nợ hiện tại"],
                    ["confirmedCosts", "Chi phí đã xác nhận trong kỳ"],
                    ["cashOut", "Tiền thực chi trong kỳ"],
                    ["netCashFlow", "Dòng tiền thuần trong kỳ"],
                    ["heldDeposits", "Tiền cọc đang giữ hiện tại"],
                    ["pendingVouchers", "Phiếu chi chờ duyệt"],
                  ].map(([key, label]) => (
                    <div key={key} className="surface-card p-4">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <strong className="mt-2 block text-xl">
                        {key === "pendingVouchers"
                          ? data.summary[key]
                          : formatCurrency(data.summary[key])}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <Chart
                    title="Thu chi theo tháng"
                    rows={data.trend}
                    label="period"
                  />
                  <Chart
                    title="Dòng tiền theo nhà trọ"
                    rows={data.byProperty}
                    label="name"
                  />
                  <section className="surface-card p-4">
                    <h2 className="font-bold">Cơ cấu chi phí đã xác nhận</h2>
                    {data.costCategories.length ? (
                      data.costCategories.map((r) => (
                        <p
                          key={String(r.category)}
                          className="mt-3 flex justify-between gap-3 text-sm"
                        >
                          <span>
                            {categories[String(r.category)] ?? r.category}
                          </span>
                          <strong>{formatCurrency(Number(r.amount))}</strong>
                        </p>
                      ))
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Chưa có chi phí trong kỳ.
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}
            {tab === "overview" && (
              <section className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
                {data.funds?.map((r) => (
                  <p
                    key={String(r.method)}
                    className="rounded-lg bg-warning-muted p-3 text-sm"
                  >
                    {r.method === "CASH" ? "Quỹ tiền mặt" : "Sổ chuyển khoản"}{" "}
                    từ nguồn đến hết kỳ:{" "}
                    <strong>{formatCurrency(Number(r.closing))}</strong>
                    <span className="block text-xs text-warning">
                      Số dư chưa xác minh với kiểm kê / sao kê
                    </span>
                  </p>
                ))}
                <button
                  className="rounded-lg border p-3 text-sm"
                  onClick={() => changeTab("vouchers")}
                >
                  Phiếu chờ duyệt: {data.summary.pendingVouchers ?? 0}
                </button>
                <button
                  className="rounded-lg border p-3 text-sm"
                  onClick={() => changeTab("deposits")}
                >
                  Cọc cần hoàn:{" "}
                  {formatCurrency(data.summary.refundsPayable ?? 0)}
                </button>
                <button
                  className="rounded-lg border p-3 text-sm"
                  onClick={() => changeTab("reconciliation")}
                >
                  Kiểm tra đối soát
                </button>
              </section>
            )}
            {ledger && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["opening", "Đầu kỳ từ nguồn đã ghi"],
                    ["incoming", "Thực thu trong kỳ"],
                    ["outgoing", "Thực chi trong kỳ"],
                    ["closing", "Cuối kỳ từ nguồn đã ghi"],
                  ].map(([k, label]) => (
                    <div className="rounded-xl border bg-card p-4" key={k}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <strong>
                        {formatCurrency(data.ledger[k as "opening"])}
                      </strong>
                    </div>
                  ))}
                </div>
                <p className="rounded-xl bg-warning-muted p-3 text-sm text-amber-900">
                  Cần xác minh số dư đầu kỳ với kiểm kê/sao kê: đây là tổng giao
                  dịch hợp lệ đã ghi trong hệ thống, chưa có số dư khởi tạo được
                  kiểm chứng. Số dư lũy kế giữ toàn bộ giao dịch của quỹ trong
                  kỳ dù bảng đang lọc.{" "}
                  {tab === "bankbook" &&
                    "Giao dịch được xác nhận thủ công, chưa đồng nghĩa đã đối soát với ngân hàng; chưa chia theo từng tài khoản ngân hàng."}
                </p>
              </>
            )}
            {tab === "deposits" ? (
              <DepositLedgerPanel
                portal={portal}
                propertyId={propertyId}
                propertyIds={data.propertyIds}
              />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 print:hidden">
                  <input
                    className={`${field} max-w-sm`}
                    placeholder="Tìm mã chứng từ hoặc nhà trọ"
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      setPage(0);
                    }}
                  />
                  <select
                    aria-label="Trạng thái chứng từ"
                    className={`${field} max-w-xs`}
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(statuses).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {!["periods", "reconciliation", "history"].includes(tab) && (
                    <select
                      aria-label="Nhóm thu chi"
                      className={`${field} max-w-xs`}
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">Tất cả nhóm thu chi</option>
                      {Object.entries(categories).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                  {!ledger &&
                    !["periods", "reconciliation", "history"].includes(tab) && (
                      <select
                        aria-label="Phương thức"
                        className={`${field} max-w-xs`}
                        value={method}
                        onChange={(e) => {
                          setMethod(e.target.value);
                          setPage(0);
                        }}
                      >
                        <option value="">Mọi phương thức</option>
                        <option value="CASH">Tiền mặt</option>
                        <option value="BANK_TRANSFER">Chuyển khoản</option>
                      </select>
                    )}
                  <button
                    className="rounded-xl border px-3"
                    onClick={() => void query.refetch()}
                  >
                    Tải lại
                  </button>
                  {tab === "vouchers" && data.permissions.createVoucher && (
                    <button
                      className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-white"
                      onClick={() => open("voucher")}
                    >
                      Lập đề nghị chi
                    </button>
                  )}
                  {tab === "receipts" && data.permissions.recordIncome && (
                    <button
                      className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-white"
                      onClick={() => open("income")}
                    >
                      Ghi khoản thu khác
                    </button>
                  )}
                  {tab === "reconciliation" && (
                    <button
                      disabled={!propertyId}
                      className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-white disabled:opacity-40"
                      onClick={() => open("reconcile")}
                    >
                      Chạy đối soát nguồn
                    </button>
                  )}
                  {tab === "periods" && portal === "accountant" && (
                    <button
                      className="rounded-xl border px-4 py-2"
                      onClick={() => open("period")}
                    >
                      Chuẩn bị kỳ
                    </button>
                  )}
                </div>
                {tab === "receipts" && (
                  <p className="text-sm text-muted-foreground">
                    Phiếu thu hóa đơn và tiền cọc tham chiếu giao dịch gốc.
                    In/xem phiếu không phát sinh lần thu thứ hai. Ghi khoản thu
                    khác chỉ dùng cho sự kiện chưa ghi ở hóa đơn hoặc sổ cọc.
                  </p>
                )}
                {tab === "expenses" && (
                  <p className="text-sm text-muted-foreground">
                    Chi phí đã xác nhận khác tiền đã trả. Tạo đề nghị chi liên
                    kết chi phí nguồn để không cộng lặp. Mua tài sản tách khỏi
                    chi phí vận hành.
                  </p>
                )}
                <div className="overflow-x-auto surface-card">
                  <table className="w-full min-w-[850px] text-left text-sm">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        {[
                          "Chứng từ / ngày",
                          "Nhà trọ / người xử lý",
                          "Phân loại / trạng thái",
                          ledger || tab === "receipts" || tab === "overview"
                            ? "Tiền vào / ra"
                            : "Số tiền / còn phải trả",
                          "Nguồn / thao tác",
                        ].map((h) => (
                          <th className="p-3" key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, i) => {
                        const id = String(
                          r.id ?? `${r.source_type}-${r.source_id}`,
                        );
                        return (
                          <tr key={`${id}-${i}`} className="border-t align-top">
                            <td className="p-3">
                              <strong>{r.code}</strong>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(String(r.event_date), true)}
                              </p>
                              <button
                                className="mt-2 text-link print:hidden"
                                onClick={() =>
                                  setExpanded(expanded === id ? undefined : id)
                                }
                              >
                                Chi tiết chứng từ
                              </button>
                              {expanded === id && (
                                <div className="mt-2 max-w-sm space-y-2 break-words">
                                  <p>{r.content}</p>
                                  <p>
                                    Mã tham chiếu:{" "}
                                    {r.reference_code ?? "Chưa có"}
                                  </p>
                                  {r.source_type && (
                                    <p>
                                      Nguồn: {r.source_type} #{r.source_id}
                                    </p>
                                  )}
                                  {r.running_balance != null && (
                                    <p>
                                      Lũy kế từ nguồn:{" "}
                                      {formatCurrency(
                                        Number(r.running_balance),
                                      )}
                                    </p>
                                  )}
                                  {r.findings_json && (
                                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                                      {String(r.findings_json)}
                                    </pre>
                                  )}
                                  {tab === "vouchers" && (
                                    <VoucherEvidence
                                      base={base}
                                      id={Number(r.id)}
                                    />
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {r.property_name}
                              <p className="text-xs text-muted-foreground">
                                {r.actor_name ?? r.payee_name ?? "—"}
                              </p>
                            </td>
                            <td className="p-3">
                              {categories[String(r.category)] ?? r.category}
                              <span
                                className={`mt-1 block rounded-lg px-2 py-1 text-xs ${r.status === "NEEDS_REVIEW" ? "bg-warning-muted text-amber-900" : "bg-muted text-secondary-foreground"}`}
                              >
                                {statuses[String(r.status)] ?? r.status}
                              </span>
                              {r.method && (
                                <small>
                                  {r.method === "CASH"
                                    ? "Tiền mặt"
                                    : r.method === "BANK_TRANSFER"
                                      ? "Chuyển khoản"
                                      : r.method}
                                </small>
                              )}
                            </td>
                            <td className="p-3">
                              {r.cash_in != null ? (
                                <>
                                  <p>
                                    Vào: {formatCurrency(Number(r.cash_in))}
                                  </p>
                                  <p>
                                    Ra: {formatCurrency(Number(r.cash_out))}
                                  </p>
                                </>
                              ) : r.amount != null ? (
                                <>
                                  <strong>
                                    {formatCurrency(Number(r.amount))}
                                  </strong>
                                  {r.payable != null && (
                                    <p>
                                      Còn trả:{" "}
                                      {formatCurrency(Number(r.payable))}
                                    </p>
                                  )}
                                </>
                              ) : r.blocking_count != null ? (
                                <p>{r.blocking_count} lỗi cần xử lý</p>
                              ) : (
                                <p>
                                  {r.start_date} → {r.end_date}
                                </p>
                              )}
                            </td>
                            <td className="space-y-2 p-3 print:hidden">
                              {tab === "vouchers" && (
                                <>
                                  {r.status === "DRAFT" &&
                                    Number(r.created_by) === user?.id &&
                                    r.canSubmit !== false && (
                                      <Action
                                        label="Gửi duyệt"
                                        run={() => open("submit", r)}
                                      />
                                    )}{" "}
                                  {r.status === "PENDING_APPROVAL" &&
                                    user?.activeRole === "OWNER" &&
                                    r.canApprove !== false &&
                                    Number(r.created_by) !== user.id && (
                                      <>
                                        <Action
                                          label="Duyệt"
                                          run={() => open("approve", r)}
                                        />
                                        <Action
                                          label="Từ chối"
                                          run={() => open("reject", r)}
                                        />
                                      </>
                                    )}
                                  {r.status === "APPROVED" &&
                                    r.canPay !== false && (
                                      <Action
                                        label="Xác nhận thực chi"
                                        run={() => open("pay", r)}
                                      />
                                    )}{" "}
                                  {r.status === "PAID" &&
                                    user?.activeRole === "OWNER" && (
                                      <Action
                                        label="Đảo chứng từ"
                                        run={() => open("reverse", r)}
                                      />
                                    )}
                                </>
                              )}
                              {tab === "periods" &&
                                portal === "accountant" &&
                                r.status === "OPEN" && (
                                  <Action
                                    label="Kiểm tra và khóa kỳ"
                                    run={() => open("closePeriod", r)}
                                  />
                                )}
                              {tab === "receipts" &&
                                r.source_type === "OTHER_INCOME" &&
                                user?.activeRole === "OWNER" && (
                                  <Action
                                    label="Đảo khoản thu"
                                    run={() => open("reverseIncome", r)}
                                  />
                                )}
                              {r.source_type === "PAYMENT" && (
                                <Link
                                  className="text-link"
                                  href={
                                    portal === "admin"
                                      ? "/admin/invoices"
                                      : `/accountant/payments/${r.source_id}`
                                  }
                                >
                                  Giao dịch nguồn
                                </Link>
                              )}
                              {r.source_type === "DEPOSIT" && (
                                <button
                                  className="text-link"
                                  onClick={() => changeTab("deposits")}
                                >
                                  Sổ cọc
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!data.rows.length && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-8 text-center text-muted-foreground"
                          >
                            Không có chứng từ trong bộ lọc này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between text-sm print:hidden">
                  <span>{data.totalElements} chứng từ</span>
                  <div className="flex gap-2">
                    <button
                      className="rounded-lg border px-3 py-2 disabled:opacity-40"
                      disabled={!page}
                      onClick={() => setPage(page - 1)}
                    >
                      Trước
                    </button>
                    <span className="p-2">
                      {page + 1} / {Math.max(1, data.totalPages)}
                    </span>
                    <button
                      className="rounded-lg border px-3 py-2 disabled:opacity-40"
                      disabled={page + 1 >= data.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )
      )}
      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chứng từ tài chính"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <form
            onSubmit={(e) => void submit(e)}
            className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-card p-6"
          >
            <h2 className="text-xl font-bold">
              {
                (
                  {
                    voucher: "Lập đề nghị chi",
                    income: "Ghi nhận khoản thu thực tế",
                    approve: "Duyệt phiếu chi",
                    reject: "Từ chối phiếu chi",
                    pay: "Xác nhận thực chi",
                    reverse: "Đảo chứng từ",
                    submit: "Gửi đề nghị chi",
                    reconcile: "Đối soát nguồn dữ liệu",
                    period: "Chuẩn bị kỳ tài chính",
                    closePeriod: "Kiểm tra và khóa kỳ",
                    reverseIncome: "Đảo khoản thu khác",
                  } as Record<string, string>
                )[dialog.kind]
              }
            </h2>
            <p className="text-sm text-muted-foreground">
              {dialog.row?.code}{" "}
              {dialog.row?.amount && formatCurrency(Number(dialog.row.amount))}.
              Đề nghị và phê duyệt chưa phát sinh dòng tiền; chỉ xác nhận thực
              chi khi đã trả tiền.
            </p>
            {["voucher", "income", "period"].includes(dialog.kind) && (
              <label className="block text-sm">
                Nhà trọ
                <select
                  required
                  name="property"
                  className={field}
                  defaultValue={propertyId ?? ""}
                >
                  <option value="">Chọn nhà trọ</option>
                  {data?.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {dialog.kind === "period" ? (
              <label className="block text-sm">
                Kỳ
                <input
                  name="period"
                  type="month"
                  required
                  defaultValue={start.slice(0, 7)}
                  className={field}
                />
              </label>
            ) : (
              ["voucher", "income"].includes(dialog.kind) && (
                <>
                  <label className="block text-sm">
                    Số tiền
                    <CurrencyInput
                      name="amount"
                      required
                      min={0.01}
                      step={0.01}
                      className={field}
                    />
                  </label>
                  {dialog.kind === "voucher" && (
                    <>
                      <label className="block text-sm">
                        Người nhận
                        <input
                          required
                          name="payee"
                          maxLength={200}
                          className={field}
                        />
                      </label>
                      <label className="block text-sm">
                        ID chi phí nguồn (nếu đã có)
                        <IntegerInput
                          name="expense"
                          type="number"
                          min={1}
                          className={field}
                        />
                      </label>
                    </>
                  )}
                  <label className="block text-sm">
                    Phân loại
                    <select name="category" className={field}>
                      {(dialog.kind === "voucher"
                        ? Object.entries(categories).slice(0, 9)
                        : [
                            ["OTHER_INCOME", "Thu nhập khác"],
                            ["SERVICE_OTHER", "Dịch vụ khác"],
                            ["COMPENSATION", "Bồi thường"],
                            [
                              "PREPAYMENT",
                              "Khách trả trước (không phải doanh thu)",
                            ],
                            [
                              "COLLECTION_ON_BEHALF",
                              "Thu hộ (không phải doanh thu)",
                            ],
                          ]
                      ).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    Phương thức
                    <select name="method" className={field}>
                      <option value="CASH">Tiền mặt</option>
                      <option value="BANK_TRANSFER">Chuyển khoản</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Ngày chứng từ
                    <input
                      required
                      name="date"
                      type="date"
                      defaultValue={date()}
                      className={field}
                    />
                  </label>
                </>
              )
            )}
            {dialog.kind === "pay" && (
              <label className="block text-sm">
                Thời điểm thực chi
                <input
                  required
                  name="at"
                  type="datetime-local"
                  defaultValue={`${date()}T${new Date().toTimeString().slice(0, 5)}:00`}
                  className={field}
                />
              </label>
            )}
            {["pay", "income"].includes(dialog.kind) && (
              <label className="block text-sm">
                Mã giao dịch / chứng từ nguồn
                <input
                  name="reference"
                  required
                  maxLength={100}
                  className={field}
                />
              </label>
            )}
            {!["reconcile", "period"].includes(dialog.kind) && (
              <label className="block text-sm">
                Nội dung, lý do và căn cứ
                <textarea
                  name="reason"
                  required
                  maxLength={500}
                  className={field}
                />
              </label>
            )}
            {["pay", "income"].includes(dialog.kind) && (
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={received}
                  onChange={(e) => setReceived(e.target.checked)}
                />
                Tôi đã nhận / trả tiền thực tế và kiểm tra chứng từ nguồn
              </label>
            )}
            {dialog.kind === "reconcile" && (
              <p className="text-sm text-warning">
                Kiểm tra tính nhất quán toàn bộ chứng từ của nhà trọ, lưu kỳ yêu
                cầu để truy vết. Không tự sửa số dư hoặc xác nhận khớp ngân
                hàng.
              </p>
            )}
            {dialog.kind === "closePeriod" && (
              <div className="rounded-xl bg-warning-muted p-3 text-sm">
                {closingCheck.isLoading ? (
                  "Đang kiểm tra điều kiện khóa..."
                ) : closingCheck.isError ? (
                  "Không tải được điều kiện khóa; vui lòng tải lại."
                ) : (
                  <>
                    Có {closingCheck.data?.blockingCount} lỗi chặn.
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                      {JSON.stringify(
                        closingCheck.data?.findings ?? [],
                        null,
                        2,
                      )}
                    </pre>
                  </>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2"
                disabled={busy}
                onClick={() => setDialog(undefined)}
              >
                Đóng
              </button>
              <button
                disabled={
                  busy ||
                  (dialog.kind === "closePeriod" &&
                    (!closingCheck.data ||
                      closingCheck.data.blockingCount > 0)) ||
                  (["pay", "income"].includes(dialog.kind) && !received)
                }
                className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-white disabled:opacity-40"
              >
                {busy ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
function Action({ label, run }: { label: string; run: () => void }) {
  return (
    <button
      className="block rounded-lg border px-3 py-2 text-link"
      onClick={run}
    >
      {label}
    </button>
  );
}
function Chart({
  title,
  rows,
  label,
}: {
  title: string;
  rows: Row[];
  label: string;
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((r) => [
      Number(r.cashIn ?? r.incoming ?? 0),
      Number(r.cashOut ?? r.outgoing ?? 0),
    ]),
  );
  return (
    <section className="surface-card p-4">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Thu (xanh) · Chi (cam), có nhãn số tiền
      </p>
      {rows.length ? (
        rows.map((r, i) => (
          <div className="mt-4 space-y-1 text-xs" key={i}>
            <strong>{r[label]}</strong>
            <div
              className="h-2 rounded bg-blue-500"
              style={{
                width: `${(Number(r.cashIn ?? r.incoming ?? 0) / max) * 100}%`,
              }}
            />
            <p>Thu {formatCurrency(Number(r.cashIn ?? r.incoming ?? 0))}</p>
            <div
              className="h-2 rounded bg-orange-400"
              style={{
                width: `${(Number(r.cashOut ?? r.outgoing ?? 0) / max) * 100}%`,
              }}
            />
            <p>Chi {formatCurrency(Number(r.cashOut ?? r.outgoing ?? 0))}</p>
          </div>
        ))
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Chưa có dòng tiền trong kỳ.
        </p>
      )}
    </section>
  );
}
