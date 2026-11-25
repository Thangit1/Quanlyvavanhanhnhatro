import { Suspense } from "react";
import { TenantIntakePage } from "@/components/admin/tenants/tenant-intake-page";
export default function Page() {
  return (
    <Suspense>
      <TenantIntakePage />
    </Suspense>
  );
}
