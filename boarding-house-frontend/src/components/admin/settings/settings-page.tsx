"use client";
import { IntegrationCenter } from "./integration-center";
import { parseNumericFields } from "@/lib/numeric-input";
import Link from "next/link";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { useSearchParams } from "next/navigation";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  Bot,
  Clock3,
  FileClock,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { SettingsNavigation } from "@/components/admin/settings/settings-navigation";
import { OrganizationSettingsPanel } from "@/components/admin/settings/organization-settings-panel";
import { groupFields, settingNavigation } from "@/constants/setting-groups";
import { adminSettingService } from "@/services/admin-setting.service";
import { useAuth } from "@/providers/auth-provider";
import { formatDate } from "@/lib/format";
import type {
  AiSettings,
  AuditPage,
  BillingSettings,
  GroupSettings,
  PropertySettings,
  SettingData,
  SettingOverview,
  SettingSection,
} from "@/types/admin-setting";

const genericSections = new Set([
  "profile",
  "organization",
  "rental",
  "contracts",
  "utilities",
  "payments",
  "notifications",
  "security",
  "integrations",
]);

export function SettingsPage({ section }: { section: SettingSection }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const isOwner = user?.activeRole === "OWNER";
  const overviewQuery = useScopedQuery({
    queryKey: ["admin-settings-overview"],
    queryFn: ({ signal }) => adminSettingService.overview(signal),
    staleTime: 20_000,
  });
  const [propertyId, setPropertyId] = useState<number | undefined>(
    Number(params.get("propertyId")) || undefined,
  );

  if (overviewQuery.isLoading) return <PageLoading />;
  const effectivePropertyId =
    propertyId ?? overviewQuery.data?.properties[0]?.id;
  const navItem = settingNavigation.find((item) => item.section === section);
  const inaccessible = navItem?.ownerOnly && !isOwner;
  return (
    <AdminShell
      title="Cài đặt hệ thống"
      subtitle="Vận hành, bảo mật và tích hợp SmartHome AI"
    >
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-link">
            Tổng quan / Cài đặt
          </p>
          <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {navItem?.label ?? "Cài đặt hệ thống"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {navItem?.description ??
                  "Quản lý cấu hình vận hành, bảo mật và tích hợp của SmartHome AI."}
              </p>
            </div>
            {section === "properties" && overviewQuery.data && (
              <label className="min-w-64">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Khu trọ đang cấu hình
                </span>
                <select
                  value={effectivePropertyId ?? ""}
                  onChange={(event) =>
                    setPropertyId(Number(event.target.value))
                  }
                  className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring"
                >
                  {overviewQuery.data.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </header>
        {overviewQuery.isError ? (
          <ErrorState onRetry={() => void overviewQuery.refetch()} />
        ) : inaccessible ? (
          <div className="rounded-2xl border border-warning-border bg-warning-muted p-8 text-center font-semibold text-warning">
            Bạn không có quyền truy cập nhóm cài đặt này.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <SettingsNavigation section={section} isOwner={isOwner} />
            <main className="min-w-0">
              <ConfigurationSources section={section} />
              {section === "organization" && <OrganizationSettingsPanel />}
              {section === "overview" && overviewQuery.data ? (
                <OverviewPanel data={overviewQuery.data} />
              ) : section === "integrations" ? (
                <IntegrationCenter />
              ) : section === "audit-logs" ? (
                <AuditPanel />
              ) : (
                <EditableSettings
                  section={section}
                  propertyId={effectivePropertyId}
                />
              )}
            </main>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function EditableSettings({
  section,
  propertyId,
}: {
  section: SettingSection;
  propertyId?: number;
}) {
  const query = useScopedQuery<SettingData>({
    queryKey: ["admin-settings", section, propertyId],
    enabled: section !== "properties" || Boolean(propertyId),
    queryFn: async ({ signal }): Promise<SettingData> => {
      if (section === "general") return adminSettingService.general(signal);
      if (section === "properties")
        return adminSettingService.property(propertyId!, signal);
      if (section === "billing") return adminSettingService.billing(signal);
      if (section === "ai") return adminSettingService.ai(signal);
      if (genericSections.has(section))
        return adminSettingService.group(section, signal);
      throw new Error("Nhóm cài đặt không được hỗ trợ.");
    },
  });
  if (query.isLoading) return <SectionSkeleton />;
  if (query.isError || !query.data)
    return <ErrorState onRetry={() => void query.refetch()} />;
  return (
    <SettingsEditor
      key={`${section}-${propertyId ?? "system"}`}
      section={section}
      propertyId={propertyId}
      data={query.data}
    />
  );
}

function SettingsEditor({
  section,
  propertyId,
  data,
}: {
  section: SettingSection;
  propertyId?: number;
  data: SettingData;
}) {
  const client = useQueryClient();
  const normalizedData = useMemo(
    () => normalizeData(section, data),
    [data, section],
  );
  const [values, setValues] = useState<Record<string, unknown>>(
    () => normalizedData,
  );
  const [original, setOriginal] = useState<Record<string, unknown>>(
    () => normalizedData,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(original),
    [original, values],
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = preparePayload(section, values);
      if (section === "general")
        return adminSettingService.updateGeneral(payload);
      if (section === "properties")
        return adminSettingService.updateProperty(propertyId!, payload);
      if (section === "billing")
        return adminSettingService.updateBilling(payload);
      if (section === "ai") return adminSettingService.updateAi(payload);
      return adminSettingService.updateGroup(section, payload);
    },
    onSuccess: (data) => {
      const normalized = normalizeData(section, data);
      setValues(normalized);
      setOriginal(normalized);
      setMessage("Cài đặt đã được lưu thành công.");
      setError("");
      void client.invalidateQueries({ queryKey: ["admin-settings-overview"] });
    },
    onError: (reason) => {
      setMessage("");
      setError(apiError(reason));
    },
  });
  const fields = groupFields[section] ?? [];
  const editable =
    "editable" in data ? Boolean((data as GroupSettings).editable) : true;
  return (
    <section className="surface-card p-5 sm:p-6">
      {section === "ai" && (
        <AiStatus
          data={data as AiSettings}
          onTest={async () => {
            try {
              const result = await adminSettingService.testAi();
              setMessage(result.message);
              setError("");
            } catch (reason) {
              setError(apiError(reason));
            }
          }}
        />
      )}
      {section === "properties" && (
        <div className="mb-6 grid gap-3 rounded-xl bg-muted p-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Mã khu trọ:</span>{" "}
            <strong>{(data as PropertySettings).propertyCode}</strong>
          </p>
          <p>
            <span className="text-muted-foreground">Địa chỉ:</span>{" "}
            <strong>{(data as PropertySettings).address}</strong>
          </p>
        </div>
      )}
      <SettingsForm
        fields={fields}
        values={values}
        onChange={(key, value) => {
          setValues((current) => ({ ...current, [key]: value }));
          setMessage("");
        }}
        onSave={() => mutation.mutate()}
        onReset={() => {
          setValues(original);
          setMessage("");
          setError("");
        }}
        dirty={dirty}
        saving={mutation.isPending}
        editable={editable}
        message={message}
        error={error}
      />
    </section>
  );
}

function OverviewPanel({ data }: { data: SettingOverview }) {
  const metrics = [
    ["Hệ thống", data.systemName, Sparkles, "bg-accent text-link"],
    ["Múi giờ", data.timezone, Clock3, "bg-cyan-50 text-cyan-700"],
    [
      "Bảo mật",
      data.security.passwordPolicyConfigured
        ? "Đã cấu hình"
        : "Chưa hoàn thiện",
      ShieldCheck,
      "bg-success-muted text-success",
    ],
    [
      "Khu trọ",
      `${data.properties.length} cơ sở`,
      KeyRound,
      "bg-violet-50 text-violet-700",
    ],
  ] as const;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon, tone]) => (
          <article key={label} className="surface-card p-5 sm:p-6 ">
            <span
              className={`grid size-10 place-items-center rounded-xl ${tone}`}
            >
              <Icon className="size-5" />
            </span>
            <p className="mt-4 text-xs font-medium text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 truncate text-lg font-extrabold text-foreground">
              {value}
            </p>
          </article>
        ))}
      </section>
      <IntegrationCenter compact />
    </div>
  );
}

function AuditPanel() {
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(0);
  const query = useScopedQuery({
    queryKey: ["setting-audit", group, page],
    queryFn: ({ signal }) =>
      adminSettingService.auditLogs(
        { group: group || undefined, page, size: 20 },
        signal,
      ),
  });
  if (query.isLoading) return <SectionSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data as AuditPage;
  return (
    <section className="overflow-hidden surface-card ">
      <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-bold text-foreground">Nhật ký thay đổi</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Không lưu mật khẩu, token hoặc API key.
          </p>
        </div>
        <select
          value={group}
          onChange={(event) => {
            setGroup(event.target.value);
            setPage(0);
          }}
          className="min-h-10 rounded-xl border border-input px-3 text-sm"
        >
          <option value="">Tất cả nhóm</option>
          {settingNavigation
            .filter(
              (item) =>
                item.section !== "overview" && item.section !== "audit-logs",
            )
            .map((item) => (
              <option key={item.section} value={item.section}>
                {item.label}
              </option>
            ))}
        </select>
      </div>
      {data.content.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          Chưa có thay đổi cấu hình nào được ghi nhận.
        </div>
      ) : (
        <div className="divide-y divide-divider">
          {data.content.map((log) => (
            <article key={log.id} className="flex gap-3 p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-link">
                <FileClock className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {log.userName} đã cập nhật {log.settingGroup}
                  </p>
                  <time className="text-xs text-muted-foreground">
                    {formatDate(log.createdAt, true)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Phạm vi: {log.scopeType}
                  {log.scopeId ? ` #${log.scopeId}` : ""} ·{" "}
                  {log.result === "SUCCESS" ? "Thành công" : "Thất bại"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border p-4 text-sm">
        <span>
          Trang {data.page + 1}/{Math.max(data.totalPages, 1)}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Trước
          </button>
          <button
            disabled={page >= data.totalPages - 1}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>
    </section>
  );
}

function AiStatus({ data, onTest }: { data: AiSettings; onTest: () => void }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-3 rounded-xl border border-accent-border bg-accent p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary hover:bg-primary-hover text-white">
          <Bot className="size-5" />
        </span>
        <div>
          <p className="text-sm font-bold text-blue-950">
            API key:{" "}
            {data.configured ? "Đã cấu hình trên máy chủ" : "Chưa cấu hình"}
          </p>
          <p className="text-xs text-link">
            Secret không được tải xuống trình duyệt.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onTest}
        className="min-h-10 rounded-xl border border-accent-border bg-card px-4 text-sm font-semibold text-link hover:bg-accent"
      >
        Kiểm tra cấu hình
      </button>
    </div>
  );
}
function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4 surface-card p-6">
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
function normalizeData(
  section: SettingSection,
  data: SettingData,
): Record<string, unknown> {
  if ("values" in data) return { ...data.values };
  const result = { ...(data as unknown as Record<string, unknown>) };
  if (section === "billing") {
    const billing = data as BillingSettings;
    result.reminderDaysBeforeDue = billing.reminderDaysBeforeDue.join(", ");
    result.reminderDaysAfterDue = billing.reminderDaysAfterDue.join(", ");
  }
  if (section === "ai") {
    const ai = data as AiSettings;
    Object.assign(result, ai.features);
    delete result.features;
  }
  return result;
}
function preparePayload(
  section: SettingSection,
  values: Record<string, unknown>,
) {
  const numericFields = (groupFields[section] ?? [])
    .filter((field) => field.type === "number")
    .map((field) => field.key);
  const payload = parseNumericFields<Record<string, unknown>>(
    values,
    numericFields,
    numericFields,
  );
  if (section === "general") delete payload.logoUrl;
  if (section === "properties")
    ["propertyId", "propertyCode", "address"].forEach(
      (key) => delete payload[key],
    );
  if (section === "billing") {
    payload.reminderDaysBeforeDue = parseDays(payload.reminderDaysBeforeDue);
    payload.reminderDaysAfterDue = parseDays(payload.reminderDaysAfterDue);
  }
  if (section === "ai") {
    payload.apiKey = "";
    payload.features = {
      tenantChatbot: payload.tenantChatbot,
      invoiceExplanation: payload.invoiceExplanation,
      contractExplanation: payload.contractExplanation,
      maintenanceClassification: payload.maintenanceClassification,
      utilityAnomalyDetection: payload.utilityAnomalyDetection,
    };
    [
      "tenantChatbot",
      "invoiceExplanation",
      "contractExplanation",
      "maintenanceClassification",
      "utilityAnomalyDetection",
      "configured",
      "connectionStatus",
    ].forEach((key) => delete payload[key]);
  }
  return payload;
}
function parseDays(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0);
}

function apiError(reason: unknown) {
  const error = reason as AxiosError<{ message?: string }>;
  return (
    error.response?.data?.message || "Không thể lưu cài đặt. Vui lòng thử lại."
  );
}

function ConfigurationSources({ section }: { section: SettingSection }) {
  const links: [string, string][] = [
    ["/admin/organizations", "Công ty & khu quản lý"],
    ["/admin/properties", "Thông tin nhà trọ"],
    ["/admin/invoices", "Hóa đơn & chính sách thanh toán"],
    ["/admin/reports/utilities", "Điện nước & cảnh báo"],
    ["/admin/properties", "Danh mục dịch vụ tại nhà trọ"],
    ["/admin/accounts", "Nhân viên & quyền truy cập"],
  ];
  return (
    <aside className="mb-5 rounded-2xl border border-accent-border bg-accent p-4 text-sm">
      <p className="font-semibold text-blue-950">Phạm vi và nguồn cấu hình</p>
      <p className="mt-2 leading-6 text-link">
        {section === "properties"
          ? "Quy tắc áp dụng riêng nhà trọ đang chọn. Biên bản và hóa đơn đã chốt giữ dữ liệu snapshot."
          : "Cấu hình chung hiện thuộc tài khoản chủ nhà; hồ sơ công ty được quản lý riêng tại Công ty & khu quản lý. Cấu hình này không tự ghi đè hợp đồng hoặc hóa đơn đã phát hành."}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {links.map(([href, label]) => (
          <Link
            key={`${href}-${label}`}
            href={href}
            className="text-link underline"
          >
            {label}
          </Link>
        ))}
      </div>
      {["notifications", "integrations"].includes(section) && (
        <p className="mt-3 text-link">
          Bật kênh chỉ lưu tùy chọn. Email/SMS/Zalo cần bộ gửi được cấu hình và
          xác nhận; lưu cấu hình không đồng nghĩa đã gửi thông báo.
        </p>
      )}
    </aside>
  );
}
