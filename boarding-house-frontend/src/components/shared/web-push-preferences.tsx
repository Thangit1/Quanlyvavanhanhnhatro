"use client";
import { useState } from "react";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import {
  disableWebPush,
  enableWebPush,
  pushOptions,
} from "@/services/web-push.service";
import { apiErrorMessage } from "@/lib/api-error";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
export function WebPushPreferences() {
  const options = useScopedQuery({
    queryKey: ["web-push-options"],
    queryFn: pushOptions,
  });
  const zalo = useScopedQuery({
    queryKey: ["zalo-notification-consent"],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<{ enabled: boolean }>>(
          "/integrations/notification-consent/ZALO",
        )
      ).data.data,
  });
  const [ownerId, setOwnerId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected =
    options.data?.find((item) => item.ownerId === ownerId) || options.data?.[0];
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <p className="text-sm font-semibold">Thông báo trình duyệt</p>
      <p className="text-xs text-muted-foreground">
        Web Push cần bạn chủ động bật và cấp quyền. Nội dung trên màn hình khóa
        chỉ thông báo có cập nhật.
      </p>
      {(options.data?.length || 0) > 1 && (
        <select
          aria-label="Chủ nhà gửi Web Push"
          className="w-full rounded-lg border border-input bg-card p-2 text-sm"
          value={selected?.ownerId}
          onChange={(event) => setOwnerId(Number(event.target.value))}
        >
          {options.data?.map((item) => (
            <option value={item.ownerId} key={item.ownerId}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          disabled={busy || !selected}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          onClick={async () => {
            if (!selected) return;
            setBusy(true);
            try {
              await enableWebPush(selected);
              setMessage("Đã đăng ký Web Push cho trình duyệt này.");
            } catch (error) {
              setMessage(apiErrorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Bật thông báo trình duyệt
        </button>
        <button
          disabled={busy}
          className="rounded-lg border border-border px-3 py-2 text-xs"
          onClick={async () => {
            setBusy(true);
            try {
              await disableWebPush();
              setMessage("Đã tắt thông báo trình duyệt này.");
            } catch (error) {
              setMessage(apiErrorMessage(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Tắt
        </button>
      </div>
      {!options.isPending && !selected && (
        <p className="text-xs text-muted-foreground">
          Chủ nhà chưa cấu hình Web Push.
        </p>
      )}
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={zalo.data?.enabled || false}
          disabled={busy || zalo.isPending || zalo.isError}
          onChange={async (event) => {
            setBusy(true);
            try {
              await apiClient.put("/integrations/notification-consent/ZALO", {
                enabled: event.target.checked,
              });
              await zalo.refetch();
            } catch (failure) {
              setMessage(apiErrorMessage(failure));
            } finally {
              setBusy(false);
            }
          }}
        />
        Cho phép nhận thông báo giao dịch qua Zalo của chủ nhà bằng mẫu được phê
        duyệt.
      </label>
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
