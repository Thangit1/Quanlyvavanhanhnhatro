import type { LucideIcon } from "lucide-react";
import {
  categoryIcon,
  notificationCategories,
  notificationSeverities,
} from "@/constants/tenant-notification";

export function NotificationIcon({
  category,
  severity,
  className = "",
}: {
  category: string;
  severity: string;
  className?: string;
}) {
  const Icon = categoryIcon(category) as LucideIcon;
  const tone =
    severity === "URGENT"
      ? "bg-danger-muted text-danger"
      : severity === "WARNING"
        ? "bg-warning-muted text-warning"
        : severity === "SUCCESS"
          ? "bg-success-muted text-success"
          : "bg-accent text-link";
  return (
    <span
      className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone} ${className}`}
    >
      <Icon className="size-5" />
    </span>
  );
}
export function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "URGENT"
      ? "bg-danger-muted text-danger"
      : severity === "WARNING"
        ? "bg-warning-muted text-warning"
        : severity === "SUCCESS"
          ? "bg-success-muted text-success"
          : "bg-accent text-link";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>
      {notificationSeverities[
        severity as keyof typeof notificationSeverities
      ] ?? severity}
    </span>
  );
}
export function categoryLabel(category: string) {
  return (
    notificationCategories[category as keyof typeof notificationCategories] ??
    category
  );
}
export function fullNotificationTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Không rõ thời gian"
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
