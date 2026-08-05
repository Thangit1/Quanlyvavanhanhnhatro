import { TenantShell } from "@/components/tenant/tenant-shell";
import { SupportPage } from "@/components/tenant/account/support-page";
export default function Page() {
  return (
    <TenantShell>
      <SupportPage />
    </TenantShell>
  );
}
