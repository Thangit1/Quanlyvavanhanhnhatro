"use client";
import { CurrencyInput, NumberInput } from "@/components/ui/number-input";
import {
  parseNumericFields,
  type NumericDraftFields,
} from "@/lib/numeric-input";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import type { Service } from "@/services/direct-contract.service";
import {
  normalizeService,
  serviceCategories,
  serviceCycle,
  serviceMethods,
  serviceSchema,
} from "@/lib/contract-services";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

type Catalog = {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: keyof typeof serviceCategories;
  calculation_method: Service["calculationMethod"];
  unit_price: number;
  unit: string;
  quantity: number;
  billing_cycle: Service["billingCycle"];
  status: string;
  is_default: boolean;
  allow_price_override: boolean;
  prorate: boolean;
  version: number;
};
type CatalogResult = {
  history?: {
    id: number;
    content: string;
    reason: string;
    created_at: string;
    actor_name: string | null;
  }[];
  items: Catalog[];
  canConfigure: boolean;
  canOverride: boolean;
};
const input =
  "w-full min-h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm disabled:bg-muted";
function fromCatalog(c: Catalog): Service {
  return {
    code: c.code,
    name: c.name,
    description: c.description ?? "",
    catalogServiceId: c.id,
    calculationMethod: c.calculation_method,
    unitPrice: Number(c.unit_price),
    unit: c.unit,
    quantity: Number(c.quantity),
    billingCycle: c.billing_cycle,
    status: "ACTIVE",
    prorate: c.prorate,
  };
}
export function ContractServicesEditor({
  propertyId,
  start,
  end,
  value,
  onChange,
  scopeAccepted,
  onAcceptScope,
  onEditingChange,
  catalogOnly = false,
}: {
  propertyId?: number;
  start: string;
  end: string;
  value: Service[];
  onChange: (services: Service[]) => void;
  scopeAccepted: boolean;
  onAcceptScope: () => void;
  onEditingChange: (editing: boolean) => void;
  catalogOnly?: boolean;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{
    row: NumericDraftFields<Service, "unitPrice" | "quantity">;
    index?: number;
    catalog?: Catalog;
    configure?: boolean;
  }>();
  const [configCategory, setConfigCategory] =
    useState<keyof typeof serviceCategories>("OTHER");
  const [recommended, setRecommended] = useState(false);
  const [allowOverride, setAllowOverride] = useState(false);
  const [reason, setReason] = useState("");
  const query = useQuery({
    queryKey: [
      "property-service-catalog",
      user?.id,
      user?.activeRole,
      propertyId,
    ],
    enabled: !!propertyId && !!user,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<CatalogResult>>(
          `/admin/properties/${propertyId}/services`,
          { signal },
        )
      ).data.data,
  });
  const catalog = query.data?.items ?? [];
  const canOverride = !!query.data?.canOverride;
  const row = editor?.row;
  const locked =
    !!editor?.catalog &&
    !editor.configure &&
    (!canOverride || !editor.catalog.allow_price_override);
  function change(
    patch: Partial<NumericDraftFields<Service, "unitPrice" | "quantity">>,
  ) {
    if (editor) setEditor({ ...editor, row: { ...editor.row, ...patch } });
  }
  function open(s?: Service, index?: number, config?: Catalog | "new") {
    onEditingChange(true);
    setError("");
    setReason("");
    const c =
      config && config !== "new"
        ? config
        : s?.catalogServiceId
          ? catalog.find((c) => c.id === s.catalogServiceId)
          : undefined;
    setConfigCategory(c?.category ?? "OTHER");
    setRecommended(c?.is_default ?? false);
    setAllowOverride(c?.allow_price_override ?? false);
    setEditor({
      row: normalizeService(
        s ??
          (c
            ? {
                ...fromCatalog(c),
                status: c.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
              }
            : {
                code: `S${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
                name: "",
                calculationMethod: "FIXED",
                unitPrice: 0,
                unit: "phòng/tháng",
                description: "",
                note: "",
              }),
      ),
      index,
      catalog: c,
      configure: !!config,
    });
  }
  async function save() {
    if (!editor || !row) return;
    let parsed: Service;
    try {
      parsed = parseNumericFields<Service>(row, ["unitPrice", "quantity"]);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const checked = serviceSchema.safeParse(parsed);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "Kiểm tra dữ liệu dịch vụ");
      return;
    }
    if (
      !editor.configure &&
      ((row.effectiveDate &&
        (row.effectiveDate < start || row.effectiveDate >= end)) ||
        (row.endDate &&
          (row.endDate <= (row.effectiveDate || start) || row.endDate > end)))
    ) {
      setError(
        "Ngày dịch vụ phải nằm trong thời hạn thuê; ngày ngừng không tính phí.",
      );
      return;
    }
    if (
      !editor.configure &&
      value.some(
        (s, i) =>
          i !== editor.index &&
          (s.code.toLowerCase() === row.code.toLowerCase() ||
            s.name.trim().toLowerCase() === row.name.trim().toLowerCase()),
      )
    ) {
      setError("Dịch vụ đã có trong danh sách.");
      return;
    }
    if (editor.configure) {
      if (!reason.trim()) {
        setError("Nhập lý do cấu hình bảng giá.");
        return;
      }
      setBusy(true);
      try {
        const path = `/admin/properties/${propertyId}/services`;
        const payload = {
          service: {
            ...checked.data,
            effectiveDate: undefined,
            endDate: undefined,
          },
          category: configCategory,
          recommended,
          allowPriceOverride: allowOverride,
          version: editor.catalog?.version ?? 0,
          reason,
        };
        if (editor.catalog)
          await apiClient.put(`${path}/${editor.catalog.id}`, payload);
        else await apiClient.post(path, payload);
        await client.invalidateQueries({
          queryKey: ["property-service-catalog"],
        });
        setEditor(undefined);
        onEditingChange(false);
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setBusy(false);
      }
    } else {
      onChange(
        editor.index === undefined
          ? [...value, checked.data]
          : value.map((s, i) => (i === editor.index ? checked.data : s)),
      );
      setEditor(undefined);
      onEditingChange(false);
    }
  }
  function acceptScope() {
    if (query.isFetching || query.isError) return;
    if (
      value.some(
        (s) =>
          s.catalogServiceId &&
          !catalog.some(
            (c) => c.id === s.catalogServiceId && c.status === "ACTIVE",
          ),
      )
    ) {
      setError(
        "Có dịch vụ không thuộc bảng giá nhà trọ này hoặc đã ngừng. Hãy xóa dịch vụ đó hoặc chọn lại từ danh mục; dữ liệu chưa bị xóa.",
      );
      return;
    }
    if (value.some((s) => !s.catalogServiceId) && !canOverride) {
      setError("Bạn chưa có quyền áp dụng dịch vụ tùy chỉnh tại nhà trọ này.");
      return;
    }
    onAcceptScope();
    setError("");
  }
  return (
    <section
      className="space-y-4 rounded-2xl border border-accent-border p-4"
      onKeyDown={(e) => {
        if (
          e.key === "Enter" &&
          !["TEXTAREA", "BUTTON"].includes((e.target as HTMLElement).tagName)
        )
          e.preventDefault();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Dịch vụ áp dụng</h3>
        <span className="text-xs text-muted-foreground">
          {value.length}/30 dịch vụ · Giá theo thỏa thuận
        </span>
      </div>
      {!scopeAccepted && (
        <div
          role="alert"
          className="rounded-xl bg-warning-muted p-3 text-sm text-amber-900"
        >
          Bạn đã đổi nhà trọ hoặc phòng. Các dịch vụ đã nhập vẫn được giữ; cần
          kiểm tra lại trước khi lưu hợp đồng.
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            disabled={query.isFetching || !propertyId}
            onClick={acceptScope}
          >
            Kiểm tra và áp dụng cho phòng này
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-sm text-danger">
          {error}
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-sm text-danger">
          {apiErrorMessage(query.error)}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void query.refetch()}
          >
            Tải lại danh mục
          </button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Tìm dịch vụ"
          placeholder="Tìm nhanh tên hoặc mã dịch vụ"
          className={`${input} flex-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Nhóm dịch vụ"
          className={input}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Tất cả nhóm</option>
          {Object.entries(serviceCategories).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {query.isPending && propertyId && (
        <p className="text-sm">Đang tải bảng giá nhà trọ…</p>
      )}
      <div className="grid max-h-80 gap-3 overflow-y-auto sm:grid-cols-2">
        {catalog
          .filter(
            (c) =>
              (!category || c.category === category) &&
              `${c.name} ${c.code}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((c) => {
            const selected = value.some(
              (s) =>
                s.catalogServiceId === c.id ||
                s.code.toLowerCase() === c.code.toLowerCase(),
            );
            return (
              <article
                key={c.id}
                className={`rounded-xl border p-3 ${c.status !== "ACTIVE" ? "bg-muted" : "bg-card"}`}
              >
                <label className="flex gap-3">
                  <input
                    type="checkbox"
                    hidden={catalogOnly}
                    className="mt-1"
                    checked={selected}
                    disabled={
                      c.status !== "ACTIVE" || (!selected && value.length >= 30)
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (
                          value.some(
                            (s) =>
                              s.name.trim().toLowerCase() ===
                              c.name.trim().toLowerCase(),
                          )
                        ) {
                          setError("Dịch vụ cùng tên đã được chọn.");
                          return;
                        }
                        onChange([...value, fromCatalog(c)]);
                      } else
                        onChange(
                          value.filter(
                            (s) =>
                              s.catalogServiceId !== c.id &&
                              s.code.toLowerCase() !== c.code.toLowerCase(),
                          ),
                        );
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <strong>{c.name}</strong>
                    <span className="block whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {c.description || serviceCategories[c.category]}
                    </span>
                    <span className="mt-1 block text-sm">
                      {Number(c.unit_price) === 0
                        ? "Miễn phí / đã bao gồm"
                        : formatCurrency(Number(c.unit_price))}{" "}
                      / {c.unit}
                    </span>
                    <span className="text-xs">
                      {serviceMethods[c.calculation_method]} ·{" "}
                      {c.status === "ACTIVE" ? "Đang áp dụng" : "Đã ngừng"}
                      {c.is_default ? " · Đề xuất của nhà trọ" : ""}
                    </span>
                  </span>
                </label>
                {query.data?.canConfigure && (
                  <button
                    type="button"
                    className="mt-2 text-xs text-link underline"
                    onClick={() => open(undefined, undefined, c)}
                  >
                    Sửa cấu hình
                  </button>
                )}
              </article>
            );
          })}
      </div>
      {catalogOnly && query.data?.history?.length ? (
        <details className="rounded-xl border p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Lịch sử cấu hình danh mục
          </summary>
          {query.data.history.map((h) => (
            <article key={h.id} className="mt-3 border-t pt-2 text-xs">
              <p>
                {h.created_at} · {h.actor_name ?? "—"} · {h.reason}
              </p>
              <pre className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                {h.content}
              </pre>
            </article>
          ))}
        </details>
      ) : null}
      {!query.isPending && !query.isError && !catalog.length && (
        <p className="rounded-xl bg-muted p-3 text-sm">
          Nhà trọ chưa cấu hình danh mục dịch vụ. Chủ nhà có thể thêm bảng giá
          bên dưới. Dịch vụ có phí chỉ áp dụng sau khi bạn chủ động chọn.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!catalogOnly && (
          <Button
            type="button"
            variant="outline"
            disabled={!canOverride || value.length >= 30}
            onClick={() => open()}
          >
            + Thêm dịch vụ tùy chỉnh
          </Button>
        )}
        {query.data?.canConfigure && (
          <Button
            type="button"
            variant="outline"
            onClick={() => open(undefined, undefined, "new")}
          >
            + Cấu hình dịch vụ nhà trọ
          </Button>
        )}
      </div>
      {value.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <caption className="py-2 text-left font-semibold">
              Dịch vụ đã chọn · Số lượng theo người là dự kiến, hóa đơn dùng
              lịch sử cư trú thực tế
            </caption>
            <thead>
              <tr>
                {[
                  "Dịch vụ",
                  "Cách tính",
                  "Đơn giá",
                  "Số lượng",
                  "Thành tiền dự kiến",
                  "Thao tác",
                ].map((t) => (
                  <th className="p-2" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((s, index) => (
                <tr key={s.code} className="border-t align-top">
                  <td className="max-w-56 p-2">
                    <strong>{s.name}</strong>
                    <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {s.description}
                    </p>
                    {s.note && (
                      <p className="whitespace-pre-wrap text-xs">{s.note}</p>
                    )}
                    <label className="mt-2 flex gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={s.status !== "INACTIVE"}
                        onChange={(e) =>
                          onChange(
                            value.map((v, i) =>
                              i === index
                                ? {
                                    ...v,
                                    status: e.target.checked
                                      ? "ACTIVE"
                                      : "INACTIVE",
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                      Áp dụng
                    </label>
                  </td>
                  <td className="p-2">{serviceMethods[s.calculationMethod]}</td>
                  <td className="p-2">
                    {s.unitPrice === 0
                      ? "Miễn phí / đã bao gồm"
                      : formatCurrency(s.unitPrice)}
                    <br />
                    <span className="text-xs">/{s.unit ?? "tháng"}</span>
                  </td>
                  <td className="p-2">
                    {s.calculationMethod === "USAGE"
                      ? "Theo thực tế"
                      : (s.quantity ?? 1)}
                  </td>
                  <td className="p-2">
                    {s.status === "INACTIVE"
                      ? "Không áp dụng"
                      : s.calculationMethod === "USAGE"
                        ? "Chưa phát sinh"
                        : formatCurrency(s.unitPrice * (s.quantity ?? 1))}
                  </td>
                  <td className="space-y-2 p-2">
                    <button
                      type="button"
                      className="mr-3 text-link underline"
                      onClick={() => open(s, index)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="text-danger underline"
                      onClick={() =>
                        onChange(value.filter((_, i) => i !== index))
                      }
                    >
                      Xóa
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        aria-label={`Đưa ${s.name} lên`}
                        disabled={!index}
                        onClick={() => {
                          const next = [...value];
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          onChange(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Đưa ${s.name} xuống`}
                        disabled={index === value.length - 1}
                        onClick={() => {
                          const next = [...value];
                          [next[index + 1], next[index]] = [
                            next[index],
                            next[index + 1],
                          ];
                          onChange(next);
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editor && row && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={
            editor.configure ? "Cấu hình bảng giá dịch vụ" : "Thông tin dịch vụ"
          }
          className="space-y-3 rounded-xl border-2 border-accent-border bg-accent p-4"
        >
          <h4 className="font-semibold">
            {editor.configure
              ? "Cấu hình bảng giá nhà trọ"
              : "Thông tin dịch vụ thỏa thuận"}
          </h4>
          {locked && (
            <p className="text-xs">
              Đơn giá, cách tính và đơn vị dùng cấu hình nhà trọ. Chủ nhà có thể
              cập nhật bảng giá trước khi chọn lại.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Tên dịch vụ
              <input
                className={input}
                maxLength={100}
                value={row.name}
                onChange={(e) => change({ name: e.target.value })}
              />
            </label>
            {editor.configure && (
              <label className="text-sm">
                Mã dịch vụ
                <input
                  className={input}
                  maxLength={30}
                  value={row.code}
                  onChange={(e) =>
                    change({ code: e.target.value.toUpperCase() })
                  }
                />
              </label>
            )}
          </div>
          <label className="block text-sm">
            Mô tả chi tiết ({row.description?.length ?? 0}/5000)
            <textarea
              rows={3}
              className={input}
              maxLength={5000}
              value={row.description ?? ""}
              onChange={(e) => change({ description: e.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Phương pháp tính
              <select
                disabled={locked}
                className={input}
                value={row.calculationMethod}
                onChange={(e) => {
                  const method = e.target.value as Service["calculationMethod"];
                  change({
                    calculationMethod: method,
                    billingCycle: serviceCycle(method),
                    quantity: method === "FIXED" ? 1 : row.quantity,
                    prorate: ["USAGE", "ONCE"].includes(method)
                      ? false
                      : row.prorate,
                  });
                }}
              >
                {Object.entries(serviceMethods).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Đơn vị tính
              <input
                disabled={locked}
                className={input}
                maxLength={30}
                value={row.unit ?? ""}
                onChange={(e) => change({ unit: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Đơn giá (đ)
              <CurrencyInput
                disabled={locked}
                type="number"
                min={0}
                step="0.01"
                className={input}
                value={row.unitPrice}
                onChange={(e) => change({ unitPrice: e.target.value })}
              />
            </label>
            <label className="text-sm">
              {row.calculationMethod === "PER_PERSON"
                ? "Số người dự kiến"
                : "Số lượng"}
              <NumberInput
                disabled={["FIXED", "USAGE"].includes(row.calculationMethod)}
                type="number"
                min="0.001"
                step="0.001"
                className={input}
                value={row.quantity ?? 1}
                onChange={(e) => change({ quantity: e.target.value })}
              />
            </label>
          </div>
          <p className="text-xs">
            Chu kỳ:{" "}
            {row.billingCycle === "ONCE"
              ? "Một lần tại kỳ hiệu lực"
              : row.billingCycle === "ON_USAGE"
                ? "Theo sử dụng có chứng từ, không tự cộng phí"
                : "Hằng tháng"}
          </p>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Cấu hình chi tiết
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {!editor.configure && (
                <>
                  <label className="text-sm">
                    Ngày bắt đầu (trống = ngày thuê)
                    <input
                      type="date"
                      className={input}
                      min={start}
                      max={end}
                      value={row.effectiveDate ?? ""}
                      onChange={(e) =>
                        change({ effectiveDate: e.target.value || undefined })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Ngày ngừng (không tính ngày này)
                    <input
                      type="date"
                      className={input}
                      min={row.effectiveDate || start}
                      max={end}
                      value={row.endDate ?? ""}
                      onChange={(e) =>
                        change({ endDate: e.target.value || undefined })
                      }
                    />
                  </label>
                </>
              )}
              {!["USAGE", "ONCE"].includes(row.calculationMethod) && (
                <label className="flex gap-2 text-sm">
                  <input
                    disabled={locked}
                    type="checkbox"
                    checked={!!row.prorate}
                    onChange={(e) => change({ prorate: e.target.checked })}
                  />
                  Phân bổ theo ngày áp dụng thực tế
                </label>
              )}
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.status !== "INACTIVE"}
                  onChange={(e) =>
                    change({ status: e.target.checked ? "ACTIVE" : "INACTIVE" })
                  }
                />
                Đang áp dụng
              </label>
              {editor.configure && (
                <>
                  <label className="text-sm">
                    Nhóm
                    <select
                      className={input}
                      value={configCategory}
                      onChange={(e) =>
                        setConfigCategory(
                          e.target.value as keyof typeof serviceCategories,
                        )
                      }
                    >
                      {Object.entries(serviceCategories).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={recommended}
                      onChange={(e) => setRecommended(e.target.checked)}
                    />
                    Đề xuất mặc định (không tự chọn)
                  </label>
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowOverride}
                      onChange={(e) => setAllowOverride(e.target.checked)}
                    />
                    Cho phép người có quyền tài chính thỏa thuận giá/cách tính
                  </label>
                </>
              )}
            </div>
          </details>
          {!editor.configure && (
            <label className="block text-sm">
              Ghi chú ({row.note?.length ?? 0}/2000)
              <textarea
                rows={3}
                maxLength={2000}
                className={input}
                value={row.note ?? ""}
                onChange={(e) => change({ note: e.target.value })}
              />
            </label>
          )}
          {editor.configure && (
            <label className="block text-sm">
              Lý do cấu hình
              <textarea
                rows={2}
                maxLength={1000}
                className={input}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void save()}>
              {busy
                ? "Đang lưu…"
                : editor.configure
                  ? "Lưu cấu hình nhà trọ"
                  : "Lưu dịch vụ vào danh sách"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setEditor(undefined);
                onEditingChange(false);
              }}
            >
              Hủy
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
