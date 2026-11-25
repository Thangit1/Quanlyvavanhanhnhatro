import { TenantShell } from "@/components/tenant/tenant-shell";
import { SessionsPage } from "@/components/tenant/account/sessions-page";
export default function Page() {
  return (
    <TenantShell>
      <SessionsPage />
    </TenantShell>
  );
}
