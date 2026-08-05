"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountantService as api } from "@/services/accountant.service";
import type { AccountantResource } from "@/types/accountant";
const poll = 30_000;
export const useAccountantDashboard = (scope: {
  propertyId?: number;
  period?: string;
}) =>
  useQuery({
    queryKey: ["accountant-dashboard", scope],
    queryFn: () => api.dashboard(scope),
    refetchInterval: poll,
  });
export const useAccountantResource = (
  resource: AccountantResource,
  scope: Record<string, string | number | undefined>,
) =>
  useQuery({
    queryKey: ["accountant-resource", resource, scope],
    queryFn: () => api.resource(resource, scope),
    placeholderData: (p) => p,
    refetchInterval: poll,
  });
export const useAccountantDetail = (resource: string, id: number) =>
  useQuery({
    queryKey: ["accountant-detail", resource, id],
    queryFn: () => api.detail(resource, id),
    enabled: id > 0,
    refetchInterval: poll,
  });
export const useAccountantAccount = () =>
  useQuery({ queryKey: ["accountant-account"], queryFn: api.account });
export const useAccountantNotifications = () =>
  useQuery({
    queryKey: ["accountant-notifications"],
    queryFn: api.notifications,
    refetchInterval: poll,
  });
export function useAccountantActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["accountant"] });
  return {
    payment: useMutation({ mutationFn: api.createPayment, onSuccess: refresh }),
    voucher: useMutation({ mutationFn: api.createVoucher, onSuccess: refresh }),
    action: useMutation({
      mutationFn: ({
        resource,
        id,
        action,
        payload,
        key,
      }: {
        resource: string;
        id: number;
        action: string;
        payload: object;
        key?: string;
      }) => api.action(resource, id, action, payload, key),
      onSuccess: refresh,
    }),
    deposit: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: object }) =>
        api.depositTransaction(id, payload),
      onSuccess: refresh,
    }),
  };
}
