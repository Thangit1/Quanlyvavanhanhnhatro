import { TenantShell } from "@/components/tenant/tenant-shell";
import { PreferencesPage } from "@/components/tenant/account/preferences-page";
export default function Page() {
  return (
    <TenantShell>
      <PreferencesPage />
    </TenantShell>
  );
}
