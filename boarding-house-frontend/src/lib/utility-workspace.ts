export type UtilityEvent = {
  removed_reading: number | string | null;
  new_reading: number | string | null;
};
export function validUtilityDrafts(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    Object.entries(value).length <= 500 &&
    Object.entries(value).every(([key, row]) => {
      if (!/^\d+$/.test(key) || !row || typeof row !== "object") return false;
      const r = row as Record<string, unknown>;
      return (
        Number.isInteger(r.version) &&
        Number(r.version) >= 0 &&
        ["electricity", "water", "reference", "reason"].every(
          (field) => typeof r[field] === "string",
        ) &&
        typeof r.confirmWarnings === "boolean"
      );
    })
  );
}
export function readingEstimate(
  previous: unknown,
  current: string,
  price: unknown,
  events: UtilityEvent[] = [],
) {
  if (previous == null || previous === "" || !Number.isFinite(Number(previous)))
    return { error: "Thiếu mốc kỳ trước/bàn giao; cần đối soát." };
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(current))
    return { error: "Nhập chỉ số không âm, tối đa 2 số thập phân." };
  let cursor = Number(previous),
    used = 0;
  for (const e of events) {
    if (
      e.removed_reading == null ||
      e.new_reading == null ||
      !Number.isFinite(Number(e.removed_reading)) ||
      !Number.isFinite(Number(e.new_reading)) ||
      Number(e.removed_reading) < cursor ||
      Number(e.new_reading) < 0
    )
      return { error: "Đoạn thay công tơ cần đối soát." };
    used += Number(e.removed_reading) - cursor;
    cursor = Number(e.new_reading);
  }
  if (Number(current) < cursor)
    return { error: "Chỉ số mới nhỏ hơn đầu đoạn đồng hồ hiện tại." };
  used += Number(current) - cursor;
  return {
    consumption: used,
    amount:
      price == null || !Number.isFinite(Number(price))
        ? null
        : used * Number(price),
  };
}
