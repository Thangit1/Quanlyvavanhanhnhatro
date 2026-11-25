import { AdminContractCreatePage } from "@/components/admin/contracts/contract-create-page";

export default async function Page({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  return <AdminContractCreatePage draftId={Number(contractId)} />;
}
