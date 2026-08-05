"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Building2,
  CalendarDays,
  FileText,
  Home,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminContractStatusBadge } from "@/components/admin/contracts/contract-status-badge";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { useAdminContract } from "@/hooks/use-admin-contracts";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";

const contractTypeLabels: Record<string, string> = {
  FIXED_TERM: "Có thời hạn",
  INDEFINITE_TERM: "Không xác định thời hạn",
  SHORT_TERM: "Ngắn hạn",
};

export function AdminContractDetailPage({
  contractId,
}: {
  contractId: number;
}) {
  const query = useAdminContract(contractId);
  if (query.isLoading) return <PageLoading />;

  return (
    <AdminShell title="Chi tiết hợp đồng" subtitle="Hồ sơ và thông tin ký kết">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <Link
          href="/admin/contracts"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách
        </Link>
        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
        {query.data && <ContractContent contract={query.data} />}
      </div>
    </AdminShell>
  );
}

function ContractContent({
  contract,
}: {
  contract: NonNullable<ReturnType<typeof useAdminContract>["data"]>;
}) {
  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 p-5 text-white shadow-lg shadow-blue-100 sm:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
              Hợp đồng thuê phòng
            </p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              {contract.contractCode}
            </h1>
            <p className="mt-2 text-sm text-blue-100">
              {contract.propertyName} · Phòng {contract.roomCode}
            </p>
          </div>
          <AdminContractStatusBadge status={contract.status} />
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <HeroItem
            label="Thời hạn"
            value={`${formatDate(contract.startDate)} – ${formatDate(contract.endDate)}`}
          />
          <HeroItem
            label="Tiền thuê hàng tháng"
            value={formatCurrency(contract.monthlyRent)}
          />
          <HeroItem
            label="Thời gian còn lại"
            value={
              contract.daysRemaining >= 0
                ? `${contract.daysRemaining} ngày`
                : "Đã hết hạn"
            }
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <InfoCard title="Thông tin hợp đồng" icon={FileText}>
            <InfoGrid
              items={[
                ["Mã hợp đồng", contract.contractCode],
                [
                  "Loại hợp đồng",
                  contractTypeLabels[contract.contractType] ?? "Loại khác",
                ],
                ["Ngày tạo", formatDate(contract.createdAt)],
                ["Ngày ký", formatDate(contract.signedAt)],
                ["Ngày bắt đầu", formatDate(contract.startDate)],
                ["Ngày kết thúc", formatDate(contract.endDate)],
                ["Chu kỳ thanh toán", statusLabel(contract.paymentCycle)],
                [
                  "Ngày thanh toán",
                  contract.paymentDueDay
                    ? `Ngày ${contract.paymentDueDay} hàng tháng`
                    : "—",
                ],
                [
                  "Thời gian báo trước",
                  contract.noticePeriodDays != null
                    ? `${contract.noticePeriodDays} ngày`
                    : "—",
                ],
              ]}
            />
          </InfoCard>

          <InfoCard title="Nhà trọ và phòng" icon={Building2}>
            <InfoGrid
              items={[
                ["Nhà trọ", contract.propertyName],
                ["Địa chỉ", contract.propertyAddress || "—"],
                ["Dãy / tòa", contract.buildingName || "—"],
                ["Tầng", contract.floorName || "—"],
                ["Mã phòng", contract.roomCode],
                ["Loại phòng", contract.roomType || "—"],
              ]}
            />
          </InfoCard>

          <InfoCard title="Khách thuê đại diện" icon={UserRound}>
            <div className="flex flex-col justify-between gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-bold text-slate-950">
                  {contract.tenantName}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {contract.tenantCode}
                </p>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-slate-400" />
                  {contract.tenantPhone || "Chưa cập nhật"}
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="size-4 text-slate-400" />
                  {contract.tenantEmail || "Chưa cập nhật"}
                </p>
                <p className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-slate-400" />
                  {contract.maskedIdentityNumber || "Chưa cập nhật giấy tờ"}
                </p>
              </div>
              <Link
                href={`/admin/tenants/${contract.tenantId}`}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Xem hồ sơ
              </Link>
            </div>
          </InfoCard>
        </div>

        <aside className="space-y-6">
          <InfoCard title="Giá trị hợp đồng" icon={Banknote}>
            <dl className="divide-y divide-slate-100">
              <MoneyRow
                label="Tiền thuê / tháng"
                value={contract.monthlyRent}
                strong
              />
              <MoneyRow label="Tiền đặt cọc" value={contract.depositAmount} />
              <MoneyRow
                label="Tiền giữ chỗ"
                value={contract.reservationAmount}
              />
              <MoneyRow label="Phí quản lý" value={contract.managementFee} />
              <MoneyRow
                label="Dịch vụ cố định"
                value={contract.fixedServiceFee}
              />
              <MoneyRow label="Giảm giá" value={contract.discountAmount} />
            </dl>
          </InfoCard>
          <section className="grid grid-cols-2 gap-3">
            <MiniCard
              icon={UsersRound}
              label="Người đang ở"
              value={contract.occupantCount}
            />
            <MiniCard
              icon={FileText}
              label="Tài liệu"
              value={contract.documentCount}
            />
          </section>
          {contract.note && (
            <InfoCard title="Ghi chú nội bộ" icon={CalendarDays}>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                {contract.note}
              </p>
            </InfoCard>
          )}
        </aside>
      </div>
    </>
  );
}

function HeroItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs text-blue-100">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Home;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-bold text-slate-950">
        <span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd
        className={
          strong
            ? "font-extrabold text-blue-700"
            : "font-semibold text-slate-900"
        }
      >
        {formatCurrency(value)}
      </dd>
    </div>
  );
}
function MiniCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Home;
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="size-5 text-blue-600" />
      <p className="mt-3 text-2xl font-extrabold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </article>
  );
}
