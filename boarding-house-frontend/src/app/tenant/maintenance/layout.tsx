import { TenantShell } from "@/components/tenant/tenant-shell";

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantShell>{children}</TenantShell>;
}
