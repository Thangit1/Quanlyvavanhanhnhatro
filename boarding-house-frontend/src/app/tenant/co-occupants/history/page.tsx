import { TenantShell } from "@/components/tenant/tenant-shell";
import { CoOccupantHistoryPage } from "@/components/tenant/co-occupants/co-occupant-history-page";
export default function Page() {
  return (
    <TenantShell>
      <CoOccupantHistoryPage />
    </TenantShell>
  );
}
