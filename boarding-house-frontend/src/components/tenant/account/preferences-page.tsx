"use client";
import { useEffect, useState } from "react";
import { MonitorCog, Save } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useAccountActions,
  useAccountPreferences,
} from "@/hooks/use-tenant-account";
import type { AccountPreferences } from "@/types/tenant-account";
import { apiErrorMessage } from "@/lib/api-error";
import { AccountLoading, AccountPageLayout } from "./account-ui";
import { ErrorState } from "@/components/shared/dashboard-ui";
export function PreferencesPage() {
  const { user } = useAuth(),
    query = useAccountPreferences(user?.activeRole === "TENANT");
  if (query.isLoading) return <AccountLoading />;
  if (query.isError || !query.data)
    return (
      <AccountPageLayout
        title="Tùy chọn giao diện"
        description="Cấu hình cách hiển thị phù hợp với bạn."
      >
        <ErrorState onRetry={() => void query.refetch()} />
      </AccountPageLayout>
    );
  return <PreferenceForm key={query.data.version} initial={query.data} />;
}
function PreferenceForm({ initial }: { initial: AccountPreferences }) {
  const [value, setValue] = useState(initial),
    [message, setMessage] = useState(""),
    actions = useAccountActions();
  useEffect(() => {
    const dark =
      value.theme === "DARK" ||
      (value.theme === "SYSTEM" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.setAttribute(
      "data-theme",
      value.theme.toLowerCase(),
    );
  }, [value.theme]);
  const setTheme = (theme: AccountPreferences["theme"]) => {
    setValue((x) => ({ ...x, theme }));
  };
  const save = () =>
    actions.updatePreferences.mutate(value, {
      onSuccess: (data) => {
        setValue(data);
        setMessage("Cài đặt đã được cập nhật.");
      },
      onError: (e) => setMessage(apiErrorMessage(e)),
    });
  return (
    <AccountPageLayout
      title="Tùy chọn giao diện"
      description="Cấu hình cách hiển thị phù hợp với bạn."
    >
      {message && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 font-semibold text-blue-800"
        >
          {message}
        </p>
      )}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <MonitorCog className="text-blue-600" />
          Giao diện
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {(["LIGHT", "DARK", "SYSTEM"] as const).map((theme) => (
            <button
              key={theme}
              onClick={() => setTheme(theme)}
              aria-pressed={value.theme === theme}
              className={`rounded-xl border p-4 font-bold ${value.theme === theme ? "border-blue-600 bg-blue-50 text-blue-700" : ""}`}
            >
              {theme === "LIGHT"
                ? "Sáng"
                : theme === "DARK"
                  ? "Tối"
                  : "Theo thiết bị"}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Select
            label="Ngôn ngữ"
            value={value.language}
            set={(language) => setValue((x) => ({ ...x, language }))}
            options={[["vi", "Tiếng Việt"]]}
          />
          <Select
            label="Múi giờ"
            value={value.timezone}
            set={(timezone) => setValue((x) => ({ ...x, timezone }))}
            options={[
              ["Asia/Ho_Chi_Minh", "Việt Nam (UTC+7)"],
              ["Asia/Bangkok", "Bangkok (UTC+7)"],
              ["UTC", "UTC"],
            ]}
          />
          <Select
            label="Định dạng ngày"
            value={value.dateFormat}
            set={(dateFormat) => setValue((x) => ({ ...x, dateFormat }))}
            options={[
              ["dd/MM/yyyy", "31/12/2026"],
              ["MM/dd/yyyy", "12/31/2026"],
              ["yyyy-MM-dd", "2026-12-31"],
            ]}
          />
          <Select
            label="Định dạng giờ"
            value={value.timeFormat}
            set={(timeFormat) => setValue((x) => ({ ...x, timeFormat }))}
            options={[
              ["HH:mm", "23:30"],
              ["hh:mm a", "11:30 PM"],
            ]}
          />
        </div>
        <label className="mt-5 flex items-start gap-3">
          <input
            type="checkbox"
            checked={value.reducedMotion}
            onChange={(e) =>
              setValue((x) => ({ ...x, reducedMotion: e.target.checked }))
            }
            className="mt-1 size-5"
          />
          <span>
            <b>Giảm hiệu ứng chuyển động</b>
            <small className="block text-slate-500">
              Hạn chế animation để cải thiện khả năng tiếp cận.
            </small>
          </span>
        </label>
        <button
          onClick={save}
          disabled={actions.updatePreferences.isPending}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white"
        >
          <Save className="size-4" />
          {actions.updatePreferences.isPending ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      </section>
    </AccountPageLayout>
  );
}
function Select({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  options: string[][];
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className="mt-1 w-full rounded-xl border p-2.5 font-normal"
      >
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
