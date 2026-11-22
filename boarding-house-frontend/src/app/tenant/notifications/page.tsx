import { CommunicationWorkspace } from "@/components/shared/communication-workspace";
import { TenantShell } from "@/components/tenant/tenant-shell";
export default function Page() {
  return (
    <TenantShell>
      <CommunicationWorkspace />
    </TenantShell>
  );
}
