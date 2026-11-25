"use client";
import { useState } from "react";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
type Instructions = {
  available: boolean;
  qrUrl?: string;
  amount?: number;
  transferContent?: string;
};
export function VietQrPanel({
  invoiceId,
  sessionId,
}: {
  invoiceId: number;
  sessionId: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const query = useScopedQuery({
    queryKey: ["invoice-vietqr", invoiceId, sessionId],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<Instructions>>(
          `/tenant/invoices/${invoiceId}/bank-transfer/${sessionId}/qr`,
        )
      ).data.data,
    retry: false,
  });
  if (query.isLoading)
    return <p className="mt-3 text-sm">Đang lấy hướng dẫn VietQR…</p>;
  if (query.isError || !query.data?.available || imageFailed)
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        VietQR chưa khả dụng. Bạn vẫn có thể chuyển khoản theo tài khoản, số
        tiền và mã tham chiếu hiển thị ở trên.
      </p>
    );
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="font-bold">Quét VietQR để chuyển khoản</h3>
      {/* Dynamic provider-generated payment instruction, not a repository image asset. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={query.data.qrUrl}
        alt="VietQR cho đúng số tiền và mã tham chiếu của hóa đơn"
        width={320}
        height={380}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className="mx-auto mt-3 max-w-full"
      />
      <p className="mt-2 text-sm text-muted-foreground">
        Kiểm tra người nhận và số tiền trong ứng dụng ngân hàng. Quét mã hoặc
        gửi minh chứng chưa có nghĩa là hóa đơn đã được xác nhận thanh toán.
      </p>
    </div>
  );
}
