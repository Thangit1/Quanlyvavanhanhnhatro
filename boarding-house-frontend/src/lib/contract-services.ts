import { z } from "zod";
import type { Service } from "@/services/direct-contract.service";

export const serviceMethods = {
  FIXED: "Theo phòng/tháng",
  PER_PERSON: "Theo người/tháng",
  QUANTITY: "Theo xe/số lượng mỗi tháng",
  USAGE: "Theo lượt sử dụng thực tế",
  ONCE: "Thu một lần",
} as const;
export const serviceCategories = {
  UTILITY: "Tiện ích",
  PARKING: "Gửi xe",
  CLEANING: "Vệ sinh",
  EQUIPMENT: "Thiết bị",
  OTHER: "Dịch vụ khác",
} as const;
export const serviceSchema = z
  .object({
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1, "Nhập tên dịch vụ").max(100),
    description: z.string().max(5000).optional(),
    note: z.string().max(2000).optional(),
    calculationMethod: z.enum([
      "FIXED",
      "PER_PERSON",
      "QUANTITY",
      "USAGE",
      "ONCE",
    ]),
    unitPrice: z
      .number()
      .finite()
      .min(0)
      .max(9999999999999.99)
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.01,
        "Đơn giá tối đa 2 chữ số thập phân",
      ),
    quantity: z
      .number()
      .finite()
      .positive()
      .max(999999999)
      .refine(
        (v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 0.01,
        "Số lượng tối đa 3 chữ số thập phân",
      ),
    unit: z.string().trim().min(1, "Nhập đơn vị tính").max(30),
    billingCycle: z.enum(["MONTHLY", "ON_USAGE", "ONCE"]),
    effectiveDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    catalogServiceId: z.number().positive().optional(),
    prorate: z.boolean().optional(),
  })
  .refine((s) => s.calculationMethod !== "FIXED" || s.quantity === 1, {
    message: "Một hợp đồng áp dụng một phòng",
    path: ["quantity"],
  });
export function serviceCycle(
  method: Service["calculationMethod"],
): NonNullable<Service["billingCycle"]> {
  return method === "USAGE"
    ? "ON_USAGE"
    : method === "ONCE"
      ? "ONCE"
      : "MONTHLY";
}
export function normalizeService(s: Service): Service {
  return {
    ...s,
    quantity: s.quantity ?? 1,
    unit: s.unit ?? "tháng",
    billingCycle: serviceCycle(s.calculationMethod),
    status: s.status ?? "ACTIVE",
    prorate: s.prorate ?? false,
  };
}
export function serviceTotals(services: Service[], firstDate?: string) {
  let recurring = 0,
    once = 0,
    usage = 0;
  for (const row of services) {
    const s = normalizeService(row);
    if (s.status === "INACTIVE") continue;
    if (
      firstDate &&
      s.effectiveDate &&
      s.effectiveDate.slice(0, 7) > firstDate.slice(0, 7)
    )
      continue;
    if (firstDate && s.endDate && s.endDate <= firstDate) continue;
    if (s.calculationMethod === "USAGE") {
      usage++;
      continue;
    }
    const amount = s.unitPrice * (s.quantity ?? 1);
    if (s.calculationMethod === "ONCE") {
      if (
        !firstDate ||
        !s.effectiveDate ||
        s.effectiveDate.slice(0, 7) === firstDate.slice(0, 7)
      )
        once += amount;
    } else recurring += amount;
  }
  return { recurring, once, usage };
}
