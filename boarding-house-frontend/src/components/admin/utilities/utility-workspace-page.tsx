"use client";
import Link from "next/link";
import { NumberInput } from "@/components/ui/number-input";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import { SummaryCard, PageHeader } from "@/components/shared/management-ui";
import { ErrorState } from "@/components/shared/dashboard-ui";
import { MonthlyBillingPanel } from "@/components/shared/monthly-billing-panel";
import { ContractServicesEditor } from "@/components/admin/contracts/contract-services-editor";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { useAdminContracts } from "@/hooks/use-admin-contracts";
import {
  useManagementProperty,
  useManagementScope,
} from "@/providers/management-scope";
import { adminPropertyService } from "@/services/admin-property.service";
import { useAuth } from "@/providers/auth-provider";
import {
  utilityWorkspaceService as service,
  type UtilityDraft,
  type UtilityRow,
  type UtilityResult,
} from "@/services/utility-workspace.service";
import { adminInvoiceService } from "@/services/admin-invoice.service";
import type { BulkPreview } from "@/types/admin-invoice";
import { readingEstimate, validUtilityDrafts } from "@/lib/utility-workspace";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency, formatDate } from "@/lib/format";

const tabs = [
  "Tổng quan",
  "Ghi chỉ số",
  "Lịch sử chỉ số",
  "Công tơ",
  "Danh mục dịch vụ",
  "Dịch vụ hợp đồng",
  "Đơn giá & định mức",
  "Kiểm tra & chốt kỳ",
];
const initialPeriod = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
export function UtilityWorkspacePage() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [propertyId, setPropertyId] = useManagementProperty(
    Number(params.get("propertyId")) || undefined,
  );
  const scope = useManagementScope();
  const accountantOptions = useScopedQuery({
    queryKey: ["utility-accountant-properties"],
    queryFn: ({ signal }) => adminPropertyService.options(signal),
    enabled: !!user,
  });
  const properties =
    user?.activeRole === "ACCOUNTANT"
      ? (accountantOptions.data?.properties ?? []).map((p) => ({
          id: p.id,
          name: p.label,
        }))
      : scope.properties;
  const [organizationId, setOrganization] = useState<number>();
  const [areaId, setArea] = useState<number>();
  const contexts = accountantOptions.data?.contexts ?? [];
  const organizations = [
    ...new Map(
      contexts
        .filter((c) => c.organizationId != null)
        .map((c) => [c.organizationId!, c.organizationName]),
    ).entries(),
  ];
  const areas = [
    ...new Map(
      contexts
        .filter(
          (c) =>
            c.areaId != null &&
            (!organizationId || c.organizationId === organizationId),
        )
        .map((c) => [c.areaId!, c.areaName]),
    ).entries(),
  ];
  const [period, setPeriod] = useState(initialPeriod);
  const [tab, setTab] = useState(tabs[0]);
  const [hasDraft, setHasDraft] = useState(false);
  return (
    <AdminShell
      title="Điện nước & Dịch vụ"
      subtitle="Ghi số theo kỳ, dịch vụ và kiểm tra phí"
      readOnly
    >
      <div className="mx-auto max-w-[1600px] space-y-5">
        <PageHeader
          title="Điện nước & Dịch vụ"
          description="Chỉ tính các hợp đồng đã nhận phòng và áp dụng ghi theo công tơ."
        />
        <div className="flex flex-wrap items-end gap-4 surface-card p-4">
          <label className="text-sm">
            Công ty
            <select
              className={input}
              value={organizationId ?? ""}
              onChange={(e) => {
                if (
                  hasDraft &&
                  !window.confirm("Đổi phạm vi sẽ rời bản đang nhập. Tiếp tục?")
                )
                  return;
                setOrganization(Number(e.target.value) || undefined);
                setArea(undefined);
                setPropertyId(undefined);
              }}
            >
              <option value="">Tất cả được phân quyền</option>
              {organizations.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Khu
            <select
              className={input}
              value={areaId ?? ""}
              onChange={(e) => {
                if (
                  hasDraft &&
                  !window.confirm("Đổi phạm vi sẽ rời bản đang nhập. Tiếp tục?")
                )
                  return;
                setArea(Number(e.target.value) || undefined);
                setPropertyId(undefined);
              }}
            >
              <option value="">Tất cả khu</option>
              {areas.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Nhà trọ
            <select
              className={input}
              value={propertyId ?? ""}
              onChange={(e) => {
                if (
                  !hasDraft ||
                  window.confirm(
                    "Đổi nhà trọ? Hãy lưu nháp trên thiết bị nếu đang nhập.",
                  )
                )
                  setPropertyId(Number(e.target.value) || undefined);
              }}
            >
              <option value="">Chọn nhà trọ được phân quyền</option>
              {properties
                .filter(
                  (p) =>
                    (!organizationId && !areaId) ||
                    contexts.some(
                      (c) =>
                        c.propertyId === p.id &&
                        (!organizationId ||
                          c.organizationId === organizationId) &&
                        (!areaId || c.areaId === areaId),
                    ),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Kỳ ghi
            <input
              type="month"
              className={input}
              value={period}
              onChange={(e) => {
                if (
                  e.target.value &&
                  (!hasDraft ||
                    window.confirm(
                      "Đổi kỳ? Hãy lưu nháp trên thiết bị nếu đang nhập.",
                    ))
                )
                  setPeriod(e.target.value);
              }}
            />
          </label>
          <Link
            className="text-sm text-link"
            href={`/admin/invoices?propertyId=${propertyId ?? ""}&billingPeriod=${period}`}
          >
            Hóa đơn theo kỳ
          </Link>
        </div>
        <nav
          aria-label="Điện nước và dịch vụ"
          className="flex gap-2 overflow-x-auto rounded-xl border bg-card p-2"
        >
          {tabs
            .filter(
              (item) => user?.activeRole !== "ACCOUNTANT" || item !== tabs[4],
            )
            .map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${item === tab ? "bg-primary hover:bg-primary-hover text-white" : "text-secondary-foreground"}`}
              >
                {item}
              </button>
            ))}
        </nav>
        {propertyId ? (
          <Workspace
            key={`${user?.id}:${user?.activeRole}:${propertyId}:${period}`}
            propertyId={propertyId}
            period={period}
            tab={tab}
            onDirtyChange={setHasDraft}
          />
        ) : (
          <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
            Chọn nhà trọ để tải đúng phạm vi. Không tải toàn bộ hồ sơ về trình
            duyệt.
          </p>
        )}
      </div>
    </AdminShell>
  );
}
function Workspace({
  propertyId,
  period,
  tab,
  onDirtyChange,
}: {
  propertyId: number;
  period: string;
  tab: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const lock = useRef(false);
  const [drafts, setDrafts] = useState<Record<number, UtilityDraft>>({});
  const [results, setResults] = useState<UtilityResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState("ELECTRICITY");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedContract, setContract] = useState(0);
  const [preview, setPreview] = useState<BulkPreview[]>([]);
  const query = useScopedQuery({
    queryKey: ["utility-workspace", propertyId, period],
    queryFn: ({ signal }) =>
      service.load(
        propertyId,
        `${period}-01`,
        signal,
        user?.activeRole === "ACCOUNTANT" ? "accountant" : "admin",
      ),
  });
  const contracts = useAdminContracts(
    { propertyId, keyword: search || undefined, size: 20 },
    user?.activeRole !== "ACCOUNTANT",
  );
  const storageKey = `utility-draft:${user?.id}:${user?.activeRole}:${propertyId}:${period}`;
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    const linkGuard = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        dirty &&
        link &&
        link.origin === location.origin &&
        link.pathname !== location.pathname &&
        !event.ctrlKey &&
        !event.metaKey &&
        link.target !== "_blank" &&
        !window.confirm("Chỉ số đang nhập chưa lưu. Rời trang?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", linkGuard, true);
    return () => {
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("click", linkGuard, true);
    };
  }, [dirty]);
  const rows = query.data?.rows ?? [];
  const draftFor = (row: UtilityRow): UtilityDraft =>
    drafts[row.id] ?? {
      version: Number(row.detail?.reading?.version ?? 0),
      electricity: String(row.detail?.reading?.electricity_current ?? ""),
      water: String(row.detail?.reading?.water_current ?? ""),
      reference: "",
      reason: "",
      confirmWarnings: false,
    };
  const update = (row: UtilityRow, patch: Partial<UtilityDraft>) => {
    setDrafts((previous) => ({
      ...previous,
      [row.id]: { ...(previous[row.id] ?? draftFor(row)), ...patch },
    }));
    setResults((previous) => previous.filter((r) => r.contractId !== row.id));
    setPreview([]);
  };
  const estimate = (row: UtilityRow, code: string) => {
    const p = row.policies?.find(
      (p) => p.code === code && p.calculation_method === "METER",
    );
    if (!p) return null;
    const m = row.detail?.meters.find(
      (m) => m.meter_type === code && m.status === "ACTIVE",
    );
    const events = (row.replacements ?? []).filter(
      (e) => Number(e.meter_id) === Number(m?.id),
    );
    return readingEstimate(
      row.detail?.previous[code],
      code === "ELECTRICITY" ? draftFor(row).electricity : draftFor(row).water,
      p.effectivePrice,
      events,
    );
  };
  const issues = (row: UtilityRow) => {
    const d = draftFor(row);
    return [
      row.error,
      ...["ELECTRICITY", "WATER"].map((code) => estimate(row, code)?.error),
      !d.reference.trim() ? "Thiếu mã chứng từ/ảnh đối chiếu" : null,
      !d.reason.trim() ? "Thiếu lý do xác nhận" : null,
    ].filter(Boolean);
  };
  const edited = rows.filter((row) => drafts[row.id]);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const pending = edited.filter((r) => r.canWrite && !issues(r).length);
      if (!pending.length) throw new Error("Chưa có dòng nhập hợp lệ để chốt.");
      if (pending.length > 50)
        throw new Error("Mỗi lần chốt tối đa 50 hợp đồng.");
      const response = await service.save(
        pending.map((row) => {
          const d = draftFor(row);
          return {
            contractId: row.id,
            reading: {
              period: `${period}-01`,
              version: d.version,
              electricity:
                d.electricity === "" ? undefined : Number(d.electricity),
              water: d.water === "" ? undefined : Number(d.water),
              reference: d.reference,
              reason: d.reason,
              confirmWarnings: d.confirmWarnings,
            },
          };
        }),
      );
      setResults(response);
      const ok = new Set(
        response.filter((r) => r.success).map((r) => r.contractId),
      );
      const remaining = Object.fromEntries(
        Object.entries(drafts).filter(([id]) => !ok.has(Number(id))),
      );
      setDrafts(remaining);
      try {
        localStorage.setItem(storageKey, JSON.stringify(remaining));
      } catch {
        /* Saved server rows remain successful even when local storage is unavailable. */
      }
      setNotice(
        `Đã chốt ${ok.size}/${pending.length} hợp đồng gửi đi. Các dòng lỗi/chưa hợp lệ vẫn được giữ.`,
      );

      await client.invalidateQueries();
    } catch (e) {
      setError(
        apiErrorMessage(
          e,
          e instanceof Error ? e.message : "Không thể chốt dữ liệu.",
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const visible = rows.filter(
    (row) =>
      `${row.room_code} ${row.code} ${row.tenant_name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status ||
        (status === "LOCKED"
          ? row.locked
          : status === "CONFIRMED"
            ? row.detail?.reading?.reading_status === "CONFIRMED"
            : row.detail?.reading?.reading_status !== "CONFIRMED")),
  );
  const meterRows = (code: string) =>
    rows.filter((row) =>
      row.policies?.some(
        (p) => p.code === code && p.calculation_method === "METER",
      ),
    );
  const roomCount = (code: string) =>
    new Set(meterRows(code).map((r) => r.room_id)).size;
  const recorded = (code: string) =>
    [...new Set(meterRows(code).map((r) => r.room_id))].filter((id) =>
      meterRows(code)
        .filter((r) => r.room_id === id)
        .every(
          (r) =>
            r.detail?.reading?.reading_status === "CONFIRMED" &&
            r.detail.reading[
              code === "ELECTRICITY" ? "electricity_current" : "water_current"
            ] != null,
        ),
    ).length;
  const warning = (row: UtilityRow, code: string) => {
    const e = estimate(row, code);
    if (e?.consumption == null) return "";
    const previous = Number(
      row.comparison?.[
        code === "ELECTRICITY" ? "electricity_consumption" : "water_consumption"
      ],
    );
    return e.consumption === 0 && (query.data?.warningPolicy?.warnZero ?? true)
      ? "Không phát sinh tiêu thụ; cần đối chiếu thực tế."
      : previous > 0 &&
          e.consumption >
            previous * Number(query.data?.warningPolicy?.highMultiplier ?? 3)
        ? `Sản lượng hơn ${query.data?.warningPolicy?.highMultiplier ?? 3} lần kỳ trước; cần rà soát chứng từ.`
        : "";
  };
  const confirmedTotal = (field: string) =>
    rows.reduce(
      (sum, row) =>
        sum +
        (row.detail?.reading?.reading_status === "CONFIRMED"
          ? Number(row.detail.reading[field] ?? 0)
          : 0),
      0,
    );
  return (
    <div className="space-y-4">
      {query.isPending && <p>Đang tải các hợp đồng cần ghi số…</p>}
      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-muted p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-accent p-3 text-sm text-link"
        >
          {notice}
        </p>
      )}
      <div hidden={tab !== tabs[0]} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          {[
            ["Phòng cần ghi điện", roomCount("ELECTRICITY")],
            ["Đã ghi điện", recorded("ELECTRICITY")],
            [
              "Chưa ghi điện",
              roomCount("ELECTRICITY") - recorded("ELECTRICITY"),
            ],
            ["Phòng cần ghi nước", roomCount("WATER")],
            ["Đã ghi nước", recorded("WATER")],
            ["Chưa ghi nước", roomCount("WATER") - recorded("WATER")],
          ].map(([label, value]) => (
            <SummaryCard key={label} label={String(label)} value={value} />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Điện đã ghi nhận"
            value={
              confirmedTotal("electricity_consumption").toLocaleString(
                "vi-VN",
              ) + " kWh"
            }
          />
          <SummaryCard
            label="Nước đã ghi nhận"
            value={
              confirmedTotal("water_consumption").toLocaleString("vi-VN") +
              " m³"
            }
          />
          <SummaryCard
            label="Phí điện nước theo chỉ số đã chốt"
            value={formatCurrency(
              confirmedTotal("electricity_amount") +
                confirmedTotal("water_amount"),
            )}
          />
        </div>
        <p className="rounded-xl border bg-card p-4 text-sm text-secondary-foreground">
          Phòng trống không có hợp đồng đã nhận sẽ không được tính là thiếu chỉ
          số. Số tiền chỉ được xác định chính thức khi backend xem trước/lập hóa
          đơn. Kỳ thiếu mốc bàn giao hoặc kỳ trước phải đối soát, không tự điền
          0.
        </p>
      </div>
      <div
        hidden={tab !== tabs[1] && tab !== tabs[7]}
        className="space-y-4 surface-card p-4"
      >
        <div className="flex flex-wrap gap-3">
          <input
            aria-label="Tìm phòng ghi số"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Phòng, hợp đồng, khách thuê"
            className={input}
          />
          <select
            aria-label="Loại chỉ số"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={input}
          >
            <option value="ELECTRICITY">Điện · kWh</option>
            <option value="WATER">Nước · m³</option>
          </select>
          <select
            aria-label="Trạng thái ghi số"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={input}
          >
            <option value="">Tất cả</option>
            <option value="PENDING">Chưa chốt</option>
            <option value="CONFIRMED">Đã chốt</option>
            <option value="LOCKED">Nguồn đã khóa</option>
          </select>
          <button
            className={secondary}
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Tải lại dữ liệu nguồn? Dữ liệu đang nhập vẫn được giữ theo version cũ.",
                )
              )
                void query.refetch();
            }}
          >
            Tải dữ liệu
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Mỗi dòng là một hợp đồng/phòng trong kỳ. Chốt từng dòng độc lập, tối
          đa 50 hợp đồng/lần. Thay công tơ được tính theo các đoạn đã lưu. Nhập
          0 chỉ khi chỉ số thực tế bằng 0.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr>
                {[
                  "Phòng / hợp đồng",
                  "Công tơ",
                  "Chỉ số cũ",
                  "Chỉ số mới",
                  "Tiêu thụ",
                  "Đơn giá",
                  "Dự kiến",
                  "Đối chiếu / trạng thái",
                ].map((t) => (
                  <th key={t} className="border-b p-3">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const policy = row.policies?.find(
                  (p) => p.code === type && p.calculation_method === "METER",
                );
                const d = draftFor(row);
                const e = estimate(row, type);
                const previous = row.detail?.previous[type];
                const meter = row.detail?.meters.find(
                  (m) => m.meter_type === type && m.status === "ACTIVE",
                );
                const result = results.find((r) => r.contractId === row.id);
                return (
                  <tr
                    key={row.id}
                    className={
                      row.error || e?.error || warning(row, type)
                        ? "bg-warning-muted"
                        : "border-b"
                    }
                  >
                    <td className="p-3">
                      <Link
                        className="font-semibold text-link"
                        href={`/admin/contracts/${row.id}`}
                      >
                        {row.room_code}
                      </Link>
                      <p className="text-xs">{row.code}</p>
                    </td>
                    <td>
                      {meter ? String(meter.meter_code) : "Thiếu công tơ"}
                    </td>
                    <td className="max-w-48 p-2">
                      {policy ? (previous ?? "Thiếu mốc") : "Không áp dụng"}
                    </td>
                    <td className="w-36 p-2">
                      <input
                        aria-label={`Chỉ số ${type} phòng ${row.room_code}`}
                        disabled={!row.canWrite || !policy || busy}
                        value={type === "ELECTRICITY" ? d.electricity : d.water}
                        inputMode="decimal"
                        className={input}
                        onChange={(event) =>
                          update(
                            row,
                            type === "ELECTRICITY"
                              ? { electricity: event.target.value }
                              : { water: event.target.value },
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            const inputs = Array.from(
                              event.currentTarget
                                .closest("tbody")!
                                .querySelectorAll<HTMLInputElement>(
                                  'input[inputmode="decimal"]:not(:disabled)',
                                ),
                            );
                            inputs[
                              inputs.indexOf(event.currentTarget) + 1
                            ]?.focus();
                          }
                        }}
                      />
                    </td>
                    <td>
                      {e?.consumption == null
                        ? "—"
                        : `${e.consumption.toLocaleString("vi-VN")} ${policy?.unit}`}
                    </td>
                    <td>
                      {policy ? formatCurrency(policy.effectivePrice) : "—"}
                    </td>
                    <td>
                      {e?.amount == null ? "—" : formatCurrency(e.amount)}
                    </td>
                    <td className="max-w-72 space-y-2 p-2">
                      {row.canWrite && (
                        <>
                          <input
                            aria-label={`Chứng từ phòng ${row.room_code}`}
                            placeholder="Mã ảnh/chứng từ đối chiếu"
                            className={input}
                            value={d.reference}
                            onChange={(e) =>
                              update(row, { reference: e.target.value })
                            }
                          />
                          <input
                            aria-label={`Lý do phòng ${row.room_code}`}
                            placeholder="Lý do xác nhận"
                            className={input}
                            value={d.reason}
                            onChange={(e) =>
                              update(row, { reason: e.target.value })
                            }
                          />
                          <label className="flex gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={d.confirmWarnings}
                              onChange={(e) =>
                                update(row, {
                                  confirmWarnings: e.target.checked,
                                })
                              }
                            />
                            Đã rà soát cảnh báo theo ngưỡng nhà trọ (
                            {query.data?.warningPolicy?.highMultiplier ?? 3} lần
                            kỳ trước)
                          </label>
                        </>
                      )}
                      <p className="text-xs text-warning">
                        {warning(row, type)}{" "}
                        {row.error ||
                          e?.error ||
                          (row.locked
                            ? "Đã khóa nguồn; điều chỉnh qua hóa đơn"
                            : String(
                                row.detail?.reading?.reading_status ??
                                  "Chưa chốt",
                              ))}
                      </p>
                      {result && !result.success && (
                        <p role="alert" className="text-xs text-danger">
                          {result.message}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && !query.isPending && (
          <p className="text-sm text-muted-foreground">
            Không có hợp đồng phát sinh nghĩa vụ ghi số trong kỳ này.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">
            {edited.filter((r) => !issues(r).length).length} dòng hợp lệ /{" "}
            {edited.length} dòng đã nhập
          </span>
          <button
            className={secondary}
            onClick={() => {
              try {
                localStorage.setItem(storageKey, JSON.stringify(drafts));
                setNotice("Đã lưu nháp trên thiết bị, chưa chốt lên hệ thống.");
              } catch {
                setError("Không thể lưu nháp trên thiết bị này.");
              }
            }}
          >
            Lưu nháp trên thiết bị
          </button>
          <button
            className={secondary}
            onClick={() => {
              try {
                const saved = localStorage.getItem(storageKey);
                if (!saved) throw Error();
                const value: unknown = JSON.parse(saved);
                if (!validUtilityDrafts(value)) throw Error();
                setDrafts(value as Record<number, UtilityDraft>);
                setNotice(
                  "Đã nạp nháp. Backend sẽ kiểm tra lại version khi chốt.",
                );
              } catch {
                setError("Không có nháp hợp lệ cho nhà trọ/kỳ này.");
              }
            }}
          >
            Nạp nháp
          </button>
          <button
            className={secondary}
            onClick={() =>
              setNotice(
                edited
                  .map(
                    (r) =>
                      `${r.room_code}: ${issues(r).join("; ") || "Dữ liệu đầu vào hợp lệ; backend sẽ kiểm tra khi chốt"}`,
                  )
                  .join(" · ") || "Chưa có dòng nhập.",
              )
            }
          >
            Kiểm tra dữ liệu
          </button>
          {query.data?.canWrite && (
            <button
              disabled={busy || !dirty}
              className={primary}
              onClick={() => {
                if (
                  window.confirm(
                    "Chốt các dòng hợp lệ lên hệ thống? Dòng lỗi được giữ để xử lý riêng.",
                  )
                )
                  void save();
              }}
            >
              {busy ? "Đang chốt…" : "Chốt chỉ số hợp lệ"}
            </button>
          )}
        </div>
        {tab === tabs[7] && (
          <div className="space-y-3 border-t pt-4">
            <button
              disabled={busy || dirty || user?.activeRole === "ACCOUNTANT"}
              className={secondary}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  setPreview(
                    await adminInvoiceService.bulkPreview({
                      propertyId,
                      billingPeriod: period,
                      issueDate: new Date().toISOString().slice(0, 10),
                      dueDate: new Date(Date.now() + 7 * 86400000)
                        .toISOString()
                        .slice(0, 10),
                      roomIds: rows.map((r) => r.room_id),
                      action: "SAVE_DRAFT",
                    }),
                  );
                } catch (e) {
                  setError(apiErrorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Xem trước phí từ backend
            </button>
            <p className="text-xs text-muted-foreground">
              Chốt/lưu xong chỉ số trước khi xem phí. Xem trước không phát hành
              hóa đơn, ghi nhận thu tiền hoặc tăng công nợ. Khóa kỳ kế toán thực
              hiện theo quyền trong phân hệ tài chính.
            </p>
            {preview.map((p, i) => (
              <p
                className="rounded-xl bg-muted p-3 text-sm"
                key={`${p.roomId}:${i}`}
              >
                {p.roomCode} · {p.status} · {formatCurrency(p.estimatedAmount)}{" "}
                {p.warning}
              </p>
            ))}
          </div>
        )}
      </div>
      <div hidden={tab !== tabs[2]} className="space-y-3">
        {rows.map((row) => (
          <article className="rounded-xl border bg-card p-4" key={row.id}>
            <h2 className="font-bold">
              {row.room_code} · {row.code}
            </h2>
            {row.detail?.revisions.length ? (
              row.detail.revisions.map((r) => (
                <p key={String(r.id)} className="mt-2 break-words text-sm">
                  Kỳ {String(r.billing_period ?? "—")} · Phiên bản{" "}
                  {String(r.version)} · {formatDate(String(r.created_at))} ·{" "}
                  {String(r.reason)}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Chưa có lịch sử điều chỉnh được ghi nhận.
              </p>
            )}
          </article>
        ))}
      </div>
      <div hidden={tab !== tabs[3]} className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border bg-card p-4">
            <h2 className="font-bold">Phòng {row.room_code}</h2>
            {row.detail?.meters.map((m) => (
              <p key={String(m.id)} className="text-sm">
                {String(m.meter_type)} · {String(m.meter_code)} ·{" "}
                {String(m.current_reading)} · {String(m.status)}
              </p>
            ))}
            <Link
              href={`/admin/rooms/${row.room_id}#room-meters`}
              className="mt-2 inline-block text-sm text-link"
            >
              Hồ sơ công tơ và lịch sử
            </Link>
            <button
              className="ml-3 text-sm text-link"
              onClick={() => {
                setContract(row.id);
              }}
            >
              Chọn hợp đồng để thay công tơ
            </button>
          </article>
        ))}
      </div>
      <div hidden={tab !== tabs[4]} className="surface-card p-4">
        {user?.activeRole !== "ACCOUNTANT" ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Cấu hình danh mục theo nhà trọ; cập nhật không sửa snapshot hợp
              đồng/hóa đơn cũ.
            </p>
            <ContractServicesEditor
              propertyId={propertyId}
              start={`${period}-01`}
              end={`${Number(period.slice(0, 4)) + 10}-12-31`}
              value={[]}
              onChange={() => {}}
              scopeAccepted
              onAcceptScope={() => {}}
              onEditingChange={() => {}}
              catalogOnly
            />
          </>
        ) : (
          <p>
            Danh mục gốc do chủ nhà cấu hình. Xem dịch vụ đã thỏa thuận trong hồ
            sơ hợp đồng.
          </p>
        )}
      </div>
      {tab === tabs[6] && query.data?.warningPolicy && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-bold">Ngưỡng rà soát tiêu thụ</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Báo khi vượt {query.data.warningPolicy.highMultiplier} lần kỳ trước
            {query.data.warningPolicy.warnZero
              ? " hoặc không phát sinh sử dụng"
              : ""}
            . Đây là cảnh báo bằng quy tắc, không phải dự báo AI hay kết luận vi
            phạm.
          </p>
          {user?.activeRole === "OWNER" && (
            <form
              key={query.data.warningPolicy.version}
              className="mt-3 flex flex-wrap items-end gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                if (lock.current) return;
                lock.current = true;
                setBusy(true);
                setError("");
                try {
                  await service.warningPolicy({
                    propertyId,
                    version: query.data!.warningPolicy!.version,
                    highMultiplier: Number(form.get("ratio")),
                    warnZero: form.get("zero") === "on",
                    reason: String(form.get("reason")),
                  });
                  await client.invalidateQueries();
                  setNotice("Đã lưu ngưỡng rà soát theo nhà trọ.");
                } catch (error) {
                  setError(apiErrorMessage(error));
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              <label className="text-sm">
                Hệ số tăng
                <NumberInput
                  required
                  name="ratio"
                  aria-label="Hệ số rà soát"
                  min="1.001"
                  max="1000"
                  step="0.001"
                  defaultValue={query.data.warningPolicy.highMultiplier}
                  className={input}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="zero"
                  type="checkbox"
                  defaultChecked={query.data.warningPolicy.warnZero}
                />
                Cảnh báo tiêu thụ bằng 0
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
              <button disabled={busy} className={primary}>
                Lưu ngưỡng rà soát
              </button>
            </form>
          )}
        </section>
      )}
      <div
        hidden={![tabs[3], tabs[5], tabs[6]].includes(tab)}
        className="space-y-3"
      >
        <section className="rounded-xl border bg-card p-4">
          <label className="text-sm">
            Chọn hợp đồng
            {user?.activeRole !== "ACCOUNTANT" && (
              <input
                aria-label="Tìm hợp đồng dịch vụ"
                placeholder="Tìm mã hợp đồng, phòng hoặc khách thuê"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={input}
              />
            )}
            <select
              aria-label="Hợp đồng điện nước"
              value={selectedContract || ""}
              onChange={(e) => setContract(Number(e.target.value))}
              className={input}
            >
              <option value="">Chọn hợp đồng</option>
              {(user?.activeRole === "ACCOUNTANT"
                ? rows.map((r) => ({ id: r.id, contractCode: r.code }))
                : (contracts.data?.page.content ?? [])
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractCode}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Giá cố định theo đơn vị, phí cố định và các phương pháp dịch vụ do
            backend cung cấp. Chưa hỗ trợ cấu hình bậc thang/định mức; không áp
            dụng biểu giá giả. Thay giá giữa kỳ cần chứng từ/chính sách, không
            tự chia sản lượng.
          </p>
        </section>
        {selectedContract > 0 && (
          <MonthlyBillingPanel
            key={`${selectedContract}:${period}`}
            contractId={selectedContract}
            initialPeriod={period}
            writeAllowed={query.data?.canWrite ?? false}
          />
        )}
      </div>
    </div>
  );
}
const input =
  "block min-h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm disabled:bg-muted";
const secondary =
  "rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-secondary-foreground disabled:opacity-50";
const primary =
  "rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
