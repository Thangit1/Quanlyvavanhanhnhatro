"use client";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  DoorOpen,
  House,
  KeyRound,
  Plus,
  RefreshCw,
  WalletCards,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyState,
  ErrorState,
  PageLoading,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import {
  useRentalLifecycle,
  useRentalLifecycleMutations,
} from "@/hooks/use-rental-lifecycle";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  BookingRow,
  CheckinRow,
  CheckoutRow,
  LifecycleBoard,
} from "@/types/rental-lifecycle";

type Tab = "booking" | "checkin" | "checkout";
type Dialog =
  | { kind: "booking" }
  | { kind: "contract"; row: BookingRow }
  | { kind: "prepare-checkin" }
  | { kind: "complete-checkin"; row: CheckinRow }
  | { kind: "request-checkout" }
  | { kind: "complete-checkout"; row: CheckoutRow }
  | null;
const today = new Date().toISOString().slice(0, 10);
const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;

export function RentalLifecyclePage() {
  const [propertyId, setPropertyId] = useState<number>();
  const [tab, setTab] = useState<Tab>("booking");
  const [dialog, setDialog] = useState<Dialog>(null);
  const query = useRentalLifecycle(propertyId);
  const mutations = useRentalLifecycleMutations();
  if (query.isLoading) return <PageLoading />;
  return (
    <AdminShell
      title="Vòng đời thuê"
      subtitle="Giữ phòng · Check-in · Cư trú · Check-out"
    >
      <div className="mx-auto max-w-[1600px] space-y-6">
        {query.isError || !query.data ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <Board
            data={query.data}
            propertyId={propertyId}
            setPropertyId={setPropertyId}
            tab={tab}
            setTab={setTab}
            setDialog={setDialog}
            mutations={mutations}
          />
        )}
      </div>
      {dialog && query.data && (
        <WorkflowDialog
          dialog={dialog}
          data={query.data}
          close={() => setDialog(null)}
          mutations={mutations}
        />
      )}
    </AdminShell>
  );
}

function Board({
  data,
  propertyId,
  setPropertyId,
  tab,
  setTab,
  setDialog,
  mutations,
}: {
  data: LifecycleBoard;
  propertyId?: number;
  setPropertyId: (v: number | undefined) => void;
  tab: Tab;
  setTab: (v: Tab) => void;
  setDialog: (v: Dialog) => void;
  mutations: ReturnType<typeof useRentalLifecycleMutations>;
}) {
  const cards = [
    [
      "Đang giữ chỗ",
      data.summary.reserved,
      KeyRound,
      "bg-blue-50 text-blue-700",
    ],
    [
      "Chờ nhận phòng",
      data.summary.awaitingCheckin,
      CalendarCheck,
      "bg-amber-50 text-amber-700",
    ],
    [
      "Đang cư trú",
      data.summary.staying,
      House,
      "bg-emerald-50 text-emerald-700",
    ],
    [
      "Yêu cầu trả phòng",
      data.summary.checkoutRequested,
      DoorOpen,
      "bg-orange-50 text-orange-700",
    ],
    [
      "Chờ quyết toán",
      data.summary.settlementPending,
      WalletCards,
      "bg-violet-50 text-violet-700",
    ],
    [
      "Đang quay vòng phòng",
      data.summary.cleaningOrMaintenance,
      RefreshCw,
      "bg-red-50 text-red-700",
    ],
  ] as const;
  return (
    <>
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Quy trình vận hành thuê phòng
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Một nguồn dữ liệu xuyên suốt từ giữ phòng đến hoàn cọc.
          </p>
        </div>
        <select
          value={propertyId ?? ""}
          onChange={(e) =>
            setPropertyId(e.target.value ? Number(e.target.value) : undefined)
          }
          className={input}
        >
          <option value="">Tất cả nhà trọ</option>
          {data.properties.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map(([label, value, Icon, color]) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span
              className={`grid size-9 place-items-center rounded-xl ${color}`}
            >
              <Icon className="size-4" />
            </span>
            <p className="mt-3 text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-extrabold">{value}</p>
          </article>
        ))}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <nav className="flex gap-1">
            {(["booking", "checkin", "checkout"] as Tab[]).map((x) => (
              <button
                key={x}
                onClick={() => setTab(x)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === x ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {x === "booking"
                  ? "Giữ phòng"
                  : x === "checkin"
                    ? "Check-in"
                    : "Check-out"}
              </button>
            ))}
          </nav>
          <button
            onClick={() =>
              setDialog({
                kind:
                  tab === "booking"
                    ? "booking"
                    : tab === "checkin"
                      ? "prepare-checkin"
                      : "request-checkout",
              })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="size-4" />
            {tab === "booking"
              ? "Giữ phòng"
              : tab === "checkin"
                ? "Tạo phiếu nhận phòng"
                : "Tạo yêu cầu trả phòng"}
          </button>
        </div>
        <div className="p-4">
          {tab === "booking" ? (
            <BookingTable
              rows={data.bookings}
              setDialog={setDialog}
              mutation={mutations.bookingStatus}
            />
          ) : tab === "checkin" ? (
            <CheckinTable rows={data.checkins} setDialog={setDialog} />
          ) : (
            <CheckoutTable rows={data.checkouts} setDialog={setDialog} />
          )}
        </div>
      </section>
    </>
  );
}

function BookingTable({
  rows,
  setDialog,
  mutation,
}: {
  rows: BookingRow[];
  setDialog: (d: Dialog) => void;
  mutation: ReturnType<typeof useRentalLifecycleMutations>["bookingStatus"];
}) {
  if (!rows.length) return <EmptyState text="Chưa có booking giữ phòng." />;
  return (
    <div className="overflow-x-auto">
      <table className={table}>
        <thead>
          <tr>
            <th>Booking</th>
            <th>Người thuê</th>
            <th>Nhà / phòng</th>
            <th>Thời gian giữ</th>
            <th>Tiền giữ chỗ</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.code}</strong>
              </td>
              <td>{r.tenantName}</td>
              <td>
                {r.propertyName}
                <small>Phòng {r.roomCode}</small>
              </td>
              <td>
                {formatDate(r.reservationStart)}
                <small>đến {formatDate(r.reservationEnd)}</small>
              </td>
              <td>
                {formatCurrency(r.depositAmount)}
                <small>{r.depositStatus}</small>
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td>
                <div className="flex justify-end gap-2">
                  {r.status === "RESERVED" && (
                    <button
                      className={linkButton}
                      onClick={() =>
                        void mutation.mutateAsync({
                          id: r.id,
                          status: "DEPOSITED",
                          reason: "Đã xác nhận tiền giữ chỗ",
                          version: r.version,
                        })
                      }
                    >
                      Xác nhận cọc
                    </button>
                  )}
                  {["RESERVED", "DEPOSITED"].includes(r.status) && (
                    <button
                      className={linkButton}
                      onClick={() => setDialog({ kind: "contract", row: r })}
                    >
                      Tạo HĐ
                    </button>
                  )}
                  {["RESERVED", "DEPOSITED"].includes(r.status) && (
                    <button
                      className="text-xs font-semibold text-red-600"
                      onClick={() =>
                        void mutation.mutateAsync({
                          id: r.id,
                          status: "CANCELLED",
                          reason: "Hủy bởi quản lý",
                          version: r.version,
                        })
                      }
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CheckinTable({
  rows,
  setDialog,
}: {
  rows: CheckinRow[];
  setDialog: (d: Dialog) => void;
}) {
  if (!rows.length) return <EmptyState text="Chưa có phiếu check-in." />;
  return (
    <div className="overflow-x-auto">
      <table className={table}>
        <thead>
          <tr>
            <th>Hợp đồng</th>
            <th>Người thuê</th>
            <th>Phòng</th>
            <th>Lịch nhận</th>
            <th>Checklist</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.contractCode}</strong>
              </td>
              <td>{r.tenantName}</td>
              <td>
                {r.propertyName}
                <small>Phòng {r.roomCode}</small>
              </td>
              <td>{formatDate(r.scheduledDate)}</td>
              <td>
                {
                  [
                    r.identityVerified,
                    r.contractVerified,
                    r.depositVerified,
                  ].filter(Boolean).length
                }
                /3 mục
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td className="text-right">
                {r.status === "READY" && (
                  <button
                    className={linkButton}
                    onClick={() =>
                      setDialog({ kind: "complete-checkin", row: r })
                    }
                  >
                    Hoàn tất
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function CheckoutTable({
  rows,
  setDialog,
}: {
  rows: CheckoutRow[];
  setDialog: (d: Dialog) => void;
}) {
  if (!rows.length) return <EmptyState text="Chưa có yêu cầu check-out." />;
  return (
    <div className="overflow-x-auto">
      <table className={table}>
        <thead>
          <tr>
            <th>Hợp đồng</th>
            <th>Người thuê</th>
            <th>Phòng</th>
            <th>Ngày trả</th>
            <th>Cọc / công nợ</th>
            <th>Quyết toán</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.contractCode}</strong>
              </td>
              <td>{r.tenantName}</td>
              <td>
                {r.propertyName}
                <small>Phòng {r.roomCode}</small>
              </td>
              <td>{formatDate(r.requestedDate)}</td>
              <td>
                {formatCurrency(r.depositHeld)}
                <small>Nợ {formatCurrency(r.outstandingDebt)}</small>
              </td>
              <td>
                {r.status === "COMPLETED" ? (
                  <>
                    Hoàn {formatCurrency(r.refundAmount)}
                    <small>Thu thêm {formatCurrency(r.balanceDue)}</small>
                  </>
                ) : (
                  "Chưa chốt"
                )}
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td className="text-right">
                {r.status !== "COMPLETED" && (
                  <button
                    className={linkButton}
                    onClick={() =>
                      setDialog({ kind: "complete-checkout", row: r })
                    }
                  >
                    Kiểm tra & chốt
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowDialog({
  dialog,
  data,
  close,
  mutations,
}: {
  dialog: Exclude<Dialog, null>;
  data: LifecycleBoard;
  close: () => void;
  mutations: ReturnType<typeof useRentalLifecycleMutations>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [property, setProperty] = useState(data.properties[0]?.id ?? 0);
  const title = {
    booking: "Giữ phòng mới",
    contract: "Tạo hợp đồng từ booking",
    "prepare-checkin": "Lập phiếu check-in",
    "complete-checkin": "Hoàn tất nhận phòng",
    "request-checkout": "Tạo yêu cầu check-out",
    "complete-checkout": "Kiểm tra và quyết toán",
  }[dialog.kind];
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      num = (k: string) => Number(f.get(k) || 0),
      str = (k: string) => String(f.get(k) || "");
    try {
      if (dialog.kind === "booking")
        await mutations.createBooking.mutateAsync({
          tenantProfileId: num("tenant"),
          roomId: num("room"),
          reservationStart: str("start"),
          reservationEnd: str("end"),
          depositAmount: num("deposit"),
          source: str("source"),
          note: str("note"),
        });
      if (dialog.kind === "contract")
        await mutations.createContract.mutateAsync({
          id: dialog.row.id,
          startDate: str("start"),
          endDate: str("end"),
          depositAmount: num("deposit"),
          paymentDueDay: num("due"),
          noticePeriodDays: num("notice"),
        });
      if (dialog.kind === "prepare-checkin")
        await mutations.prepareCheckin.mutateAsync({
          contractId: num("contract"),
          scheduledDate: str("date"),
          note: str("note"),
        });
      if (dialog.kind === "complete-checkin")
        await mutations.completeCheckin.mutateAsync({
          id: dialog.row.id,
          identityVerified: f.get("identity") === "on",
          contractVerified: f.get("contractVerified") === "on",
          depositVerified: f.get("depositVerified") === "on",
          electricityReading: num("electricity"),
          waterReading: num("water"),
          keysCardsCount: num("keys"),
          note: str("note"),
          version: dialog.row.version,
        });
      if (dialog.kind === "request-checkout")
        await mutations.requestCheckout.mutateAsync({
          contractId: num("contract"),
          requestedDate: str("date"),
          reason: str("reason"),
        });
      if (dialog.kind === "complete-checkout") {
        const amount = num("chargeAmount");
        await mutations.completeCheckout.mutateAsync({
          id: dialog.row.id,
          actualDate: str("date"),
          finalElectricityReading: num("electricity"),
          finalWaterReading: num("water"),
          charges:
            amount > 0
              ? [
                  {
                    chargeType: str("chargeType"),
                    description:
                      str("chargeDescription") || "Chi phí phát sinh",
                    amount,
                  },
                ]
              : [],
          note: str("note"),
          version: dialog.row.version,
        });
      }
      close();
    } catch (x) {
      setError(apiErrorMessage(x));
    } finally {
      setBusy(false);
    }
  };
  const availableRooms = data.rooms.filter(
    (x) => x.parentId === property && ["VACANT", "READY"].includes(x.status),
  );
  const tenants = data.tenants.filter((x) => x.parentId === property);
  const pendingContracts = data.contracts.filter(
    (x) => x.status === "PENDING_CONFIRMATION",
  );
  const activeContracts = data.contracts.filter((x) =>
    ["ACTIVE", "EXPIRING"].includes(x.status),
  );
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={close} aria-label="Đóng">
            <X />
          </button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {dialog.kind === "booking" && (
            <>
              <Field label="Nhà trọ">
                <select
                  required
                  value={property}
                  onChange={(e) => setProperty(Number(e.target.value))}
                  className={input}
                >
                  {data.properties.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Người thuê">
                <select required name="tenant" className={input}>
                  <option value="">Chọn người thuê</option>
                  {tenants.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} · {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Phòng sẵn sàng">
                <select required name="room" className={input}>
                  <option value="">Chọn phòng</option>
                  {availableRooms.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <DatePair />
              <Field label="Tiền giữ chỗ">
                <input
                  required
                  min="0"
                  name="deposit"
                  type="number"
                  defaultValue="0"
                  className={input}
                />
              </Field>
              <Field label="Nguồn khách">
                <input
                  name="source"
                  placeholder="Facebook, giới thiệu..."
                  className={input}
                />
              </Field>
            </>
          )}
          {dialog.kind === "contract" && (
            <>
              <p className="rounded-xl bg-blue-50 p-3 text-sm">
                {dialog.row.code} · {dialog.row.tenantName} · Phòng{" "}
                {dialog.row.roomCode}
              </p>
              <DatePair />
              <Field label="Tiền cọc hợp đồng">
                <input
                  required
                  min="0"
                  name="deposit"
                  type="number"
                  defaultValue={dialog.row.depositAmount}
                  className={input}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày hạn thanh toán">
                  <input
                    required
                    min="1"
                    max="28"
                    name="due"
                    type="number"
                    defaultValue="5"
                    className={input}
                  />
                </Field>
                <Field label="Báo trước (ngày)">
                  <input
                    required
                    min="0"
                    name="notice"
                    type="number"
                    defaultValue="30"
                    className={input}
                  />
                </Field>
              </div>
            </>
          )}
          {dialog.kind === "prepare-checkin" && (
            <>
              <Field label="Hợp đồng chờ nhận phòng">
                <select required name="contract" className={input}>
                  <option value="">Chọn hợp đồng</option>
                  {pendingContracts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ngày nhận phòng">
                <input
                  required
                  name="date"
                  type="date"
                  defaultValue={today}
                  className={input}
                />
              </Field>
            </>
          )}
          {dialog.kind === "complete-checkin" && (
            <>
              <p className="rounded-xl bg-blue-50 p-3 text-sm">
                {dialog.row.contractCode} · {dialog.row.tenantName} · Phòng{" "}
                {dialog.row.roomCode}
              </p>
              <Checklist />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Chỉ số điện">
                  <input
                    required
                    min="0"
                    step="0.01"
                    name="electricity"
                    type="number"
                    className={input}
                  />
                </Field>
                <Field label="Chỉ số nước">
                  <input
                    required
                    min="0"
                    step="0.01"
                    name="water"
                    type="number"
                    className={input}
                  />
                </Field>
              </div>
              <Field label="Số khóa/thẻ bàn giao">
                <input
                  required
                  min="0"
                  name="keys"
                  type="number"
                  defaultValue="1"
                  className={input}
                />
              </Field>
            </>
          )}
          {dialog.kind === "request-checkout" && (
            <>
              <Field label="Hợp đồng đang thuê">
                <select required name="contract" className={input}>
                  <option value="">Chọn hợp đồng</option>
                  {activeContracts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ngày dự kiến trả">
                <input
                  required
                  min={today}
                  name="date"
                  type="date"
                  defaultValue={today}
                  className={input}
                />
              </Field>
              <Field label="Lý do">
                <textarea
                  required
                  name="reason"
                  className={`${input} min-h-20`}
                />
              </Field>
            </>
          )}
          {dialog.kind === "complete-checkout" && (
            <>
              <div className="rounded-xl bg-amber-50 p-3 text-sm">
                <strong>
                  {dialog.row.contractCode} · Phòng {dialog.row.roomCode}
                </strong>
                <p className="mt-1">
                  Cọc {formatCurrency(dialog.row.depositHeld)} · Công nợ hiện
                  tại {formatCurrency(dialog.row.outstandingDebt)}
                </p>
              </div>
              <Field label="Ngày trả thực tế">
                <input
                  required
                  name="date"
                  type="date"
                  defaultValue={today}
                  className={input}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Chỉ số điện cuối">
                  <input
                    min="0"
                    step="0.01"
                    name="electricity"
                    type="number"
                    className={input}
                  />
                </Field>
                <Field label="Chỉ số nước cuối">
                  <input
                    min="0"
                    step="0.01"
                    name="water"
                    type="number"
                    className={input}
                  />
                </Field>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-3 text-sm font-bold">
                  Chi phí phát sinh (nếu có)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select name="chargeType" className={input}>
                    <option value="DAMAGE">Hư hỏng</option>
                    <option value="UTILITY">Điện nước cuối kỳ</option>
                    <option value="CLEANING">Vệ sinh</option>
                    <option value="PENALTY">Phạt</option>
                    <option value="OTHER">Khác</option>
                  </select>
                  <input
                    min="0"
                    name="chargeAmount"
                    type="number"
                    defaultValue="0"
                    className={input}
                  />
                </div>
                <input
                  name="chargeDescription"
                  placeholder="Mô tả khoản phí"
                  className={`${input} mt-3`}
                />
              </div>
            </>
          )}
          {!["request-checkout"].includes(dialog.kind) && (
            <Field label="Ghi chú">
              <textarea name="note" className={`${input} min-h-20`} />
            </Field>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
            >
              Hủy
            </button>
            <button
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Đang xử lý..." : "Xác nhận"}
              <ArrowRight className="size-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function DatePair() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Ngày bắt đầu">
        <input
          required
          name="start"
          type="date"
          defaultValue={today}
          className={input}
        />
      </Field>
      <Field label="Ngày kết thúc">
        <input
          required
          name="end"
          type="date"
          defaultValue={nextYear}
          className={input}
        />
      </Field>
    </div>
  );
}
function Checklist() {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-4">
      {[
        ["identity", "Đã đối chiếu CCCD"],
        ["contractVerified", "Hợp đồng đã ký/xác nhận"],
        ["depositVerified", "Đã xác nhận tiền cọc"],
      ].map(([name, label]) => (
        <label
          key={name}
          className="flex items-center gap-3 text-sm font-semibold"
        >
          <input required name={name} type="checkbox" className="size-4" />
          {label}
        </label>
      ))}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}
const input =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500";
const linkButton = "text-xs font-semibold text-blue-700";
const table =
  "w-full min-w-[1000px] text-left text-sm [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-3 [&_th]:text-xs [&_th]:uppercase [&_th]:text-slate-500 [&_td]:border-t [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-slate-500";
