"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MessageCircle,
  BellRing,
  CreditCard,
  Bot,
  RefreshCw,
  Settings2,
  ScrollText,
} from "lucide-react";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";

type Kind = "EMAIL" | "ZALO" | "WEB_PUSH" | "PAYMENT" | "AI";
type Configuration = {
  kind: Kind;
  provider: string;
  environment: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  status: string;
  version: number;
  secretsConfigured: Record<string, boolean>;
  secretStoreWritable: boolean;
  lastCheckedAt?: string;
  resultCode?: string;
  capabilities?: Record<string, unknown>;
};
type Operation = {
  status: string;
  resultCode: string;
  providerReference?: string;
  capabilities?: Record<string, unknown>;
};
type Template = { template_id: string; name: string; status: string };
const definitions = [
  {
    kind: "EMAIL" as const,
    name: "Email",
    description: "SMTP cho hợp đồng, hóa đơn và nhắc việc.",
    icon: Mail,
  },
  {
    kind: "ZALO" as const,
    name: "Zalo OA / ZBS Template Message",
    description: "Gửi qua OA và template được Zalo phê duyệt.",
    icon: MessageCircle,
  },
  {
    kind: "WEB_PUSH" as const,
    name: "Web Push",
    description: "Thông báo trình duyệt khi người dùng chủ động đăng ký.",
    icon: BellRing,
  },
  {
    kind: "PAYMENT" as const,
    name: "Thanh toán",
    description: "Tiền mặt, ngân hàng, VNPay và MoMo theo từng môi trường.",
    icon: CreditCard,
  },
  {
    kind: "AI" as const,
    name: "Trí tuệ nhân tạo",
    description: "Kiểm tra provider/model; phân biệt mô hình với quy tắc.",
    icon: Bot,
  },
];
const labels: Record<string, string> = {
  NOT_CONFIGURED: "Chưa cấu hình",
  CONFIGURED: "Đã cấu hình, chưa xác minh đầy đủ",
  TESTING: "Đang kiểm tra",
  CONNECTED: "Kết nối đã xác minh",
  DEGRADED: "Chưa đủ điều kiện hoạt động",
  ERROR: "Lỗi kết nối",
  DISABLED: "Đã tắt",
  SENT: "Provider đã tiếp nhận",
  UNKNOWN: "Chưa xác định kết quả",
  SIMULATED: "Mô phỏng, chưa gửi thật",
};
const providers: Record<Kind, string[]> = {
  EMAIL: ["SMTP"],
  ZALO: ["ZBS"],
  WEB_PUSH: ["VAPID"],
  PAYMENT: ["MANUAL", "VNPAY", "MOMO"],
  AI: ["RULE_BASED", "OPENAI", "GEMINI"],
};
const fields: Record<Kind, [string, string, string?][]> = {
  EMAIL: [
    ["host", "SMTP Host"],
    ["port", "SMTP Port", "number"],
    ["username", "Username"],
    ["fromEmail", "From Email", "email"],
    ["fromName", "From Name"],
    ["tlsMode", "TLS/SSL: NONE, STARTTLS hoặc SSL"],
    ["authentication", "Xác thực SMTP", "checkbox"],
  ],
  ZALO: [
    ["oaId", "OA ID"],
    ["oaName", "Tên OA"],
    ["appId", "App ID"],
    ["redirectUri", "OAuth Redirect URI", "url"],
  ],
  WEB_PUSH: [
    ["publicKey", "VAPID Public Key"],
    ["subject", "VAPID Subject (mailto: hoặc https://)"],
  ],
  PAYMENT: [
    ["cashEnabled", "Bật tiền mặt", "checkbox"],
    ["bankTransferEnabled", "Bật chuyển khoản thủ công", "checkbox"],
    ["bankName", "Ngân hàng"],
    ["bankBin", "Mã BIN ngân hàng VietQR"],
    ["qrEnabled", "Hiển thị VietQR", "checkbox"],
    ["accountName", "Chủ tài khoản"],
    ["accountNumber", "Số tài khoản"],
    ["transferContent", "Nội dung chuyển khoản"],
    ["vnpayEnabled", "Bật VNPay", "checkbox"],
    ["tmnCode", "VNPay TMN Code"],
    ["vnpayReturnUrl", "VNPay Return URL", "url"],
    ["vnpayIpnUrl", "VNPay IPN URL", "url"],
    ["momoEnabled", "Bật MoMo", "checkbox"],
    ["partnerCode", "MoMo Partner Code"],
    ["momoRedirectUrl", "MoMo Redirect URL", "url"],
    ["momoIpnUrl", "MoMo IPN URL", "url"],
  ],
  AI: [
    ["model", "Model"],
    ["faqEnabled", "FAQ / trợ lý nội dung", "checkbox"],
    ["messageSuggestionsEnabled", "Gợi ý thông báo", "checkbox"],
    ["anomalyEnabled", "Bất thường điện nước (quy tắc hiện có)", "checkbox"],
    ["forecastEnabled", "Dự báo (quy tắc hiện có)", "checkbox"],
    ["monthlyLimit", "Giới hạn yêu cầu/tháng", "number"],
  ],
};
const events = [
  "INVOICE_ISSUED",
  "INVOICE_BEFORE_DUE",
  "INVOICE_OVERDUE",
  "PAYMENT_CONFIRMED",
  "CONTRACT_EXPIRY",
  "CHECKIN",
  "CHECKOUT",
  "MAINTENANCE_CREATED",
  "DEPOSIT_REFUNDED",
];
const control =
  "min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const base = "/owner/integrations";
async function get<T>(path: string) {
  return (await apiClient.get<ApiEnvelope<T>>(base + path)).data.data;
}
export function IntegrationCenter({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [selected, setSelected] = useState<Kind>();
  const [history, setHistory] = useState<Kind>();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["integration-center", user?.id],
    queryFn: () => get<Configuration[]>(""),
    enabled: user?.activeRole === "OWNER",
  });
  const logs = useQuery({
    queryKey: ["integration-history", user?.id, history],
    queryFn: () => get<Record<string, unknown>[]>(`/${history}/history`),
    enabled: !!history,
  });
  async function operate(kind: Kind, operation: string, payload: unknown = {}) {
    setBusy(kind);
    setError("");
    setMessage("");
    try {
      const { data } = await apiClient.post<ApiEnvelope<Operation>>(
        `${base}/${kind}/${operation}`,
        payload,
        { timeout: 95000, headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      setMessage(
        `${labels[data.data.status] || data.data.status} · ${data.data.resultCode}`,
      );
      await client.invalidateQueries({ queryKey: ["integration-center"] });
      await client.invalidateQueries({ queryKey: ["integration-history"] });
      return data.data;
    } catch (failure) {
      setError(apiErrorMessage(failure));
    } finally {
      setBusy("");
    }
  }
  if (user?.activeRole !== "OWNER")
    return (
      <section className="surface-card p-6 text-muted-foreground">
        Cấu hình tích hợp thuộc phạm vi chủ nhà. Liên hệ chủ nhà để kiểm tra nhà
        cung cấp.
      </section>
    );
  return (
    <section aria-label="Trung tâm tích hợp" className="space-y-5">
      <div className="surface-card p-5">
        <h2 className="text-xl font-bold">Trung tâm tích hợp</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cấu hình dùng chung cho các nhà trọ của chủ nhà hiện tại. Lưu cấu hình
          chưa có nghĩa là kết nối thành công.
        </p>
        <a
          href="/integration-guide.html"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-link underline"
        >
          Hướng dẫn SMTP, Zalo, Web Push, thanh toán và AI
        </a>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger-border bg-danger-muted p-4 text-danger"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-border bg-muted p-4 text-foreground"
        >
          {message}
        </p>
      )}
      {query.isPending && <p role="status">Đang tải cấu hình tích hợp…</p>}
      {query.isError && (
        <div role="alert" className="surface-card p-5">
          {apiErrorMessage(query.error)}
          <Button onClick={() => void query.refetch()}>Thử lại</Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {definitions.map((definition) => {
          const config = query.data?.find(
            (item) => item.kind === definition.kind,
          );
          const Icon = definition.icon;
          return (
            <article
              key={definition.kind}
              className="surface-card flex flex-col gap-3 p-5"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-accent p-3 text-link">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-bold">{definition.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {definition.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-border bg-muted px-3 py-1">
                  {config?.provider ?? "—"}
                </span>
                <span className="rounded-full border border-border bg-muted px-3 py-1">
                  {config?.environment ?? "—"}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${config?.status === "CONNECTED" ? "bg-success-muted text-success" : config?.status === "ERROR" ? "bg-danger-muted text-danger" : "bg-muted text-secondary-foreground"}`}
                >
                  {config ? labels[config.status] || config.status : "Đang tải"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Kiểm tra gần nhất:{" "}
                {config?.lastCheckedAt
                  ? new Date(config.lastCheckedAt).toLocaleString("vi-VN")
                  : "Chưa kiểm tra"}
              </p>
              {config?.resultCode && (
                <p className="break-words text-xs text-muted-foreground">
                  {config.resultCode}
                </p>
              )}
              {config?.capabilities && (
                <dl className="space-y-1 rounded-xl bg-muted p-3 text-xs">
                  {Object.entries(config.capabilities).map(([key, value]) => (
                    <div className="flex justify-between gap-3" key={key}>
                      <dt>{key}</dt>
                      <dd className="break-all">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!config}
                  onClick={() => {
                    setSelected(definition.kind);
                    setHistory(undefined);
                  }}
                >
                  <Settings2 className="size-4" />
                  Cấu hình
                </Button>
                <Button
                  variant="outline"
                  disabled={!config || !!busy}
                  onClick={() => void operate(definition.kind, "CHECK")}
                >
                  <RefreshCw className="size-4" />
                  {busy === definition.kind
                    ? "Đang kiểm tra…"
                    : "Kiểm tra kết nối"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={!config}
                  onClick={() =>
                    setHistory(
                      history === definition.kind ? undefined : definition.kind,
                    )
                  }
                >
                  <ScrollText className="size-4" />
                  Nhật ký
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {selected && query.data?.find((item) => item.kind === selected) && (
        <IntegrationForm
          key={`${selected}-${query.data.find((item) => item.kind === selected)!.version}`}
          config={query.data.find((item) => item.kind === selected)!}
          close={() => setSelected(undefined)}
          operate={operate}
          busy={!!busy}
        />
      )}
      {history && (
        <div className="surface-card overflow-hidden p-5">
          <h3 className="font-bold">Nhật ký {history}</h3>
          <p className="my-2 text-xs text-muted-foreground">
            Không hiển thị credential, nội dung tài liệu hoặc phản hồi provider
            thô.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Thao tác</th>
                  <th>Trạng thái</th>
                  <th>Mã kết quả</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {logs.data?.map((row) => (
                  <tr key={String(row.id)} className="border-t border-border">
                    <td className="p-2">{String(row.operation)}</td>
                    <td>{String(row.status)}</td>
                    <td>{String(row.result_code)}</td>
                    <td>{String(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.data?.length === 0 && <p>Chưa có hoạt động tích hợp.</p>}
          </div>
        </div>
      )}
      {!compact && <AiSuggestions />}
      {!compact && (
        <p className="text-xs text-muted-foreground">
          SMTP/provider tiếp nhận chưa phải là phát đến người nhận. Tiền mặt và
          chuyển khoản thủ công cần kế toán xác minh. Rule-based không phải mô
          hình AI.
        </p>
      )}
    </section>
  );
}
function AiSuggestions() {
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [purpose, setPurpose] = useState("FAQ");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true);
    setResult("");
    try {
      const response = await apiClient.post<
        ApiEnvelope<{ content: string; resultCode?: string; mode: string }>
      >(
        `${base}/AI/suggest`,
        { text, consent, purpose },
        { timeout: 25000, headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      const value = response.data.data;
      setResult(`${value.mode} · ${value.resultCode || ""}\n${value.content}`);
    } catch (error) {
      setResult(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="surface-card space-y-4 p-6">
      <h3 className="text-lg font-bold">Thử gợi ý nội dung</h3>
      <p className="text-sm text-muted-foreground">
        Bật tính năng trong cấu hình AI trước khi dùng. Chỉ nhập nội dung chung;
        không nhập CCCD, số điện thoại, email hoặc hồ sơ người thuê. Kết quả cần
        được kiểm tra trước khi sử dụng.
      </p>
      <label className="block text-sm">
        Mục đích
        <select
          className="ml-3 rounded-lg border border-border bg-background p-2"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        >
          <option value="FAQ">Giải đáp thường gặp</option>
          <option value="MESSAGE">Gợi ý thông báo</option>
        </select>
      </label>
      <textarea
        aria-label="Nội dung yêu cầu AI"
        maxLength={1200}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-h-28 w-full rounded-xl border border-border bg-background p-3"
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        Tôi xác nhận nội dung không chứa dữ liệu cá nhân và đồng ý gửi nội dung
        này đến provider đã cấu hình.
      </label>
      <Button disabled={busy || !consent || !text.trim()} onClick={generate}>
        {busy ? "Đang xử lý…" : "Tạo gợi ý"}
      </Button>
      {result && (
        <p
          role="status"
          className="whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm"
        >
          {result}
        </p>
      )}
    </div>
  );
}
function IntegrationForm({
  config,
  close,
  operate,
  busy,
}: {
  config: Configuration;
  close: () => void;
  operate: (
    kind: Kind,
    action: string,
    payload?: unknown,
  ) => Promise<Operation | undefined>;
  busy: boolean;
}) {
  const client = useQueryClient();
  const [provider, setProvider] = useState(config.provider);
  const [environment, setEnvironment] = useState(config.environment);
  const [enabled, setEnabled] = useState(config.enabled);
  const [values, setValues] = useState<Record<string, unknown>>({
    ...(config.kind === "EMAIL"
      ? { port: 587, tlsMode: "STARTTLS", authentication: true }
      : {}),
    ...config.settings,
  });
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [recipient, setRecipient] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [parameters, setParameters] = useState("{}");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [oauthUrl, setOauthUrl] = useState("");
  const [businessParameters, setBusinessParameters] = useState(
    JSON.stringify(config.settings.templateParameters || {}, null, 2),
  );
  const templates = useQuery({
    queryKey: ["integration-templates"],
    queryFn: () => get<Template[]>("/ZALO/templates"),
    enabled: config.kind === "ZALO",
  });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiClient.put(`${base}/${config.kind}`, {
        provider,
        environment,
        enabled,
        settings: {
          ...values,
          ...(config.kind === "ZALO"
            ? { templateParameters: JSON.parse(businessParameters) }
            : {}),
        },
        secrets,
        version: config.version,
      });
      setSecrets({});
      await client.invalidateQueries({ queryKey: ["integration-center"] });
    } catch (failure) {
      setError(apiErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="flex justify-between gap-4">
        <h3 className="text-lg font-bold">
          Cấu hình {definitions.find((item) => item.kind === config.kind)?.name}
        </h3>
        <Button variant="ghost" onClick={close}>
          Đóng
        </Button>
      </div>
      <form onSubmit={save} className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">
            Provider
            <select
              className={control}
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            >
              {providers[config.kind].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold">
            Môi trường
            <select
              className={control}
              value={environment}
              onChange={(event) => setEnvironment(event.target.value)}
            >
              {["DEV", "TEST", "PRODUCTION"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Bật tích hợp
          </label>
          {fields[config.kind].map(([name, label, type]) => (
            <label
              key={name}
              className={
                type === "checkbox"
                  ? "flex items-center gap-2 text-sm"
                  : "space-y-1 text-sm font-semibold"
              }
            >
              {type === "checkbox" ? (
                <>
                  <input
                    type="checkbox"
                    checked={Boolean(values[name])}
                    onChange={(event) =>
                      setValues({ ...values, [name]: event.target.checked })
                    }
                  />
                  {label}
                </>
              ) : (
                <>
                  {label}
                  <input
                    className={control}
                    type={type || "text"}
                    value={String(values[name] ?? "")}
                    onChange={(event) =>
                      setValues({
                        ...values,
                        [name]:
                          type === "number"
                            ? Number(event.target.value)
                            : event.target.value,
                      })
                    }
                  />
                </>
              )}
            </label>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-muted p-4">
          <p className="text-sm font-semibold">Bí mật chỉ lưu phía máy chủ</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Để trống để giữ credential hiện tại. API đọc chỉ trả trạng thái.{" "}
            {config.secretStoreWritable
              ? "Kho mã hóa AES-GCM đã sẵn sàng."
              : "Chưa có INTEGRATION_MASTER_KEY; sử dụng biến môi trường theo hướng dẫn."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(config.secretsConfigured).map(([name, present]) => (
              <label key={name} className="space-y-1 text-xs font-semibold">
                {name} · {present ? "Đã cấu hình" : "Chưa cấu hình"}
                <input
                  className={control}
                  type="password"
                  autoComplete="new-password"
                  value={secrets[name] || ""}
                  disabled={
                    config.kind === "PAYMENT" || !config.secretStoreWritable
                  }
                  placeholder={
                    present
                      ? "Giữ credential hiện tại"
                      : "Nhập khi kho mã hóa sẵn sàng"
                  }
                  onChange={(event) =>
                    setSecrets({ ...secrets, [name]: event.target.value })
                  }
                />
              </label>
            ))}
            {config.kind === "PAYMENT" && (
              <p className="text-sm text-muted-foreground">
                Khóa VNPAY/MoMo chỉ được đọc từ biến môi trường máy chủ theo ID
                chủ nhà. Không nhập hoặc lưu khóa thanh toán qua biểu mẫu này.
              </p>
            )}
          </div>
        </div>
        {config.kind === "ZALO" && (
          <div className="space-y-3">
            <p className="text-sm font-bold">
              Ánh xạ sự kiện → template đã đồng bộ/phê duyệt
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {events.map((event) => (
                <label key={event} className="text-xs font-semibold">
                  {event}
                  <select
                    className={control}
                    value={String(
                      (
                        values.templateMappings as
                          Record<string, string> | undefined
                      )?.[event] || "",
                    )}
                    onChange={(change) =>
                      setValues({
                        ...values,
                        templateMappings: {
                          ...((values.templateMappings as object) || {}),
                          [event]: change.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Chưa ánh xạ</option>
                    {templates.data
                      ?.filter((item) => item.status === "ENABLE")
                      .map((item) => (
                        <option key={item.template_id} value={item.template_id}>
                          {item.name} · {item.template_id}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="block text-sm">
              Ánh xạ tên tham số template (JSON theo sự kiện; giá trị:
              invoice_code, room_code, billing_period, due_date,
              remaining_amount)
              <textarea
                className={control}
                value={businessParameters}
                onChange={(event) => setBusinessParameters(event.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Không tự nhập template ID giả hoặc tự đánh dấu phê duyệt. Đồng bộ
              template sau khi xác thực OA.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu cấu hình"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void operate(config.kind, "CHECK")}
          >
            Kiểm tra bản đã lưu
          </Button>
          {config.kind === "ZALO" && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  await operate("ZALO", "SYNC_TEMPLATES");
                  await templates.refetch();
                }}
              >
                Đồng bộ template
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void operate("ZALO", "REFRESH_TOKEN")}
              >
                Làm mới token
              </Button>
            </>
          )}
        </div>
      </form>
      {config.kind === "ZALO" && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const { data } = await apiClient.post<
                  ApiEnvelope<{ url: string }>
                >(base + "/ZALO/oauth");
                setOauthUrl(data.data.url);
              } catch (failure) {
                setError(apiErrorMessage(failure));
              }
            }}
          >
            Kết nối OA bằng OAuth
          </Button>
          {oauthUrl && (
            <a
              className="ml-3 font-semibold text-link underline"
              target="_blank"
              rel="noreferrer"
              href={oauthUrl}
            >
              Mở Zalo và cấp quyền
            </a>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              if (
                !window.confirm(
                  "Ngắt Zalo trên hệ thống? Lịch sử gửi được giữ lại. Thu hồi quyền provider trên trang Zalo riêng.",
                )
              )
                return;
              try {
                await apiClient.delete(base + "/ZALO/connection");
                await client.invalidateQueries({
                  queryKey: ["integration-center"],
                });
              } catch (failure) {
                setError(apiErrorMessage(failure));
              }
            }}
          >
            Ngắt kết nối
          </Button>
        </div>
      )}
      {config.kind === "WEB_PUSH" && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Tạo khóa trên máy chủ không trả private key. Đăng ký trình duyệt tại
            menu chuông rồi gửi thử cho chính bạn.
          </p>
          <Button
            variant="outline"
            disabled={!config.secretStoreWritable}
            onClick={async () => {
              if (
                config.settings.publicKey &&
                !window.confirm(
                  "Tạo khóa VAPID mới sẽ cần đăng ký lại các trình duyệt. Tiếp tục?",
                )
              )
                return;
              try {
                await apiClient.post(base + "/WEB_PUSH/keys");
                await client.invalidateQueries({
                  queryKey: ["integration-center"],
                });
              } catch (failure) {
                setError(apiErrorMessage(failure));
              }
            }}
          >
            Tạo cặp khóa VAPID
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void operate("WEB_PUSH", "TEST_SEND")}
          >
            Gửi Push thử cho chính tôi
          </Button>
        </div>
      )}
      {["EMAIL", "ZALO"].includes(config.kind) && (
        <div className="mt-6 space-y-3 border-t border-border pt-5">
          <h4 className="font-bold">Gửi thử có kiểm soát</h4>
          <p className="text-xs text-muted-foreground">
            Người nhận phải thuộc allowlist do máy chủ cho phép. Dùng cấu hình
            đã lưu; gửi thử không thay đổi hợp đồng hoặc công nợ.
          </p>
          <label className="block text-sm">
            {config.kind === "EMAIL"
              ? "Email được phép nhận thử"
              : "Zalo UID được phép nhận thử"}
            <input
              className={control}
              value={recipient}
              type={config.kind === "EMAIL" ? "email" : "text"}
              onChange={(event) => setRecipient(event.target.value)}
            />
          </label>
          {config.kind === "ZALO" && (
            <>
              <label className="block text-sm">
                Template
                <select
                  className={control}
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                >
                  <option value="">Chọn template phê duyệt</option>
                  {templates.data
                    ?.filter((item) => item.status === "ENABLE")
                    .map((item) => (
                      <option key={item.template_id} value={item.template_id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                Tham số mẫu (JSON, không chứa tài liệu định danh)
                <textarea
                  className={control}
                  value={parameters}
                  onChange={(event) => setParameters(event.target.value)}
                />
              </label>
            </>
          )}
          <Button
            disabled={busy || !recipient}
            onClick={() => {
              try {
                const parsed = JSON.parse(parameters) as Record<string, string>;
                void operate(config.kind, "TEST_SEND", {
                  recipient,
                  templateId,
                  parameters: parsed,
                });
              } catch {
                setError("Tham số template phải là JSON hợp lệ.");
              }
            }}
          >
            Gửi thử
          </Button>
        </div>
      )}
    </div>
  );
}
