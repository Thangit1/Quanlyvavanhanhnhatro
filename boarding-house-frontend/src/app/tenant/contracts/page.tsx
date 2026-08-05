import { TenantShell } from "@/components/tenant/tenant-shell";
import { ContractListPage } from "@/components/tenant/contracts/contract-list-page";

export default function TenantContractsPage() {
  return (
    <TenantShell>
      <ContractListPage />
    </TenantShell>
  );
}
