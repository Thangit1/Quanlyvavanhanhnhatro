"use client";
import Link from "next/link";
import { NumberInput } from "@/components/ui/number-input";
import { useRef, Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useManagementScope } from "@/providers/management-scope";
import { useOptionalAccountantScope } from "@/components/accountant/accountant-scope";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  Send,
  Clock,
  FileText,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useScopedQuery } from "@/hooks/use-scoped-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { apiErrorMessage } from "@/lib/api-error";
import {
  PageHeader,
  PageToolbar,
  SummaryCard,
  Pagination,
  LoadingSkeleton,
} from "./management-ui";
import { ErrorState } from "./dashboard-ui";
import {
  AccountModal,
  AccountField,
} from "@/components/admin/accounts/account-ui";
import { AdminShell } from "@/components/admin/admin-shell";
import type { CommunicationRow as Row } from "./communication-bell";
type Options = {
  permissions?: { propertyId: number; canManage: boolean; canSend: boolean }[];
  properties: {
    id: number;
    name: string;
    organizationId?: number;
    organizationName?: string;
  }[];
  channels: { code: string; available: boolean; status: string }[];
  events: string[];
  canManage: boolean;
  canSend: boolean;
};
type Message = {
  propertyId: number;
  title: string;
  body: string;
  category: string;
  audience: string;
  recipientIds: number[];
  roomIds: number[];
  channels: string[];
  scheduledAt: string;
  templateId?: number;
};
type Preview = {
  recipients: Row[];
  rendered?: { recipientId: number; title: string; body: string }[];
  recipientCount: number;
  deliveryCount: number;
  previewHash: string;
};
type Page = {
  rows: Row[];
  totalElements: number;
  totalPages: number;
  unreadCount?: number;
  campaigns?: Row[];
  summary?: Row[];
  dueTasks?: number;
  overdueTasks?: number;
};
const input =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-sm";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-40";
const primary =
  button + " bg-primary hover:bg-primary-hover! text-white border-blue-600!";
const statusNames: Record<string, string> = {
  DRAFT: "Bản nháp",
  SCHEDULED: "Đã lên lịch",
  QUEUED: "Đang chờ xử lý",
  SENDING: "Đang gửi",
  SENT: "Nhà cung cấp đã tiếp nhận",
  DELIVERED: "Đã khả dụng / xác nhận phát",
  FAILED: "Gửi thất bại",
  CANCELLED: "Đã hủy",
  UNKNOWN: "Chưa rõ kết quả — cần đối soát",
  SIMULATED: "Mô phỏng — không phát thật",
  OPEN: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thực hiện",
  COMPLETED: "Đã hoàn thành",
  SOURCE: "Theo hồ sơ nguồn",
};
const eventNames: Record<string, string> = {
  INVOICE_ISSUED: "Phát hành hóa đơn",
  PAYMENT_OPEN: "Mở cửa sổ thanh toán",
  INVOICE_BEFORE_DUE: "Trước hạn thanh toán",
  INVOICE_DUE: "Ngày đến hạn",
  INVOICE_OVERDUE: "Quá hạn thanh toán",
  PAYMENT_CONFIRMED: "Thanh toán đã xác nhận",
  PAYMENT_FAILED: "Giao dịch thanh toán chưa thành công",
  CONTRACT_EXPIRY: "Hợp đồng sắp hết hạn",
  CHECKIN: "Chuẩn bị nhận phòng",
  CHECKOUT: "Lịch kiểm kê/trả phòng",
  MAINTENANCE_CREATED: "Tiếp nhận bảo trì",
  MAINTENANCE_ASSIGNED: "Phân công bảo trì",
  MAINTENANCE_DUE: "Hạn bảo trì",
  MAINTENANCE_URGENT: "Khẩn cấp chưa tiếp nhận",
  MAINTENANCE_COMPLETED: "Bảo trì báo hoàn thành",
  DEPOSIT_REFUNDED: "Đã thực chi hoàn cọc",
};
const categories: Record<string, string> = {
  ANNOUNCEMENT: "Thông báo chung",
  INVOICE: "Hóa đơn",
  PAYMENT: "Thanh toán",
  CONTRACT: "Hợp đồng",
  MAINTENANCE: "Bảo trì",
  CHECKOUT: "Nhận / trả phòng",
  TASK: "Công việc",
  SYSTEM: "Hệ thống",
  UTILITY: "Điện nước",
  EMERGENCY: "Khẩn cấp",
};
const localNow = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T")
    .slice(0, 16);
const dateText = (v: Row[string] | undefined) =>
  v ? String(v).replace("T", " ").slice(0, 19) : "—";
function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return new FormData(e.currentTarget);
}
export function AdminCommunicationPage() {
  return (
    <AdminShell
      title="Thông báo & Công việc"
      subtitle="Hộp thư, lịch vận hành và nhắc việc có kiểm soát"
    >
      <CommunicationWorkspace />
    </AdminShell>
  );
}
export function CommunicationWorkspace({
  initialTab = "inbox",
}: {
  initialTab?: string;
}) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CommunicationBody initialTab={initialTab} />
    </Suspense>
  );
}
function CommunicationBody({ initialTab }: { initialTab: string }) {
  const searchParams = useSearchParams();
  const managementScope = useManagementScope();
  const accountantScope = useOptionalAccountantScope();
  const [localProperty, setLocalProperty] = useState(0);
  const { user } = useAuth(),
    qc = useQueryClient();
  const accountant = user?.activeRole === "ACCOUNTANT",
    staff = ["OWNER", "MANAGER"].includes(user?.activeRole ?? "");
  const property = staff
    ? (managementScope.propertyId ?? 0)
    : accountantScope
      ? (accountantScope.propertyId ?? 0)
      : localProperty;
  const setProperty = (id: number) => {
    if (staff) managementScope.setPropertyId(id || undefined);
    else if (accountantScope) accountantScope.setPropertyId(id || undefined);
    else setLocalProperty(id);
  };
  const [tab, setTab] = useState(
      searchParams.get("tab") === "calendar" ? "calendar" : initialTab,
    ),
    [company, setCompany] = useState(0),
    [page, setPage] = useState(0),
    [category, setCategory] = useState(""),
    [state, setState] = useState(""),
    [channel, setChannel] = useState(""),
    [keyword, setKeyword] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [mode, setMode] = useState("list"),
    [date, setDate] = useState(localNow().slice(0, 10));
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Row | null>(null),
    [attempts, setAttempts] = useState<Row[] | null>(null),
    [edit, setEdit] = useState<{ kind: string; row?: Row } | null>(null),
    [preview, setPreview] = useState<{
      data: Preview;
      message: Message;
    } | null>(null),
    [chosen, setChosen] = useState<Row | null>(null);
  const [previousProperty, setPreviousProperty] = useState(property);
  const inflight = useRef(false),
    requestKey = useRef("");
  const options = useScopedQuery({
    queryKey: ["communications-options"],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Options>>("/communications/options", {
          signal,
        })
      ).data.data,
    refetchInterval: 60000,
  });
  const opt = options.data,
    permission = opt?.permissions?.find((p) => p.propertyId === property),
    canSend = opt?.canSend && (permission?.canSend ?? true),
    canManage = opt?.canManage && (permission?.canManage ?? true);
  if (previousProperty !== property) {
    setPreviousProperty(property);
    setPage(0);
    setPreview(null);
    setEdit(null);
    setDetail(null);
    setChosen(null);
    if (
      company &&
      opt?.properties.find((p) => p.id === property)?.organizationId !== company
    )
      setCompany(0);
  }
  const audience = useScopedQuery({
    queryKey: ["communications-audience", property],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<{ recipients: Row[]; rooms: Row[] }>>(
          "/communications/audience",
          { params: { propertyId: property }, signal },
        )
      ).data.data,
    enabled: !!property && !!canSend,
    refetchInterval: 60000,
  });
  const calendarRange = (() => {
    const d = new Date(date + "T12:00:00"),
      end = new Date(d);
    if (mode === "month") {
      d.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
    } else if (mode === "week") {
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      end.setTime(d.getTime());
      end.setDate(end.getDate() + 6);
    } else if (mode === "list") {
      end.setDate(end.getDate() + 30);
    }
    return {
      from: d.toLocaleDateString("sv-SE"),
      to: end.toLocaleDateString("sv-SE"),
    };
  })();
  const effectiveProperties =
    opt?.properties.filter((p) => !company || p.organizationId === company) ??
    [];
  const params = {
    propertyId: property || undefined,
    category: category || undefined,
    readStatus: state || undefined,
    status: state || undefined,
    channel: channel || undefined,
    from: from || undefined,
    to: to || undefined,
    keyword,
    page,
    size: 20,
  };
  const query = useScopedQuery({
    queryKey: ["communications-workspace", tab, params, calendarRange],
    queryFn: async ({ signal }) => {
      const path =
        tab === "calendar"
          ? "calendar"
          : tab === "history"
            ? "history"
            : "inbox";
      return (
        await apiClient.get<ApiEnvelope<Page>>("/communications/" + path, {
          params:
            tab === "calendar"
              ? { propertyId: property || undefined, ...calendarRange }
              : params,
          signal,
        })
      ).data.data;
    },
    enabled: ["inbox", "history", "calendar"].includes(tab),
    refetchInterval: 60000,
  });
  const templates = useScopedQuery({
    queryKey: ["communications-templates", property],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Row[]>>("/communications/templates", {
          params: { propertyId: property || undefined },
          signal,
        })
      ).data.data,
    enabled: !!canManage && (tab === "templates" || tab === "compose"),
    refetchInterval: 60000,
  });
  const rules = useScopedQuery({
    queryKey: ["communications-rules", property],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Row[]>>("/communications/rules", {
          params: { propertyId: property || undefined },
          signal,
        })
      ).data.data,
    enabled: !!canSend && tab === "rules",
    refetchInterval: 60000,
  });
  const prefs = useScopedQuery({
    queryKey: ["communications-preferences"],
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ApiEnvelope<Row>>("/communications/preferences", {
          signal,
        })
      ).data.data,
    enabled: tab === "channels",
    refetchInterval: 60000,
  });
  async function action(
    fn: () => Promise<unknown>,
    message: string,
    close = true,
  ) {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await qc.invalidateQueries();
      setNotice(message);
      if (close) {
        setEdit(null);
        setPreview(null);
        requestKey.current = "";
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  function changeTab(value: string) {
    setTab(value);
    setPage(0);
    setState("");
    setError("");
    setNotice("");
    setPreview(null);
  }
  function changeProperty(value: number) {
    setProperty(value);
    setPage(0);
    setPreview(null);
    setEdit(null);
    setDetail(null);
    setChosen(null);
    requestKey.current = "";
  }
  async function compose(e: FormEvent<HTMLFormElement>) {
    const f = values(e);
    const message: Message = {
      propertyId: property,
      title: String(f.get("title")),
      body: String(f.get("body")),
      category: String(f.get("category")),
      audience: String(f.get("audience")),
      recipientIds: f.getAll("recipients").map(Number),
      roomIds: f.getAll("rooms").map(Number),
      channels: f.getAll("channels").map(String),
      scheduledAt: String(f.get("scheduledAt")),
      ...(chosen ? { templateId: Number(chosen.id) } : {}),
    };
    await action(
      async () => {
        const result = (
          await apiClient.post<ApiEnvelope<Preview>>(
            "/communications/preview",
            message,
          )
        ).data.data;
        setPreview({ data: result, message });
        requestKey.current = crypto.randomUUID();
      },
      "Đã kiểm tra người nhận; chưa gửi.",
      false,
    );
  }
  async function submitMessage(draft: boolean) {
    if (!preview) return;
    await action(
      () =>
        apiClient.post("/communications/campaigns", {
          message: preview.message,
          previewHash: preview.data.previewHash,
          key: requestKey.current,
          draft,
        }),
      draft
        ? "Đã lưu bản nháp."
        : "Đã tạo yêu cầu gửi. Xem kết quả từng người và kênh trong lịch sử.",
    );
  }
  async function saveEditor(e: FormEvent<HTMLFormElement>) {
    const f = values(e),
      v = (name: string) => String(f.get(name) ?? ""),
      r = edit?.row;
    let payload: Record<string, unknown>, path: string;
    if (edit?.kind === "task") {
      path = "tasks";
      payload = {
        propertyId: property || Number(r?.property_id),
        roomId: Number(v("roomId")) || null,
        title: v("title"),
        description: v("description"),
        assigneeId: Number(v("assigneeId")),
        startsAt: v("startsAt"),
        dueAt: v("dueAt"),
        priority: v("priority"),
        status: v("status"),
        note: v("note"),
        version: Number(r?.version ?? 0),
        key: String(
          r?.request_key ?? (requestKey.current ||= crypto.randomUUID()),
        ),
      };
    } else if (edit?.kind === "template") {
      path = "templates";
      payload = {
        propertyId: property || Number(r?.property_id),
        code: v("code"),
        name: v("name"),
        eventType: v("eventType"),
        channel: v("channel"),
        title: v("title"),
        body: v("body"),
        enabled: f.get("enabled") === "on",
        version: Number(r?.version ?? 0),
      };
    } else {
      path = "rules";
      payload = {
        propertyId: property || Number(r?.property_id),
        eventType: v("eventType"),
        audience: v("audience"),
        offsetDays: Number(v("offsetDays")),
        sendHour: Number(v("sendHour")),
        dailyLimit: Number(v("dailyLimit")),
        enabled: f.get("enabled") === "on",
        version: Number(r?.version ?? 0),
      };
    }
    await action(
      () =>
        r
          ? apiClient.put(`/communications/${path}/${r.id}`, payload)
          : apiClient.post(`/communications/${path}`, payload),
      "Đã lưu dữ liệu trên hệ thống.",
    );
  }
  const tabs = [
    { key: "inbox", name: "Hộp thư", icon: Bell },
    ...(canSend
      ? [
          { key: "compose", name: "Tạo thông báo", icon: Send },
          { key: "history", name: "Lịch sử gửi", icon: Clock },
        ]
      : []),
    ...(canManage
      ? [{ key: "templates", name: "Mẫu nội dung", icon: FileText }]
      : []),
    { key: "calendar", name: "Lịch công việc", icon: CalendarDays },
    ...(canSend
      ? [{ key: "rules", name: "Nhắc việc tự động", icon: Clock }]
      : []),
    { key: "channels", name: "Kênh & tùy chọn", icon: Settings2 },
  ];
  return (
    <div className="min-w-0 space-y-5 p-4 md:p-6">
      <PageHeader
        title="Thông báo & Công việc"
        description="Theo dõi hộp thư, lịch nguồn và kết quả gửi. Đã xếp hàng không đồng nghĩa đã phát hoặc đã đọc."
      />
      {user?.activeRole === "TENANT" && (
        <Link className={button} href="/tenant/notifications/archive">
          Lưu trữ, xác nhận & tùy chọn thông báo
        </Link>
      )}
      <nav aria-label="Nhóm thông báo" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`${button} ${tab === t.key ? "border-blue-600 bg-accent text-link" : ""}`}
          >
            <t.icon className="size-4" />
            {t.name}
          </button>
        ))}
      </nav>
      {options.isError ? (
        <ErrorState
          message={apiErrorMessage(options.error)}
          onRetry={() => void options.refetch()}
        />
      ) : options.isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <PageToolbar>
            <label className="text-xs text-muted-foreground">
              Công ty
              <select
                aria-label="Công ty thông báo"
                className={input}
                value={company}
                onChange={(e) => {
                  setCompany(Number(e.target.value));
                  changeProperty(
                    Number(e.target.value)
                      ? (opt?.properties.find(
                          (p) => p.organizationId === Number(e.target.value),
                        )?.id ?? 0)
                      : 0,
                  );
                }}
              >
                <option value={0}>Tất cả công ty</option>
                {Array.from(
                  new Map(
                    opt?.properties
                      .filter((p) => p.organizationId)
                      .map((p) => [p.organizationId, p.organizationName]),
                  ).entries(),
                ).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Nhà trọ
              <select
                aria-label="Nhà trọ thông báo"
                className={input}
                value={property}
                onChange={(e) => changeProperty(Number(e.target.value))}
              >
                <option value={0} disabled={!!company}>
                  {company
                    ? "Chọn nhà trong công ty"
                    : "Tất cả nhà trong phạm vi"}
                </option>
                {effectiveProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {["inbox", "history"].includes(tab) && (
              <>
                <input
                  aria-label="Tìm thông báo"
                  className={input + " sm:max-w-60"}
                  placeholder="Tìm tiêu đề, nội dung…"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(0);
                  }}
                />
                {tab === "inbox" && (
                  <select
                    aria-label="Loại thông báo"
                    className={input + " sm:max-w-44"}
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">Tất cả loại</option>
                    {Object.entries(categories).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  aria-label="Trạng thái thông báo"
                  className={input + " sm:max-w-56"}
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">Tất cả trạng thái</option>
                  {(tab === "inbox"
                    ? [
                        ["UNREAD", "Chưa đọc"],
                        ["READ", "Đã đọc"],
                      ]
                    : Object.entries(statusNames).filter(
                        ([k]) =>
                          ![
                            "OPEN",
                            "IN_PROGRESS",
                            "COMPLETED",
                            "SOURCE",
                          ].includes(k),
                      )
                  ).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                {tab === "history" && (
                  <select
                    aria-label="Kênh gửi"
                    className={input + " sm:max-w-40"}
                    value={channel}
                    onChange={(e) => {
                      setChannel(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">Tất cả kênh</option>
                    {opt?.channels.map((c) => (
                      <option key={c.code}>{c.code}</option>
                    ))}
                  </select>
                )}
                <label className="text-xs">
                  Từ ngày
                  <input
                    aria-label="Từ ngày thông báo"
                    type="date"
                    className={input}
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                <label className="text-xs">
                  Đến ngày
                  <input
                    aria-label="Đến ngày thông báo"
                    type="date"
                    className={input}
                    value={to}
                    min={from || undefined}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
              </>
            )}
          </PageToolbar>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-danger-muted p-4 text-sm text-danger"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-xl bg-accent p-4 text-sm text-link"
            >
              {notice}
            </p>
          )}
          {["inbox", "history", "calendar"].includes(tab) && (
            <>
              {query.isError ? (
                <ErrorState
                  message={apiErrorMessage(query.error)}
                  onRetry={() => void query.refetch()}
                />
              ) : query.isLoading ? (
                <LoadingSkeleton />
              ) : (
                <>
                  {tab === "inbox" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <SummaryCard
                          label="Chưa đọc — toàn hộp thư"
                          value={query.data?.unreadCount ?? 0}
                          icon={<Bell className="size-5" />}
                        />
                        <SummaryCard
                          label="Thông báo theo bộ lọc"
                          value={query.data?.totalElements ?? 0}
                        />
                      </div>
                      <button
                        disabled={busy || !query.data?.unreadCount}
                        className={button}
                        onClick={() =>
                          void action(
                            () =>
                              apiClient.post("/communications/inbox/read-all"),
                            "Đã đánh dấu các thông báo của bạn là đã đọc.",
                            false,
                          )
                        }
                      >
                        Đọc tất cả của tôi
                      </button>
                      <div className="space-y-3">
                        {query.data?.rows.map((r) => (
                          <article
                            key={String(r.id)}
                            className={`rounded-2xl border p-4 ${r.read_at ? "border-border bg-card" : "border-accent-border bg-accent/40"}`}
                          >
                            <div className="flex flex-wrap justify-between gap-3">
                              <div>
                                <b>{String(r.title)}</b>
                                <p className="text-xs text-muted-foreground">
                                  {categories[String(r.category)] ??
                                    String(r.category)}{" "}
                                  ·{" "}
                                  {String(
                                    r.property_name ?? "Thông báo cá nhân",
                                  )}{" "}
                                  · {dateText(r.created_at)} ·{" "}
                                  {r.read_at ? "Đã đọc" : "Chưa đọc"}
                                </p>
                              </div>
                              <button
                                className={button}
                                onClick={() => {
                                  setDetail(r);
                                  if (!r.read_at)
                                    void action(
                                      () =>
                                        apiClient.post(
                                          `/communications/inbox/${r.id}/read`,
                                        ),
                                      "Đã đọc thông báo.",
                                      false,
                                    );
                                }}
                              >
                                Xem chi tiết
                              </button>
                            </div>
                            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-secondary-foreground">
                              {String(r.content)}
                            </p>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                  {tab === "history" && (
                    <>
                      <div className="rounded-xl bg-muted p-4 text-sm">
                        IN_APP “Đã khả dụng” nghĩa là đã ghi vào hộp thư; thời
                        điểm đọc được theo dõi riêng. Email/SMS/Zalo chưa cấu
                        hình sẽ không được báo phát thành công.
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {query.data?.campaigns
                          ?.filter(
                            (c) =>
                              c.status === "DRAFT" ||
                              c.status === "SCHEDULED" ||
                              c.status === "QUEUED",
                          )
                          .map((c) => (
                            <div
                              key={String(c.id)}
                              className="rounded-xl border bg-card p-3 text-sm"
                            >
                              <b>{String(c.title)}</b>
                              <p>{statusNames[String(c.status)]}</p>
                              {c.status === "DRAFT" && (
                                <button
                                  disabled={busy}
                                  className={button}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Kiểm tra lại người nhận và đưa bản nháp này vào hàng đợi?",
                                      )
                                    )
                                      void action(
                                        () =>
                                          apiClient.post(
                                            `/communications/campaigns/${c.id}/queue`,
                                            { version: c.version },
                                          ),
                                        "Đã xếp hàng; chưa xác nhận phát.",
                                        false,
                                      );
                                  }}
                                >
                                  Xếp hàng
                                </button>
                              )}
                              <button
                                disabled={busy}
                                className={button}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Hủy các lượt gửi chưa thực hiện? Lịch sử đã phát được giữ nguyên.",
                                    )
                                  )
                                    void action(
                                      () =>
                                        apiClient.post(
                                          `/communications/campaigns/${c.id}/cancel`,
                                          { version: c.version },
                                        ),
                                      "Đã hủy các lượt chưa gửi.",
                                      false,
                                    );
                                }}
                              >
                                Hủy lịch chưa gửi
                              </button>
                            </div>
                          ))}
                      </div>
                      <div className="overflow-x-auto surface-card">
                        <table className="w-full min-w-[900px] text-left text-sm">
                          <thead>
                            <tr>
                              {[
                                "Nội dung / Người nhận",
                                "Kênh / Trạng thái",
                                "Lịch / Kết quả",
                                "Lần thử / Đọc",
                                "Xử lý",
                              ].map((h) => (
                                <th key={h} className="p-4">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {query.data?.rows.map((r) => (
                              <tr key={String(r.id)} className="border-t">
                                <td className="p-4">
                                  <b>{String(r.title)}</b>
                                  <p>{String(r.recipient_name)}</p>
                                </td>
                                <td className="p-4">
                                  {String(r.channel)}
                                  <p>
                                    {statusNames[String(r.status)] ??
                                      String(r.status)}
                                  </p>
                                </td>
                                <td className="p-4">
                                  {dateText(r.scheduled_at)}
                                  <p className="text-xs">
                                    {String(r.result_code ?? "Chưa xử lý")}
                                  </p>
                                </td>
                                <td className="p-4">
                                  {String(r.attempt_count)} lần
                                  <p>
                                    {r.read_at
                                      ? `Đọc ${dateText(r.read_at)}`
                                      : "Chưa có xác nhận đọc"}
                                  </p>
                                </td>
                                <td className="p-4">
                                  <button
                                    className={button}
                                    onClick={() =>
                                      void action(
                                        async () =>
                                          setAttempts(
                                            (
                                              await apiClient.get<
                                                ApiEnvelope<Row[]>
                                              >(
                                                `/communications/deliveries/${r.id}/attempts`,
                                              )
                                            ).data.data,
                                          ),
                                        "Đã tải lịch sử lần gửi.",
                                        false,
                                      )
                                    }
                                  >
                                    Lịch sử lần gửi
                                  </button>
                                  {r.status === "FAILED" &&
                                    !!r.retryable &&
                                    Number(r.attempt_count) < 3 && (
                                      <button
                                        disabled={busy}
                                        className={button}
                                        onClick={() =>
                                          void action(
                                            () =>
                                              apiClient.post(
                                                `/communications/deliveries/${r.id}/retry`,
                                              ),
                                            "Đã yêu cầu thử lại cùng mã gửi.",
                                            false,
                                          )
                                        }
                                      >
                                        Thử lại có kiểm soát
                                      </button>
                                    )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {tab === "calendar" && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="date"
                          aria-label="Ngày xem lịch"
                          className={input + " max-w-48"}
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                        />
                        {[
                          ["day", "Ngày"],
                          ["week", "Tuần"],
                          ["month", "Tháng"],
                          ["list", "Danh sách"],
                        ].map(([k, v]) => (
                          <button
                            key={k}
                            className={`${button} ${mode === k ? "bg-accent text-link" : ""}`}
                            onClick={() => setMode(k)}
                          >
                            {v}
                          </button>
                        ))}
                        {canManage && (
                          <button
                            className={primary}
                            disabled={!property}
                            onClick={() => {
                              setEdit({ kind: "task" });
                              requestKey.current = "";
                            }}
                          >
                            Tạo công việc
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <SummaryCard
                          label="Việc sắp đến hạn trong khoảng xem"
                          value={query.data?.dueTasks ?? 0}
                        />
                        <SummaryCard
                          label="Việc quá hạn trong khoảng xem"
                          value={query.data?.overdueTasks ?? 0}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {calendarRange.from} – {calendarRange.to}. Sự kiện nguồn
                        mở đúng phân hệ; công việc thủ công có trạng thái riêng.
                      </p>
                      <div
                        className={
                          mode === "month"
                            ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                            : "space-y-3"
                        }
                      >
                        {Array.from(
                          new Set(
                            query.data?.rows.map((r) =>
                              String(r.starts_at).slice(0, 10),
                            ),
                          ),
                        ).map((day) => (
                          <section key={day} className="surface-card p-4">
                            <h3 className="mb-3 font-bold">{day}</h3>
                            {query.data?.rows
                              .filter((r) =>
                                String(r.starts_at).startsWith(day),
                              )
                              .map((r) => (
                                <article
                                  key={String(r.kind) + r.id}
                                  className="mb-3 rounded-xl bg-muted p-3"
                                >
                                  <b className="text-sm">{String(r.title)}</b>
                                  <p className="text-xs text-muted-foreground">
                                    {r.kind === "SOURCE"
                                      ? "Sự kiện từ hồ sơ nguồn"
                                      : "Công việc thủ công"}{" "}
                                    ·{" "}
                                    {statusNames[String(r.status)] ??
                                      String(r.status)}
                                  </p>
                                  <p className="text-xs">
                                    Hạn: {dateText(r.due_at)}{" "}
                                    {r.assignee_name
                                      ? `· ${r.assignee_name}`
                                      : ""}
                                  </p>
                                  {r.link && (
                                    <Link
                                      className="mt-2 inline-block text-sm text-link underline"
                                      href={String(r.link)}
                                    >
                                      Mở hồ sơ nguồn
                                    </Link>
                                  )}
                                  {r.kind === "MANUAL" && (
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        className={button}
                                        onClick={() => {
                                          changeProperty(Number(r.property_id));
                                          setEdit({ kind: "task", row: r });
                                        }}
                                      >
                                        {staff
                                          ? "Sửa / Phân công"
                                          : "Cập nhật tiến độ"}
                                      </button>
                                      <button
                                        className={button}
                                        onClick={() =>
                                          void action(
                                            async () =>
                                              setAttempts(
                                                (
                                                  await apiClient.get<
                                                    ApiEnvelope<Row[]>
                                                  >(
                                                    `/communications/tasks/${r.id}/history`,
                                                  )
                                                ).data.data,
                                              ),
                                            "Đã tải lịch sử công việc.",
                                            false,
                                          )
                                        }
                                      >
                                        Lịch sử
                                      </button>
                                    </div>
                                  )}
                                </article>
                              ))}
                          </section>
                        ))}
                      </div>
                    </>
                  )}
                  {query.data?.rows.length === 0 && (
                    <p className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
                      Không có dữ liệu phù hợp bộ lọc.
                    </p>
                  )}
                  {tab !== "calendar" && (
                    <Pagination
                      page={page}
                      totalPages={query.data?.totalPages ?? 0}
                      onChange={setPage}
                    />
                  )}
                </>
              )}
            </>
          )}
          {tab === "compose" && canSend && (
            <section className="surface-card p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-bold">Soạn thông báo</h2>
              {!property ? (
                <p className="text-sm text-muted-foreground">
                  Chọn nhà trọ trước khi chọn người nhận.
                </p>
              ) : audience.isError ? (
                <ErrorState
                  message={apiErrorMessage(audience.error)}
                  onRetry={() => void audience.refetch()}
                />
              ) : (
                <form
                  onSubmit={compose}
                  onChange={() => setPreview(null)}
                  className="space-y-4"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <AccountField title="Nhóm người nhận">
                      <select name="audience" className={input}>
                        <option value="ALL_TENANTS">
                          Tất cả người thuê đang có hợp đồng
                        </option>
                        <option value="ROOMS">Phòng được chọn</option>
                        <option value="SELECTED">Người nhận cụ thể</option>
                        {!accountant &&
                          ["MANAGER", "ACCOUNTANT", "TECHNICIAN"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                      </select>
                    </AccountField>
                    <AccountField title="Loại">
                      <select name="category" className={input}>
                        {Object.entries(categories)
                          .filter(
                            ([k]) =>
                              !accountant || ["INVOICE", "PAYMENT"].includes(k),
                          )
                          .map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                      </select>
                    </AccountField>
                  </div>
                  <fieldset className="rounded-xl border p-3">
                    <legend className="text-sm font-semibold">
                      Phòng / người nhận lựa chọn
                    </legend>
                    <div className="grid max-h-48 gap-2 overflow-auto sm:grid-cols-2">
                      {audience.data?.rooms.map((r) => (
                        <label key={`room${r.id}`} className="text-sm">
                          <input
                            name="rooms"
                            type="checkbox"
                            value={String(r.id)}
                          />{" "}
                          Phòng {String(r.code)}
                        </label>
                      ))}
                      {audience.data?.recipients.map((r) => (
                        <label
                          key={`${r.id}-${r.recipient_role}`}
                          className="text-sm"
                        >
                          <input
                            name="recipients"
                            type="checkbox"
                            value={String(r.id)}
                          />{" "}
                          {String(r.name)} · {String(r.recipient_role)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {canManage && (
                    <AccountField title="Dùng mẫu đã lưu (tùy chọn)">
                      <select
                        className={input}
                        value={String(chosen?.id ?? "")}
                        onChange={(e) => {
                          setChosen(
                            templates.data?.find(
                              (r) => String(r.id) === e.target.value,
                            ) ?? null,
                          );
                          setPreview(null);
                        }}
                      >
                        <option value="">Tự nhập</option>
                        {templates.data
                          ?.filter(
                            (t) =>
                              Number(t.property_id) === property && !!t.enabled,
                          )
                          .map((t) => (
                            <option key={String(t.id)} value={String(t.id)}>
                              {String(t.name)}
                            </option>
                          ))}
                      </select>
                    </AccountField>
                  )}
                  <div
                    key={String(chosen?.id ?? "manual")}
                    className="space-y-3"
                  >
                    <AccountField title="Tiêu đề">
                      <input
                        required
                        name="title"
                        maxLength={200}
                        defaultValue={String(chosen?.title ?? "")}
                        className={input}
                      />
                    </AccountField>
                    <AccountField title="Nội dung văn bản">
                      <textarea
                        required
                        name="body"
                        maxLength={5000}
                        defaultValue={String(chosen?.body ?? "")}
                        className={input + " min-h-28"}
                      />
                    </AccountField>
                  </div>
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold">
                      Kênh gửi
                    </legend>
                    <div className="flex flex-wrap gap-4">
                      {opt?.channels.map((c) => (
                        <label key={c.code} className="text-sm">
                          <input
                            type="checkbox"
                            name="channels"
                            value={c.code}
                            defaultChecked={c.code === "IN_APP"}
                            disabled={!c.available}
                          />{" "}
                          {c.code} {!c.available && "— chưa cấu hình"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <AccountField title="Thời gian gửi (giờ Việt Nam)">
                    <input
                      name="scheduledAt"
                      type="datetime-local"
                      required
                      defaultValue={localNow()}
                      className={input}
                    />
                  </AccountField>
                  <button
                    disabled={busy || audience.isLoading}
                    className={primary}
                  >
                    Kiểm tra & xem trước
                  </button>
                  {preview && (
                    <section className="rounded-xl border border-accent-border bg-accent p-4">
                      <h3 className="font-bold">
                        Xác nhận trước khi tạo yêu cầu gửi
                      </h3>
                      <p className="text-sm">
                        {preview.data.recipientCount} người ·{" "}
                        {preview.data.deliveryCount} lượt theo kênh. Chưa phát
                        thông báo.
                      </p>
                      <p className="mt-2 text-sm">
                        {preview.data.recipients.map((r) => r.name).join(", ")}
                      </p>
                      <b className="mt-3 block">
                        {preview.data.rendered?.[0]?.title ??
                          preview.message.title}
                      </b>
                      <p className="whitespace-pre-wrap text-sm">
                        {preview.data.rendered?.[0]?.body ??
                          preview.message.body}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          className={button}
                          onClick={() => void submitMessage(true)}
                        >
                          Lưu bản nháp
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={primary}
                          onClick={() => void submitMessage(false)}
                        >
                          Xác nhận tạo yêu cầu gửi
                        </button>
                      </div>
                    </section>
                  )}
                </form>
              )}
            </section>
          )}
          {tab === "templates" && canManage && (
            <section className="space-y-3">
              <button
                className={primary}
                disabled={!property}
                onClick={() => setEdit({ kind: "template" })}
              >
                Thêm mẫu
              </button>
              <p className="text-sm text-muted-foreground">
                Văn bản thuần; biến cho phép:{" "}
                {
                  "{{name}}, {{property}}, {{room}}, {{code}}, {{date}}, {{link}}"
                }
                . Không thực thi HTML hoặc mã mẫu.
              </p>
              {templates.isError ? (
                <ErrorState
                  message={apiErrorMessage(templates.error)}
                  onRetry={() => void templates.refetch()}
                />
              ) : (
                templates.data?.map((t) => (
                  <article key={String(t.id)} className="surface-card p-4">
                    <b>{String(t.name)}</b>
                    <p className="text-sm">
                      {String(t.code)} · {String(t.channel)} · phiên bản{" "}
                      {String(t.version)} · {t.enabled ? "Đang dùng" : "Đã tắt"}
                    </p>
                    <p className="my-2 line-clamp-2 text-sm text-muted-foreground">
                      {String(t.body)}
                    </p>
                    <button
                      className={button}
                      onClick={() => setEdit({ kind: "template", row: t })}
                    >
                      Sửa mẫu
                    </button>
                  </article>
                ))
              )}
            </section>
          )}
          {tab === "rules" && canSend && (
            <section className="space-y-3">
              <button
                className={primary}
                disabled={!property}
                onClick={() => setEdit({ kind: "rule" })}
              >
                Thêm quy tắc
              </button>
              <p className="rounded-xl bg-warning-muted p-4 text-sm text-amber-900">
                Không có quy tắc mặc định tự bật. Nhắc tiền chỉ gửi người thuê
                nguồn. Scheduler không sửa tiền, không gia hạn, không nhận/trả
                phòng hoặc nghiệm thu thay người dùng.
              </p>
              {rules.isError ? (
                <ErrorState
                  message={apiErrorMessage(rules.error)}
                  onRetry={() => void rules.refetch()}
                />
              ) : (
                rules.data?.map((r) => (
                  <article key={String(r.id)} className="surface-card p-4">
                    <b>
                      {eventNames[String(r.event_type)] ?? String(r.event_type)}
                    </b>
                    <p className="text-sm">
                      {String(r.audience)} · mốc {String(r.offset_days)} ngày ·{" "}
                      {String(r.send_hour)}h · giới hạn {String(r.daily_limit)}
                      /ngày/người/nhà · {r.enabled ? "Bật" : "Tắt"}
                    </p>
                    <button
                      className={button}
                      onClick={() => setEdit({ kind: "rule", row: r })}
                    >
                      Cấu hình
                    </button>
                  </article>
                ))
              )}
            </section>
          )}
          {tab === "channels" && (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {opt?.channels.map((c) => (
                  <article key={c.code} className="surface-card p-5 sm:p-6">
                    <b>{c.code}</b>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {c.available
                        ? "Khả dụng — ghi vào hộp thư database. Đọc được theo dõi riêng."
                        : "Chưa cấu hình provider. Không gửi thử, không báo SENT/DELIVERED giả."}
                    </p>
                  </article>
                ))}
              </div>
              {prefs.isError ? (
                <ErrorState
                  message={apiErrorMessage(prefs.error)}
                  onRetry={() => void prefs.refetch()}
                />
              ) : (
                prefs.data && (
                  <form
                    key={String(prefs.data.version)}
                    className="space-y-3 rounded-2xl border bg-card p-5"
                    onSubmit={(e) => {
                      const f = values(e);
                      void action(
                        () =>
                          apiClient.put("/communications/preferences", {
                            quiet: f.get("quiet") === "on",
                            start: f.get("start"),
                            end: f.get("end"),
                            version: prefs.data!.version,
                          }),
                        "Đã cập nhật khung giờ không làm phiền.",
                        false,
                      );
                    }}
                  >
                    <h3 className="font-bold">Tùy chọn cá nhân</h3>
                    <label className="text-sm">
                      <input
                        name="quiet"
                        type="checkbox"
                        defaultChecked={!!prefs.data.quiet_hours_enabled}
                      />{" "}
                      Hoãn phát trong khung giờ không làm phiền
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        aria-label="Bắt đầu không làm phiền"
                        name="start"
                        type="time"
                        required
                        defaultValue={String(
                          prefs.data.quiet_hours_start ?? "22:00",
                        ).slice(0, 5)}
                        className={input}
                      />
                      <input
                        aria-label="Kết thúc không làm phiền"
                        name="end"
                        type="time"
                        required
                        defaultValue={String(
                          prefs.data.quiet_hours_end ?? "07:00",
                        ).slice(0, 5)}
                        className={input}
                      />
                    </div>
                    <button disabled={busy} className={primary}>
                      Lưu tùy chọn
                    </button>
                    <p className="text-xs text-muted-foreground">
                      Áp dụng cho hàng đợi mới. Thông báo đã có trong hộp thư
                      không bị xóa.
                    </p>
                  </form>
                )
              )}
            </section>
          )}
        </>
      )}
      {detail && (
        <AccountModal
          title="Chi tiết thông báo"
          onClose={() => setDetail(null)}
        >
          <h3 className="font-bold">{String(detail.title)}</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
            {String(detail.content)}
          </p>
          {detail.link && (
            <Link href={String(detail.link)} className={primary + " mt-5"}>
              Mở nghiệp vụ liên quan
            </Link>
          )}
          {user?.activeRole === "TENANT" && (
            <Link
              className={button + " mt-3"}
              href={`/tenant/notifications/${detail.id}`}
            >
              Mở hồ sơ thông báo / xác nhận
            </Link>
          )}
        </AccountModal>
      )}
      {attempts && (
        <AccountModal title="Lịch sử xử lý" onClose={() => setAttempts(null)}>
          <div className="space-y-3">
            {attempts.length ? (
              attempts.map((r, i) => (
                <article key={i} className="rounded-xl border p-3 text-sm">
                  {Object.entries(r).map(([k, v]) => (
                    <p key={k}>
                      <span className="text-muted-foreground">{k}: </span>
                      {String(v ?? "—")}
                    </p>
                  ))}
                </article>
              ))
            ) : (
              <p>Chưa có lần xử lý nào.</p>
            )}
          </div>
        </AccountModal>
      )}
      {edit && (
        <AccountModal
          title={
            edit.kind === "task"
              ? "Công việc vận hành"
              : edit.kind === "template"
                ? "Mẫu thông báo"
                : "Quy tắc nhắc việc"
          }
          onClose={() => setEdit(null)}
        >
          <form onSubmit={saveEditor} className="space-y-3">
            {edit.kind === "task" ? (
              <>
                <AccountField title="Tiêu đề">
                  <input
                    required
                    name="title"
                    maxLength={200}
                    defaultValue={String(edit.row?.title ?? "")}
                    readOnly={!staff}
                    className={input}
                  />
                </AccountField>
                <AccountField title="Mô tả">
                  <textarea
                    required
                    name="description"
                    maxLength={2000}
                    readOnly={!staff}
                    defaultValue={String(edit.row?.description ?? "")}
                    className={input}
                  />
                </AccountField>
                <AccountField title="Phòng">
                  <select
                    name="roomId"
                    className={input}
                    defaultValue={String(edit.row?.room_id ?? 0)}
                    disabled={!staff}
                  >
                    <option value={0}>Không gắn phòng</option>
                    {audience.data?.rooms.map((r) => (
                      <option key={String(r.id)} value={String(r.id)}>
                        {String(r.code)}
                      </option>
                    ))}
                  </select>
                  {!staff && (
                    <input
                      name="roomId"
                      type="hidden"
                      value={String(edit.row?.room_id ?? 0)}
                    />
                  )}
                </AccountField>
                <AccountField title="Người phụ trách">
                  <select
                    name="assigneeId"
                    className={input}
                    defaultValue={String(
                      edit.row?.assignee_id ?? user?.id ?? "",
                    )}
                    disabled={!staff}
                  >
                    {audience.data?.recipients
                      .filter((r) => r.recipient_role !== "TENANT")
                      .map((r) => (
                        <option
                          key={String(r.id) + r.recipient_role}
                          value={String(r.id)}
                        >
                          {String(r.name)} · {String(r.recipient_role)}
                        </option>
                      ))}
                  </select>
                  {!staff && (
                    <input
                      type="hidden"
                      name="assigneeId"
                      value={String(edit.row?.assignee_id)}
                    />
                  )}
                </AccountField>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["startsAt", "Bắt đầu", "starts_at"],
                    ["dueAt", "Hạn hoàn thành", "due_at"],
                  ].map(([name, label, key]) => (
                    <AccountField key={name} title={label}>
                      <input
                        required
                        readOnly={!staff}
                        type="datetime-local"
                        name={name}
                        defaultValue={String(
                          edit.row?.[key] ?? localNow(),
                        ).slice(0, 16)}
                        className={input}
                      />
                    </AccountField>
                  ))}
                </div>
                <AccountField title="Ưu tiên">
                  <select
                    name="priority"
                    disabled={!staff}
                    className={input}
                    defaultValue={String(edit.row?.priority ?? "NORMAL")}
                  >
                    {["LOW", "NORMAL", "HIGH", "URGENT"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  {!staff && (
                    <input
                      type="hidden"
                      name="priority"
                      value={String(edit.row?.priority)}
                    />
                  )}
                </AccountField>
                <AccountField title="Trạng thái">
                  <select
                    name="status"
                    className={input}
                    defaultValue={String(edit.row?.status ?? "OPEN")}
                  >
                    {[
                      "OPEN",
                      "IN_PROGRESS",
                      "COMPLETED",
                      ...(staff ? ["CANCELLED"] : []),
                    ].map((v) => (
                      <option key={v} value={v}>
                        {statusNames[v]}
                      </option>
                    ))}
                  </select>
                </AccountField>
                <AccountField title="Ghi chú">
                  <textarea
                    name="note"
                    maxLength={1000}
                    defaultValue={String(edit.row?.note ?? "")}
                    className={input}
                  />
                </AccountField>
              </>
            ) : edit.kind === "template" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AccountField title="Mã">
                    <input
                      name="code"
                      required
                      pattern="[A-Z0-9_-]+"
                      maxLength={60}
                      defaultValue={String(edit.row?.code ?? "")}
                      className={input}
                    />
                  </AccountField>
                  <AccountField title="Tên">
                    <input
                      name="name"
                      required
                      maxLength={180}
                      defaultValue={String(edit.row?.name ?? "")}
                      className={input}
                    />
                  </AccountField>
                </div>
                <AccountField title="Sự kiện">
                  <select
                    name="eventType"
                    className={input}
                    defaultValue={String(
                      edit.row?.event_type ?? "ANNOUNCEMENT",
                    )}
                  >
                    <option value="ANNOUNCEMENT">Thông báo chung</option>
                    {opt?.events.map((v) => (
                      <option key={v} value={v}>
                        {eventNames[v] ?? v}
                      </option>
                    ))}
                  </select>
                </AccountField>
                <AccountField title="Kênh">
                  <select
                    name="channel"
                    className={input}
                    defaultValue={String(edit.row?.channel ?? "IN_APP")}
                  >
                    {opt?.channels.map((c) => (
                      <option key={c.code}>{c.code}</option>
                    ))}
                  </select>
                </AccountField>
                <AccountField title="Tiêu đề">
                  <input
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={String(edit.row?.title ?? "")}
                    className={input}
                  />
                </AccountField>
                <AccountField title="Nội dung">
                  <textarea
                    name="body"
                    required
                    maxLength={5000}
                    defaultValue={String(edit.row?.body ?? "")}
                    className={input + " min-h-28"}
                  />
                </AccountField>
                <p className="text-xs text-muted-foreground">
                  Dữ liệu soạn mẫu không được gửi cho đến khi xem trước và xác
                  nhận ở mục Tạo thông báo.
                </p>
              </>
            ) : (
              <>
                <AccountField title="Sự kiện">
                  <select
                    name="eventType"
                    className={input}
                    defaultValue={String(
                      edit.row?.event_type ?? "INVOICE_BEFORE_DUE",
                    )}
                    disabled={!!edit.row}
                  >
                    {opt?.events
                      .filter(
                        (v) =>
                          !accountant ||
                          v.startsWith("INVOICE") ||
                          v.startsWith("PAYMENT") ||
                          v === "DEPOSIT_REFUNDED",
                      )
                      .map((v) => (
                        <option key={v} value={v}>
                          {eventNames[v] ?? v}
                        </option>
                      ))}
                  </select>
                  {edit.row && (
                    <input
                      type="hidden"
                      name="eventType"
                      value={String(edit.row.event_type)}
                    />
                  )}
                </AccountField>
                <AccountField title="Nhóm nhận">
                  <select
                    name="audience"
                    disabled={!!edit.row}
                    className={input}
                    defaultValue={String(edit.row?.audience ?? "TENANT")}
                  >
                    <option value="TENANT">Người thuê nguồn</option>
                    {!accountant && (
                      <>
                        <option value="STAFF">
                          Chủ nhà / quản lý trong phạm vi
                        </option>
                        <option value="ASSIGNEE">
                          Người được phân công nguồn
                        </option>
                      </>
                    )}
                  </select>
                  {edit.row && (
                    <input
                      type="hidden"
                      name="audience"
                      value={String(edit.row.audience)}
                    />
                  )}
                </AccountField>
                {[
                  [
                    "offsetDays",
                    "Mốc cách ngày nguồn (quá hạn: sau hạn)",
                    "offset_days",
                    0,
                    0,
                    60,
                  ],
                  ["sendHour", "Giờ gửi theo Việt Nam", "send_hour", 9, 7, 21],
                  [
                    "dailyLimit",
                    "Giới hạn/ngày/người/nhà",
                    "daily_limit",
                    2,
                    1,
                    5,
                  ],
                ].map(([name, label, key, def, min, max]) => (
                  <AccountField key={String(name)} title={String(label)}>
                    <NumberInput
                      name={String(name)}
                      required
                      min={Number(min)}
                      max={Number(max)}
                      readOnly={name === "offsetDays" && !!edit.row}
                      defaultValue={Number(edit.row?.[String(key)] ?? def)}
                      className={input}
                    />
                  </AccountField>
                ))}
              </>
            )}
            {edit.kind !== "task" && (
              <label className="block text-sm">
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={
                    edit.row ? !!edit.row.enabled : edit.kind === "template"
                  }
                />{" "}
                Đang bật
              </label>
            )}
            <button className={primary} disabled={busy}>
              Lưu
            </button>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </form>
        </AccountModal>
      )}
    </div>
  );
}
