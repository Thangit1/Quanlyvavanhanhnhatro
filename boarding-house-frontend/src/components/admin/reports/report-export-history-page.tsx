"use client";
import { Download, RefreshCw } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { useReportExports } from "@/hooks/use-admin-reports";
import { formatDate, statusLabel } from "@/lib/format";
import { adminReportService } from "@/services/admin-report.service";
import { ReportError, ReportNavigation, ReportPanel } from "./report-shared";
export function ReportExportHistoryPage() {
  const query = useReportExports();
  return (
    <AdminShell
      title="Lịch sử xuất báo cáo"
      subtitle="Theo dõi và tải lại các tệp báo cáo còn hiệu lực."
      readOnly
    >
      <div className="space-y-5">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-sm text-slate-500">Báo cáo / Lịch sử xuất</p>
            <h1 className="mt-1 text-3xl font-black">Lịch sử xuất báo cáo</h1>
          </div>
          <button
            onClick={() => void query.refetch()}
            className="btn-secondary"
          >
            <RefreshCw className="size-4" />
            Làm mới
          </button>
        </header>
        <ReportNavigation />
        {query.isError && <ReportError retry={() => void query.refetch()} />}
        <ReportPanel title="Tệp báo cáo của bạn">
          {query.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    {[
                      "Mã",
                      "Loại",
                      "Định dạng",
                      "Tạo lúc",
                      "Hết hạn",
                      "Dung lượng",
                      "Trạng thái",
                      "",
                    ].map((x) => (
                      <th key={x} className="px-3 py-3">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.map((job) => (
                    <tr key={job.id} className="border-t">
                      <td className="px-3 py-3 font-bold">#{job.id}</td>
                      <td className="px-3 py-3">
                        {statusLabel(job.reportType)}
                      </td>
                      <td className="px-3 py-3">{job.format}</td>
                      <td className="px-3 py-3">
                        {formatDate(job.createdAt, true)}
                      </td>
                      <td className="px-3 py-3">
                        {formatDate(job.expiresAt, true)}
                      </td>
                      <td className="px-3 py-3">
                        {job.fileSize
                          ? `${new Intl.NumberFormat("vi-VN").format(job.fileSize)} byte`
                          : "—"}
                      </td>
                      <td className="px-3 py-3">{statusLabel(job.status)}</td>
                      <td className="px-3 py-3">
                        <button
                          disabled={job.status !== "COMPLETED"}
                          onClick={() => void adminReportService.download(job)}
                          className="btn-secondary"
                        >
                          <Download className="size-4" />
                          Tải
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-slate-500">
              Chưa có tác vụ xuất báo cáo.
            </p>
          )}
        </ReportPanel>
      </div>
    </AdminShell>
  );
}
