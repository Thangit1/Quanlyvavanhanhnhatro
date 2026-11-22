"use client";
import { FormInput } from "@/components/ui/number-input";

import { Check, LoaderCircle, RotateCcw, Save } from "lucide-react";
import type { SettingField } from "@/constants/setting-groups";
import { VIETNAM_PHONE_PATTERN } from "@/lib/phone-validation";

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
        <div className="rounded-xl border border-warning-border bg-warning-muted p-4 text-sm font-medium text-warning">
          Bạn chỉ có quyền xem nhóm cấu hình này.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-muted p-4 text-sm font-medium text-danger"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-success-border bg-success-muted p-4 text-sm font-medium text-success"
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
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 surface-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p
          className={`text-sm font-medium ${dirty ? "text-warning" : "text-muted-foreground"}`}
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
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-secondary-foreground hover:bg-muted disabled:opacity-40 sm:flex-none"
          >
            <RotateCcw className="size-4" />
            Hủy thay đổi
          </button>
          <button
            type="submit"
            disabled={!dirty || saving || !editable}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 text-sm font-semibold text-white shadow-card hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
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
        className={`flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-4 ${wrapper}`}
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">
            {field.label}
          </span>
          {field.description && (
            <span className="mt-1 block text-xs text-muted-foreground">
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
    "mt-2 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition focus:border-ring focus:ring-2 focus:ring-ring disabled:bg-muted disabled:text-muted-foreground";
  return (
    <label className={wrapper}>
      <span className="text-sm font-semibold text-foreground">
        {field.label}
        {field.required && <span className="text-danger"> *</span>}
      </span>
      {field.description && (
        <span className="mt-1 block text-xs text-muted-foreground">
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
        <FormInput
          type={field.type}
          numericKind={
            /price|amount|cost|fee|rent|deposit/i.test(field.key) &&
            !/day|month|percent|rate|enabled|method|value/i.test(field.key)
              ? "currency"
              : /temperature|confidence|threshold|rate|percent|feeValue/i.test(
                    field.key,
                  )
                ? "decimal"
                : "integer"
          }
          inputMode={field.type === "tel" ? "tel" : undefined}
          autoComplete={field.type === "tel" ? "tel" : undefined}
          pattern={
            field.type === "tel" ? VIETNAM_PHONE_PATTERN.source : undefined
          }
          title={
            field.type === "tel" ? "Số điện thoại không hợp lệ." : undefined
          }
          value={String(value ?? "")}
          disabled={disabled}
          required={field.required}
          min={field.min}
          max={field.max}
          onChange={(event) => onChange(event.target.value)}
          className={`${common} invalid:border-danger invalid:focus:ring-red-100`}
        />
      )}
    </label>
  );
}
