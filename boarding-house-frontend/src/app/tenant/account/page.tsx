import { TenantShell } from "@/components/tenant/tenant-shell";
import { AccountOverviewPage } from "@/components/tenant/account/account-overview-page";
export default function Page() {
  return (
    <TenantShell>
      <AccountOverviewPage />
    </TenantShell>
  );
}
