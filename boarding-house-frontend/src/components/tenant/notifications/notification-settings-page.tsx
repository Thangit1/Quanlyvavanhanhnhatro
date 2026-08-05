"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, LockKeyhole, Save } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/use-tenant-notifications";
import { notificationCategories } from "@/constants/tenant-notification";
import type { NotificationPreferences } from "@/types/tenant-notification";
import { ErrorState } from "@/components/shared/dashboard-ui";
import { apiErrorMessage } from "@/lib/api-error";
const mandatory = new Set(["INVOICE", "CONTRACT", "SECURITY", "EMERGENCY"]);

export function NotificationSettingsPage() {
  const { user } = useAuth(),
    query = useNotificationPreferences(user?.activeRole === "TENANT");
  if (query.isLoading)
    return (
      <main className="mx-auto max-w-4xl p-6 text-center text-slate-500">
        Đang tải cài đặt...
      </main>
    );
  if (query.isError || !query.data)
    return (
      <main className="mx-auto max-w-4xl p-6">
        <ErrorState onRetry={() => void query.refetch()} />
      </main>
    );
  return <PreferenceForm key={query.data.version} initial={query.data} />;
}
function PreferenceForm({ initial }: { initial: NotificationPreferences }) {
  const [value, setValue] = useState(initial),
    [message, setMessage] = useState(""),
    mutation = useUpdateNotificationPreferences();
  const save = () =>
    mutation.mutate(value, {
      onSuccess: (data) => {
        setValue(data);
        setMessage("Đã lưu cài đặt thông báo.");
      },
      onError: (error) => setMessage(apiErrorMessage(error)),
    });
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <Link
        href="/tenant/notifications"
        className="inline-flex items-center gap-2 font-bold text-blue-700"
      >
        <ArrowLeft className="size-4" />
        Trở lại thông báo
      </Link>
      <div>
        <h1 className="text-3xl font-black text-slate-950">
          Cài đặt thông báo
        </h1>
        <p className="mt-1 text-slate-500">
          Chọn loại thông báo bạn muốn nhận trong ứng dụng.
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 font-semibold text-blue-800"
        >
          {message}
        </p>
      )}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Kênh nhận thông báo</h2>
        <label className="mt-4 flex items-center justify-between rounded-xl border p-4">
          <span>
            <b>Trong ứng dụng</b>
            <small className="mt-1 block text-slate-500">
              Chuông thông báo và Trung tâm thông báo
            </small>
          </span>
          <input type="checkbox" checked disabled className="size-5" />
        </label>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-dashed p-4 text-slate-500">
          <span>
            <b>Email</b>
            <small className="mt-1 block">
              Chưa được cấu hình trên hệ thống
            </small>
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
            Chưa khả dụng
          </span>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Danh mục</h2>
        <p className="mt-1 text-sm text-slate-500">
          Thông báo hóa đơn, hợp đồng, bảo mật và khẩn cấp là bắt buộc.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(notificationCategories).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-xl border p-3"
            >
              <span className="flex items-center gap-2 font-semibold">
                {label}
                {mandatory.has(key) && (
                  <LockKeyhole className="size-3.5 text-slate-400" />
                )}
              </span>
              <input
                type="checkbox"
                checked={mandatory.has(key) || (value.categories[key] ?? true)}
                disabled={mandatory.has(key)}
                onChange={(e) =>
                  setValue((current) => ({
                    ...current,
                    categories: {
                      ...current.categories,
                      [key]: e.target.checked,
                    },
                  }))
                }
                className="size-5"
              />
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Tần suất và giờ yên lặng</h2>
        <label className="mt-4 block text-sm font-semibold">
          Tần suất
          <select
            value={value.digestMode}
            onChange={(e) =>
              setValue((current) => ({
                ...current,
                digestMode: e.target.value,
              }))
            }
            className="mt-2 block w-full rounded-xl border px-3 py-2.5"
          >
            <option value="IMMEDIATE">Ngay khi có thông báo</option>
            <option value="DAILY">Tổng hợp hằng ngày</option>
            <option value="WEEKLY">Tổng hợp hằng tuần</option>
          </select>
        </label>
        <label className="mt-4 flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={value.quietHoursEnabled}
            onChange={(e) =>
              setValue((current) => ({
                ...current,
                quietHoursEnabled: e.target.checked,
              }))
            }
            className="size-5"
          />
          Bật giờ không làm phiền
        </label>
        {value.quietHoursEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm">
              Bắt đầu
              <input
                type="time"
                value={value.quietHoursStart ?? "22:00"}
                onChange={(e) =>
                  setValue((current) => ({
                    ...current,
                    quietHoursStart: e.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-xl border p-2.5"
              />
            </label>
            <label className="text-sm">
              Kết thúc
              <input
                type="time"
                value={value.quietHoursEnd ?? "07:00"}
                onChange={(e) =>
                  setValue((current) => ({
                    ...current,
                    quietHoursEnd: e.target.value,
                  }))
                }
                className="mt-1 block w-full rounded-xl border p-2.5"
              />
            </label>
          </div>
        )}
      </section>
      <button
        onClick={save}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-50"
      >
        <Save className="size-4" />
        {mutation.isPending ? "Đang lưu..." : "Lưu cài đặt"}
      </button>
    </main>
  );
}
