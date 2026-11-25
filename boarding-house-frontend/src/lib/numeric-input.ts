export type NumericDraft<T> = T extends number
  ? number | string
  : T extends (infer U)[]
    ? NumericDraft<U>[]
    : T extends object
      ? { [K in keyof T]: NumericDraft<T[K]> }
      : T;
export type NumericDraftFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: NumericDraft<T[P]>;
};
export function numericText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number")
    return Number.isFinite(value)
      ? value.toLocaleString("en-US", {
          useGrouping: false,
          maximumFractionDigits: 20,
        })
      : "";
  return value;
}
export function normalizeNumericText(value: string): string {
  if (!value.trim()) return "";
  const [whole, fraction] = value.split(".");
  const negative = whole.startsWith("-");
  const digits = whole.replace(/^-/, "").replace(/^0+(?=\d)/, "") || "0";
  const decimal = fraction?.replace(/0+$/, "");
  const zero = /^0+$/.test(digits) && !decimal;
  return `${negative && !zero ? "-" : ""}${digits}${decimal ? `.${decimal}` : ""}`;
}
export function parseNumericValue(
  value: string | number | null | undefined,
): number | undefined {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Giá trị số không hợp lệ.");
  const raw = numericText(value).trim();
  if (!raw) return undefined;
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))
    throw new Error("Nhập giá trị số hợp lệ.");
  const normalized = normalizeNumericText(raw),
    result = Number(normalized);
  if (
    !Number.isFinite(result) ||
    Math.abs(result) > Number.MAX_SAFE_INTEGER ||
    normalizeNumericText(numericText(result)) !== normalized
  )
    throw new Error("Giá trị vượt giới hạn hoặc độ chính xác được hỗ trợ.");
  return result;
}
export function numericPreview(
  value: string | number | null | undefined,
): number {
  try {
    return parseNumericValue(value) ?? 0;
  } catch {
    return 0;
  }
}
export function requiredNumericValue(
  value: string | number | null | undefined,
): number {
  const parsed = parseNumericValue(value);
  if (parsed === undefined) throw new Error("Vui lòng nhập giá trị số.");
  return parsed;
}
export function parseNumericFields<T>(
  draft: NumericDraft<T>,
  fields: readonly string[],
  optional: readonly string[] = [],
  defaults: Record<string, number> = {},
): T {
  function convert(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(convert);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
          if (!fields.includes(key)) return [key, convert(item)];
          if (item === null && optional.includes(key)) return [key, null];
          const parsed = parseNumericValue(item as string | number | undefined);
          if (parsed !== undefined) return [key, parsed];
          if (key in defaults) return [key, defaults[key]];
          if (optional.includes(key)) return [key, undefined];
          throw new Error(`Vui lòng nhập giá trị cho ${key}.`);
        }),
      );
    return value;
  }
  return convert(draft) as T;
}
export function parseVietnameseCurrencyPaste(text: string): string | undefined {
  const raw = text
    .trim()
    .replace(/\s*[₫đ]\s*$/i, "")
    .replace(/[\s\u00a0]/g, "");
  if (/^-?0\.\d+$/.test(raw)) return raw;
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw))
    return raw.replaceAll(".", "").replace(",", ".");
  if (/^-?\d+(?:,\d+)?$/.test(raw)) return raw.replace(",", ".");
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return raw;
  return undefined;
}
export function formatVietnameseNumber(raw: string): string {
  if (!raw) return "";
  const normalized = normalizeNumericText(raw),
    [whole, fraction] = normalized.split(".");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (fraction ? `,${fraction}` : "")
  );
}
export function numericValidation(
  raw: string,
  {
    required = false,
    min,
    max,
    step = "1",
  }: {
    required?: boolean;
    min?: string | number;
    max?: string | number;
    step?: string | number;
  },
): string {
  if (!raw) return required ? "Vui lòng nhập giá trị." : "";
  let value: number;
  try {
    value = parseNumericValue(raw)!;
  } catch (e) {
    return (e as Error).message;
  }
  if (min !== undefined && value < Number(min))
    return `Giá trị tối thiểu là ${min}.`;
  if (max !== undefined && value > Number(max))
    return `Giá trị tối đa là ${max}.`;
  if (step !== "any") {
    const increment = Number(step),
      base = min === undefined ? 0 : Number(min);
    if (
      increment > 0 &&
      Math.abs(
        (value - base) / increment - Math.round((value - base) / increment),
      ) > 1e-6
    )
      return `Giá trị phải theo bước ${step}.`;
  }
  return "";
}
