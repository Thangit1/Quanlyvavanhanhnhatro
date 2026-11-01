import { TenantShell } from "@/components/tenant/tenant-shell";

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantShell>{children}</TenantShell>;
}
