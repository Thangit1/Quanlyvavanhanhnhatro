import { TenantShell } from "@/components/tenant/tenant-shell";
import { CoOccupantRequestDetailPage } from "@/components/tenant/co-occupants/co-occupant-request-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return (
    <TenantShell>
      <CoOccupantRequestDetailPage requestId={Number(requestId)} />
    </TenantShell>
  );
}
