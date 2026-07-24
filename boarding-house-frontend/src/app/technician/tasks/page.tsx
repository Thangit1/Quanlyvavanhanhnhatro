import { ProtectedPage } from "@/components/auth/protected-page";
export default function Page() { return <ProtectedPage allowedRole="TECHNICIAN" title="Công việc kỹ thuật" />; }
