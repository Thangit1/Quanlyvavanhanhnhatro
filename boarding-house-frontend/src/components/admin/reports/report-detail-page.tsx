"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  CircleDollarSign,
  Download,
  Gauge,
  Hash,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  useCreateReportExport,
  useReportData,
  useReportOverview,
} from "@/hooks/use-admin-reports";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import { adminReportService } from "@/services/admin-report.service";
import {
  ReportError,
  ReportFilterBar,
  ReportKpi,
  ReportNavigation,
  ReportPanel,
  ReportSkeleton,
  useReportFilterState,
} from "./report-shared";

const titles: Record<string, [string, string]> = {
  occupancy: [
    "Báo cáo vận hành phòng",
    "Theo dõi công suất, trạng thái và hiệu quả khai thác phòng.",
  ],
  operations: [
    "So sánh vận hành khu trọ",
    "Đối chiếu tình trạng phòng giữa các khu trọ được chọn.",
  ],
  revenue: [
    "Báo cáo doanh thu",
    "Doanh thu thực thu từ các thanh toán đã xác nhận.",
  ],
  expenses: [
    "Báo cáo chi phí",
    "Tổng hợp các khoản chi đã xác nhận hoặc phê duyệt.",
  ],
  profit: ["Báo cáo lợi nhuận", "Doanh thu thực thu trừ chi phí hợp lệ."],
  debt: [
    "Hóa đơn và công nợ",
    "Theo dõi khả năng thu tiền và tuổi nợ hóa đơn.",
  ],
  contracts: [
    "Báo cáo hợp đồng",
    "Theo dõi hiệu lực, thời hạn và biến động hợp đồng.",
  ],
  tenants: [
    "Báo cáo người thuê",
    "Tổng hợp cư trú và tình trạng khai báo tạm trú.",
  ],
  utilities: [
    "Báo cáo điện nước",
    "Phân tích chỉ số, mức sử dụng và chi phí tiện ích.",
  ],
  maintenance: [
    "Báo cáo bảo trì",
    "Theo dõi yêu cầu, SLA, thời gian xử lý và chi phí.",
  ],
  assets: [
    "Báo cáo tài sản",
    "Theo dõi số lượng, tình trạng và lịch sử sửa chữa tài sản.",
  ],
};
const labels: Record<string, string> = {
  totalProperties: "Tổng khu trọ",
  totalRooms: "Tổng phòng",
  availableRooms: "Phòng khả dụng",
  occupiedRooms: "Đang thuê",
  vacantRooms: "Còn trống",
  reservedRooms: "Giữ chỗ",
  maintenanceRooms: "Đang sửa chữa",
  inactiveRooms: "Ngừng sử dụng",
  occupancyRate: "Tỷ lệ lấp đầy",
  averageRoomRent: "Giá phòng trung bình",
  confirmedRevenue: "Doanh thu thực thu",
  paymentCount: "Số thanh toán",
  averagePayment: "Thanh toán trung bình",
  totalExpense: "Tổng chi phí",
  expenseCount: "Số khoản chi",
  averageExpense: "Chi phí trung bình",
  confirmedExpense: "Chi phí hợp lệ",
  profit: "Lợi nhuận",
  profitMargin: "Biên lợi nhuận",
  totalInvoiceAmount: "Tổng tiền hóa đơn",
  totalPaidAmount: "Đã thanh toán",
  outstandingDebt: "Công nợ",
  unpaidInvoiceCount: "Hóa đơn chưa thanh toán",
  partiallyPaidInvoiceCount: "Thanh toán một phần",
  overdueInvoiceCount: "Hóa đơn quá hạn",
  collectionRate: "Tỷ lệ thu tiền",
  activeContracts: "Hợp đồng hiệu lực",
  newContracts: "Hợp đồng mới",
  expiringContracts: "Sắp hết hạn",
  expiredContracts: "Đã hết hạn",
  terminatedContracts: "Đã chấm dứt",
  averageTermDays: "Thời hạn trung bình (ngày)",
  activeResidents: "Người đang cư trú",
  representatives: "Đại diện thuê",
  occupants: "Người ở cùng",
  movedIn: "Mới chuyển vào",
  movedOut: "Đã chuyển đi",
  temporaryResidenceMissing: "Chưa khai báo tạm trú",
  electricityUsage: "Điện tiêu thụ",
  waterUsage: "Nước tiêu thụ",
  electricityCost: "Tiền điện",
  waterCost: "Tiền nước",
  measuredRooms: "Phòng có chỉ số",
  totalRequests: "Tổng yêu cầu",
  openRequests: "Đang mở",
  resolvedRequests: "Đã xử lý",
  overdueRequests: "Quá hạn SLA",
  totalCost: "Tổng chi phí",
  averageResolutionHours: "Xử lý trung bình (giờ)",
  totalAssets: "Tổng tài sản",
  goodAssets: "Đang sử dụng tốt",
  maintenanceAssets: "Cần bảo trì",
  damagedAssets: "Hư hỏng",
};
const colors = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#64748b",
];
const moneyKey = (key: string) =>
  /(amount|cost|expense|revenue|profit|debt|rent|price)/i.test(key) &&
  !/(count|rate)/i.test(key);
const percentKey = (key: string) => /(rate|margin|percent)/i.test(key);
function display(key: string, value: unknown) {
  if (value == null) return "—";
  if (moneyKey(key)) return formatCurrency(Number(value));
  if (percentKey(key))
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value))}%`;
  if (/date|at$/i.test(key) && typeof value === "string")
    return formatDate(value, /at$/i.test(key));
  if (/status|priority|type$/i.test(key) && typeof value === "string")
    return statusLabel(value);
  if (typeof value === "number")
    return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(
      value,
    );
  return String(value);
}
function human(key: string) {
  return (
    labels[key] ??
    key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase())
  );
}

export function ReportDetailPage({ type }: { type: string }) {
  const filters = useReportFilterState();
  const options = useReportOverview(filters.applied);
  const query = useReportData(type, filters.applied);
  const exporter = useCreateReportExport();
  const data = query.data;
  const [title, description] = titles[type] ?? [
    "Báo cáo",
    "Dữ liệu báo cáo vận hành.",
  ];
  const columns = data?.details[0] ? Object.keys(data.details[0]) : [];
  const exportReport = async () => {
    const job = await exporter.mutateAsync({
      type,
      filters: filters.applied,
      columns,
    });
    await adminReportService.download(job);
  };
  return (
    <AdminShell title={title} subtitle={description} readOnly>
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Báo cáo / {title}</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                void query.refetch();
                void options.refetch();
              }}
              className="btn-secondary"
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
              />
              Làm mới
            </button>
            <button
              onClick={() => void exportReport()}
              disabled={!data || exporter.isPending}
              className="btn-primary"
            >
              <Download className="size-4" />
              {exporter.isPending ? "Đang tạo..." : "Xuất CSV"}
            </button>
          </div>
        </header>
        <ReportNavigation />
        <ReportFilterBar
          properties={options.data?.availableProperties ?? []}
          state={filters}
        />
        {options.isError && (
          <ReportError
            retry={() => void options.refetch()}
            message="Không thể tải danh sách khu trọ; dữ liệu báo cáo vẫn được xử lý riêng."
          />
        )}
        {query.isLoading && <ReportSkeleton />}
        {query.isError && <ReportError retry={() => void query.refetch()} />}
        {data && (
          <>
            <p className="text-right text-xs text-slate-500">
              Cập nhật lúc {formatDate(data.updatedAt, true)}
            </p>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(data.summary).map(([key, value], i) => (
                <ReportKpi
                  key={key}
                  label={human(key)}
                  value={display(key, value)}
                  icon={
                    [Hash, CircleDollarSign, Gauge, TrendingUp, Activity][i % 5]
                  }
                />
              ))}
            </section>
            <div className="grid gap-5 xl:grid-cols-2">
              <ReportPanel title="Xu hướng theo thời gian">
                {data.trend.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip
                          formatter={(v) =>
                            display(
                              moneyKey(Object.keys(data.summary)[0] ?? "")
                                ? "amount"
                                : "value",
                              Number(v),
                            )
                          }
                        />
                        <Legend />
                        <Bar
                          dataKey="value"
                          name="Giá trị chính"
                          fill="#2563eb"
                          radius={[5, 5, 0, 0]}
                        />
                        <Bar
                          dataKey="secondaryValue"
                          name="Giá trị so sánh"
                          fill="#f59e0b"
                          radius={[5, 5, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-20 text-center text-slate-500">
                    Chưa có dữ liệu xu hướng trong kỳ.
                  </p>
                )}
              </ReportPanel>
              <ReportPanel title="Phân bố dữ liệu">
                {data.breakdown.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.breakdown.map((x) => ({
                            ...x,
                            name: statusLabel(x.label),
                          }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={95}
                        >
                          {data.breakdown.map((x, i) => (
                            <Cell
                              key={x.label}
                              fill={colors[i % colors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) =>
                            new Intl.NumberFormat("vi-VN", {
                              maximumFractionDigits: 2,
                            }).format(Number(v))
                          }
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-20 text-center text-slate-500">
                    Chưa có dữ liệu phân bố trong kỳ.
                  </p>
                )}
              </ReportPanel>
            </div>
            <ReportPanel
              title="Dữ liệu chi tiết"
              description={`Tối đa ${data.details.length} bản ghi trong phạm vi hiện tại.`}
            >
              {data.details.length ? (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          {columns.map((c) => (
                            <th key={c} className="whitespace-nowrap px-3 py-3">
                              {human(c)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.details.map((row, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            {columns.map((c) => (
                              <td
                                key={c}
                                className="max-w-64 px-3 py-3 text-slate-700"
                              >
                                {display(c, row[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {data.details.map((row, i) => (
                      <article
                        key={i}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        {columns.slice(0, 6).map((c) => (
                          <div
                            key={c}
                            className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0"
                          >
                            <span className="text-xs text-slate-500">
                              {human(c)}
                            </span>
                            <span className="text-right text-sm font-medium text-slate-800">
                              {display(c, row[c])}
                            </span>
                          </div>
                        ))}
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-12 text-center text-slate-500">
                  Chưa có dữ liệu báo cáo trong khoảng thời gian này.
                </p>
              )}
            </ReportPanel>
          </>
        )}
        {exporter.isError && (
          <ReportError
            retry={() => void exportReport()}
            message="Không thể tạo tệp CSV. Vui lòng thử lại."
          />
        )}
      </div>
    </AdminShell>
  );
}
