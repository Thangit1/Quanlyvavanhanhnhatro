import { TenantShell } from "@/components/tenant/tenant-shell";
import { ChangePasswordPage } from "@/components/tenant/account/change-password-page";
export default function Page() {
  return (
    <TenantShell>
      <ChangePasswordPage />
    </TenantShell>
  );
}
