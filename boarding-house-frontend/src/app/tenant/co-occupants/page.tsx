import { TenantShell } from "@/components/tenant/tenant-shell";
import { CoOccupantOverviewPage } from "@/components/tenant/co-occupants/co-occupant-overview-page";
export default function Page() {
  return (
    <TenantShell>
      <CoOccupantOverviewPage />
    </TenantShell>
  );
}
