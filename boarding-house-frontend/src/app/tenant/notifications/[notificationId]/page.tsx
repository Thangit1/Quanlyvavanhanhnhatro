import { NotificationDetailPage } from "@/components/tenant/notifications/notification-detail-page";
import { TenantShell } from "@/components/tenant/tenant-shell";
export default function Page() {
  return (
    <TenantShell>
      <NotificationDetailPage />
    </TenantShell>
  );
}
