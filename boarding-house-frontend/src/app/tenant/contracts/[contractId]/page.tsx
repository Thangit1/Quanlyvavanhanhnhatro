import { TenantShell } from "@/components/tenant/tenant-shell";
import { ContractDetailPage } from "@/components/tenant/contracts/contract-detail-page";

export default async function TenantContractDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const [{ contractId }, query] = await Promise.all([params, searchParams]);
  const initialAction =
    query.action === "extension" || query.action === "termination"
      ? query.action
      : null;
  return (
    <TenantShell>
      <ContractDetailPage
        contractId={Number(contractId)}
        initialAction={initialAction}
      />
    </TenantShell>
  );
}
