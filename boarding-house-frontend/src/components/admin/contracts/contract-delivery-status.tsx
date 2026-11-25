"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
type Delivery = {
  id: number;
  channel: string;
  status: string;
  result_code?: string;
  source_key: string;
};
type State = {
  businessEmailEnabled: boolean;
  contractStatus: string;
  contractUrl: string;
  deliveries: Delivery[];
  submissionErrors: { description: string }[];
};
export function ContractDeliveryStatus({ contractId }: { contractId: number }) {
  const query = useScopedQuery({
    queryKey: ["contract-delivery", contractId],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<State>>(
          `/admin/contracts/${contractId}/delivery`,
          { signal },
        )
      ).data.data,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const key = useRef("");
  const lock = useRef(false);
  const labels: Record<string, string> = {
    QUEUED: "Chờ gửi",
    SCHEDULED: "Đã lên lịch",
    DISPATCHING: "Đang gửi",
    SENT: "Máy chủ email đã chấp nhận",
    DELIVERED: "Đã có trong hộp thông báo",
    FAILED: "Chưa gửi được",
    UNKNOWN: "Chưa xác định — kiểm tra hộp thư trước khi gửi lại",
    CANCELLED: "Đã hủy do trạng thái thay đổi",
  };
  if (query.isLoading)
    return <p role="status">Đang kiểm tra tiến trình gửi hợp đồng…</p>;
  if (query.isError || !query.data)
    return (
      <p role="alert" className="text-danger">
        Không tải được trạng thái gửi.{" "}
        <button onClick={() => void query.refetch()}>Thử lại</button>
      </p>
    );
  const data = query.data;
  return (
    <section className="surface-card space-y-4 p-5">
      <h2 className="text-lg font-bold">Tài khoản và gửi hợp đồng</h2>
      {data.contractStatus === "PENDING_CONFIRMATION" && (
        <Link
          href={`/admin/contracts/${contractId}/edit?mode=agreement`}
          className="inline-block text-sm font-semibold text-link underline"
        >
          Chỉnh sửa điều khoản và yêu cầu hai bên xác nhận lại
        </Link>
      )}
      {!data.businessEmailEnabled && (
        <p className="rounded-xl bg-warning-muted p-3 text-sm">
          Email nghiệp vụ đang tắt. Hợp đồng vẫn được lưu; chưa gửi email kích
          hoạt hoặc hợp đồng.
        </p>
      )}
      {data.contractStatus === "DRAFT" &&
        data.submissionErrors.map((e, i) => (
          <p key={i} role="alert" className="text-sm text-danger">
            Đã lưu bản nháp, chưa gửi hợp đồng: {e.description}
          </p>
        ))}
      <ul className="space-y-2 text-sm">
        {data.deliveries.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap justify-between gap-2 rounded-xl border p-3"
          >
            <span>
              {d.source_key.includes(":ACTIVATE:")
                ? "Kích hoạt tài khoản"
                : d.source_key.includes(":SIGNED:")
                  ? "Hai bên xác nhận"
                  : d.source_key.includes(":DEPOSIT-")
                    ? "Xác nhận thu cọc"
                    : "Gửi hợp đồng"}{" "}
              · {d.channel === "EMAIL" ? "Email" : "Thông báo nội bộ"}
            </span>
            <span>
              {labels[d.status] || d.status}
              {d.result_code && d.status === "FAILED"
                ? ` (${d.result_code})`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-xl border px-4 py-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(data.contractUrl);
              setMessage(
                "Đã sao chép liên kết xem hợp đồng; người nhận cần đăng nhập.",
              );
            } catch {
              setMessage("Không sao chép được liên kết.");
            }
          }}
        >
          Sao chép liên kết hợp đồng
        </button>
        {data.contractStatus === "PENDING_CONFIRMATION" && (
          <button
            type="button"
            disabled={busy || !data.businessEmailEnabled}
            className="rounded-xl bg-primary px-4 py-2 text-white disabled:opacity-50"
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setMessage("");
              key.current ||= crypto.randomUUID();
              try {
                await apiClient.post(
                  `/admin/contracts/${contractId}/delivery/resend`,
                  {},
                  { headers: { "Idempotency-Key": key.current } },
                );
                key.current = "";
                await query.refetch();
                setMessage(
                  "Đã kiểm tra yêu cầu gửi lại. Xem trạng thái thực tế ở trên; không tạo thêm hợp đồng hoặc tài khoản.",
                );
              } catch (e) {
                setMessage(apiErrorMessage(e));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? "Đang ghi yêu cầu…" : "Gửi lại email"}
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
