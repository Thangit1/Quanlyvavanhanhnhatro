"use client";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { businessQueryKey } from "@/lib/business-query-key";
export function useScopedQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
>(
  options: Omit<UseQueryOptions<TQueryFnData, TError, TData>, "enabled"> & {
    enabled?: boolean;
  },
) {
  const { user } = useAuth();
  const query = useQuery({
    ...options,
    queryKey: businessQueryKey(options.queryKey, user?.id, user?.activeRole),
    enabled: !!user && options.enabled !== false,
    refetchInterval: options.refetchInterval ?? 15_000,
    refetchOnWindowFocus: "always",
  });
  // Disabled bootstrap reads have no data yet; existing pages use isLoading to guard render.
  return { ...query, isLoading: query.isLoading || (!user && query.isPending) };
}
