import { TenantShell } from "@/components/tenant/tenant-shell";
import { ProfilePage } from "@/components/tenant/account/profile-page";
export default function Page() {
  return (
    <TenantShell>
      <ProfilePage />
    </TenantShell>
  );
}
