import { AdminContractDetailPage } from "@/components/admin/contracts/contract-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  return <AdminContractDetailPage contractId={Number(contractId)} />;
}
