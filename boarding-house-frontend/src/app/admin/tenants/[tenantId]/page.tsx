import { TenantDetailPage } from "@/components/admin/tenants/tenant-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <TenantDetailPage tenantId={Number(tenantId)} />;
}
