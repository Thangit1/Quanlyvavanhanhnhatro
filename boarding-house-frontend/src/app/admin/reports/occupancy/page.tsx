import { Suspense } from "react";
import { ManagementReportWorkspace } from "@/components/admin/reports/management-report-workspace";
export default function Page() {
  return (
    <Suspense fallback={<p>Đang tải báo cáo...</p>}>
      <ManagementReportWorkspace initialType="occupancy" />
    </Suspense>
  );
}
