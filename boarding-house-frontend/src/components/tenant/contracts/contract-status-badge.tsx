import { Ban, CircleCheck, CircleX, Clock3, Hourglass } from "lucide-react";
import { contractStatusLabel, contractStatusStyle } from "@/constants/contract-status";
import type { ContractStatus } from "@/types/tenant-contract";

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const Icon = status === "ACTIVE" ? CircleCheck : status === "EXPIRING" ? Hourglass :
    status === "CANCELLED" ? Ban : ["EXPIRED", "TERMINATED"].includes(status) ? CircleX : Clock3;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${contractStatusStyle[status]}`}>
    <Icon className="size-3.5" aria-hidden="true" />{contractStatusLabel[status]}</span>;
}
