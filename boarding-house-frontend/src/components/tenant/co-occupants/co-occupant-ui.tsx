import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";
import {
  label,
  requestStatusLabels,
  residenceRoleLabels,
  residenceStatusLabels,
  temporaryResidenceLabels,
} from "@/constants/tenant-co-occupant";
export function Badge({
  kind,
  value,
}: {
  kind: "role" | "residence" | "temporary" | "request";
  value: string;
}) {
  const map =
    kind === "role"
      ? residenceRoleLabels
      : kind === "temporary"
        ? temporaryResidenceLabels
        : kind === "request"
          ? requestStatusLabels
          : residenceStatusLabels;
  const warning =
    value.includes("PENDING") ||
    value.includes("NEED") ||
    value === "SUBMITTED" ||
    value === "UNDER_REVIEW";
  const danger =
    value === "REJECTED" || value === "EXPIRED" || value === "CANCELLED";
  const Icon = danger ? AlertCircle : warning ? Clock3 : CheckCircle2;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${danger ? "bg-red-50 text-red-700" : warning ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
    >
      <Icon className="size-3.5" />
      {label(map, value)}
    </span>
  );
}
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
