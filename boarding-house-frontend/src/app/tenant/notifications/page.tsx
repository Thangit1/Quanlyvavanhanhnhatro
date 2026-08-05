import { NotificationListPage } from "@/components/tenant/notifications/notification-list-page";
import { TenantShell } from "@/components/tenant/tenant-shell";
export default function Page() {
  return (
    <TenantShell>
      <NotificationListPage />
    </TenantShell>
  );
}
