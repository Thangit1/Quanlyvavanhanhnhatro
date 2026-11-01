"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { formatDate, statusLabel } from "@/lib/format";
import { apiErrorMessage } from "@/lib/api-error";

type Extension = {
  id: number;
  requested_end_date: string;
  note: string | null;
  status: string;
  review_reason: string | null;
};

export function ContractExtensionReview({
  contractId,
}: {
  contractId: number;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<number>();
  const [error, setError] = useState("");
  const base = `/admin/contracts/${contractId}/extensions`;
  const query = useQuery({
    queryKey: [
      "admin-contract-extensions",
      contractId,
      user?.id,
      user?.activeRole,
    ],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<Extension[]>>(base)).data.data,
  });
  async function approve(id: number) {
    setBusy(id);
    setError("");
    try {
      await apiClient.post(`${base}/${id}/approve`, { reason });
      setReason("");
      await Promise.all(
        [
          "admin-contract-extensions",
          "admin-contract",
          "admin-contracts",
          "rental-lifecycle",
          "tenant-contract",
          "contract-changes",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(undefined);
    }
  }
  if (query.isLoading || (!query.isError && !query.data?.length)) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold">Yêu cầu gia hạn hợp đồng</h2>
      {(error || query.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {error || apiErrorMessage(query.error)}
        </p>
      )}
      {query.data?.some((x) => x.status === "PENDING") && (
        <input
          aria-label="Căn cứ phê duyệt gia hạn"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="Lý do / căn cứ hai bên thống nhất gia hạn"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      )}
      {query.data?.map((x) => (
        <div
          key={x.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"
        >
          <div>
            Đề nghị đến {formatDate(x.requested_end_date)} ·{" "}
            {statusLabel(x.status)}
            <p className="text-slate-500">{x.note || x.review_reason}</p>
          </div>
          {x.status === "PENDING" && (
            <button
              disabled={busy !== undefined || !reason.trim()}
              onClick={() => void approve(x.id)}
              className="rounded-xl bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
            >
              {busy === x.id
                ? "Đang kiểm tra..."
                : "Duyệt nội dung, chờ xác nhận"}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
