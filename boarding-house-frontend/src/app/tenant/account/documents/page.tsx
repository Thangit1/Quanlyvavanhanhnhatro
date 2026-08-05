import { TenantShell } from "@/components/tenant/tenant-shell";
import { DocumentsPage } from "@/components/tenant/account/documents-page";
export default function Page() {
  return (
    <TenantShell>
      <DocumentsPage />
    </TenantShell>
  );
}
