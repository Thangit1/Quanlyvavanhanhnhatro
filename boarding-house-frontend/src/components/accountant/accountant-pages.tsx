"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FilePlus2,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import {
  useAccountantAccount,
  useAccountantActions,
  useAccountantDashboard,
  useAccountantDetail,
  useAccountantNotifications,
  useAccountantResource,
} from "@/hooks/use-accountant";
import { useAccountantScope } from "./accountant-scope";
import type { AccountantResource, ApiPage } from "@/types/accountant";
import { formatCurrency } from "@/lib/format";
import { apiErrorMessage as getApiErrorMessage } from "@/lib/api-error";

const labels: Record<
  AccountantResource,
  { title: string; subtitle: string; empty: string }
> = {
  invoices: {
    title: "Quản lý hóa đơn",
    subtitle: "Kiểm tra, phát hành và theo dõi tình trạng thanh toán",
    empty: "Chưa có hóa đơn trong phạm vi và kỳ đã chọn.",
  },
  payments: {
    title: "Thanh toán",
    subtitle: "Ghi nhận tiền thu và phân bổ trực tiếp vào hóa đơn",
    empty: "Chưa có giao dịch thanh toán.",
  },
  "payment-proofs": {
    title: "Minh chứng chuyển khoản",
    subtitle: "Duyệt thủ công; hệ thống không tự phê duyệt",
    empty: "Không có minh chứng đang chờ xử lý.",
  },
  receipts: {
    title: "Biên lai thu",
    subtitle: "Tra cứu chứng từ thu đã phát hành",
    empty: "Chưa có biên lai trong kỳ.",
  },
  debts: {
    title: "Công nợ người thuê",
    subtitle: "Theo dõi tuổi nợ, nhắc nợ và cam kết thanh toán",
    empty: "Không có công nợ trong phạm vi đã chọn.",
  },
  deposits: {
    title: "Quản lý tiền cọc",
    subtitle: "Tiền cọc được theo dõi riêng và không ghi nhận là doanh thu",
    empty: "Chưa có hồ sơ tiền cọc.",
  },
  "payment-vouchers": {
    title: "Phiếu chi",
    subtitle: "Lập phiếu và gửi người có thẩm quyền duyệt",
    empty: "Chưa có phiếu chi.",
  },
  expenses: {
    title: "Chi phí",
    subtitle: "Theo dõi chứng từ chi phí vận hành",
    empty: "Chưa có chi phí.",
  },
  "other-income": {
    title: "Khoản thu khác",
    subtitle: "Các khoản thu ngoài hóa đơn thuê phòng",
    empty: "Chưa có khoản thu khác trong kỳ.",
  },
  periods: {
    title: "Kỳ kế toán",
    subtitle: "Kiểm tra và khóa sổ theo từng khu trọ",
    empty: "Chưa có kỳ kế toán.",
  },
  cashbook: {
    title: "Sổ quỹ tiền mặt",
    subtitle: "Các khoản thu chi bằng tiền mặt theo thứ tự thời gian",
    empty: "Chưa có bút toán tiền mặt.",
  },
  bankbook: {
    title: "Sổ ngân hàng",
    subtitle: "Các khoản thu chi không dùng tiền mặt",
    empty: "Chưa có bút toán ngân hàng.",
  },
  "cash-flow": {
    title: "Dòng tiền",
    subtitle: "Tổng hợp luồng tiền vào và ra từ dữ liệu thực tế",
    empty: "Chưa có dữ liệu dòng tiền.",
  },
  reports: {
    title: "Báo cáo tài chính",
    subtitle: "Doanh thu, chi phí, công nợ và tuổi nợ",
    empty: "Chưa có dữ liệu báo cáo.",
  },
  exports: {
    title: "Xuất dữ liệu",
    subtitle: "Chuẩn bị dữ liệu tài chính trong phạm vi được giao",
    empty: "Chưa có dữ liệu để xuất.",
  },
  "reconciliation/bank": {
    title: "Đối soát ngân hàng",
    subtitle: "Đối chiếu thủ công giao dịch ngân hàng với thanh toán",
    empty: "Chưa cấu hình tài khoản hoặc chưa nhập giao dịch ngân hàng.",
  },
  "reconciliation/payment-gateways": {
    title: "Đối soát cổng thanh toán",
    subtitle: "Theo dõi các cổng thanh toán đã kết nối",
    empty: "Chưa có cổng thanh toán được cấu hình.",
  },
};
const statusText: Record<string, string> = {
  DRAFT: "Bản nháp",
  ISSUED: "Đã phát hành",
  UNPAID: "Chờ thanh toán",
  PARTIALLY_PAID: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  CANCELLED: "Đã hủy",
  CONFIRMED: "Đã xác nhận",
  REVERSED: "Đã đảo",
  PENDING: "Chờ xử lý",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  OPEN: "Đang mở",
  CLOSED: "Đã khóa",
  PENDING_APPROVAL: "Chờ duyệt",
  HELD: "Đang giữ",
  PARTIAL: "Chưa đủ",
  SETTLED: "Đã tất toán",
};
const fmt = (key: string, value: unknown) => {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "object") return JSON.stringify(value);
  if (/amount|debit|credit|debt|collected|spent/i.test(key))
    return formatCurrency(Number(value));
  if (/date|_at$|period/i.test(key)) {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime()))
      return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: key.endsWith("_at") ? "short" : undefined,
      }).format(d);
  }
  return statusText[String(value)] ?? String(value);
};
const nice = (key: string) =>
  ({
    code: "Mã",
    invoice_code: "Hóa đơn",
    receipt_code: "Mã thu",
    voucher_code: "Mã phiếu",
    tenant_name: "Người thuê",
    room_code: "Phòng",
    property_name: "Khu trọ",
    total_amount: "Tổng tiền",
    paid_amount: "Đã thu",
    remaining_amount: "Còn nợ",
    amount: "Số tiền",
    status: "Trạng thái",
    due_date: "Hạn thanh toán",
    paid_at: "Ngày thu",
    created_at: "Ngày tạo",
    entry_type: "Loại",
    debit: "Thu",
    credit: "Chi",
    description: "Nội dung",
    period_code: "Kỳ",
    payee_name: "Người nhận",
  })[key] ?? key.replaceAll("_", " ");

export function AccountantDashboardPage() {
  const scope = useAccountantScope();
  const query = useAccountantDashboard({
    propertyId: scope.propertyId,
    period: scope.period,
  });
  if (query.isLoading) return <Loading />;
  if (query.isError)
    return (
      <ErrorState
        retry={() => void query.refetch()}
        text={getApiErrorMessage(query.error)}
      />
    );
  const d = query.data!;
  const s = d.summary ?? { collected: 0, spent: 0, debt: 0, pending_proofs: 0 };
  return (
    <Main
      title="Tổng quan tài chính"
      subtitle={`Kỳ ${scope.period} · số liệu lấy trực tiếp từ backend`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Đã thu trong kỳ"
          value={formatCurrency(Number(s.collected ?? 0))}
          icon={TrendingUp}
        />
        <Metric
          label="Đã chi trong kỳ"
          value={formatCurrency(Number(s.spent ?? 0))}
          icon={TrendingDown}
        />
        <Metric
          label="Công nợ còn lại"
          value={formatCurrency(Number(s.debt ?? 0))}
          icon={WalletCards}
        />
        <Metric
          label="Minh chứng chờ duyệt"
          value={String(s.pending_proofs ?? 0)}
          icon={ShieldCheck}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Thanh toán gần đây">
          <MiniRows rows={d.recentPayments} />
        </Panel>
        <Panel title="Hóa đơn quá hạn">
          <MiniRows rows={d.overdueInvoices} />
        </Panel>
      </div>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <b>Trợ lý AI:</b> {d.ai.reason}
      </div>
    </Main>
  );
}

export function AccountantResourcePage({
  resource,
}: {
  resource: AccountantResource;
}) {
  const meta = labels[resource];
  const scope = useAccountantScope();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<"payment" | "voucher" | null>(null);
  const query = useAccountantResource(resource, {
    propertyId: scope.propertyId,
    period: scope.period,
    keyword: keyword || undefined,
    status: status || undefined,
    page,
    size: 20,
  });
  const payload = query.data as ApiPage | Record<string, unknown> | undefined;
  const rows: Record<string, unknown>[] = Array.isArray(
    (payload as ApiPage | undefined)?.content,
  )
    ? (payload as ApiPage).content
    : Array.isArray(payload)
      ? (payload as Record<string, unknown>[])
      : payload && resource === "reports"
        ? [payload as Record<string, unknown>]
        : [];
  const total = (payload as ApiPage | undefined)?.totalElements ?? rows.length;
  return (
    <Main
      title={meta.title}
      subtitle={meta.subtitle}
      actions={
        <>
          {resource === "payments" && (
            <Primary onClick={() => setModal("payment")}>
              <CircleDollarSign className="size-4" />
              Ghi nhận thanh toán
            </Primary>
          )}
          {resource === "payment-vouchers" && (
            <Primary onClick={() => setModal("voucher")}>
              <FilePlus2 className="size-4" />
              Lập phiếu chi
            </Primary>
          )}
        </>
      }
    >
      <div className="mb-5 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-3 size-4 text-slate-400" />
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(0);
            }}
            placeholder="Tìm theo mã, phòng hoặc người thuê"
            className="min-h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </label>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          {[
            "DRAFT",
            "ISSUED",
            "PARTIALLY_PAID",
            "PAID",
            "OVERDUE",
            "CONFIRMED",
            "PENDING",
            "APPROVED",
            "REJECTED",
            "OPEN",
            "CLOSED",
          ].map((x) => (
            <option key={x} value={x}>
              {statusText[x]}
            </option>
          ))}
        </select>
        <button
          onClick={() => void query.refetch()}
          className="rounded-xl border border-slate-200 px-3 hover:bg-slate-50"
          aria-label="Tải lại"
        >
          <RefreshCw
            className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
          />
        </button>
      </div>
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          retry={() => void query.refetch()}
          text={getApiErrorMessage(query.error)}
        />
      ) : rows.length === 0 ? (
        <Empty text={meta.empty} />
      ) : (
        <DataTable resource={resource} rows={rows} />
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{total} bản ghi</span>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Trước
          </button>
          <button
            disabled={(page + 1) * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>
      {modal && (
        <CreateDialog
          type={modal}
          close={() => setModal(null)}
          propertyId={scope.propertyId}
        />
      )}
    </Main>
  );
}

export function AccountantDetailPage({ resource }: { resource: string }) {
  const params = useParams();
  const id = Number(
    params.id ??
      params.invoiceId ??
      params.paymentId ??
      params.receiptId ??
      params.voucherId ??
      params.tenantId,
  );
  const query = useAccountantDetail(resource, id);
  const actions = useAccountantActions();
  const data = query.data;
  const run = (action: string, payload: object, key?: string) =>
    actions.action.mutate(
      { resource, id, action, payload, key },
      { onSuccess: () => void query.refetch() },
    );
  if (query.isLoading) return <Loading />;
  if (query.isError || !data)
    return (
      <ErrorState
        retry={() => void query.refetch()}
        text={getApiErrorMessage(query.error)}
      />
    );
  return (
    <Main
      title={String(
        data.code ??
          data.receipt_code ??
          data.voucher_code ??
          `Chi tiết #${id}`,
      )}
      subtitle="Dữ liệu chứng từ và dấu vết xử lý từ backend"
      actions={
        <div className="flex gap-2">
          {resource === "invoices" && data.status === "DRAFT" && (
            <Primary
              onClick={() => run("issue", { version: Number(data.version) })}
            >
              Phát hành
            </Primary>
          )}
          {resource === "payment-proofs" && data.status === "PENDING" && (
            <>
              <Primary
                onClick={() =>
                  run(
                    "approve",
                    {
                      version: 0,
                      note: "Đã đối chiếu thủ công",
                      issueReceipt: true,
                    },
                    crypto.randomUUID(),
                  )
                }
              >
                Duyệt
              </Primary>
              <button
                onClick={() => {
                  const reason = prompt("Lý do từ chối");
                  if (reason) run("reject", { version: 0, reason });
                }}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
              >
                Từ chối
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(data)
          .filter(([, v]) => typeof v !== "object")
          .map(([k, v]) => (
            <div
              key={k}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {nice(k)}
              </p>
              <p className="mt-2 break-words font-semibold text-slate-900">
                {fmt(k, v)}
              </p>
            </div>
          ))}
      </div>
      {Object.entries(data)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => (
          <Panel key={k} title={nice(k)}>
            <MiniRows rows={v as Record<string, unknown>[]} />
          </Panel>
        ))}
    </Main>
  );
}

export function AccountantNotificationsPage() {
  const query = useAccountantNotifications();
  return (
    <Main
      title="Thông báo kế toán"
      subtitle="Các sự kiện thu tiền, quá hạn và đối soát cần chú ý"
    >
      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          retry={() => void query.refetch()}
          text={getApiErrorMessage(query.error)}
        />
      ) : (
        <Panel title={`${query.data?.length ?? 0} thông báo`}>
          <MiniRows rows={query.data ?? []} />
        </Panel>
      )}
    </Main>
  );
}
export function AccountantAccountPage() {
  const query = useAccountantAccount();
  if (query.isLoading) return <Loading />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        retry={() => void query.refetch()}
        text={getApiErrorMessage(query.error)}
      />
    );
  const a = query.data;
  return (
    <Main
      title="Tài khoản kế toán"
      subtitle="Hồ sơ, quyền nghiệp vụ và phạm vi khu trọ"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Thông tin cá nhân">
          <dl className="space-y-4 text-sm">
            <Info label="Mã nhân viên" value={a.employee_code} />
            <Info label="Họ tên" value={a.full_name} />
            <Info label="Email" value={a.email} />
            <Info label="Điện thoại" value={a.phone ?? "—"} />
          </dl>
        </Panel>
        <Panel title="Phạm vi được giao">
          <div className="space-y-3">
            {a.properties.map((p) => (
              <div key={p.id} className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-slate-500">{p.address}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Main>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function DataTable({
  resource,
  rows,
}: {
  resource: AccountantResource;
  rows: Record<string, unknown>[];
}) {
  const preferred = [
    "code",
    "invoice_code",
    "receipt_code",
    "voucher_code",
    "tenant_name",
    "room_code",
    "property_name",
    "period_code",
    "amount",
    "total_amount",
    "paid_amount",
    "remaining_amount",
    "debit",
    "credit",
    "due_date",
    "paid_at",
    "voucher_date",
    "status",
  ];
  const keys = preferred
    .filter((k) => rows.some((r) => r[k] != null))
    .slice(0, 7);
  const base =
    resource === "payment-proofs"
      ? "payment-proofs"
      : resource === "receipts"
        ? "receipts"
        : resource === "payment-vouchers" || resource === "expenses"
          ? "payment-vouchers"
          : resource;
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {keys.map((k) => (
              <th key={k} className="px-4 py-3">
                {nice(k)}
              </th>
            ))}
            <th className="px-4 py-3 text-right">Chi tiết</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)} className="hover:bg-slate-50">
              {keys.map((k) => (
                <td
                  key={k}
                  className="whitespace-nowrap px-4 py-3 text-slate-700"
                >
                  {k === "status" ? (
                    <Status value={String(row[k])} />
                  ) : (
                    fmt(k, row[k])
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-right">
                {Boolean(row.id) &&
                  ![
                    "cashbook",
                    "bankbook",
                    "cash-flow",
                    "reports",
                    "exports",
                    "reconciliation/bank",
                    "reconciliation/payment-gateways",
                    "periods",
                  ].includes(resource) && (
                    <Link
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                      href={`/accountant/${base}/${row.id}`}
                    >
                      Xem <ArrowRight className="size-3" />
                    </Link>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CreateDialog({
  type,
  close,
  propertyId,
}: {
  type: "payment" | "voucher";
  close: () => void;
  propertyId?: number;
}) {
  const actions = useAccountantActions();
  const [error, setError] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const payload =
      type === "payment"
        ? {
            invoiceId: Number(f.get("invoiceId")),
            amount: Number(f.get("amount")),
            paymentMethod: f.get("method"),
            paidAt: new Date(String(f.get("date"))).toISOString().slice(0, 19),
            referenceCode: f.get("reference") || null,
            note: f.get("description") || null,
            issueReceipt: true,
          }
        : {
            propertyId: Number(f.get("propertyId")),
            payeeName: f.get("payeeName"),
            amount: Number(f.get("amount")),
            category: f.get("category"),
            paymentMethod: f.get("method"),
            voucherDate: f.get("date"),
            description: f.get("description"),
          };
    const mutation = type === "payment" ? actions.payment : actions.voucher;
    mutation.mutate(payload, {
      onSuccess: close,
      onError: (e) => setError(getApiErrorMessage(e)),
    });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {type === "payment" ? "Ghi nhận thanh toán" : "Lập phiếu chi"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Kiểm tra kỹ trước khi lưu chứng từ.
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Đóng">
            <X />
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          {type === "payment" ? (
            <Field name="invoiceId" label="ID hóa đơn" type="number" />
          ) : (
            <>
              <Field
                name="propertyId"
                label="ID khu trọ"
                type="number"
                defaultValue={propertyId}
              />
              <Field name="payeeName" label="Người nhận" />
            </>
          )}
          <Field name="amount" label="Số tiền" type="number" />
          <Field
            name="date"
            label="Ngày chứng từ"
            type={type === "payment" ? "datetime-local" : "date"}
          />
          {type === "voucher" && <Field name="category" label="Nhóm chi phí" />}
          <label className="text-sm font-medium">
            Phương thức
            <select
              name="method"
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3"
            >
              <option value="BANK_TRANSFER">Chuyển khoản</option>
              <option value="CASH">Tiền mặt</option>
              <option value="CARD">Thẻ</option>
              <option value="EWALLET">Ví điện tử</option>
            </select>
          </label>
          {type === "payment" && (
            <Field name="reference" label="Mã tham chiếu" required={false} />
          )}
          <Field name="description" label="Nội dung" />
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <Primary
            type="submit"
            disabled={actions.payment.isPending || actions.voucher.isPending}
          >
            Lưu chứng từ
          </Primary>
        </div>
      </form>
    </div>
  );
}
function Field({
  name,
  label,
  type = "text",
  defaultValue,
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: number;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={type === "number" ? "0.01" : undefined}
        step={type === "number" ? "0.01" : undefined}
        className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500"
      />
    </label>
  );
}
function Main({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">
            Tài chính / Kế toán
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </main>
  );
}
function Primary({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function MiniRows({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows?.length)
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Chưa có dữ liệu.
      </p>
    );
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((r, i) => (
        <div
          key={String(r.id ?? i)}
          className="flex items-center justify-between gap-3 py-3"
        >
          <div>
            <p className="font-semibold text-slate-800">
              {String(
                r.code ??
                  r.invoice_code ??
                  r.receipt_code ??
                  r.tenant_name ??
                  `#${r.id}`,
              )}
            </p>
            <p className="text-xs text-slate-500">
              {String(r.tenant_name ?? r.room_code ?? r.description ?? "")}
            </p>
          </div>
          <p className="font-bold text-slate-900">
            {fmt("amount", r.amount ?? r.remaining_amount ?? "")}
          </p>
        </div>
      ))}
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {statusText[value] ?? value}
    </span>
  );
}
function Loading() {
  return (
    <div className="grid min-h-64 place-items-center text-sm text-slate-500">
      <RefreshCw className="mb-2 size-6 animate-spin text-emerald-600" />
      Đang tải dữ liệu…
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <div>
        <CheckCircle2 className="mx-auto size-10 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}
function ErrorState({ retry, text }: { retry: () => void; text: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <div>
        <AlertCircle className="mx-auto size-10 text-red-500" />
        <p className="mt-3 font-semibold text-red-800">{text}</p>
        <button
          onClick={retry}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
