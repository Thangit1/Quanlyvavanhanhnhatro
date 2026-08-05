import { Suspense } from "react";
import { ReportOverviewPage } from "@/components/admin/reports/report-overview-page";
import { PageLoading } from "@/components/shared/dashboard-ui";
export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReportOverviewPage />
    </Suspense>
  );
}
