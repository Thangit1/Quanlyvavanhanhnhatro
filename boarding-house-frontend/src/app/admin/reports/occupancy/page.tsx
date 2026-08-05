import { Suspense } from "react";
import { ReportDetailPage } from "@/components/admin/reports/report-detail-page";
import { PageLoading } from "@/components/shared/dashboard-ui";
export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReportDetailPage type="occupancy" />
    </Suspense>
  );
}
