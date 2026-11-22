"use client";
import { maintenanceStyles } from "./maintenance-styles";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  ClipboardCheck,
  History,
  PackagePlus,
  Plus,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  AccountField,
  AccountModal,
} from "@/components/admin/accounts/account-ui";
import {
  PageHeader,
  PageToolbar,
  PropertySelector,
  SearchInput,
  SummaryCard,
  LoadingSkeleton,
  Pagination,
} from "@/components/shared/management-ui";
import { ErrorState } from "@/components/shared/dashboard-ui";
import { FormInput } from "@/components/ui/number-input";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { useManagementProperty } from "@/providers/management-scope";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";

type Tab = "assets" | "materials" | "approvals" | "costs" | "history";
type Row = {
  id: number;
  code: string;
  name: string;
  property_id: number;
  property_name: string;
  room_id?: number;
  room_code?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  status: string;
  condition_status?: string;
  purchased_at?: string;
  purchase_price?: number | null;
  custodian_id?: number;
  custodian?: string;
  note?: string;
  version: number;
  task_id?: number;
  expense_id?: number;
  voucher_id?: number;
  voucher_status?: string;
  amount?: number | null;
  paid_amount?: number | null;
  actual_cost?: number | null;
  estimated_cost?: number | null;
  items?: string;
  requester?: string;
  created_at?: string;
  unit_price?: number | null;
};
type Data = {
  rows: Row[];
  summary: { status: string; count: number }[];
  totalElements: number;
  totalPages: number;
  page: number;
  canWrite: boolean;
  canApprove: boolean;
};
type Options = {
  properties: {
    id: number;
    name: string;
    organizationId?: number;
    organizationName?: string;
  }[];
  rooms: { id: number; code: string; propertyId: number }[];
  staff: { id: number; name: string; propertyId: number }[];
  canWrite: boolean;
  canApprove: boolean;
};
type AssetHistory = {
  changes: {
    id: number;
    new_condition: string;
    new_status: string;
    reason: string;
    actor_name: string;
    created_at: string;
  }[];
  handovers: {
    checkin_id: number;
    contract_id: number;
    contract_code: string;
    asset_name: string;
    quantity: number;
    condition_status: string;
    actual_checkin_at?: string;
  }[];
};
const root = "/admin/operations";
const tabs: [Tab, string][] = [
  ["assets", "Tài sản & thiết bị"],
  ["materials", "Kho vật tư"],
  ["approvals", "Duyệt vật tư"],
  ["costs", "Chi phí sửa chữa"],
  ["history", "Lịch sử nhập / xuất"],
];
const labels: Record<string, string> = {
  NEW: "Mới nhập",
  IN_USE: "Đang sử dụng",
  REPAIRING: "Đang sửa chữa",
  BROKEN: "Hư hỏng",
  RETIRED: "Ngừng sử dụng",
  DISPOSED: "Đã thanh lý",
  NEEDS_CHECK: "Cần kiểm tra",
  ACTIVE: "Hoạt động",
  INACTIVE: "Ngừng sử dụng",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  RECEIVED: "Đã tiếp nhận",
  RECORDED: "Đã ghi nhận",
  GOOD: "Tốt",
  FAIR: "Đã qua sử dụng",
  DAMAGED: "Hư hại",
  MISSING: "Thiếu",
  PAID: "Đã chi",
  DRAFT: "Nháp",
  SUBMITTED: "Chờ duyệt",
  OWNER: "Chủ nhà",
  TENANT: "Người thuê",
  SHARED: "Chia sẻ",
};
const assetStates = [
  "NEW",
  "IN_USE",
  "REPAIRING",
  "BROKEN",
  "NEEDS_CHECK",
  "RETIRED",
  "DISPOSED",
];
const categories = [
  "AIR_CONDITIONER",
  "WATER_HEATER",
  "BED",
  "WARDROBE",
  "FURNITURE",
  "WASHING_MACHINE",
  "REFRIGERATOR",
  "CAMERA",
  "METER",
  "NETWORK",
  "OTHER",
];
const categoryLabels: Record<string, string> = {
  AIR_CONDITIONER: "Điều hòa",
  WATER_HEATER: "Bình nóng lạnh",
  BED: "Giường",
  WARDROBE: "Tủ",
  FURNITURE: "Bàn ghế",
  WASHING_MACHINE: "Máy giặt",
  REFRIGERATOR: "Tủ lạnh",
  CAMERA: "Camera",
  METER: "Công tơ",
  NETWORK: "Thiết bị mạng",
  OTHER: "Khác",
};
const input =
  "min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold disabled:opacity-50";
async function get<T>(path: string, signal: AbortSignal, params?: object) {
  return (await apiClient.get<ApiEnvelope<T>>(path, { signal, params })).data
    .data;
}
const money = (value?: number | null) =>
  value == null ? "—" : formatCurrency(value);

export function OperationsWorkspace({
  initialTab = "assets",
}: {
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [property] = useManagementProperty();
  const [organization, setOrganization] = useState(0),
    [room, setRoom] = useState(0),
    [keyword, setKeyword] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(0);
  const [previousProperty, setPreviousProperty] = useState(property);
  const [editing, setEditing] = useState<Row | "new" | null>(null),
    [history, setHistory] = useState<Row | null>(null),
    [receiving, setReceiving] = useState<Row | null>(null),
    [decision, setDecision] = useState<{ row: Row; approve: boolean } | null>(
      null,
    ),
    [newMaterial, setNewMaterial] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const guard = useRef(false),
    qc = useQueryClient();
  if (previousProperty !== property) {
    setPreviousProperty(property);
    setRoom(0);
    setPage(0);
    setEditing(null);
    setHistory(null);
    setReceiving(null);
    setDecision(null);
    setNewMaterial(false);
  }
  const options = useScopedQuery({
    queryKey: ["operations-options"],
    queryFn: ({ signal }) => get<Options>(root + "/options", signal),
  });
  const params = {
    tab,
    propertyId: property,
    organizationId: organization || undefined,
    roomId: room || undefined,
    keyword,
    status: status || undefined,
    category: category || undefined,
    page,
    size: 20,
  };
  const query = useScopedQuery({
    queryKey: ["operations-workspace", params],
    queryFn: ({ signal }) => get<Data>(root, signal, params),
  });
  const historyQuery = useScopedQuery({
    queryKey: ["operations-asset-history", history?.id],
    enabled: !!history,
    queryFn: ({ signal }) =>
      get<AssetHistory>(`${root}/assets/${history!.id}/history`, signal),
  });
  async function run(action: () => Promise<unknown>, message: string) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setEditing(null);
      setReceiving(null);
      setDecision(null);
      setNewMaterial(false);
      await qc.invalidateQueries();
      setNotice(message);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  function changeTab(next: Tab) {
    setTab(next);
    setPage(0);
    setStatus("");
    setCategory("");
    setHistory(null);
    setNotice("");
  }
  const rooms = (options.data?.rooms ?? []).filter(
    (r) => !property || r.propertyId === property,
  );
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
    <AdminShell
      title="Tài sản và bảo trì"
      subtitle="Thiết bị, vật tư và chứng từ sửa chữa theo nhà trọ"
    >
      <div className="min-w-0 space-y-5">
        <PageHeader
          title="Tài sản và vận hành"
          description="Theo dõi thiết bị, duyệt đề xuất và đối chiếu chi phí từ công việc sửa chữa."
        >
          <div className="flex flex-wrap gap-2">
            <Link className={button} href="/admin/maintenance">
              <ClipboardCheck className="size-4" />
              Công việc bảo trì
            </Link>
            {options.data?.canWrite && tab === "assets" && (
              <button
                className={maintenanceStyles.primary}
                onClick={() => {
                  setError("");
                  setEditing("new");
                }}
              >
                <Plus className="size-4" />
                Thêm tài sản
              </button>
            )}
            {options.data?.canWrite && tab === "materials" && (
              <button
                className={maintenanceStyles.primary}
                onClick={() => {
                  setError("");
                  setNewMaterial(true);
                }}
              >
                <Plus className="size-4" />
                Thêm vật tư
              </button>
            )}
          </div>
        </PageHeader>
        <nav className="flex flex-wrap gap-2" aria-label="Phân hệ vận hành">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              className={tab === key ? maintenanceStyles.primary : button}
              onClick={() => changeTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <PageToolbar>
          <PropertySelector />
          <label className="text-xs text-muted-foreground">
            Công ty
            <select
              aria-label="Công ty"
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
              aria-label="Phòng"
              className={input}
              value={room}
              onChange={(e) => {
                setRoom(Number(e.target.value));
                setPage(0);
              }}
              disabled={tab === "materials"}
            >
              <option value={0}>Tất cả phòng</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </select>
          </label>
          <SearchInput
            aria-label="Tìm tài sản hoặc công việc"
            placeholder="Mã, tên tài sản / công việc…"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(0);
            }}
          />
          <select
            aria-label="Trạng thái"
            className={`${input} sm:max-w-48`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {(tab === "assets"
              ? assetStates
              : tab === "materials"
                ? ["ACTIVE", "INACTIVE"]
                : tab === "history"
                  ? ["RECORDED"]
                  : [
                      "PENDING",
                      "APPROVED",
                      "REJECTED",
                      ...(tab === "approvals" ? ["RECEIVED"] : []),
                    ]
            ).map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
          {tab === "assets" && (
            <select
              aria-label="Nhóm tài sản"
              className={`${input} sm:max-w-48`}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả nhóm</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          )}
        </PageToolbar>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-muted p-4 text-danger">
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl bg-success-muted p-4 text-success"
          >
            {notice}
          </p>
        )}
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
                  icon={<Boxes className="size-5" />}
                  label="Tổng bản ghi theo bộ lọc"
                  value={query.data.totalElements}
                />
                {query.data.summary.map((s) => (
                  <SummaryCard
                    key={s.status}
                    label={labels[s.status] ?? s.status}
                    value={s.count}
                  />
                ))}
              </div>
              <div className="overflow-x-auto surface-card">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      {[
                        "Mã / Tên",
                        "Nhà trọ / Phòng",
                        tab === "assets" ? "Nhóm / Số lượng" : "Nội dung",
                        tab === "assets"
                          ? "Tình trạng / Vòng đời"
                          : "Trạng thái",
                        tab === "assets"
                          ? "Giá mua / Phụ trách"
                          : tab === "costs"
                            ? "Dự kiến / Phát sinh / Đề xuất / Thực chi"
                            : "Số lượng / Đơn giá",
                        "Thao tác",
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
                          <p className="mt-1 max-w-56 break-words">{r.name}</p>
                          {r.task_id && (
                            <Link
                              className="text-link underline"
                              href={`/admin/maintenance/${r.task_id}`}
                            >
                              Xem công việc
                            </Link>
                          )}
                        </td>
                        <td className="p-4">
                          {r.property_name}
                          <p className="text-muted-foreground">
                            {r.room_code ??
                              (r.room_id ? `Phòng #${r.room_id}` : "—")}
                          </p>
                        </td>
                        <td className="max-w-64 p-4 break-words">
                          {tab === "assets" ? (
                            <>
                              {categoryLabels[r.category ?? ""] ?? r.category}
                              <p>{r.quantity} thiết bị</p>
                              {r.purchased_at && (
                                <p className="text-xs text-muted-foreground">
                                  Mua: {formatDate(r.purchased_at)}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              {r.items ?? r.note ?? r.requester ?? "—"}
                              {tab === "costs" && r.expense_id && (
                                <p>Chi phí #{r.expense_id}</p>
                              )}
                            </>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                            {labels[r.status] ?? r.status}
                          </span>
                          {r.condition_status && (
                            <p className="mt-2 text-muted-foreground">
                              {labels[r.condition_status] ?? r.condition_status}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          {tab === "assets" ? (
                            <>
                              {money(r.purchase_price)}
                              <p className="text-muted-foreground">
                                {r.custodian ?? "Chưa phân công"}
                              </p>
                            </>
                          ) : tab === "costs" ? (
                            <>
                              <p>Dự kiến: {money(r.estimated_cost)}</p>
                              <p>Phát sinh: {money(r.actual_cost)}</p>
                              <p>Đề xuất: {money(r.amount)}</p>
                              <p className="font-semibold">
                                Thực chi: {money(r.paid_amount)}
                              </p>
                              {r.voucher_id && (
                                <Link
                                  className="text-link underline"
                                  href={`/admin/finance/vouchers?propertyId=${r.property_id}`}
                                >
                                  Phiếu chi #{r.voucher_id} ·{" "}
                                  {labels[r.voucher_status ?? ""] ??
                                    r.voucher_status}
                                </Link>
                              )}
                            </>
                          ) : (
                            <>
                              {r.quantity ?? "—"} {r.unit ?? ""}
                              {tab === "materials" && (
                                <p className="text-muted-foreground">
                                  {money(r.unit_price)}
                                </p>
                              )}
                            </>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex max-w-48 flex-wrap gap-2">
                            {tab === "assets" && (
                              <>
                                <button
                                  className={button}
                                  onClick={() => setHistory(r)}
                                >
                                  <History className="size-4" />
                                  Lịch sử
                                </button>
                                {query.data!.canWrite && (
                                  <button
                                    className={button}
                                    onClick={() => {
                                      setError("");
                                      setEditing(r);
                                    }}
                                  >
                                    Cập nhật
                                  </button>
                                )}
                              </>
                            )}
                            {tab === "materials" && query.data!.canWrite && (
                              <button
                                className={button}
                                onClick={() => {
                                  setError("");
                                  setReceiving(r);
                                }}
                              >
                                <PackagePlus className="size-4" />
                                Nhập kho
                              </button>
                            )}
                            {((tab === "approvals" && query.data!.canWrite) ||
                              (tab === "costs" && query.data!.canApprove)) &&
                              r.status === "PENDING" && (
                                <>
                                  <button
                                    className={button}
                                    onClick={() => {
                                      setError("");
                                      setDecision({ row: r, approve: true });
                                    }}
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    className={button}
                                    onClick={() => {
                                      setError("");
                                      setDecision({ row: r, approve: false });
                                    }}
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!query.data.rows.length && (
                  <p className="p-10 text-center text-muted-foreground">
                    Chưa có dữ liệu phù hợp bộ lọc.
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
        <p className="rounded-xl border border-accent-border bg-accent p-4 text-sm leading-6 text-link">
          {tab === "assets"
            ? "Tài sản được quản lý theo phòng. Bàn giao và kiểm kê lưu trong hồ sơ hợp đồng; thay đổi tình trạng không tự trừ tiền cọc. Dùng trạng thái ngừng sử dụng hoặc thanh lý để giữ lịch sử."
            : tab === "costs"
              ? "Đề xuất, chi phí phát sinh và thực chi là các số liệu riêng. Duyệt chi phí chủ nhà tạo chứng từ chi phí; kế toán lập phiếu chi liên kết mã chi phí tại phân hệ Thu chi. Chỉ phiếu đã thanh toán mới được tính thực chi. Chi phí người thuê cần qua quy trình quyết toán."
              : "Duyệt đề xuất không làm tăng tồn kho hay phát sinh thực chi. Nhập kho ghi nhận hàng thực nhận; xuất dùng chỉ trừ tồn một lần khi kỹ thuật ghi nhận sử dụng. Tồn trước nâng cấp được giữ nguyên."}
        </p>
        {editing && options.data && (
          <AssetForm
            key={editing === "new" ? "new" : editing.id}
            row={editing === "new" ? null : editing}
            options={options.data}
            property={property}
            busy={busy}
            error={error}
            onClose={() => setEditing(null)}
            onSave={(data) =>
              run(
                () =>
                  editing === "new"
                    ? apiClient.post(root + "/assets", data)
                    : apiClient.put(`${root}/assets/${editing.id}`, data),
                "Đã lưu tài sản và lịch sử thay đổi.",
              )
            }
          />
        )}
        {receiving && (
          <StockForm
            key={receiving.id}
            row={receiving}
            busy={busy}
            error={error}
            onClose={() => setReceiving(null)}
            onSave={(data) =>
              run(
                () =>
                  apiClient.post(
                    `${root}/materials/${receiving.id}/receive`,
                    data,
                  ),
                "Đã ghi nhận nhập kho. Chưa ghi thực chi.",
              )
            }
          />
        )}
        {newMaterial && options.data && (
          <MaterialForm
            options={options.data}
            property={property}
            busy={busy}
            error={error}
            onClose={() => setNewMaterial(false)}
            onSave={(data) =>
              run(
                () => apiClient.post("/admin/maintenance/materials", data),
                "Đã tạo vật tư.",
              )
            }
          />
        )}
        {decision && (
          <DecisionForm
            key={decision.row.id + String(decision.approve)}
            row={decision.row}
            approve={decision.approve}
            busy={busy}
            error={error}
            onClose={() => setDecision(null)}
            onSave={(reason) =>
              run(
                () =>
                  apiClient.post(
                    `${root}/${tab === "costs" ? "costs" : "material-requests"}/${decision.row.id}/review`,
                    {
                      version: decision.row.version,
                      approve: decision.approve,
                      reason,
                    },
                  ),
                "Đã xét duyệt đề xuất. Chưa ghi nhận thực chi.",
              )
            }
          />
        )}
        {history && (
          <AccountModal
            title={`Lịch sử · ${history.code}`}
            onClose={() => setHistory(null)}
          >
            <div className="space-y-4">
              {historyQuery.isLoading ? (
                <LoadingSkeleton />
              ) : historyQuery.isError ? (
                <ErrorState onRetry={() => void historyQuery.refetch()} />
              ) : (
                <>
                  <h3 className="font-semibold">Thay đổi tình trạng</h3>
                  {historyQuery.data?.changes.map((h) => (
                    <article
                      key={h.id}
                      className="rounded-xl border p-3 text-sm"
                    >
                      <p>
                        {labels[h.new_condition]} · {labels[h.new_status]}
                      </p>
                      <p>{h.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.actor_name} · {formatDate(h.created_at, true)}
                      </p>
                    </article>
                  ))}
                  {!historyQuery.data?.changes.length && (
                    <p className="text-sm text-muted-foreground">
                      Chưa có thay đổi được ghi nhận.
                    </p>
                  )}
                  <h3 className="font-semibold">Biên bản bàn giao nguồn</h3>
                  {historyQuery.data?.handovers.map((h) => (
                    <Link
                      key={`${h.checkin_id}-${h.asset_name}`}
                      href={`/admin/contracts/${h.contract_id}`}
                      className="block rounded-xl border p-3 text-sm text-link"
                    >
                      {h.contract_code} · {h.asset_name} × {h.quantity} ·{" "}
                      {labels[h.condition_status] ?? h.condition_status}
                    </Link>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Mở hợp đồng để xem phiên bản bàn giao đã xác nhận và kiểm kê
                    trả phòng.
                  </p>
                </>
              )}
            </div>
          </AccountModal>
        )}
      </div>
    </AdminShell>
  );
}

function FormActions({
  busy,
  onClose,
  error,
}: {
  busy: boolean;
  onClose: () => void;
  error: string;
}) {
  return (
    <>
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={onClose}
        >
          Hủy
        </button>
        <button className={maintenanceStyles.primary} disabled={busy}>
          {busy ? "Đang lưu…" : "Xác nhận lưu"}
        </button>
      </div>
    </>
  );
}
function AssetForm({
  row,
  options,
  property,
  busy,
  error,
  onClose,
  onSave,
}: {
  row: Row | null;
  options: Options;
  property?: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (data: object) => void;
}) {
  const [room, setRoom] = useState(String(row?.room_id ?? ""));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({
      roomId: Number(room),
      code: f.get("code"),
      name: f.get("name"),
      category: f.get("category"),
      quantity: Number(f.get("quantity")),
      condition: f.get("condition"),
      status: f.get("status"),
      purchasedAt: f.get("purchasedAt") || null,
      purchasePrice: f.get("purchasePrice")
        ? Number(f.get("purchasePrice"))
        : null,
      custodianId: f.get("custodianId") ? Number(f.get("custodianId")) : null,
      note: f.get("note"),
      version: row?.version ?? 0,
      reason: f.get("reason"),
    });
  }
  return (
    <AccountModal
      title={row ? "Cập nhật tài sản" : "Thêm tài sản"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountField title="Phòng">
            <select
              className={input}
              required
              disabled={!!row}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              <option value="">Chọn phòng</option>
              {options.rooms
                .filter((r) => !property || r.propertyId === property)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} ·{" "}
                    {
                      options.properties.find((p) => p.id === r.propertyId)
                        ?.name
                    }
                  </option>
                ))}
            </select>
          </AccountField>
          <Text
            label="Mã tài sản"
            name="code"
            value={row?.code}
            required
            maxLength={60}
          />
          <Text
            label="Tên tài sản"
            name="name"
            value={row?.name}
            required
            maxLength={150}
          />
          <AccountField title="Nhóm">
            <select
              name="category"
              className={input}
              defaultValue={row?.category ?? "OTHER"}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </AccountField>
          <Text
            label="Số lượng"
            name="quantity"
            type="number"
            value={row?.quantity ?? 1}
            required
          />
          <AccountField title="Tình trạng">
            <select
              name="condition"
              className={input}
              defaultValue={row?.condition_status ?? "GOOD"}
            >
              {["GOOD", "FAIR", "DAMAGED", "BROKEN", "MISSING"].map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </AccountField>
          <AccountField title="Vòng đời">
            <select
              name="status"
              className={input}
              defaultValue={row?.status ?? "IN_USE"}
            >
              {assetStates.map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </AccountField>
          <Text
            label="Ngày mua"
            name="purchasedAt"
            type="date"
            value={row?.purchased_at?.slice(0, 10)}
          />
          <Text
            label="Giá mua (khi được cấp quyền tài chính)"
            name="purchasePrice"
            type="number"
            value={row?.purchase_price ?? ""}
          />
          <AccountField title="Người phụ trách">
            <select
              name="custodianId"
              className={input}
              defaultValue={row?.custodian_id ?? ""}
            >
              <option value="">Chưa phân công</option>
              {options.staff
                .filter(
                  (s) =>
                    s.propertyId ===
                    options.rooms.find((r) => r.id === Number(room))
                      ?.propertyId,
                )
                .map((s) => (
                  <option key={`${s.id}-${s.propertyId}`} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </AccountField>
        </div>
        <Text label="Ghi chú" name="note" value={row?.note} maxLength={500} />
        <Text label="Lý do thay đổi" name="reason" required maxLength={1000} />
        <FormActions busy={busy} onClose={onClose} error={error} />
      </form>
    </AccountModal>
  );
}
function Text({
  label,
  name,
  value,
  type = "text",
  required = false,
  maxLength,
}: {
  label: string;
  name: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <AccountField title={label}>
      <FormInput
        name={name}
        aria-label={label}
        className={input}
        defaultValue={value ?? ""}
        type={type}
        required={required}
        min={type === "number" ? 0 : undefined}
        numericKind={name === "quantity" ? "integer" : "currency"}
        maxLength={maxLength}
      />
    </AccountField>
  );
}
function StockForm({
  row,
  busy,
  error,
  onClose,
  onSave,
}: {
  row: Row;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (data: object) => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  return (
    <AccountModal
      title={`Nhập kho · ${row.name}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            quantity: Number(f.get("quantity")),
            reason: f.get("reason"),
            key,
          });
        }}
      >
        <Text
          label="Số lượng thực nhận"
          name="quantity"
          type="number"
          required
        />
        <Text
          label="Chứng từ / lý do nhập"
          name="reason"
          required
          maxLength={1000}
        />
        <FormActions busy={busy} onClose={onClose} error={error} />
      </form>
    </AccountModal>
  );
}
function DecisionForm({
  row,
  approve,
  busy,
  error,
  onClose,
  onSave,
}: {
  row: Row;
  approve: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  return (
    <AccountModal
      title={`${approve ? "Duyệt" : "Từ chối"} đề xuất · ${row.code}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(String(new FormData(e.currentTarget).get("reason")));
        }}
      >
        <p className="text-sm text-secondary-foreground">
          {row.items ?? row.note ?? row.name}. Thao tác này chưa xác nhận thanh
          toán.
        </p>
        <Text label="Lý do xét duyệt" name="reason" required maxLength={1000} />
        <FormActions busy={busy} onClose={onClose} error={error} />
      </form>
    </AccountModal>
  );
}
function MaterialForm({
  options,
  property,
  busy,
  error,
  onClose,
  onSave,
}: {
  options: Options;
  property?: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (data: object) => void;
}) {
  return (
    <AccountModal
      title="Thêm vật tư"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            propertyId: Number(f.get("propertyId")),
            code: f.get("code"),
            name: f.get("name"),
            unit: f.get("unit"),
            stockQuantity: 0,
            minimumQuantity: 0,
            unitPrice: Number(f.get("unitPrice")),
          });
        }}
      >
        <AccountField title="Nhà trọ">
          <select
            name="propertyId"
            className={input}
            defaultValue={property ?? ""}
            required
          >
            <option value="">Chọn nhà trọ</option>
            {options.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </AccountField>
        <Text label="Mã vật tư" name="code" required maxLength={50} />
        <Text label="Tên vật tư" name="name" required maxLength={150} />
        <Text label="Đơn vị" name="unit" required maxLength={30} />
        <Text
          label="Đơn giá tham khảo"
          name="unitPrice"
          type="number"
          required
        />
        <p className="text-sm text-muted-foreground">
          Tồn khởi tạo bằng 0. Ghi nhận nhập kho sau khi hàng thực nhận.
        </p>
        <FormActions busy={busy} onClose={onClose} error={error} />
      </form>
    </AccountModal>
  );
}
