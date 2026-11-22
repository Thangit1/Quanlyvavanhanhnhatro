"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { NumberInput } from "@/components/ui/number-input";
import { apiErrorMessage } from "@/lib/api-error";
type Policy = {
  openingDay: number | null;
  monthOffset: number;
  version: number;
  timezone: string;
  openingDate: string | null;
  canConfigure: boolean;
};
export function InvoicePolicyPanel({
  propertyId,
  period,
}: {
  propertyId: number;
  period: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const client = useQueryClient();
  const month =
    period ||
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
  const query = useScopedQuery({
    queryKey: ["invoice-payment-policy", propertyId, month],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Policy>>(
          "/admin/invoices/payment-policy",
          { params: { propertyId, period: `${month}-01` }, signal },
        )
      ).data.data,
  });
  const policy = query.data;
  return (
    <details className="rounded-2xl border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Chính sách mở thanh toán cho hóa đơn mới
      </summary>
      {query.isError && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {apiErrorMessage(query.error)}
        </p>
      )}
      {policy && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            {policy.openingDate
              ? `Kỳ ${month}: mở từ ${policy.openingDate}.`
              : "Chưa đặt ngày chung: dùng ngày lập/phát hành của hóa đơn."}{" "}
            Múi giờ {policy.timezone}. Ngày không tồn tại được lấy ngày cuối
            tháng. Hạn thanh toán chọn riêng khi lập hóa đơn; quá hạn vẫn được
            trả nợ.
          </p>
          {policy.canConfigure && (
            <form
              key={policy.version}
              className="flex flex-wrap items-end gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setBusy(true);
                setMessage("");
                try {
                  await apiClient.put("/admin/invoices/payment-policy", {
                    propertyId,
                    version: policy.version,
                    openingDay: data.get("openingDay")
                      ? Number(data.get("openingDay"))
                      : null,
                    monthOffset: Number(data.get("monthOffset")),
                    reason: data.get("reason"),
                  });
                  await client.invalidateQueries({
                    queryKey: ["invoice-payment-policy"],
                  });
                  setMessage(
                    "Đã lưu cho hóa đơn mới; không đổi cửa sổ của hóa đơn đã có.",
                  );
                } catch (error) {
                  setMessage(apiErrorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="text-sm">
                Ngày mở (để trống dùng ngày lập)
                <NumberInput
                  name="openingDay"
                  min={1}
                  max={31}
                  defaultValue={policy.openingDay}
                  className={input}
                />
              </label>
              <label className="text-sm">
                Tháng so với kỳ sử dụng
                <select
                  name="monthOffset"
                  defaultValue={policy.monthOffset}
                  className={input}
                >
                  <option value="-1">Tháng trước</option>
                  <option value="0">Cùng tháng</option>
                  <option value="1">Tháng sau</option>
                </select>
              </label>
              <label className="text-sm">
                Lý do
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  className={input}
                />
              </label>
              <button
                disabled={busy}
                className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Lưu chính sách
              </button>
            </form>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-secondary-foreground">
          {message}
        </p>
      )}
    </details>
  );
}
const input =
  "mt-1 block min-h-10 w-full rounded-lg border border-input px-3 py-2 text-sm";
