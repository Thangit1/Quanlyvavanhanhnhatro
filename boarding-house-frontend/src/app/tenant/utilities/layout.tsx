import { TenantShell } from "@/components/tenant/tenant-shell";

export default function UtilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantShell>{children}</TenantShell>;
}
