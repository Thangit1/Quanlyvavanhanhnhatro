import { TenantShell } from "@/components/tenant/tenant-shell";
import { SecurityPage } from "@/components/tenant/account/security-page";
export default function Page() {
  return (
    <TenantShell>
      <SecurityPage />
    </TenantShell>
  );
}
