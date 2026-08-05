import { TenantShell } from "@/components/tenant/tenant-shell";
import { CoOccupantDetailPage } from "@/components/tenant/co-occupants/co-occupant-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ occupantId: string }>;
}) {
  const { occupantId } = await params;
  return (
    <TenantShell>
      <CoOccupantDetailPage occupantId={Number(occupantId)} />
    </TenantShell>
  );
}
