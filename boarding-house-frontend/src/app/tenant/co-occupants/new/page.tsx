import { TenantShell } from "@/components/tenant/tenant-shell";
import { CoOccupantNewPage } from "@/components/tenant/co-occupants/co-occupant-new-page";
export default function Page() {
  return (
    <TenantShell>
      <CoOccupantNewPage />
    </TenantShell>
  );
}
