import { TenantFormPage } from "@/components/admin/tenants/tenant-form-page";
export default async function Page({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <TenantFormPage tenantId={Number(tenantId)} />;
}
