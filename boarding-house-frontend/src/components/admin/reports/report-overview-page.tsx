"use client";
import Link from "next/link";
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
  Building2,
  CircleDollarSign,
  Download,
  FileClock,
  House,
  Percent,
  Receipt,
  RefreshCw,
  TrendingUp,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import { adminReportService } from "@/services/admin-report.service";
import {
  useCreateReportExport,
  useReportOverview,
} from "@/hooks/use-admin-reports";
import {
  ReportError,
  ReportFilterBar,
  ReportKpi,
  ReportNavigation,
  ReportPanel,
  ReportSkeleton,
  useReportFilterState,
} from "./report-shared";

const colors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#94a3b8"];
const number = (value: number | undefined) =>
  new Intl.NumberFormat("vi-VN").format(value ?? 0);
const percent = (value: number | undefined) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value ?? 0)}%`;

export function ReportOverviewPage() {
  const filters = useReportFilterState();
  const query = useReportOverview(filters.applied);
  const exporter = useCreateReportExport();
  const data = query.data;
  const s = data?.summary;
  const exportReport = async () => {
    const job = await exporter.mutateAsync({
      type: "revenue",
      filters: filters.applied,
    });
    await adminReportService.download(job);
  };
  const kpis = s
    ? ([
        [
          "Tổng khu trọ",
          number(s.totalProperties),
          Building2,
          "Số khu trọ trong phạm vi được phân quyền.",
        ],
        [
          "Tổng số phòng",
          number(s.totalRooms),
          House,
          "Bao gồm mọi trạng thái phòng.",
        ],
        [
          "Phòng đang thuê",
          number(s.occupiedRooms),
          Users,
          "Phòng có trạng thái đang thuê.",
        ],
        [
          "Phòng còn trống",
          number(s.vacantRooms),
          House,
          "Phòng sẵn sàng cho thuê.",
        ],
        [
          "Tỷ lệ lấp đầy",
          percent(s.occupancyRate),
          Percent,
          "Phòng đang thuê / phòng khả dụng; loại phòng ngừng hoạt động và đang sửa chữa.",
        ],
        [
          "Người đang cư trú",
          number(s.activeTenants),
          Users,
          "Hồ sơ cư trú đang hoạt động.",
        ],
        [
          "Doanh thu thực thu",
          formatCurrency(s.confirmedRevenue),
          CircleDollarSign,
          "Chỉ thanh toán CONFIRMED, đã trừ hoàn tiền.",
        ],
        [
          "Chi phí hợp lệ",
          formatCurrency(s.confirmedExpense),
          WalletCards,
          "Khoản chi CONFIRMED hoặc APPROVED trong kỳ.",
        ],
        [
          "Lợi nhuận",
          formatCurrency(s.profit),
          TrendingUp,
          "Doanh thu thực thu trừ chi phí hợp lệ.",
        ],
        [
          "Tổng công nợ",
          formatCurrency(s.outstandingDebt),
          Receipt,
          "Số tiền còn lại của hóa đơn chưa hủy.",
        ],
        [
          "HĐ sắp hết hạn",
          number(s.expiringContracts),
          FileClock,
          "Hợp đồng hiệu lực kết thúc trong 30 ngày.",
        ],
        [
          "Bảo trì đang mở",
          number(s.openMaintenance),
          Wrench,
          "Yêu cầu chưa nghiệm thu, từ chối hoặc hủy.",
        ],
      ] as const)
    : [];
  return (
    <AdminShell
      title="Báo cáo và thống kê"
      subtitle="Theo dõi tình hình tài chính, công suất phòng và hiệu quả vận hành."
      readOnly
    >
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Tổng quan / Báo cáo</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Báo cáo và thống kê
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Dữ liệu tổng hợp trực tiếp từ các phân hệ vận hành.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => query.refetch()}
              className="btn-secondary"
              aria-label="Làm mới dữ liệu"
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
              />
              Làm mới
            </button>
            <button
              onClick={() => void exportReport()}
              disabled={exporter.isPending || !data}
              className="btn-primary"
            >
              <Download className="size-4" />
              {exporter.isPending ? "Đang tạo..." : "Xuất CSV"}
            </button>
          </div>
        </header>
        <ReportNavigation />
        <ReportFilterBar
          properties={data?.availableProperties ?? []}
          state={filters}
        />
        {query.isLoading && <ReportSkeleton />}
        {query.isError && <ReportError retry={() => void query.refetch()} />}
        {data && (
          <>
            <p className="text-right text-xs text-slate-500">
              Cập nhật lúc {formatDate(data.updatedAt, true)}
            </p>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map(([label, value, icon, hint]) => (
                <ReportKpi
                  key={label}
                  label={label}
                  value={value}
                  icon={icon}
                  hint={hint}
                />
              ))}
            </section>
            <div className="grid gap-5 xl:grid-cols-2">
              <ReportPanel
                title="Doanh thu và chi phí theo tháng"
                description="Doanh thu dựa trên thanh toán đã xác nhận; chi phí dựa trên khoản chi hợp lệ."
              >
                {data.revenueTrend.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.revenueTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Legend />
                        <Bar
                          dataKey="value"
                          name="Doanh thu"
                          fill="#2563eb"
                          radius={[5, 5, 0, 0]}
                        />
                        <Bar
                          dataKey="secondaryValue"
                          name="Chi phí"
                          fill="#f59e0b"
                          radius={[5, 5, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-20 text-center text-slate-500">
                    Chưa có dữ liệu tài chính trong kỳ.
                  </p>
                )}
              </ReportPanel>
              <ReportPanel
                title="Cơ cấu trạng thái phòng"
                description="Phân bố theo trạng thái hiện tại của phòng."
              >
                {data.roomStatus.length ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.roomStatus.map((x) => ({
                            ...x,
                            name: statusLabel(x.label),
                          }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={95}
                        >
                          {data.roomStatus.map((x, i) => (
                            <Cell
                              key={x.label}
                              fill={colors[i % colors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => number(Number(v))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-20 text-center text-slate-500">
                    Chưa có dữ liệu phòng.
                  </p>
                )}
              </ReportPanel>
            </div>
            <ReportPanel title="Cảnh báo vận hành">
              {data.operationalAlerts.length ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {data.operationalAlerts.map((a) => (
                    <Link
                      key={a.code}
                      href={a.actionUrl}
                      className="rounded-xl border border-amber-200 bg-amber-50 p-4 hover:border-amber-400"
                    >
                      <p className="font-bold text-amber-900">{a.title}</p>
                      <p className="mt-1 text-sm text-amber-800">
                        {a.description}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Không có cảnh báo đáng chú ý trong phạm vi hiện tại.
                </p>
              )}
            </ReportPanel>
          </>
        )}
        {exporter.isError && (
          <ReportError
            retry={() => void exportReport()}
            message="Không thể tạo báo cáo CSV. Vui lòng thử lại."
          />
        )}
      </div>
    </AdminShell>
  );
}
