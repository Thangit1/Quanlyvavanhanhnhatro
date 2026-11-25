import { Suspense } from "react";
import { ReportExportHistoryPage } from "@/components/admin/reports/report-export-history-page";
import { PageLoading } from "@/components/shared/dashboard-ui";
export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReportExportHistoryPage />
    </Suspense>
  );
}
