"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
type Gateway = { provider: string; environment: string };
type Session = {
  id: number;
  provider: string;
  environment: string;
  status: string;
  checkout_url?: string;
  realMoney?: boolean;
  amount?: number;
};
export function GatewayPaymentPanel({ invoiceId }: { invoiceId: number }) {
  const cache = useQueryClient();
  const providers = useScopedQuery({
    queryKey: ["invoice-gateways", invoiceId],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<Gateway[]>>(
          `/tenant/invoices/${invoiceId}/gateways`,
        )
      ).data.data,
  });
  const keys = useRef<Record<string, string>>({});
  const [session, setSession] = useState<Session>();
  const sessionId = session?.id;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create(provider: string) {
    setBusy(true);
    setError("");
    try {
      if (
        session?.provider === provider &&
        ["FAILED", "CANCELLED", "EXPIRED", "TEST_SUCCEEDED"].includes(
          session.status,
        )
      ) {
        keys.current[provider] = crypto.randomUUID();
      }
      keys.current[provider] ||= crypto.randomUUID();
      const { data } = await apiClient.post<ApiEnvelope<Session>>(
        provider === "SIMULATED"
          ? `/tenant/invoices/${invoiceId}/simulation`
          : `/tenant/invoices/${invoiceId}/gateway/${provider}`,
        {},
        { headers: { "Idempotency-Key": keys.current[provider] } },
      );
      setSession(data.data);
    } catch (failure) {
      setError(apiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { data } = await apiClient.get<ApiEnvelope<Session>>(
        `/tenant/gateway-sessions/${sessionId}`,
      );
      setSession(data.data);
      if (data.data.realMoney || data.data.status === "SUCCEEDED") {
        void cache.invalidateQueries({
          queryKey: ["tenant-invoice", invoiceId],
        });
        void cache.invalidateQueries({ queryKey: ["tenant-invoices"] });
        void cache.invalidateQueries({ queryKey: ["tenant-payments"] });
      }
    } catch (failure) {
      setError(apiErrorMessage(failure));
    }
  }, [sessionId, cache, invoiceId]);
  useEffect(() => {
    if (session?.status !== "PENDING") return;
    const timer = setInterval(() => {
      void refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [session?.status, refresh]);
  async function change(outcome: "SUCCESS" | "FAILED" | "CANCELLED") {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const simulated = session.provider === "SIMULATED";
      const { data } = await apiClient.post<ApiEnvelope<Session>>(
        `/tenant/gateway-sessions/${session.id}/${simulated ? "simulation-outcome" : "cancel"}`,
        simulated ? { outcome } : {},
      );
      setSession(data.data);
    } catch (failure) {
      setError(apiErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  if (!providers.data?.length && !providers.isError) return null;
  return (
    <section className="surface-card space-y-3 p-6">
      <h2 className="text-xl font-bold">Cổng thanh toán</h2>
      <p className="text-sm text-muted-foreground">
        Chỉ IPN được xác minh mới cập nhật kết quả. Trang quay lại từ provider
        không xác nhận đã thu tiền. Giao dịch TEST được lưu riêng và không ghi
        thành tiền thực thu.
      </p>
      <div className="flex flex-wrap gap-3">
        {providers.data?.map((item) => (
          <button
            key={item.provider}
            disabled={busy || session?.status === "REVIEW_REQUIRED"}
            className="rounded-xl border border-input px-4 py-3 font-semibold text-link disabled:opacity-50"
            onClick={() => void create(item.provider)}
          >
            {item.provider === "SIMULATED"
              ? "Giả lập — không thu tiền thật"
              : `${item.provider} · ${item.environment === "TEST" ? "Thử nghiệm" : "Thực tế"}`}
          </button>
        ))}
      </div>
      {session && (
        <div className="rounded-xl bg-muted p-4 text-sm">
          <p>
            {session.provider === "SIMULATED" ? "Giả lập" : session.provider} ·{" "}
            {session.environment} · {session.status}
          </p>
          {session.provider === "SIMULATED" && session.status === "PENDING" && (
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                disabled={busy}
                className="rounded-xl bg-primary px-4 py-2 text-white disabled:opacity-50"
                onClick={() => void change("SUCCESS")}
              >
                Giả lập thành công
              </button>
              <button
                disabled={busy}
                className="rounded-xl border px-4 py-2 disabled:opacity-50"
                onClick={() => void change("FAILED")}
              >
                Giả lập thất bại
              </button>
            </div>
          )}
          {session.status === "PENDING" && (
            <button
              disabled={busy}
              className="mt-3 rounded-xl border px-4 py-2 disabled:opacity-50"
              onClick={() => void change("CANCELLED")}
            >
              Ngừng phiên này
            </button>
          )}
          {session.provider !== "SIMULATED" &&
            session.checkout_url &&
            session.status === "PENDING" && (
              <a
                className="mt-2 inline-block font-bold text-link underline"
                target="_blank"
                rel="noreferrer"
                href={session.checkout_url}
              >
                Mở trang thanh toán{" "}
                {session.environment === "TEST" ? "sandbox" : "provider"}
              </a>
            )}
          <button className="ml-4 underline" onClick={() => void refresh()}>
            Kiểm tra kết quả IPN
          </button>
          {session.status === "TEST_SUCCEEDED" && (
            <p className="mt-2 text-warning">
              Sandbox thành công; hóa đơn thật vẫn giữ công nợ và cần giao dịch
              thực tế đã xác minh để tất toán.
            </p>
          )}
          {session.status === "FAILED" && (
            <p className="mt-2 text-danger" role="status">
              Giao dịch chưa thành công. Hóa đơn chưa được thanh toán bởi giao
              dịch này; hãy kiểm tra công nợ trước khi thử lại.
            </p>
          )}
          {["CANCELLED", "EXPIRED"].includes(session.status) && (
            <p className="mt-2 text-warning">
              Phiên đã hủy hoặc hết hạn; công nợ không tự thay đổi. Nếu tài
              khoản đã bị trừ tiền, hãy liên hệ chủ nhà để đối soát trước khi
              thanh toán lại.
            </p>
          )}
          {session.status === "REVIEW_REQUIRED" && (
            <p className="mt-2 text-warning" role="status">
              Giao dịch cần đối soát với chủ nhà hoặc kế toán. Vui lòng chưa
              thanh toán lại để tránh thu trùng.
            </p>
          )}
        </div>
      )}
      {(error || providers.isError) && (
        <p role="alert" className="text-sm text-danger">
          {error || apiErrorMessage(providers.error)}
        </p>
      )}
    </section>
  );
}
