"use client";

import { Check, LoaderCircle, RotateCcw, Save } from "lucide-react";
import type { SettingField } from "@/constants/setting-groups";

export function SettingsForm({
  fields,
  values,
  onChange,
  onSave,
  onReset,
  dirty,
  saving,
  editable,
  message,
  error,
}: {
  fields: SettingField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onSave: () => void;
  onReset: () => void;
  dirty: boolean;
  saving: boolean;
  editable: boolean;
  message?: string;
  error?: string;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      className="space-y-5"
    >
      {!editable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Bạn chỉ có quyền xem nhóm cấu hình này.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700"
        >
          <Check className="size-4" />
          {message}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={values[field.key]}
            disabled={!editable || saving}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p
          className={`text-sm font-medium ${dirty ? "text-amber-700" : "text-slate-500"}`}
        >
          {saving
            ? "Đang lưu thay đổi..."
            : dirty
              ? "Bạn có thay đổi chưa được lưu."
              : "Mọi thay đổi đã được lưu."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={onReset}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:flex-none"
          >
            <RotateCcw className="size-4" />
            Hủy thay đổi
          </button>
          <button
            type="submit"
            disabled={!dirty || saving || !editable}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  field,
  value,
  disabled,
  onChange,
}: {
  field: SettingField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const wrapper = field.wide ? "md:col-span-2" : "";
  if (field.type === "switch")
    return (
      <label
        className={`flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 ${wrapper}`}
      >
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            {field.label}
          </span>
          {field.description && (
            <span className="mt-1 block text-xs text-slate-500">
              {field.description}
            </span>
          )}
        </span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="size-5 accent-blue-600"
        />
      </label>
    );
  const common =
    "mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
  return (
    <label className={wrapper}>
      <span className="text-sm font-semibold text-slate-800">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </span>
      {field.description && (
        <span className="mt-1 block text-xs text-slate-500">
          {field.description}
        </span>
      )}
      {field.type === "textarea" ? (
        <textarea
          rows={4}
          value={String(value ?? "")}
          disabled={disabled}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
          className={`${common} resize-y py-3`}
        />
      ) : field.type === "select" ? (
        <select
          value={String(value ?? "")}
          disabled={disabled}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
          className={common}
        >
          <option value="">Chọn giá trị</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type}
          value={String(value ?? "")}
          disabled={disabled}
          required={field.required}
          min={field.min}
          max={field.max}
          onChange={(event) =>
            onChange(
              field.type === "number"
                ? event.target.value === ""
                  ? ""
                  : Number(event.target.value)
                : event.target.value,
            )
          }
          className={common}
        />
      )}
    </label>
  );
}
