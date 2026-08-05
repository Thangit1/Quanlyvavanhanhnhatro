"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  CalendarDays,
  FileClock,
  History,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useCoOccupantOverview,
  useCoOccupants,
  useCoOccupantRequests,
} from "@/hooks/use-tenant-co-occupants";
import {
  EmptyState,
  ErrorState,
  PageLoading,
} from "@/components/shared/dashboard-ui";
import { formatDate } from "@/lib/format";
import { Badge, initials } from "./co-occupant-ui";
import { requestTypeLabels, label } from "@/constants/tenant-co-occupant";

export function CoOccupantOverviewPage() {
  const { user } = useAuth();
  const enabled = user?.activeRole === "TENANT";
  const overview = useCoOccupantOverview(enabled);
  const occupants = useCoOccupants(enabled);
  const [tab, setTab] = useState<"ACTIVE" | "REQUESTS">("ACTIVE");
  const requests = useCoOccupantRequests(
    enabled && !!overview.data?.permissions.canViewHistory,
  );
  if (overview.isLoading || occupants.isLoading) return <PageLoading />;
  if (
    overview.isError ||
    occupants.isError ||
    !overview.data ||
    !occupants.data
  )
    return (
      <main className="p-5">
        <ErrorState
          onRetry={() => {
            void overview.refetch();
            void occupants.refetch();
          }}
        />
      </main>
    );
  const d = overview.data;
  const cards = [
    ["Tổng người đang ở", d.summary.activeOccupantCount, Users],
    ["Người đại diện", d.summary.representativeCount, UserRoundCheck],
    ["Người ở cùng", d.summary.coOccupantCount, Users],
    ["Yêu cầu đang chờ", d.summary.pendingRequestCount, FileClock],
    [
      "Chưa xong tạm trú",
      d.summary.temporaryResidencePendingCount,
      ShieldCheck,
    ],
  ] as const;
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-28 sm:p-6 lg:pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Trang chủ / Người ở cùng</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Người ở cùng
          </h1>
          <p className="mt-1 text-slate-500">
            Quản lý thông tin những người đang cư trú cùng phòng với bạn.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void overview.refetch();
              void occupants.refetch();
              void requests.refetch();
            }}
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold"
          >
            <RefreshCw className="size-4" />
            Làm mới
          </button>
          {d.permissions.canCreateOccupantRequest && (
            <Link
              href="/tenant/co-occupants/new"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
            >
              <Plus className="size-4" />
              Đăng ký người ở cùng
            </Link>
          )}
        </div>
      </header>
      {!d.permissions.canCreateOccupantRequest &&
        d.permissions.createDisabledReason && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            {d.permissions.createDisabledReason}
          </div>
        )}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 to-blue-500 p-6 text-white shadow-lg shadow-blue-100">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm text-blue-100">
              <Building2 className="size-4" />
              Phòng đang cư trú
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {d.room.propertyName} · Phòng {d.room.roomCode}
            </h2>
            <p className="mt-2 flex items-center gap-2 text-sm text-blue-100">
              <MapPin className="size-4" />
              {d.room.address}
            </p>
            <p className="mt-1 text-sm text-blue-100">
              {[
                d.room.buildingName,
                d.room.floorName,
                d.room.roomType,
                d.room.area ? `${d.room.area} m²` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 p-5 backdrop-blur">
            <p className="text-3xl font-black">
              {d.room.currentOccupantCount}/{d.room.maximumOccupants}
            </p>
            <p className="text-sm text-blue-100">người đang cư trú</p>
            <p className="mt-2 font-semibold">
              {d.room.capacityStatus === "OVER_CAPACITY"
                ? "Phòng đang vượt sức chứa"
                : d.room.availableSlots === 0
                  ? "Phòng đã đủ người"
                  : `Còn ${d.room.availableSlots} chỗ`}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-4 border-t border-white/20 pt-4 text-sm">
          <span>
            Đại diện: <b>{d.contract.representativeName}</b>
          </span>
          <span>
            Hợp đồng: <b>{d.contract.code}</b>
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="size-4" />
            Hết hạn {formatDate(d.contract.endDate)}
          </span>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(([name, value, Icon]) => (
          <article
            key={name}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <Icon className="size-5 text-blue-600" />
            <p className="mt-3 text-2xl font-black">{value}</p>
            <p className="text-sm text-slate-500">{name}</p>
          </article>
        ))}
      </section>
      <section>
        <div className="flex gap-2 overflow-x-auto border-b pb-3">
          <button
            onClick={() => setTab("ACTIVE")}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === "ACTIVE" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
          >
            Đang cư trú ({d.summary.activeOccupantCount})
          </button>
          {d.permissions.canViewHistory && (
            <button
              onClick={() => setTab("REQUESTS")}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === "REQUESTS" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
            >
              Yêu cầu đang xử lý ({d.summary.pendingRequestCount})
            </button>
          )}{" "}
          {d.permissions.canViewHistory && (
            <Link
              href="/tenant/co-occupants/history"
              className="ml-auto inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-blue-700"
            >
              <History className="size-4" />
              Lịch sử
            </Link>
          )}
        </div>
        {tab === "ACTIVE" ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {occupants.data.content.length ? (
              occupants.data.content.map((o) => (
                <article
                  key={o.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <div className="flex gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-100 font-black text-blue-700">
                      {initials(o.fullName)}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-bold text-slate-950">
                        {o.fullName}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {o.tenantCode} ·{" "}
                        {o.maskedPhone || "Chưa có số điện thoại"}
                      </p>
                      <div className="mt-2">
                        <Badge kind="role" value={o.residenceRole} />
                      </div>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Chuyển vào</dt>
                      <dd className="font-semibold">
                        {formatDate(o.moveInDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Quan hệ</dt>
                      <dd className="font-semibold">{o.relationship || "—"}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge kind="residence" value={o.residenceStatus} />
                    <Badge
                      kind="temporary"
                      value={o.temporaryResidenceStatus}
                    />
                  </div>
                  {o.permissions.canViewDetail && (
                    <Link
                      href={`/tenant/co-occupants/${o.id}`}
                      className="mt-4 block rounded-xl border border-blue-200 py-2.5 text-center text-sm font-bold text-blue-700"
                    >
                      Xem chi tiết
                    </Link>
                  )}
                </article>
              ))
            ) : (
              <EmptyState text="Hiện chưa có người ở cùng được đăng ký." />
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {requests.isLoading ? (
              <PageLoading />
            ) : requests.data?.content.length ? (
              requests.data.content.map((r) => (
                <Link
                  key={r.id}
                  href={`/tenant/co-occupants/requests/${r.id}`}
                  className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <p className="font-bold">{r.personName}</p>
                    <p className="text-sm text-slate-500">
                      {r.requestCode} ·{" "}
                      {label(requestTypeLabels, r.requestType)} · Gửi{" "}
                      {formatDate(r.submittedAt, true)}
                    </p>
                    {r.informationRequest && (
                      <p className="mt-2 text-sm text-amber-700">
                        {r.informationRequest}
                      </p>
                    )}
                  </div>
                  <Badge kind="request" value={r.status} />
                </Link>
              ))
            ) : (
              <EmptyState text="Hiện chưa có yêu cầu người ở cùng." />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
