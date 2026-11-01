"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";

type Period = {
  id: number;
  property_id: number;
  period_code: string;
  status: string;
  version: number;
};
type Check = {
  id: number;
  blockingCount: number;
  findings: {
    code: string;
    severity: string;
    resourceType: string;
    resourceId: number;
  }[];
};
export function AccountingPeriodPanel({
  propertyId,
  period,
}: {
  propertyId?: number;
  period: string;
}) {
  const client = useQueryClient();
  const [check, setCheck] = useState<Check>();
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["accounting-period-controls", propertyId],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<{ content: Period[] }>>(
          "/accountant/periods",
          { params: { propertyId } },
        )
      ).data.data,
  });
  const mutate = useMutation({
    mutationFn: async ({
      id,
      action,
      version,
    }: {
      id?: number;
      action: string;
      version?: number;
    }) => {
      if (action === "create") {
        await apiClient.post("/accountant/finance/periods", {
          propertyId,
          period,
        });
        return;
      }
      if (action === "check") {
        setCheck(
          (
            await apiClient.get<ApiEnvelope<Check>>(
              `/accountant/periods/${id}/closing-check`,
            )
          ).data.data,
        );
        return;
      }
      const note = prompt(
        action === "close"
          ? "Lý do khóa kỳ sau khi đối chiếu chứng từ"
          : "Lý do và căn cứ mở lại kỳ kế toán",
      );
      if (!note) return;
      await apiClient.post(`/accountant/periods/${id}/${action}`, {
        version,
        note,
      });
    },
    onSuccess: () => {
      setError("");
      void client.invalidateQueries();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  return (
    <section className="my-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">
        Đối soát và khóa kỳ kế toán
      </h2>
      <p className="text-sm text-slate-500">
        Đối soát kiểm tra số dư hiện tại và lưu kết quả cho kỳ được chọn; không
        tự sửa lịch sử. Lỗi trọng yếu chặn khóa kỳ.
      </p>
      {propertyId && (
        <button
          className="btn-primary"
          disabled={mutate.isPending}
          onClick={() => mutate.mutate({ action: "create" })}
        >
          Chuẩn bị kỳ {period}
        </button>
      )}
      {query.isLoading ? (
        <p>Đang tải kỳ kế toán...</p>
      ) : query.isError ? (
        <p role="alert">{apiErrorMessage(query.error)}</p>
      ) : !query.data?.content.length ? (
        <p className="text-sm text-slate-500">
          Chưa có kỳ. Chọn một khu trọ để chuẩn bị kỳ cần khóa.
        </p>
      ) : (
        query.data.content.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-3 text-sm"
          >
            <span className="flex-1">
              Khu #{p.property_id} · {p.period_code} · {p.status}
            </span>
            <button
              disabled={mutate.isPending}
              onClick={() => mutate.mutate({ id: p.id, action: "check" })}
            >
              Đối soát
            </button>
            <button
              disabled={mutate.isPending}
              onClick={() =>
                mutate.mutate({
                  id: p.id,
                  action: p.status === "OPEN" ? "close" : "reopen",
                  version: p.version,
                })
              }
            >
              {p.status === "OPEN" ? "Khóa kỳ" : "Mở lại theo quyền được cấp"}
            </button>
          </div>
        ))
      )}
      {check && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p>
            Đối soát #{check.id}: {check.blockingCount} vấn đề chặn khóa kỳ.
          </p>
          {!check.findings.length ? (
            <p>Không phát hiện sai lệch trong các kiểm tra đã hỗ trợ.</p>
          ) : (
            check.findings.map((f, i) => (
              <p key={i}>
                {f.severity} · {f.code} · {f.resourceType} #{f.resourceId}
              </p>
            ))
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
