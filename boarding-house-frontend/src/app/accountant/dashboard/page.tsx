import { ProtectedPage } from "@/components/auth/protected-page";
export default function Page() { return <ProtectedPage allowedRole="ACCOUNTANT" title="Tổng quan kế toán" />; }
