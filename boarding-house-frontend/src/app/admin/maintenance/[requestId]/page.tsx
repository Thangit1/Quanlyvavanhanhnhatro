import { MaintenanceDetailPage } from "@/components/admin/maintenance/maintenance-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <MaintenanceDetailPage id={Number(requestId)} />;
}
