import { Suspense } from "react";
import { UtilityWorkspacePage } from "@/components/admin/utilities/utility-workspace-page";
import { PageLoading } from "@/components/shared/dashboard-ui";
export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <UtilityWorkspacePage />
    </Suspense>
  );
}
