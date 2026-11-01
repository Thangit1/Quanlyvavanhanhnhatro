import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CircleDollarSign,
  FileText,
  Home,
  Receipt,
  UserRound,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

export type TenantNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const tenantNavigationItems: readonly TenantNavigationItem[] = [
  { label: "Tổng quan", href: "/tenant/home", icon: Home },
  { label: "Hợp đồng", href: "/tenant/contracts", icon: FileText },
  { label: "Hóa đơn", href: "/tenant/invoices", icon: Receipt },
  { label: "Thanh toán", href: "/tenant/payments", icon: CircleDollarSign },
  { label: "Điện & Nước", href: "/tenant/utilities", icon: Zap },
  { label: "Yêu cầu sửa chữa", href: "/tenant/maintenance", icon: Wrench },
  { label: "Người ở cùng", href: "/tenant/co-occupants", icon: Users },
  { label: "Thông báo", href: "/tenant/notifications", icon: Bell },
  { label: "Tài khoản", href: "/tenant/account", icon: UserRound },
] as const;

const mobileHrefs = new Set([
  "/tenant/home",
  "/tenant/invoices",
  "/tenant/maintenance",
  "/tenant/notifications",
  "/tenant/account",
]);

export const tenantMobileNavigationItems = tenantNavigationItems.filter(
  ({ href }) => mobileHrefs.has(href),
);

export function isTenantNavigationActive(pathname: string, href: string) {
  if (href === "/tenant/home") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
