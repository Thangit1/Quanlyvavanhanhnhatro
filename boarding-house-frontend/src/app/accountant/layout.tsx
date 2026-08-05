import { AccountantShell } from "@/components/accountant/accountant-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AccountantShell>{children}</AccountantShell>;
}
