"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, DoorOpen, CalendarClock } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  AccountModal,
  AccountField,
} from "@/components/admin/accounts/account-ui";
import {
  PageHeader,
  PageToolbar,
  SearchInput,
  SummaryCard,
  Pagination,
  LoadingSkeleton,
  PropertySelector,
} from "@/components/shared/management-ui";
import { ErrorState } from "@/components/shared/dashboard-ui";
import { CheckoutSettlementPanel } from "@/components/shared/checkout-settlement-panel";
import { useAccountantScope } from "@/components/accountant/accountant-scope";
import { useManagementProperty } from "@/providers/management-scope";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";

const phases: Record<string, string> = {
  SCHEDULE_PENDING: "Chờ xác nhận lịch",
  INSPECTION: "Đang kiểm kê",
  SETTLEMENT: "Chờ quyết toán",
  CONFIRMATION: "Chờ xác nhận / áp dụng",
  DEBT: "Chờ thu công nợ",
  REFUND: "Chờ xử lý cọc",
  CLOSE_READY: "Chờ đóng hồ sơ",
  COMPLETED: "Đã hoàn tất",
  DISPUTED: "Có tranh chấp",
  FINANCE_PENDING: "Tài chính đang xử lý",
  CANCELLED: "Đã hủy",
};
type Row = {
  id: number;
  code: string;
  contract_id: number;
  contract_code: string;
  property_id: number;
  property_name: string;
  room_id: number;
  room_code: string;
  room_status: string;
  tenant_name: string;
  tenant_profile_id: number;
  created_at: string;
  requested_date: string;
  confirmed_date: string | null;
  inspection_at: string | null;
  inspection_scheduled_at: string | null;
  actual_checkout_at: string | null;
  status: string;
  stage: string;
  financial_status: string;
  inspection_status: string;
  refund_status: string;
  assignee_name: string;
  version: number;
  can_open: boolean;
  current_debt: number | null;
  held_deposit: number | null;
  disputed: boolean;
};
type Data = {
  rows: Row[];
  summary: { stage: string; count: number }[];
  totalElements: number;
  totalPages: number;
  page: number;
};
type Options = {
  properties: {
    id: number;
    name: string;
    organizationId?: number;
    organizationName?: string;
  }[];
  rooms: { id: number; code: string; propertyId: number }[];
  contracts: {
    id: number;
    code: string;
    tenantName: string;
    roomCode: string;
    propertyId: number;
    canRequest: boolean;
  }[];
  staff: { id: number; name: string }[];
  assignees: { id: number; name: string; propertyId: number }[];
  canRequest: boolean;
};
const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-40";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
export function CheckoutWorkspace({
  portal = "admin",
}: {
  portal?: "admin" | "accountant";
}) {
  return portal === "admin" ? (
    <AdminShell
      title="Quản lý trả phòng"
      subtitle="Bàn giao, công nợ và hoàn cọc theo hồ sơ thực tế"
    >
      <AdminBody />
    </AdminShell>
  ) : (
    <AccountantBody />
  );
}
function AdminBody() {
  const params = useSearchParams();
  const [propertyId, setPropertyId] = useManagementProperty(
    Number(params.get("propertyId")) || undefined,
  );
  return (
    <Workspace
      portal="admin"
      propertyId={propertyId}
      setPropertyId={setPropertyId}
    />
  );
}
function AccountantBody() {
  const scope = useAccountantScope();
  return (
    <Workspace
      portal="accountant"
      propertyId={scope.propertyId}
      setPropertyId={scope.setPropertyId}
    />
  );
}
function Workspace({
  portal,
  propertyId,
  setPropertyId,
}: {
  portal: "admin" | "accountant";
  propertyId?: number;
  setPropertyId: (id?: number) => void;
}) {
  const params = useSearchParams(),
    qc = useQueryClient(),
    root = `/${portal}/checkout-workspace`;
  const [organization, setOrganization] = useState(0),
    [room, setRoom] = useState(Number(params.get("roomId")) || 0),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [keyword, setKeyword] = useState(""),
    [stage, setStage] = useState(""),
    [financial, setFinancial] = useState(""),
    [assignee, setAssignee] = useState(0),
    [dispute, setDispute] = useState(""),
    [page, setPage] = useState(0);
  const [contract, setContract] = useState(
      Number(params.get("contractId")) || 0,
    ),
    [creating, setCreating] = useState(false),
    [assignment, setAssignment] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [previous, setPrevious] = useState(propertyId);
  if (previous !== propertyId) {
    setPrevious(propertyId);
    setRoom(0);
    setPage(0);
    setContract(0);
    setCreating(false);
    setAssignment(null);
  }
  const options = useScopedQuery({
    queryKey: ["checkout-workspace-options", portal],
    queryFn: async ({ signal }) =>
      (await apiClient.get<ApiEnvelope<Options>>(root + "/options", { signal }))
        .data.data,
  });
  const filter = {
    propertyId,
    organizationId: organization || undefined,
    roomId: room || undefined,
    from: from || undefined,
    to: to || undefined,
    keyword,
    stage: stage || undefined,
    financialStatus: financial || undefined,
    assignee: assignee || undefined,
    disputed: dispute === "" ? undefined : dispute === "yes",
    page,
    size: 20,
  };
  const query = useScopedQuery({
    queryKey: ["checkout-workspace", portal, filter],
    queryFn: async ({ signal }) =>
      (await apiClient.get<ApiEnvelope<Data>>(root, { params: filter, signal }))
        .data.data,
  });
  const companies = Array.from(
    new Map(
      (options.data?.properties ?? [])
        .filter((p) => p.organizationId)
        .map((p) => [
          p.organizationId!,
          p.organizationName ?? String(p.organizationId),
        ]),
    ).entries(),
  );
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Quản lý trả phòng"
        description="Theo dõi yêu cầu, kiểm kê và nghĩa vụ tài chính từ cùng một hồ sơ."
      >
        <div className="flex flex-wrap gap-2">
          <Link
            className={button}
            href={
              portal === "admin"
                ? "/admin/rental-lifecycle?tab=checkin"
                : "/accountant/deposits"
            }
          >
            Nhận phòng / Sổ cọc
          </Link>
          {portal === "admin" && options.data?.canRequest && (
            <button className={primary} onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Tạo yêu cầu trả phòng
            </button>
          )}
        </div>
      </PageHeader>
      <div className="rounded-xl border border-accent-border bg-accent p-4 text-sm text-link">
        Bàn giao phòng và đóng tài chính được theo dõi riêng. Cọc phải hoàn chưa
        phải tiền đã chuyển; phòng cần vệ sinh/sửa chữa chưa sẵn sàng cho thuê.
      </div>
      <PageToolbar>
        {portal === "admin" ? (
          <PropertySelector />
        ) : (
          <label className="text-xs text-muted-foreground">
            Nhà trọ
            <select
              className={input}
              value={propertyId ?? ""}
              onChange={(e) => {
                setPropertyId(Number(e.target.value) || undefined);
                setPage(0);
              }}
            >
              <option value="">Tất cả nhà được giao</option>
              {options.data?.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs text-muted-foreground">
          Công ty
          <select
            aria-label="Công ty trả phòng"
            className={input}
            value={organization}
            onChange={(e) => {
              setOrganization(Number(e.target.value));
              setPage(0);
            }}
          >
            <option value={0}>Tất cả công ty</option>
            {companies.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Phòng
          <select
            aria-label="Phòng trả"
            className={input}
            value={room}
            onChange={(e) => {
              setRoom(Number(e.target.value));
              setPage(0);
            }}
          >
            <option value={0}>Tất cả phòng</option>
            {options.data?.rooms
              .filter((r) => !propertyId || r.propertyId === propertyId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
          </select>
        </label>
        <div className="min-w-48 flex-1">
          <SearchInput
            aria-label="Tìm hồ sơ trả phòng"
            value={keyword}
            placeholder="Mã, hợp đồng, phòng, người thuê…"
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <label className="text-xs text-muted-foreground">
          Từ ngày trả dự kiến
          <input
            aria-label="Từ ngày trả dự kiến"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
            className={input}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Đến ngày
          <input
            aria-label="Đến ngày trả dự kiến"
            type="date"
            min={from || undefined}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
            className={input}
          />
        </label>
        <select
          aria-label="Giai đoạn trả phòng"
          className={`${input} sm:max-w-56`}
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Tất cả giai đoạn</option>
          {Object.entries(phases).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tài chính trả phòng"
          className={`${input} sm:max-w-56`}
          value={financial}
          onChange={(e) => {
            setFinancial(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Tất cả trạng thái tài chính</option>
          {[
            "UNSETTLED",
            "NEEDS_REVIEW",
            "REVIEW_PENDING",
            "REFUND_PENDING",
            "COLLECTION_PENDING",
            "SETTLED",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Phụ trách trả phòng"
          className={`${input} sm:max-w-48`}
          value={assignee}
          onChange={(e) => {
            setAssignee(Number(e.target.value));
            setPage(0);
          }}
        >
          <option value={0}>Tất cả người xử lý</option>
          {options.data?.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tranh chấp"
          className={`${input} sm:max-w-48`}
          value={dispute}
          onChange={(e) => {
            setDispute(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Tất cả phản hồi</option>
          <option value="yes">Có tranh chấp mở</option>
          <option value="no">Không có tranh chấp mở</option>
        </select>
      </PageToolbar>
      {query.isError || options.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error ?? options.error)}
          onRetry={() => {
            void query.refetch();
            void options.refetch();
          }}
        />
      ) : query.isLoading ? (
        <LoadingSkeleton />
      ) : (
        query.data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryCard
                label="Tổng hồ sơ theo bộ lọc"
                value={query.data.totalElements}
                icon={<DoorOpen className="size-5" />}
              />
              {query.data.summary.map((s) => (
                <button
                  key={s.stage}
                  className="text-left"
                  onClick={() => {
                    setStage(s.stage);
                    setPage(0);
                  }}
                >
                  <SummaryCard
                    label={phases[s.stage] ?? s.stage}
                    value={s.count}
                  />
                </button>
              ))}
            </div>
            <div className="overflow-x-auto surface-card">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    {[
                      "Hồ sơ / Hợp đồng",
                      "Nhà / Phòng / Người thuê",
                      "Ngày yêu cầu / Dự kiến",
                      "Kiểm kê / Bàn giao thực tế",
                      "Quyết toán / Hoàn cọc",
                      "Công nợ / Cọc đang giữ",
                      "Người phụ trách",
                      "Xử lý",
                    ].map((h) => (
                      <th key={h} className="p-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {query.data.rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="p-4">
                        <b>{r.code}</b>
                        <p>{r.contract_code}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {phases[r.stage] ?? r.stage}
                        </p>
                      </td>
                      <td className="p-4">
                        <b>
                          {r.property_name} · {r.room_code}
                        </b>
                        <p>{r.tenant_name}</p>
                        {portal === "accountant" ? (
                          <button type="button" className="text-xs text-link underline" onClick={() => setContract(r.contract_id)}>
                            Hồ sơ quyết toán
                          </button>
                        ) : <Link
                          className="text-xs text-link underline"
                          href={`/${portal}/contracts/${r.contract_id}`}
                        >
                          Hợp đồng nguồn
                        </Link>}
                      </td>
                      <td className="p-4">
                        {formatDate(r.created_at)}
                        <p className="mt-1 font-semibold">
                          {formatDate(r.requested_date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Đã hẹn: {formatDate(r.confirmed_date)}
                        </p>
                      </td>
                      <td className="p-4">
                        <p>
                          {r.inspection_at
                            ? `Đã kiểm kê ${formatDate(r.inspection_at, true)}`
                            : "Chưa kiểm kê"}
                        </p>
                        <p>
                          {r.actual_checkout_at
                            ? `Bàn giao ${formatDate(r.actual_checkout_at, true)}`
                            : "Chưa bàn giao thực tế"}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="rounded-full bg-muted px-2 py-1 text-xs">
                          {r.stage === "DISPUTED"
                            ? "Có tranh chấp"
                            : (phases[r.stage] ?? r.status)}
                        </span>
                        <p className="mt-2 text-xs">
                          Hoàn cọc:{" "}
                          {r.refund_status === "PAID"
                            ? "Đã chi"
                            : r.refund_status === "PENDING"
                              ? "Đang xử lý"
                              : "Chưa có yêu cầu"}
                        </p>
                      </td>
                      <td className="p-4">
                        Nợ: {formatCurrency(r.current_debt)}
                        <p>Cọc: {formatCurrency(r.held_deposit)}</p>
                      </td>
                      <td className="p-4">
                        {r.assignee_name ?? "Chưa phân công"}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(r.inspection_scheduled_at, true)}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={button}
                            disabled={!r.can_open}
                            title={
                              !r.can_open
                                ? "Cần quyền FINANCE_READ để mở hồ sơ có số liệu quyết toán"
                                : undefined
                            }
                            onClick={() => setContract(r.contract_id)}
                          >
                            Mở hồ sơ
                          </button>
                          {portal === "admin" &&
                            !r.actual_checkout_at &&
                            !["CANCELLED", "COMPLETED"].includes(r.status) && (
                              <button
                                className={button}
                                onClick={() => {
                                  setError("");
                                  setAssignment(r);
                                }}
                              >
                                <CalendarClock className="size-4" />
                                Phân công
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!query.data.rows.length && (
                <p className="p-10 text-center text-muted-foreground">
                  Không có hồ sơ trả phòng phù hợp bộ lọc.
                </p>
              )}
            </div>
            <Pagination
              page={page}
              totalPages={query.data.totalPages}
              onChange={setPage}
            />
          </>
        )
      )}
      {contract > 0 && (
        <AccountModal
          title="Hồ sơ trả phòng và quyết toán"
          onClose={() => setContract(0)}
        >
          <CheckoutSettlementPanel
            key={contract}
            portal={portal}
            contractId={contract}
            wizard
          />
        </AccountModal>
      )}
      {creating && options.data && (
        <AccountModal
          title="Chọn hợp đồng đang thuê"
          onClose={() => setCreating(false)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const id = Number(new FormData(e.currentTarget).get("contract"));
              if (id) {
                setContract(id);
                setCreating(false);
              }
            }}
          >
            <AccountField title="Hợp đồng">
              <select
                name="contract"
                aria-label="Hợp đồng trả phòng"
                className={input}
                required
                defaultValue=""
              >
                <option value="">Chọn hợp đồng</option>
                {options.data.contracts
                  .filter((c) => !propertyId || c.propertyId === propertyId)
                  .map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.canRequest}>
                      {c.code} · {c.roomCode} · {c.tenantName}
                      {!c.canRequest ? " · Đã có hồ sơ" : ""}
                    </option>
                  ))}
              </select>
            </AccountField>
            <p className="text-sm text-muted-foreground">
              Bước tiếp theo nhập ngày dự kiến và căn cứ. Chưa kết thúc hợp đồng
              hoặc trừ cọc.
            </p>
            <button className={primary}>Tiếp tục</button>
          </form>
        </AccountModal>
      )}
      {assignment && options.data && (
        <AccountModal
          title={`Phân công kiểm kê · ${assignment.code}`}
          onClose={() => {
            if (!busy) setAssignment(null);
          }}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const data = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                await apiClient.post(`${root}/${assignment.id}/assignment`, {
                  userId: Number(data.get("user")),
                  inspectionAt: data.get("at"),
                  version: assignment.version,
                  reason: data.get("reason"),
                });
                await qc.invalidateQueries();
                setAssignment(null);
              } catch (e) {
                setError(apiErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <AccountField title="Người bàn giao">
              <select name="user" required className={input}>
                <option value="">Chọn nhân viên trong nhà trọ</option>
                {options.data.assignees
                  .filter((a) => a.propertyId === assignment.property_id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </AccountField>
            <AccountField title="Lịch kiểm kê">
              <input
                type="datetime-local"
                name="at"
                required
                className={input}
              />
            </AccountField>
            <AccountField title="Căn cứ phân công">
              <input
                name="reason"
                required
                maxLength={1000}
                className={input}
              />
            </AccountField>
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <button disabled={busy} className={primary}>
              {busy ? "Đang lưu…" : "Lưu phân công và thông báo"}
            </button>
          </form>
        </AccountModal>
      )}
    </div>
  );
}
