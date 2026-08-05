"use client";
import { createContext, useContext, useMemo, useState } from "react";
import { useAccountantAccount } from "@/hooks/use-accountant";
type Scope = {
  propertyId?: number;
  period: string;
  setPropertyId: (id?: number) => void;
  setPeriod: (period: string) => void;
  properties: { id: number; name: string; address: string }[];
};
const Context = createContext<Scope | null>(null);
export function AccountantScopeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = useAccountantAccount();
  const [propertyId, setPropertyId] = useState<number>();
  const [period, setPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const value = useMemo(
    () => ({
      propertyId,
      period,
      setPropertyId,
      setPeriod,
      properties: account.data?.properties ?? [],
    }),
    [account.data?.properties, period, propertyId],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccountantScope() {
  const value = useContext(Context);
  if (!value) throw new Error("AccountantScopeProvider is required");
  return value;
}
