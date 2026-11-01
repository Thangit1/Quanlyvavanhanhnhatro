import { TenantShell } from "@/components/tenant/tenant-shell";

export default function InvoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantShell>{children}</TenantShell>;
}
