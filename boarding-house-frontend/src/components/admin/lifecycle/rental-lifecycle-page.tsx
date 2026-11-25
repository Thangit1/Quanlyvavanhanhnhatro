"use client";
import { CurrencyInput, NumberInput } from "@/components/ui/number-input";

import { ContractOnboardingPanel } from "@/components/shared/contract-onboarding-panel";
import { CheckoutSettlementPanel } from "@/components/shared/checkout-settlement-panel";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckoutWorkspace } from "./checkout-workspace";
import { useManagementProperty } from "@/providers/management-scope";
import { DepositLedgerPanel } from "@/components/shared/deposit-ledger-panel";
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
  | { kind: "extend-booking"; row: BookingRow }
  | { kind: "contract"; row: BookingRow }
  | { kind: "prepare-checkin" }
  | { kind: "complete-checkin"; row: CheckinRow }
  | { kind: "request-checkout" }
  | { kind: "complete-checkout"; row: CheckoutRow }
  | null;
const today = new Date().toISOString().slice(0, 10);
const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;

export function RentalLifecyclePage() {
  const params = useSearchParams();
  return params.get("tab") === "checkout" ? <CheckoutWorkspace /> : <RentalLifecycleBoardPage />;
}
function RentalLifecycleBoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [propertyId, setPropertyId] = useManagementProperty(
    Number(searchParams.get("propertyId")) || undefined,
  );
  const selectedRoom = Number(searchParams.get("roomId")) || undefined;
  const requestedTab = searchParams.get("tab");
  const [previousTab, setPreviousTab] = useState(requestedTab);
  const [tab, setTab] = useState<Tab>(
    requestedTab === "checkin" || requestedTab === "checkout"
      ? requestedTab
      : "booking",
  );
  if (previousTab !== requestedTab) {
    setPreviousTab(requestedTab);
    setTab(
      requestedTab === "checkin" || requestedTab === "checkout"
        ? requestedTab
        : "booking",
    );
  }
  const [dialog, setDialog] = useState<Dialog>(
    searchParams.get("action") === "booking" ? { kind: "booking" } : null,
  );
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
            data={
              selectedRoom
                ? {
                    ...query.data,
                    bookings: query.data.bookings.filter(
                      (r) => r.roomId === selectedRoom,
                    ),
                    checkins: query.data.checkins.filter(
                      (r) => r.roomId === selectedRoom,
                    ),
                    checkouts: query.data.checkouts.filter(
                      (r) => r.roomId === selectedRoom,
                    ),
                  }
                : query.data
            }
            propertyId={propertyId}
            setPropertyId={setPropertyId}
            tab={tab}
            setTab={(next) => next === "checkout" ? router.push("/admin/checkouts") : setTab(next)}
            setDialog={setDialog}
            mutations={mutations}
          />
        )}
        <div id="deposits" className="scroll-mt-44">
          <DepositLedgerPanel portal="admin" propertyId={propertyId} />
        </div>
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
      "bg-accent text-link",
    ],
    [
      "Chờ nhận phòng",
      data.summary.awaitingCheckin,
      CalendarCheck,
      "bg-warning-muted text-warning",
    ],
    [
      "Đang cư trú",
      data.summary.staying,
      House,
      "bg-success-muted text-success",
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
      "bg-danger-muted text-danger",
    ],
  ] as const;
  return (
    <>
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            Quy trình vận hành thuê phòng
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
            className="surface-card p-4 "
          >
            <span
              className={`grid size-9 place-items-center rounded-xl ${color}`}
            >
              <Icon className="size-4" />
            </span>
            <p className="mt-3 text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-extrabold">{value}</p>
          </article>
        ))}
      </section>
      <section className="surface-card ">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <nav className="flex gap-1">
            {(["booking", "checkin", "checkout"] as Tab[]).map((x) => (
              <button
                key={x}
                onClick={() => setTab(x)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === x ? "bg-primary hover:bg-primary-hover text-white" : "text-secondary-foreground hover:bg-muted"}`}
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
            className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white"
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
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const filtered = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.code} ${r.tenantName} ${r.tenantPhone ?? ""} ${r.propertyName} ${r.roomCode}`
        .toLocaleLowerCase("vi")
        .includes(keyword.trim().toLocaleLowerCase("vi")),
  );
  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          aria-label="Tìm phiếu giữ phòng"
          placeholder="Mã phiếu, khách, nhà hoặc phòng"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className={input}
        />
        <select
          aria-label="Trạng thái giữ phòng"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={input}
        >
          <option value="">Tất cả trạng thái</option>
          {[
            "RESERVED",
            "DEPOSITED",
            "CONTRACT_CREATED",
            "CHECKED_IN",
            "CANCELLED",
            "EXPIRED",
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Tiền giữ chỗ dưới đây là mức thỏa thuận. Xem giao dịch thực thu, hoàn và
        chuyển cọc trong sổ cọc bên dưới.
      </p>
      {!filtered.length && (
        <EmptyState text="Chưa có phiếu giữ phòng phù hợp." />
      )}
      {mutation.isError && (
        <p role="alert" className="mb-3 text-sm text-danger">
          {apiErrorMessage(mutation.error)}
        </p>
      )}
      <table className={table}>
        <thead>
          <tr>
            <th>Booking</th>
            <th>Người thuê</th>
            <th>Nhà / phòng</th>
            <th>Thời gian giữ</th>
            <th>Tiền giữ chỗ thỏa thuận</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.code}</strong>
                <small>Tạo {formatDate(r.createdAt)}</small>
                {r.createdByName && <small>Người lập: {r.createdByName}</small>}
              </td>
              <td>
                {r.tenantName}
                <small>{r.tenantPhone || "Chưa có số điện thoại"}</small>
              </td>
              <td>
                {r.propertyName}
                <small>Phòng {r.roomCode}</small>
              </td>
              <td>
                {formatDate(r.reservationStart)}
                <small>đến {formatDate(r.reservationEnd)}</small>
                {["RESERVED", "DEPOSITED"].includes(r.status) &&
                  r.reservationEnd <= today && (
                    <small className="text-warning">
                      Đã quá hạn; chờ tác vụ hết hạn. Không thể lập hợp đồng.
                    </small>
                  )}
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
                    <span className="text-xs text-muted-foreground">
                      Thu tiền qua sổ giữ chỗ bên dưới
                    </span>
                  )}
                  {r.reservationEnd > today &&
                    (r.status === "DEPOSITED" ||
                      (r.status === "RESERVED" &&
                        Number(r.depositAmount) === 0)) && (
                      <button
                        className={linkButton}
                        onClick={() => setDialog({ kind: "contract", row: r })}
                      >
                        Tạo HĐ
                      </button>
                    )}
                  {["RESERVED", "DEPOSITED"].includes(r.status) &&
                    r.reservationEnd > today && (
                      <button
                        className={linkButton}
                        onClick={() =>
                          setDialog({ kind: "extend-booking", row: r })
                        }
                      >
                        Gia hạn giữ chỗ
                      </button>
                    )}
                  {["RESERVED", "DEPOSITED"].includes(r.status) && (
                    <button
                      className="text-xs font-semibold text-danger"
                      disabled={mutation.isPending}
                      onClick={() => {
                        const reason = window.prompt(
                          "Lý do hủy phiếu giữ phòng (tiền đã thu được xử lý riêng trong sổ cọc):",
                        );
                        if (!reason?.trim()) return;
                        mutation.mutate({
                          id: r.id,
                          status: "CANCELLED",
                          reason: reason.trim(),
                          version: r.version,
                        });
                      }}
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
                {["COMPLETED", "SETTLEMENT"].includes(r.status) ? (
                  <>
                    Phải hoàn {formatCurrency(r.refundAmount)}
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
                {r.id > 0 && (
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
  const routeParams = useSearchParams();
  const requestedProperty = Number(routeParams.get("propertyId"));
  const [property, setProperty] = useState(
    data.properties.some((p) => p.id === requestedProperty)
      ? requestedProperty
      : (data.properties[0]?.id ?? 0),
  );
  const title = {
    booking: "Giữ phòng mới",
    "extend-booking": "Gia hạn giữ chỗ",
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
      if (dialog.kind === "extend-booking")
        await mutations.extendBooking.mutateAsync({
          id: dialog.row.id,
          reservationEnd: str("end"),
          reason: str("note"),
          version: dialog.row.version,
        });
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
          reservationTransferAmount: num("reservationTransfer"),
          monthlyRent: num("monthlyRent"),
          initialPaymentRequired: f.get("initialPaymentRequired") === "on",
          utilityRates: ["ELECTRICITY", "WATER"].map((code) => ({
            code,
            name: code === "ELECTRICITY" ? "Điện" : "Nước",
            calculationMethod: str(`${code}-method`),
            unitPrice: num(`${code}-price`),
            unit:
              str(`${code}-method`) === "METER"
                ? code === "ELECTRICITY"
                  ? "kWh"
                  : "m3"
                : "tháng",
          })),
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
  if (dialog.kind === "complete-checkin")
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl bg-card p-5">
          <button className="mb-4 text-link" onClick={close}>
            Đóng
          </button>
          <ContractOnboardingPanel
            portal="admin"
            contractId={dialog.row.contractId}
          />
        </div>
      </div>
    );
  if (dialog.kind === "complete-checkout")
    return (
      <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-card p-5">
          <button className="mb-4 text-link" onClick={close}>
            Đóng
          </button>
          <CheckoutSettlementPanel
            portal="admin"
            contractId={dialog.row.contractId}
          />
        </div>
      </div>
    );
  const availableRooms = data.rooms.filter(
    // Availability is still enforced again at the backend.
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
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={close} aria-label="Đóng">
            <X />
          </button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          {error && (
            <p className="rounded-xl bg-danger-muted p-3 text-sm text-danger">
              {error}
            </p>
          )}
          {dialog.kind === "extend-booking" && (
            <Field label="Ngày hết hạn mới (không bao gồm)">
              <input
                required
                type="date"
                name="end"
                min={dialog.row.reservationEnd}
                defaultValue={dialog.row.reservationEnd}
                className={input}
              />
            </Field>
          )}
          {dialog.kind === "booking" && (
            <>
              <p className="text-xs text-muted-foreground">
                Phòng được giữ ngay khi tạo booking. Hệ thống chưa nhận nhiều
                lịch giữ chỗ tương lai trên cùng phòng.
              </p>
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
                <select
                  key={property}
                  required
                  name="room"
                  defaultValue={
                    availableRooms.some(
                      (r) => r.id === Number(routeParams.get("roomId")),
                    )
                      ? routeParams.get("roomId")!
                      : ""
                  }
                  className={input}
                >
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
                <CurrencyInput
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
              <p className="rounded-xl bg-accent p-3 text-sm">
                {dialog.row.code} · {dialog.row.tenantName} · Phòng{" "}
                {dialog.row.roomCode}
              </p>
              <DatePair />
              <Field label="Giá thuê thỏa thuận mỗi tháng">
                <CurrencyInput
                  required
                  min="0"
                  step="0.01"
                  name="monthlyRent"
                  type="number"
                  className={input}
                />
              </Field>
              {["ELECTRICITY", "WATER"].map((code) => (
                <div key={code} className="grid grid-cols-2 gap-3">
                  <Field
                    label={
                      code === "ELECTRICITY"
                        ? "Cách tính điện"
                        : "Cách tính nước"
                    }
                  >
                    <select required name={`${code}-method`} className={input}>
                      <option value="METER">Đồng hồ riêng</option>
                      <option value="FIXED">Phí cố định / không thu</option>
                    </select>
                  </Field>
                  <Field label="Đơn giá thỏa thuận">
                    <CurrencyInput
                      required
                      min="0"
                      step="0.01"
                      name={`${code}-price`}
                      type="number"
                      className={input}
                    />
                  </Field>
                </div>
              ))}
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="initialPaymentRequired" />
                Yêu cầu thanh toán hóa đơn thuê đầu kỳ trước nhận phòng
              </label>
              <Field label="Tiền cọc hợp đồng">
                <CurrencyInput
                  required
                  min="0"
                  name="deposit"
                  type="number"
                  defaultValue={dialog.row.depositAmount}
                  className={input}
                />
              </Field>
              <Field label="Tiền giữ chỗ được thống nhất chuyển sang cọc">
                <CurrencyInput
                  required
                  min="0"
                  name="reservationTransfer"
                  type="number"
                  defaultValue={dialog.row.depositAmount}
                  className={input}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Chỉ chuyển tiền đã thực nhận. Phần giữ chỗ còn dư được theo dõi
                riêng và phải xử lý theo thỏa thuận.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày hạn thanh toán">
                  <NumberInput
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
                  <NumberInput
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
          {!["request-checkout"].includes(dialog.kind) && (
            <Field label="Ghi chú">
              <textarea
                required={dialog.kind === "extend-booking"}
                name="note"
                className={`${input} min-h-20`}
              />
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
              className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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
      <Field label="Ngày kết thúc (không bao gồm)">
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
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-secondary-foreground">
      {label}
      {children}
    </label>
  );
}
const input =
  "mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring";
const linkButton = "text-xs font-semibold text-link";
const table =
  "w-full min-w-[1000px] text-left text-sm [&_th]:bg-muted [&_th]:px-3 [&_th]:py-3 [&_th]:text-xs [&_th]:uppercase [&_th]:text-muted-foreground [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-3 [&_small]:mt-1 [&_small]:block [&_small]:text-xs [&_small]:text-muted-foreground";
