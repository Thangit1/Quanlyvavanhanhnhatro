import { NotificationSettingsPage } from "@/components/tenant/notifications/notification-settings-page";
import { TenantShell } from "@/components/tenant/tenant-shell";
export default function Page() {
  return (
    <TenantShell>
      <NotificationSettingsPage />
    </TenantShell>
  );
}
