"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";

export function FinancialSummary({
  summary,
}: {
  summary: Record<string, number>;
}) {
  const labels: Record<string, string> = {
    cashIn: "Tổng tiền vào trong kỳ",
    cashOut: "Tổng tiền ra trong kỳ",
    netCashFlow: "Dòng tiền thuần trong kỳ",
    confirmedCosts: "Chi phí quản trị đã xác nhận",
    periodInvoiceObligations: "Nghĩa vụ hóa đơn kỳ dịch vụ",
    heldDeposits: "Cọc đang giữ hiện tại",
    refundsPayable: "Cọc còn phải hoàn hiện tại",
    expensePayables: "Phiếu đã duyệt chưa chi hiện tại",
    customerAdvances: "Tiền trả trước nhận trong kỳ",
  };
  return (
    <section className="my-5 space-y-3">
      <p className="text-sm text-slate-500">
        Quản trị nội bộ: dòng tiền gồm cọc và mua tài sản, không phải lợi nhuận
        kế toán. Số dư hiện tại khác phát sinh trong kỳ; chưa hỗ trợ doanh thu
        dồn tích.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(labels).map(([key, label]) => (
          <div
            key={key}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 font-semibold text-slate-900">
              {summary[key] == null ? "—" : formatCurrency(summary[key])}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

type Voucher = {
  id: number;
  property_id: number;
  voucher_code: string;
  amount: number;
  status: string;
  version: number;
  created_by: number;
  expense_category: string;
};

function VoucherEvidence({ base, id }: { base: string; id: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["voucher-documents", base, id],
    enabled: open,
    queryFn: async () =>
      (
        await apiClient.get<
          ApiEnvelope<{ id: number; original_name: string }[]>
        >(`${base}/vouchers/${id}/documents`)
      ).data.data,
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      await apiClient.post(`${base}/vouchers/${id}/documents`, body, {
        headers: { "Content-Type": undefined },
      });
    },
    onSuccess: () => {
      setError("");
      void query.refetch();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  async function download(document: { id: number; original_name: string }) {
    try {
      const response = await apiClient.get<Blob>(
        `${base}/vouchers/${id}/documents/${document.id}/file`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }
  return (
    <div>
      <button onClick={() => setOpen(!open)}>Chứng từ</button>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
          <label className="block text-xs">
            Đính kèm PDF/PNG/JPEG, tối đa 5 MB
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={upload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = "";
              }}
            />
          </label>
          {query.isLoading ? (
            <p>Đang tải...</p>
          ) : query.isError ? (
            <p role="alert">{apiErrorMessage(query.error)}</p>
          ) : (
            query.data?.map((document) => (
              <button
                key={document.id}
                className="block underline"
                onClick={() => void download(document)}
              >
                {document.original_name}
              </button>
            ))
          )}
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export function FinanceVoucherPanel({
  portal,
  propertyIds,
}: {
  portal: "admin" | "accountant";
  propertyIds?: number[];
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const retryKey = useRef<Record<number, string>>({});
  const base = `/${portal}/finance`;
  const query = useQuery({
    queryKey: ["finance-vouchers", portal, user?.id, user?.activeRole],
    queryFn: async () =>
      (await apiClient.get<ApiEnvelope<Voucher[]>>(`${base}/vouchers`)).data
        .data,
  });
  const mutation = useMutation({
    mutationFn: async ({
      v,
      action,
      payload,
    }: {
      v: Voucher;
      action: string;
      payload: object;
    }) => {
      retryKey.current[v.id] ??= crypto.randomUUID();
      await apiClient.post(`${base}/vouchers/${v.id}/${action}`, payload, {
        headers: { "Idempotency-Key": retryKey.current[v.id] },
      });
      delete retryKey.current[v.id];
    },
    onSuccess: () => {
      setError("");
      void client.invalidateQueries();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  const rows = (query.data ?? []).filter(
    (v) => !propertyIds?.length || propertyIds.includes(v.property_id),
  );
  function action(v: Voucher, kind: string) {
    if (kind === "pay") {
      const reference = prompt("Mã chứng từ thực chi / tham chiếu ngân hàng");
      if (!reference) return;
      const evidence = prompt(
        "Chứng cứ đã chi tiền (số biên nhận, nơi lưu chứng từ)",
      );
      if (!evidence) return;
      const at = prompt(
        "Ngày giờ thực chi theo giờ nghiệp vụ (YYYY-MM-DDTHH:mm:ss)",
      );
      if (at)
        mutation.mutate({
          v,
          action: kind,
          payload: { version: v.version, paidAt: at, reference, evidence },
        });
    } else {
      const reason = prompt("Lý do và kết quả đối chiếu chứng từ");
      if (reason)
        mutation.mutate({
          v,
          action: kind,
          payload: { version: v.version, reason },
        });
    }
  }
  return (
    <section className="my-5 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">
        Phiếu chi và xác nhận thực chi
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Chủ trọ duyệt độc lập; phiếu đã duyệt vẫn chưa tính tiền ra. Chỉ xác
        nhận khi đã trả tiền thực tế. Danh sách theo phạm vi khu đã chọn, không
        giới hạn kỳ lập phiếu.
      </p>
      {query.isLoading ? (
        <p>Đang tải...</p>
      ) : query.isError ? (
        <p role="alert">{apiErrorMessage(query.error)}</p>
      ) : !rows.length ? (
        <p className="mt-3 text-sm text-slate-500">Chưa có phiếu chi.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm"
            >
              <span className="flex-1">
                {v.voucher_code} · {formatCurrency(v.amount)} · {v.status}
              </span>
              <VoucherEvidence base={base} id={v.id} />
              {portal === "admin" &&
                user?.activeRole === "OWNER" &&
                v.status === "PENDING_APPROVAL" &&
                v.created_by !== user.id && (
                  <>
                    <button
                      className="btn-primary"
                      disabled={mutation.isPending}
                      onClick={() => action(v, "approve")}
                    >
                      Duyệt
                    </button>
                    <button
                      disabled={mutation.isPending}
                      onClick={() => action(v, "reject")}
                    >
                      Từ chối
                    </button>
                  </>
                )}
              {v.status === "APPROVED" && (
                <button
                  className="btn-primary"
                  disabled={mutation.isPending}
                  onClick={() => action(v, "pay")}
                >
                  Xác nhận thực chi
                </button>
              )}
              {portal === "admin" &&
                user?.activeRole === "OWNER" &&
                v.status === "PAID" && (
                  <button
                    disabled={mutation.isPending}
                    onClick={() => action(v, "reverse")}
                  >
                    Đảo chứng từ sai
                  </button>
                )}
            </div>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
