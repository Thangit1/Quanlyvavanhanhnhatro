import { MaintenanceDetailPage } from "@/components/tenant/maintenance/maintenance-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <MaintenanceDetailPage requestId={Number(requestId)} />;
}
