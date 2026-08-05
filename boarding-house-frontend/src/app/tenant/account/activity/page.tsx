import { TenantShell } from "@/components/tenant/tenant-shell";
import { ActivityPage } from "@/components/tenant/account/activity-page";
export default function Page() {
  return (
    <TenantShell>
      <ActivityPage />
    </TenantShell>
  );
}
