"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { adminPropertyService } from "@/services/admin-property.service";
import { organizationService } from "@/services/organization.service";
import { adminReportService } from "@/services/admin-report.service";
import { currentSessionEpoch } from "@/services/api-client";
import { usePathname } from "next/navigation";

export function reportingRange(period: string, now = new Date()) {
  const year = now.getFullYear();
  const month =
    period === "YEAR"
      ? 0
      : period === "QUARTER"
        ? Math.floor(now.getMonth() / 3) * 3
        : now.getMonth();
  const end = new Date(
    year,
    month + (period === "YEAR" ? 12 : period === "QUARTER" ? 3 : 1),
    0,
  );
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { startDate: iso(new Date(year, month, 1)), endDate: iso(end) };
}

type Scope = {
  propertyId?: number;
  setPropertyId: (id?: number) => void;
  properties: { id: number; name: string }[];
  period: string;
  setPeriod: (period: string) => void;
  canReadFinance: boolean;
  canReadFinanceFor: (propertyId: number) => boolean;
  loading: boolean;
  error: boolean;
  retry: () => void;
  propertyGroups: {
    label: string;
    properties: { id: number; name: string }[];
  }[];
};
const Context = createContext<Scope | null>(null);

export function ManagementScopeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  // Public recovery forms must survive bootstrap/logout epoch changes: their bearer
  // reset token lives only in component memory after removing the URL fragment.
  if (pathname === "/reset-password" || pathname === "/forgot-password")
    return children;
  return (
    <ScopeSession
      key={`${user?.id}:${user?.activeRole}:${currentSessionEpoch()}`}
    >
      {children}
    </ScopeSession>
  );
}

function ScopeSession({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const enabled = !!user && ["OWNER", "MANAGER"].includes(user.activeRole);
  const [selected, setSelected] = useState<number>();
  const [period, setPeriod] = useState("MONTH");
  const options = useScopedQuery({
    queryKey: ["management-scope"],
    queryFn: async ({ signal }) =>
      (await adminPropertyService.options(signal)).properties.map((p) => ({
        id: p.id,
        name: p.label,
      })),
    enabled,
  });
  // The report scope is supplied by the server after FINANCE_READ filtering.
  const finance = useScopedQuery({
    queryKey: ["management-finance-access"],
    queryFn: ({ signal }) =>
      adminReportService.overview(reportingRange("MONTH"), signal),
    enabled: enabled && user?.activeRole === "MANAGER",
    retry: false,
  });
  const properties = options.isError ? [] : (options.data ?? []);
  const directory = useScopedQuery({
    queryKey: ["management-property-directory"],
    queryFn: async ({ signal }) => {
      const organizations = await organizationService.list(signal);
      return Promise.all(
        organizations.map(async (org) => ({
          name: org.name,
          detail: await organizationService.detail(org.id, signal),
        })),
      );
    },
    enabled: enabled && user?.activeRole === "OWNER",
    retry: false,
  });
  const grouped = new Set<number>();
  const propertyGroups: Scope["propertyGroups"] = [];
  if (!directory.isError)
    for (const org of directory.data ?? []) {
      for (const area of [null, ...org.detail.areas]) {
        const ids = new Set(
          org.detail.relationships
            .filter((r) => !r.ended_at && r.area_id === (area?.id ?? null))
            .map((r) => r.property_id),
        );
        const items = properties.filter(
          (p) => ids.has(p.id) && !grouped.has(p.id),
        );
        items.forEach((p) => grouped.add(p.id));
        if (items.length)
          propertyGroups.push({
            label: `${org.name} / ${area?.name ?? "Chưa phân khu"}`,
            properties: items,
          });
      }
    }
  const other = properties.filter((p) => !grouped.has(p.id));
  if (other.length)
    propertyGroups.push({
      label: "Nhà trọ được phân quyền",
      properties: other,
    });
  const propertyId = properties.some((p) => p.id === selected)
    ? selected
    : undefined;
  const financeIds = finance.isError
    ? []
    : (finance.data?.scope.propertyIds ?? []);
  return (
    <Context.Provider
      value={{
        propertyId,
        setPropertyId: (id) =>
          setSelected(properties.some((p) => p.id === id) ? id : undefined),
        properties,
        propertyGroups,
        period,
        setPeriod,
        canReadFinance:
          user?.activeRole === "OWNER" ||
          (user?.activeRole === "MANAGER" &&
            (propertyId
              ? financeIds.includes(propertyId)
              : financeIds.length > 0)),
        canReadFinanceFor: (id) =>
          user?.activeRole === "OWNER" ||
          user?.activeRole === "ACCOUNTANT" ||
          (user?.activeRole === "MANAGER" && financeIds.includes(id)),
        loading: enabled && options.isLoading,
        error: enabled && options.isError,
        retry: () => {
          void options.refetch();
          void finance.refetch();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useManagementScope() {
  const scope = useContext(Context);
  if (!scope) throw new Error("ManagementScopeProvider is required");
  return scope;
}

// Accountant read-only screens keep their existing local scope.
export function useManagementProperty(initial?: number) {
  const scope = useManagementScope();
  const { user } = useAuth();
  const [local, setLocal] = useState(initial);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && !scope.loading && !scope.error) {
      initialized.current = true;
      if (initial != null) scope.setPropertyId(initial);
    }
  }, [initial, scope]);
  return user?.activeRole === "ACCOUNTANT"
    ? ([local, setLocal] as const)
    : ([scope.propertyId, scope.setPropertyId] as const);
}
