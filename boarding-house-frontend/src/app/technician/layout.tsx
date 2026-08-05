import { TechnicianShell } from "@/components/technician/technician-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <TechnicianShell>{children}</TechnicianShell>;
}
