"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  Droplets,
  RefreshCw,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/providers/auth-provider";
import { useTenantUtilities } from "@/hooks/use-tenant-utilities";
import type { UtilityHistoryItem, UtilityMetric } from "@/types/tenant-utility";

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function TenantUtilitiesPage() {
  const { user } = useAuth();
  const [contractId, setContractId] = useState<number>();
  const [period, setPeriod] = useState<string>();
  const [chartType, setChartType] = useState<"electricity" | "water">(
    "electricity",
  );
  const [formulaOpen, setFormulaOpen] = useState(false);
  const query = useTenantUtilities(
    user?.activeRole === "TENANT",
    contractId,
    period,
  );
  const data = query.data;
  const selectedPeriod = period ?? data?.selectedPeriod ?? "";
  const selectedContract = contractId ?? data?.selectedContractId ?? undefined;

  const chartData = useMemo(
    () =>
      [...(data?.history ?? [])]
        .slice(0, 6)
        .reverse()
        .map((item) => ({
          period: periodLabel(item.period),
          usage:
            chartType === "electricity"
              ? item.electricityUsage
              : item.waterUsage,
          amount:
            chartType === "electricity"
              ? item.electricityAmount
              : item.waterAmount,
        })),
    [chartType, data?.history],
  );

  if (query.isLoading) return <UtilitiesSkeleton />;

  return (
    <main className="mx-auto max-w-7xl space-y-6 overflow-x-hidden p-4 sm:p-6">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/tenant/home" className="hover:text-blue-700">
          Trang chủ
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Điện &amp; Nước</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">
            Điện &amp; Nước
          </h1>
          <p className="mt-2 text-slate-500">
            Theo dõi chỉ số, mức tiêu thụ và chi phí điện nước của phòng.
          </p>
        </div>
        {data && data.history.length > 0 && (
          <label className="text-sm font-medium text-slate-700">
            Kỳ ghi chỉ số
            <select
              value={selectedPeriod}
              onChange={(event) => setPeriod(event.target.value)}
              className="mt-1 block min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {data.history.map((item) => (
                <option key={item.period} value={item.period}>
                  Tháng {periodLabel(item.period)}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {query.isError ? (
        <UtilityError onRetry={() => void query.refetch()} />
      ) : !data || data.rooms.length === 0 ? (
        <UtilityEmpty text="Chưa có hợp đồng thuê phòng đang hiệu lực để xem chỉ số điện nước." />
      ) : (
        <>
          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Phòng đang sử dụng
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-950">
                Phòng {data.room?.roomCode}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Nhà trọ: {data.room?.propertyName}
              </p>
              {data.periodStart && data.periodEnd && (
                <p className="mt-2 text-sm text-slate-600">
                  Kỳ ghi chỉ số: {date(data.periodStart)} –{" "}
                  {date(data.periodEnd)}
                </p>
              )}
            </div>
            {data.rooms.length > 1 && (
              <label className="text-sm font-medium text-slate-700">
                Phòng của tôi
                <select
                  value={selectedContract}
                  onChange={(event) => {
                    setContractId(Number(event.target.value));
                    setPeriod(undefined);
                  }}
                  className="mt-1 block min-w-56 rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
                >
                  {data.rooms.map((room) => (
                    <option key={room.contractId} value={room.contractId}>
                      {room.propertyName} · Phòng {room.roomCode}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>

          {!data.reading ? (
            <UtilityEmpty text="Chỉ số điện nước sẽ xuất hiện tại đây sau khi được ghi nhận." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={data.reading.status} />
                <button
                  type="button"
                  onClick={() => setFormulaOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                  <Calculator className="size-4" />
                  Xem cách tính
                </button>
              </div>

              <section className="grid gap-4 lg:grid-cols-2">
                <UtilityCard
                  title="Điện"
                  icon={Zap}
                  iconClass="bg-amber-100 text-amber-700"
                  metric={data.reading.electricity}
                  unit="kWh"
                  previous={previousUsage(
                    data.history,
                    selectedPeriod,
                    "electricity",
                  )}
                />
                <UtilityCard
                  title="Nước"
                  icon={Droplets}
                  iconClass="bg-sky-100 text-sky-700"
                  metric={data.reading.water}
                  unit="m³"
                  previous={previousUsage(
                    data.history,
                    selectedPeriod,
                    "water",
                  )}
                />
              </section>

              <CostSummary
                electricity={data.reading.electricity}
                water={data.reading.water}
                total={data.reading.totalAmount}
                invoice={data.reading.invoice}
                period={data.selectedPeriod}
              />

              {chartData.some((item) => item.usage !== null) && (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-950">
                        Mức tiêu thụ
                      </h2>
                      <p className="text-sm text-slate-500">6 tháng gần nhất</p>
                    </div>
                    <div className="flex rounded-xl bg-slate-100 p-1">
                      {(["electricity", "water"] as const).map((type) => (
                        <button
                          type="button"
                          key={type}
                          onClick={() => setChartType(type)}
                          className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold ${chartType === type ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                        >
                          {type === "electricity" ? "Điện" : "Nước"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient
                            id="utility-fill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#2563eb"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="95%"
                              stopColor="#2563eb"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="period" fontSize={12} />
                        <YAxis
                          fontSize={12}
                          unit={chartType === "electricity" ? " kWh" : " m³"}
                        />
                        <Tooltip
                          content={
                            <ChartTooltip
                              unit={chartType === "electricity" ? "kWh" : "m³"}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="usage"
                          stroke="#2563eb"
                          strokeWidth={2}
                          fill="url(#utility-fill)"
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              <UtilityHistory
                history={data.history}
                selectedPeriod={selectedPeriod}
                onSelect={setPeriod}
              />

              {formulaOpen && (
                <FormulaDialog
                  electricity={data.reading.electricity}
                  water={data.reading.water}
                  onClose={() => setFormulaOpen(false)}
                />
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

function UtilityCard({
  title,
  icon: Icon,
  iconClass,
  metric,
  unit,
  previous,
}: {
  title: string;
  icon: typeof Zap;
  iconClass: string;
  metric: UtilityMetric;
  unit: string;
  previous: number | null;
}) {
  const change = percentageChange(metric.usage, previous);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`grid size-11 place-items-center rounded-xl ${iconClass}`}
          >
            <Icon className="size-6" />
          </span>
          <h2 className="text-lg font-extrabold uppercase text-slate-950">
            {title}
          </h2>
        </div>
        {metric.valid && metric.complete && (
          <CheckCircle2
            className="size-5 text-emerald-600"
            aria-label="Chỉ số hợp lệ"
          />
        )}
      </div>
      {!metric.valid ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Chỉ số đang cần được kiểm tra.
        </div>
      ) : !metric.complete ? (
        <p className="mt-5 text-sm text-slate-500">
          Chưa ghi đủ chỉ số đầu kỳ và cuối kỳ.
        </p>
      ) : (
        <>
          <dl className="mt-5 space-y-3 text-sm">
            <MetricRow
              label="Chỉ số cũ"
              value={`${format(metric.previousIndex)} ${unit}`}
            />
            <MetricRow
              label="Chỉ số mới"
              value={`${format(metric.currentIndex)} ${unit}`}
            />
            <div className="border-t border-slate-100 pt-3">
              <MetricRow
                label="Tiêu thụ"
                value={`${format(metric.usage)} ${unit}`}
                strong
              />
            </div>
            <MetricRow
              label="Đơn giá"
              value={`${money(metric.unitPrice)}/${unit}`}
            />
            <div className="border-t border-slate-100 pt-3">
              <MetricRow
                label="Thành tiền"
                value={money(metric.amount)}
                strong
              />
            </div>
          </dl>
          <div className="mt-4 flex items-center gap-2 text-sm">
            {change === null ? (
              <span className="text-slate-500">
                Chưa có dữ liệu tháng trước để so sánh.
              </span>
            ) : change === 0 ? (
              <span className="font-medium text-slate-600">
                Không đổi so với tháng trước
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 font-semibold ${change > 0 ? "text-amber-700" : "text-emerald-700"}`}
              >
                {change > 0 ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <ArrowDownRight className="size-4" />
                )}
                {number.format(Math.abs(change))}% so với tháng trước
              </span>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function CostSummary({
  electricity,
  water,
  total,
  invoice,
  period,
}: {
  electricity: UtilityMetric;
  water: UtilityMetric;
  total: number | null;
  invoice: { id: number; code: string; status: string } | null;
  period: string | null;
}) {
  const safe = electricity.valid && water.valid;
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-extrabold text-slate-950">
        Chi phí điện nước kỳ này
      </h2>
      {!safe ? (
        <p className="mt-4 text-sm font-semibold text-amber-800">
          Chi phí chưa được tổng hợp vì có chỉ số cần kiểm tra.
        </p>
      ) : (
        <dl className="mt-4 max-w-xl space-y-3">
          <MetricRow label="Điện" value={money(electricity.amount)} />
          <MetricRow label="Nước" value={money(water.amount)} />
          <div className="border-t border-blue-200 pt-3">
            <MetricRow label="Tổng cộng" value={money(total)} strong />
          </div>
        </dl>
      )}
      {invoice && (
        <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-emerald-800">
              Đã được tính vào hóa đơn tháng {periodLabel(period)}
            </p>
            <p className="text-sm text-slate-500">Mã hóa đơn: {invoice.code}</p>
          </div>
          <Link
            href={`/tenant/invoices/${invoice.id}`}
            className="inline-flex items-center gap-2 font-semibold text-blue-700 hover:text-blue-800"
          >
            Xem hóa đơn <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </section>
  );
}

function UtilityHistory({
  history,
  selectedPeriod,
  onSelect,
}: {
  history: UtilityHistoryItem[];
  selectedPeriod: string;
  onSelect: (period: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-extrabold text-slate-950">Lịch sử sử dụng</h2>
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-3 py-3 font-semibold">Tháng</th>
              <th className="px-3 py-3 font-semibold">Điện</th>
              <th className="px-3 py-3 font-semibold">Tiền điện</th>
              <th className="px-3 py-3 font-semibold">Nước</th>
              <th className="px-3 py-3 font-semibold">Tiền nước</th>
              <th className="px-3 py-3 font-semibold">Hóa đơn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((item) => (
              <tr
                key={item.period}
                onClick={() => onSelect(item.period)}
                className={`cursor-pointer hover:bg-blue-50 ${selectedPeriod === item.period ? "bg-blue-50" : ""}`}
              >
                <td className="px-3 py-4 font-semibold">
                  {periodLabel(item.period)}
                </td>
                <td className="px-3 py-4">
                  {usage(item.electricityUsage, "kWh", item.electricityValid)}
                </td>
                <td className="px-3 py-4">
                  {item.electricityValid
                    ? money(item.electricityAmount)
                    : "Cần kiểm tra"}
                </td>
                <td className="px-3 py-4">
                  {usage(item.waterUsage, "m³", item.waterValid)}
                </td>
                <td className="px-3 py-4">
                  {item.waterValid ? money(item.waterAmount) : "Cần kiểm tra"}
                </td>
                <td className="px-3 py-4">
                  {item.invoiceId ? "Đã lập" : "Chưa lập"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3 md:hidden">
        {history.map((item) => (
          <button
            type="button"
            key={item.period}
            onClick={() => onSelect(item.period)}
            className={`cursor-pointer rounded-xl border p-4 text-left ${selectedPeriod === item.period ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}
          >
            <div className="flex justify-between gap-2">
              <strong>Tháng {periodLabel(item.period)}</strong>
              <span className="text-xs font-semibold text-slate-500">
                {item.invoiceId ? "Đã lập hóa đơn" : "Chưa lập hóa đơn"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Điện</p>
                <p className="font-semibold">
                  {usage(item.electricityUsage, "kWh", item.electricityValid)}
                </p>
                <p>
                  {item.electricityValid
                    ? money(item.electricityAmount)
                    : "Cần kiểm tra"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Nước</p>
                <p className="font-semibold">
                  {usage(item.waterUsage, "m³", item.waterValid)}
                </p>
                <p>
                  {item.waterValid ? money(item.waterAmount) : "Cần kiểm tra"}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function FormulaDialog({
  electricity,
  water,
  onClose,
}: {
  electricity: UtilityMetric;
  water: UtilityMetric;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="formula-title"
    >
      <button
        className="absolute inset-0 bg-slate-950/50"
        onClick={onClose}
        aria-label="Đóng"
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="formula-title"
              className="text-xl font-extrabold text-slate-950"
            >
              Cách tính điện &amp; nước
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Số tiền ưu tiên theo dữ liệu đã được hệ thống ghi nhận.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-2 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Formula
            title="Cách tính tiền điện"
            metric={electricity}
            unit="kWh"
          />
          <Formula title="Cách tính tiền nước" metric={water} unit="m³" />
        </div>
      </div>
    </div>
  );
}

function Formula({
  title,
  metric,
  unit,
}: {
  title: string;
  metric: UtilityMetric;
  unit: string;
}) {
  if (!metric.valid)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-3 text-sm text-amber-800">
          Chỉ số đang cần được kiểm tra nên hệ thống chưa tính chi phí.
        </p>
      </div>
    );
  if (!metric.complete)
    return (
      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-3 text-sm text-slate-500">
          Chưa có đủ chỉ số để hiển thị cách tính.
        </p>
      </div>
    );
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <dl className="mt-4 space-y-3 text-sm">
        <MetricRow
          label="Chỉ số đầu kỳ"
          value={`${format(metric.previousIndex)} ${unit}`}
        />
        <MetricRow
          label="Chỉ số cuối kỳ"
          value={`${format(metric.currentIndex)} ${unit}`}
        />
        <MetricRow
          label="Tiêu thụ"
          value={`${format(metric.currentIndex)} - ${format(metric.previousIndex)} = ${format(metric.usage)} ${unit}`}
        />
        <MetricRow
          label="Đơn giá"
          value={`${money(metric.unitPrice)}/${unit}`}
        />
        <MetricRow
          label="Thành tiền"
          value={`${format(metric.usage)} × ${money(metric.unitPrice)} = ${money(metric.amount)}`}
          strong
        />
      </dl>
    </div>
  );
}

function MetricRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-right ${strong ? "font-extrabold text-slate-950" : "font-semibold text-slate-800"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    PENDING: "Chưa ghi đủ chỉ số",
    RECORDED: "Đã ghi chỉ số",
    INVOICED: "Đã đưa vào hóa đơn",
  };
  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
      {labels[status] ?? status}
    </span>
  );
}

function UtilityEmpty({ text }: { text: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto flex w-fit gap-2 text-blue-600">
        <Zap />
        <Droplets />
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-slate-900">
        Chưa có dữ liệu điện nước.
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{text}</p>
    </section>
  );
}

function UtilityError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
    >
      <AlertTriangle className="mx-auto size-8 text-red-600" />
      <p className="mt-3 font-semibold text-red-800">
        Không thể tải dữ liệu điện nước.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
      >
        <RefreshCw className="size-4" />
        Thử lại
      </button>
    </section>
  );
}

type ChartPoint = {
  period: string;
  usage: number | null;
  amount: number | null;
};
function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  unit: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <p className="font-bold">Tháng {point.period}</p>
      <p className="mt-1 text-blue-700">
        {format(point.usage)} {unit}
      </p>
      <p className="text-slate-600">{money(point.amount)}</p>
    </div>
  );
}

export function UtilitiesSkeleton() {
  return (
    <main
      className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"
      aria-label="Đang tải dữ liệu điện nước"
    >
      <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
      <div className="space-y-3">
        <div className="h-9 w-64 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
    </main>
  );
}

function previousUsage(
  history: UtilityHistoryItem[],
  selected: string,
  type: "electricity" | "water",
) {
  const index = history.findIndex((item) => item.period === selected);
  if (index < 0 || index + 1 >= history.length) return null;
  const previous = history[index + 1];
  return type === "electricity"
    ? previous.electricityUsage
    : previous.waterUsage;
}

function percentageChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  const value = ((current - previous) / previous) * 100;
  return Number.isFinite(value) ? value : null;
}

function format(value: number | null) {
  return value === null ? "—" : number.format(value);
}
function money(value: number | null) {
  return value === null ? "—" : currency.format(value);
}
function usage(value: number | null, unit: string, valid: boolean) {
  return valid && value !== null
    ? `${format(value)} ${unit}`
    : valid
      ? "—"
      : "Cần kiểm tra";
}
function periodLabel(value: string | null) {
  if (!value) return "—";
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}
function date(value: string) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00`));
}
