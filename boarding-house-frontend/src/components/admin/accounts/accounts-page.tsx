"use client";
import Link from "next/link";
import { AccountField, AccountModal } from "./account-ui";
import {
  CreateAccountWizard,
  InitialCredentialDialog,
  EditAccountDialog,
} from "./create-account-wizard";
import { ManagerTenantAccounts } from "./manager-tenant-accounts";
import {
  accountProvisioningService as provisioning,
  type ProvisionResult,
} from "@/services/account-provisioning.service";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, ShieldCheck, Search, Building2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyState,
  ErrorState,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { managerCapabilities } from "@/services/owner-access.service";
import {
  ownerAccountsService as service,
  roleLabels,
  accountantPermissions,
  technicianPermissions,
  type ManagedAccount,
  type StaffRole,
  type AccountRole,
  type AccountOptions,
  type InvitationLink,
} from "@/services/owner-accounts.service";

const accountState: Record<string, string> = {
  ACTIVE: "Hoạt động",
  LOCKED: "Bị khóa",
  INACTIVE: "Ngừng hoạt động",
  NO_ACCOUNT: "Chưa có tài khoản",
  PENDING: "Chờ kích hoạt",
  ACCEPTED: "Đã kích hoạt",
  REVOKED: "Đã thu hồi",
  EXPIRED: "Hết hạn",
};
const residenceState: Record<string, string> = {
  ACTIVE: "Đang cư trú",
  PENDING: "Chưa nhận phòng",
  NOTICE: "Đã báo trả phòng",
  EXPIRED: "Hết hạn cư trú",
  CHECKED_OUT: "Đã trả phòng",
  INACTIVE: "Ngừng cư trú",
};

const input =
  "min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus:border-ring";
const primary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-secondary-foreground disabled:opacity-50";
const card = "rounded-2xl border border-border bg-card p-5 shadow-card";
export { AccountField, AccountModal } from "./account-ui";
export function AccountsPage() {
  return (
    <AdminShell
      title="Tài khoản & Nhân sự"
      subtitle="Tài khoản, hồ sơ cư trú và phân công tại các cơ sở"
    >
      <AccountsWorkspace />
    </AdminShell>
  );
}

export function AccountsWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const owner = user?.activeRole === "OWNER";
  const [tab, setTab] = useState("staff"),
    [property, setProperty] = useState(0),
    [area, setArea] = useState(0),
    [organization, setOrganization] = useState(0),
    [keyword, setKeyword] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false),
    [creatingProfile, setCreatingProfile] = useState<ManagedAccount | null>(
      null,
    ),
    [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(null),
    [credential, setCredential] = useState<ProvisionResult | null>(null);
  const [selected, setSelected] = useState<ManagedAccount | null>(null),
    [assigning, setAssigning] = useState<ManagedAccount | null>(null),
    [invite, setInvite] = useState(false),
    [tenantInvite, setTenantInvite] = useState<ManagedAccount | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState<InvitationLink | null>(null),
    [historyPage, setHistoryPage] = useState(0);
  const role = embedded
    ? "MANAGER"
    : ["MANAGER", "TENANT", "ACCOUNTANT", "TECHNICIAN"].includes(tab)
      ? tab
      : tab === "staff"
        ? "STAFF"
        : undefined;
  const key = ["owner-accounts", user?.id, user?.activeRole];
  const options = useQuery({
    queryKey: [...key, "options"],
    enabled: owner,
    queryFn: ({ signal }) => service.options(signal),
    refetchInterval: 15000,
  });
  const accounts = useQuery({
    queryKey: [
      ...key,
      property,
      area,
      organization,
      role,
      keyword,
      status,
      page,
    ],
    enabled: owner,
    queryFn: ({ signal }) =>
      service.list(
        {
          propertyId: property || undefined,
          areaId: area || undefined,
          organizationId: organization || undefined,
          role,
          keyword,
          status,
          page,
          size: 20,
        },
        signal,
      ),
    refetchInterval: 15000,
  });
  const invitations = useQuery({
    queryKey: [...key, "invitations"],
    enabled: owner && tab === "invitations",
    queryFn: ({ signal }) => service.invitations(signal),
    refetchInterval: 15000,
  });
  const history = useQuery({
    queryKey: [...key, "history", historyPage],
    enabled: owner && tab === "history",
    queryFn: ({ signal }) => service.history(historyPage, signal),
  });
  async function refresh() {
    await client.cancelQueries();
    await client.invalidateQueries();
  }
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function statusAccount(row: ManagedAccount) {
    const reason = window.prompt("Lý do thay đổi trạng thái tài khoản:");
    if (!reason?.trim() || !row.id) return;
    const next = row.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    await run(
      () => provisioning.status(row.id!, next, reason.trim()),
      "Đã cập nhật trạng thái tài khoản. Phiên bị khóa mất hiệu lực ngay.",
    );
    setSelected(null);
  }
  async function resetAccount(row: ManagedAccount) {
    if (!row.id) return;
    const reason = window.prompt("Lý do đặt lại mật khẩu:");
    if (!reason?.trim()) return;
    await run(async () => {
      setCredential(await provisioning.reset(row.id!, reason.trim()));
      setSelected(null);
    }, "Đã cấp mật khẩu khởi tạo mới. Mật khẩu cũ và các phiên cũ đã mất hiệu lực.");
  }
  if (!owner) return <ManagerTenantAccounts />;
  const tabs = embedded
    ? [
        ["overview", "Quản lý & Phân công"],
        ["history", "Lịch sử phân quyền"],
      ]
    : [
        ["overview", "Tổng quan"],
        ["staff", "Nhân viên"],
        ...Object.entries(roleLabels),
        ["permissions", "Phân quyền"],
        ["management", "Quản lý tài khoản"],
        ["history", "Nhật ký"],
      ];
  return (
    <div className="space-y-6">
      <header
        className={`${card} flex flex-wrap items-center justify-between gap-4`}
      >
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-link">
            <Users className="size-4" />
            SmartHome AI
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">
            {embedded ? "Phân công tại cơ sở" : "Tài khoản & Nhân sự"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tạo tài khoản, quản lý phạm vi làm việc và trạng thái đăng nhập.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={secondary} href="/admin/tenants">
            Hồ sơ cư trú & lịch sử thuê
          </Link>
          <button
            className={primary}
            onClick={() => {
              setCreatingProfile(null);
              setCreating(true);
            }}
          >
            <UserPlus className="size-4" />+ Tạo tài khoản
          </button>
        </div>
      </header>
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
          className="rounded-xl bg-success-muted p-4 text-sm text-success"
        >
          {notice}
        </p>
      )}
      {!embedded && accounts.data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Tổng nhân viên", "totalStaff"],
            ["Tổng tài khoản theo bộ lọc", "totalAccounts"],
            ["Người quản lý", "MANAGER"],
            ["Người thuê", "TENANT"],
            ["Kế toán", "ACCOUNTANT"],
            ["Kỹ thuật", "TECHNICIAN"],
            ["Tài khoản đang hoạt động", "active"],
            ["Tài khoản chưa kích hoạt", "pending"],
            ["Tài khoản bị khóa", "locked"],
          ].map(([label, key]) => (
            <div className={card} key={key}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-extrabold text-foreground">
                {accounts.data.summary[key] ?? 0}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Nhóm tài khoản">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            className={tab === key ? primary : secondary}
            onClick={() => {
              setTab(key);
              setPage(0);
              setSelected(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {options.isError && (
        <ErrorState
          message={apiErrorMessage(options.error)}
          onRetry={() => void options.refetch()}
        />
      )}
      {!["invitations", "history"].includes(tab) && (
        <>
          <div className={`${card} grid gap-4 md:grid-cols-4`}>
            <AccountField title="Tìm kiếm">
              <div className="relative">
                <Search className="absolute right-3 top-3 size-4 text-muted-foreground" />
                <input
                  className={input}
                  placeholder="Tên, email, số điện thoại..."
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            </AccountField>
            <AccountField title="Công ty">
              <select
                className={input}
                value={organization}
                onChange={(e) => {
                  setOrganization(Number(e.target.value));
                  setArea(0);
                  setProperty(0);
                  setPage(0);
                }}
              >
                <option value={0}>Tất cả công ty</option>
                {options.data?.organizations?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </AccountField>
            <AccountField title="Khu vực">
              <select
                className={input}
                value={area}
                onChange={(e) => {
                  setArea(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value="0">Tất cả khu vực</option>
                {options.data?.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </AccountField>
            <AccountField title="Nhà trọ">
              <select
                className={input}
                value={property}
                onChange={(e) => {
                  setProperty(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value="0">Tất cả nhà trọ</option>
                {options.data?.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </AccountField>
            <AccountField title="Trạng thái tài khoản">
              <select
                className={input}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Tất cả</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="LOCKED">Bị khóa</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
                <option value="NO_ACCOUNT">Chưa có tài khoản</option>
              </select>
            </AccountField>
          </div>
          {tab === "permissions" && (
            <div className={`${card} text-sm leading-6 text-secondary-foreground`}>
              <ShieldCheck className="mb-2 size-6 text-link" />
              Chọn nhân sự → Phân công → Chọn nhà trọ hoặc khu vực → Chọn quyền
              → Xác nhận. Quyền kế toán áp dụng cho toàn bộ nhà trọ được giao
              của tài khoản; chỉ quản trị viên duy nhất được thay đổi. Phân công
              theo khu vực áp dụng cho danh sách nhà trọ tại thời điểm xác nhận,
              không tự mở rộng khi chuyển khu vực.
            </div>
          )}
          {accounts.isPending && (
            <p role="status" className={card}>
              Đang tải tài khoản...
            </p>
          )}
          {accounts.isError && (
            <ErrorState
              message={apiErrorMessage(accounts.error)}
              onRetry={() => void accounts.refetch()}
            />
          )}
          {accounts.data && (
            <section className="overflow-hidden surface-card ">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      {[
                        ["account", "Tài khoản"],
                        ["role", "Vai trò"],
                        ["company", "Công ty"],
                        ["property", "Nhà trọ / Phòng"],
                        ["residence", "Cư trú"],
                        ["account-status", "Trạng thái tài khoản"],
                        ["assignment-status", "Trạng thái phân công"],
                        ["created", "Ngày tạo"],
                        ["actions", "Thao tác"],
                      ].map(([id, label]) => (
                        <th className="px-5 py-4" key={id}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {accounts.data.items.map((row) => (
                      <tr
                        key={`${row.role_code}-${row.id ?? `profile-${row.profile_id}`}`}
                        className="hover:bg-muted/70"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground">
                            {row.full_name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.email ?? "Chưa có email"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.phone ?? ""}{" "}
                            {row.tenant_code ?? (row.id ? `NV-${row.id}` : "")}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {roleLabels[row.role_code]}
                        </td>
                        <td className="px-5 py-4">
                          {Array.from(
                            new Set(
                              row.assignments
                                .map((a) => a.organization_name)
                                .filter(Boolean),
                            ),
                          ).join(", ") || "Chưa gắn công ty"}
                        </td>
                        <td className="max-w-64 px-5 py-4">
                          {row.assignments.length ? (
                            row.assignments.map((a) => (
                              <p key={a.property_id} className="mb-1">
                                {a.property_name}
                                {a.is_primary ? " · Phụ trách chính" : ""}
                              </p>
                            ))
                          ) : (
                            <span className="text-muted-foreground">
                              Chưa phân công
                            </span>
                          )}
                          {row.room_code && (
                            <p className="text-xs text-muted-foreground">
                              Phòng {row.room_code} ·{" "}
                              {row.contract_code ?? "Chưa có hợp đồng"}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {row.role_code === "TENANT" ? (
                            <span>
                              {row.residence_status
                                ? (residenceState[row.residence_status] ??
                                  row.residence_status)
                                : "Chưa nhận phòng"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {row.status === "NO_ACCOUNT" ? (
                            <span className="text-muted-foreground">
                              Chưa có tài khoản
                            </span>
                          ) : (
                            <StatusBadge status={row.status} />
                          )}
                          {row.must_change_password && (
                            <p className="mt-1 text-xs text-warning">
                              Chờ đổi mật khẩu lần đầu
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-secondary-foreground">
                          {row.assignments.length
                            ? "Đã phân công phạm vi"
                            : "Chưa phân công"}
                        </td>
                        <td className="px-5 py-4 text-secondary-foreground">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleDateString(
                                "vi-VN",
                              )
                            : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="font-semibold text-link"
                              onClick={() => setSelected(row)}
                            >
                              Chi tiết
                            </button>
                            {row.role_code !== "TENANT" && (
                              <button
                                className={secondary}
                                onClick={() => setAssigning(row)}
                              >
                                Phân công
                              </button>
                            )}
                            {row.id && (
                              <button
                                className="font-semibold text-link"
                                onClick={() => setEditingAccount(row)}
                              >
                                Chỉnh sửa
                              </button>
                            )}
                            {row.role_code === "TENANT" && !row.id && (
                              <button
                                className={secondary}
                                onClick={() => {
                                  setCreatingProfile(row);
                                  setCreating(true);
                                }}
                              >
                                Tạo tài khoản
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!accounts.data.items.length && (
                <EmptyState text="Chưa có tài khoản phù hợp. Mời nhân sự hoặc mở hồ sơ cư trú để quản lý người thuê." />
              )}
              <div className="flex items-center justify-between border-t border-border p-4 text-sm">
                <span>
                  {accounts.data.total} kết quả · Trang {page + 1}
                </span>
                <div className="flex gap-2">
                  <button
                    className={secondary}
                    disabled={!page}
                    onClick={() => setPage(page - 1)}
                  >
                    Trước
                  </button>
                  <button
                    className={secondary}
                    disabled={(page + 1) * 20 >= accounts.data.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Sau
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}
      {tab === "management" && (
        <section className={card}>
          <h2 className="font-bold">Quản lý đăng nhập và trạng thái</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Dùng Chi tiết để chỉnh sửa thông tin, khóa/mở hoặc cấp lại mật khẩu
            khởi tạo trong phạm vi bạn được quản trị.
          </p>
          <button
            className={`${secondary} mt-4`}
            onClick={() => {
              setTab("invitations");
              setPage(0);
            }}
          >
            Thiết lập bằng liên kết (tùy chọn)
          </button>
        </section>
      )}
      {tab === "invitations" && (
        <section className={card}>
          <h2 className="mb-4 font-bold">Thiết lập bằng liên kết (tùy chọn)</h2>
          <button
            className={secondary}
            onClick={() => {
              setTenantInvite(null);
              setInvite(true);
            }}
          >
            Thêm liên kết tùy chọn
          </button>
          <p className="mb-5 text-sm text-muted-foreground">
            Liên kết có hiệu lực 48 giờ. Gửi lại sẽ vô hiệu hóa liên kết trước.
            Chưa cấu hình dịch vụ email; bạn sao chép liên kết và chuyển riêng
            cho người nhận.
          </p>
          {invitations.isPending && <p role="status">Đang tải lời mời...</p>}
          {invitations.isError && (
            <ErrorState
              message={apiErrorMessage(invitations.error)}
              onRetry={() => void invitations.refetch()}
            />
          )}
          <div className="space-y-3">
            {invitations.data?.slice(page * 20, (page + 1) * 20).map((i) => (
              <article
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="font-semibold">
                    {i.full_name} · {roleLabels[i.role_code]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {i.email} · Hết hạn {i.expires_at}
                  </p>
                  <p className="mt-1 text-xs font-bold text-link">
                    {accountState[i.status] ?? i.status}
                  </p>
                </div>
                {["PENDING", "EXPIRED"].includes(i.status) && (
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      className={secondary}
                      onClick={() => {
                        const reason = window.prompt("Lý do gửi lại lời mời:");
                        if (reason?.trim())
                          void run(async () => {
                            setLink(await service.resend(i.id, reason));
                          }, "Đã tạo liên kết mới.");
                      }}
                    >
                      Gửi lại
                    </button>
                    <button
                      disabled={busy}
                      className={secondary}
                      onClick={() => {
                        const reason = window.prompt("Lý do thu hồi lời mời:");
                        if (reason?.trim())
                          void run(
                            () => service.revokeInvitation(i.id, reason),
                            "Đã thu hồi lời mời.",
                          );
                      }}
                    >
                      Thu hồi
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {invitations.data?.length === 0 && (
            <EmptyState text="Chưa có lời mời." />
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              className={secondary}
              disabled={!page}
              onClick={() => setPage(page - 1)}
            >
              Trước
            </button>
            <button
              className={secondary}
              disabled={(page + 1) * 20 >= (invitations.data?.length ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              Sau
            </button>
          </div>
        </section>
      )}
      {tab === "history" && (
        <section className={card}>
          <h2 className="mb-4 font-bold">Nhật ký quản trị</h2>
          {history.isPending && <p role="status">Đang tải nhật ký...</p>}
          {history.isError && (
            <ErrorState
              message={apiErrorMessage(history.error)}
              onRetry={() => void history.refetch()}
            />
          )}
          <div className="space-y-4">
            {history.data?.map((h) => (
              <article
                className="border-b border-border pb-3 text-sm"
                key={h.id}
              >
                <p className="font-semibold">{h.action}</p>
                <p className="mt-1 break-words text-secondary-foreground">{h.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {h.occurred_at} · {h.resource_type} #{h.resource_id}
                </p>
              </article>
            ))}
          </div>
          {!history.data?.length && !history.isPending && (
            <EmptyState text="Chưa có nhật ký ở trang này." />
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              disabled={!historyPage}
              className={secondary}
              onClick={() => setHistoryPage(historyPage - 1)}
            >
              Trước
            </button>
            <button
              className={secondary}
              disabled={history.data?.length !== 50}
              onClick={() => setHistoryPage(historyPage + 1)}
            >
              Sau
            </button>
          </div>
        </section>
      )}
      {selected && (
        <AccountModal
          title={selected.full_name}
          drawer
          onClose={() => setSelected(null)}
        >
          <div className="space-y-5">
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Email", selected.email],
                ["Điện thoại", selected.phone],
                ["Vai trò", roleLabels[selected.role_code]],
                [
                  "Trạng thái tài khoản",
                  accountState[selected.status] ?? selected.status,
                ],
                [
                  "Trạng thái cư trú",
                  selected.residence_status
                    ? (residenceState[selected.residence_status] ??
                      selected.residence_status)
                    : "Không áp dụng",
                ],
                ["Mã người thuê", selected.tenant_code ?? "Không áp dụng"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-semibold">
                    {value ?? "Chưa cập nhật"}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-3">
              {selected.profile_id && (
                <Link
                  className={primary}
                  href={`/admin/tenants/${selected.profile_id}`}
                >
                  Hồ sơ cư trú & lịch sử thuê
                </Link>
              )}
              {selected.id && (
                <button
                  disabled={busy}
                  className={secondary}
                  onClick={() => void statusAccount(selected)}
                >
                  {selected.status === "ACTIVE"
                    ? "Khóa tài khoản"
                    : "Kích hoạt / Mở khóa"}
                </button>
              )}
              {selected.id && (
                <>
                  <button
                    className={secondary}
                    disabled={busy}
                    onClick={() => {
                      setEditingAccount(selected);
                      setSelected(null);
                    }}
                  >
                    Chỉnh sửa thông tin
                  </button>
                  <button
                    className={secondary}
                    disabled={busy}
                    onClick={() => void resetAccount(selected)}
                  >
                    Đặt lại mật khẩu
                  </button>
                </>
              )}
              {selected.role_code !== "TENANT" && (
                <button
                  className={primary}
                  onClick={() => {
                    setAssigning(selected);
                    setSelected(null);
                  }}
                >
                  Chỉnh sửa phân công
                </button>
              )}
            </div>
            {selected.role_code !== "TENANT" && (
              <StaffDetails
                row={selected}
                onRevoke={(propertyId) => {
                  const reason = window.prompt("Lý do thu hồi phân công:");
                  if (reason?.trim() && selected.id)
                    void run(
                      () =>
                        service.revoke(
                          selected.id!,
                          selected.role_code as StaffRole,
                          propertyId,
                          reason,
                        ),
                      "Đã thu hồi phân công; dữ liệu nghiệp vụ được giữ nguyên.",
                    );
                }}
              />
            )}
          </div>
        </AccountModal>
      )}
      {assigning && options.data && (
        <AssignmentDialog
          row={assigning}
          options={options.data}
          onClose={() => setAssigning(null)}
          onSaved={async () => {
            setAssigning(null);
            await refresh();
            setNotice(
              "Đã lưu phân công. Các truy vấn được làm mới theo phạm vi hiện tại.",
            );
          }}
        />
      )}
      {creating && (
        <CreateAccountWizard
          profile={creatingProfile}
          onClose={() => {
            setCreating(false);
            setCreatingProfile(null);
          }}
          onCreated={refresh}
        />
      )}
      {editingAccount?.id && (
        <EditAccountDialog
          account={{
            id: editingAccount.id,
            full_name: editingAccount.full_name,
            phone: editingAccount.phone,
            email: editingAccount.email,
          }}
          onClose={() => setEditingAccount(null)}
          onSaved={async () => {
            await refresh();
            setSelected(null);
            setNotice("Đã lưu thông tin tài khoản.");
          }}
        />
      )}
      {credential && (
        <InitialCredentialDialog
          result={credential}
          onClose={() => setCredential(null)}
        />
      )}
      {invite && (
        <InvitationDialog
          row={tenantInvite}
          onClose={() => setInvite(false)}
          onCreated={async (result) => {
            setLink(result);
            setInvite(false);
            await refresh();
          }}
        />
      )}
      {link && (
        <AccountModal
          title="Liên kết kích hoạt tài khoản"
          onClose={() => setLink(null)}
        >
          <p className="mb-4 text-sm text-secondary-foreground">
            Gửi riêng liên kết này cho người nhận. Liên kết chỉ hiển thị ở lần
            tạo và dùng được một lần trong {link.expiresInHours} giờ.
          </p>
          <input
            aria-label="Liên kết kích hoạt"
            className={input}
            readOnly
            value={
              typeof window !== "undefined"
                ? `${window.location.origin}/accept-invitation#token=${link.token}`
                : ""
            }
          />
          <button
            className={`${primary} mt-4`}
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  `${window.location.origin}/accept-invitation#token=${link.token}`,
                )
                .then(() => setNotice("Đã sao chép liên kết."))
                .catch(() =>
                  setError(
                    "Không thể sao chép tự động. Hãy chọn và sao chép liên kết.",
                  ),
                );
            }}
          >
            Sao chép liên kết
          </button>
        </AccountModal>
      )}
    </div>
  );
}

function StaffDetails({
  row,
  onRevoke,
}: {
  row: ManagedAccount;
  onRevoke: (property: number) => void;
}) {
  const { user } = useAuth();
  const detail = useQuery({
    queryKey: ["owner-account-detail", user?.id, row.id, row.role_code],
    enabled: !!row.id,
    queryFn: ({ signal }) =>
      service.detail(row.id!, row.role_code as StaffRole, signal),
  });
  if (detail.isPending) return <p role="status">Đang tải phân công...</p>;
  if (detail.isError)
    return (
      <ErrorState
        message={apiErrorMessage(detail.error)}
        onRetry={() => void detail.refetch()}
      />
    );
  return (
    <div className="space-y-3">
      {row.role_code === "ACCOUNTANT" && (
        <div className="rounded-xl bg-accent p-4 text-sm">
          <p className="mb-2 font-bold">
            Quyền kế toán trên các cơ sở được giao
          </p>
          {Object.entries(accountantPermissions)
            .filter(([key]) => detail.data.accountant?.[0]?.[key])
            .map(([key, label]) => (
              <p key={key}>{label}</p>
            ))}
        </div>
      )}
      {detail.data.assignments.map((a) => (
        <div
          key={a.property_id}
          className="rounded-xl border border-border p-4"
        >
          <p className="font-bold">
            {a.property_name}
            {a.is_primary ? " · Phụ trách chính" : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {a.area_name ?? "Chưa phân khu vực"}
          </p>
          {row.role_code === "MANAGER" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded bg-muted px-2 py-1 text-xs">
                Vận hành cơ bản
              </span>
              {detail.data.capabilities
                .filter((c) => c.property_id === a.property_id)
                .map((c) => (
                  <span
                    className="rounded bg-accent px-2 py-1 text-xs text-link"
                    key={c.capability}
                  >
                    {managerCapabilities[
                      c.capability as keyof typeof managerCapabilities
                    ] ?? c.capability}
                  </span>
                ))}
            </div>
          )}
          {row.role_code === "TECHNICIAN" && (
            <p className="mt-2 text-xs text-secondary-foreground">
              {detail.data.technician?.find(
                (t) => t.property_id === a.property_id,
              )?.can_update !== false
                ? "Được cập nhật công việc"
                : "Xem công việc được giao"}{" "}
              ·{" "}
              {detail.data.technician?.find(
                (t) => t.property_id === a.property_id,
              )?.can_record_cost !== false
                ? "Được ghi vật tư/chi phí"
                : "Không có quyền chi phí mới"}
            </p>
          )}
          <button
            className="mt-3 text-sm font-semibold text-danger"
            onClick={() => onRevoke(a.property_id)}
          >
            Thu hồi phân công tại cơ sở
          </button>
        </div>
      ))}
      {!detail.data.assignments.length && (
        <EmptyState text="Tài khoản chưa được giao cơ sở." />
      )}
      {row.role_code === "TECHNICIAN" && (
        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="font-bold">
            Lịch sử công việc tại cơ sở được quản lý
          </h3>
          {detail.data.tasks?.map((task) => (
            <Link
              key={task.id}
              href={`/admin/maintenance/${task.id}`}
              className="block rounded-xl border border-border p-3"
            >
              <p className="font-semibold text-link">
                {task.code} · {task.title}
              </p>
              <p className="my-2 text-sm text-muted-foreground">
                {task.property_name}
              </p>
              <StatusBadge status={task.status} />
            </Link>
          ))}
          {!detail.data.tasks?.length && (
            <EmptyState text="Chưa có lịch sử công việc trong phạm vi quản lý." />
          )}
          <Link
            className="text-sm font-bold text-link"
            href="/admin/maintenance"
          >
            Mở yêu cầu bảo trì
          </Link>
        </section>
      )}
    </div>
  );
}

function AssignmentDialog({
  row,
  options,
  onClose,
  onSaved,
}: {
  row: ManagedAccount;
  options: AccountOptions;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const existing = useQuery({
    queryKey: ["owner-account-detail", user?.id, row.id, row.role_code],
    enabled: !!row.id,
    queryFn: ({ signal }) =>
      service.detail(row.id!, row.role_code as StaffRole, signal),
  });
  const [properties, setProperties] = useState<number[]>([]),
    [area, setArea] = useState(0),
    [caps, setCaps] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [primaryManager, setPrimary] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const labels: Record<string, string> =
    row.role_code === "MANAGER"
      ? managerCapabilities
      : row.role_code === "ACCOUNTANT"
        ? accountantPermissions
        : technicianPermissions;
  function loadAssignment(property: number) {
    if (!existing.data) return;
    setProperties([property]);
    setArea(0);
    setPrimary(
      !!existing.data.assignments.find((a) => a.property_id === property)
        ?.is_primary,
    );
    if (row.role_code === "MANAGER")
      setCaps(
        existing.data.capabilities
          .filter((c) => c.property_id === property)
          .map((c) => c.capability),
      );
    else if (row.role_code === "ACCOUNTANT")
      setCaps(
        Object.keys(accountantPermissions).filter(
          (c) => existing.data.accountant?.[0]?.[c],
        ),
      );
    else {
      const tech = existing.data.technician?.find(
        (t) => t.property_id === property,
      );
      setCaps([
        ...(!tech || tech.can_update ? ["MAINTENANCE_UPDATE"] : []),
        ...(!tech || tech.can_record_cost ? ["MAINTENANCE_COST"] : []),
      ]);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!properties.length && !area) {
      setError("Chọn ít nhất một nhà trọ hoặc khu vực.");
      return;
    }
    if (
      !window.confirm(
        `Cập nhật quyền ${roleLabels[row.role_code]} tại các cơ sở đã chọn? Quyền cũ tại những cơ sở này sẽ được thay bằng lựa chọn đang hiển thị.${row.role_code === "ACCOUNTANT" ? " Quyền kế toán áp dụng trên toàn bộ cơ sở được giao cho tài khoản." : ""}`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await service.assign(row.id!, {
        role: row.role_code as StaffRole,
        propertyIds: properties,
        areaId: area || null,
        capabilities: caps,
        primary: primaryManager,
        reason: reason.trim(),
      });
      await onSaved();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountModal
      title={`Phân công · ${row.full_name}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="space-y-5" onSubmit={save}>
        <fieldset disabled={busy} className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {roleLabels[row.role_code]} · {row.email}. Các cơ sở không được chọn
            giữ nguyên phân công.
          </p>
          {existing.isPending && (
            <p role="status" className="text-sm">
              Đang tải quyền hiện tại...
            </p>
          )}
          {existing.isError && (
            <ErrorState
              message={apiErrorMessage(existing.error)}
              onRetry={() => void existing.refetch()}
            />
          )}
          {!!existing.data?.assignments.length && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                Nạp phân công hiện tại để chỉnh sửa
              </p>
              <div className="flex flex-wrap gap-2">
                {existing.data.assignments.map((a) => (
                  <button
                    type="button"
                    className={secondary}
                    key={a.property_id}
                    onClick={() => loadAssignment(a.property_id)}
                  >
                    {a.property_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <AccountField title="Phạm vi khu vực (danh sách cơ sở hiện tại)">
            <select
              className={input}
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
            >
              <option value="0">Chọn từng nhà trọ</option>
              {options.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </AccountField>
          <fieldset className="rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-bold">
              Một hoặc nhiều nhà trọ
            </legend>
            <div className="grid max-h-52 gap-3 overflow-y-auto sm:grid-cols-2">
              {options.properties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={properties.includes(p.id)}
                    onChange={(e) =>
                      setProperties(
                        e.target.checked
                          ? [...properties, p.id]
                          : properties.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
            {!options.properties.length && (
              <p className="text-sm text-muted-foreground">
                Chưa có nhà trọ. Tạo nhà trọ trước khi phân công.
              </p>
            )}
          </fieldset>
          <fieldset className="space-y-3 rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-bold">Quyền được cấp</legend>
            {row.role_code === "MANAGER" && (
              <p className="text-xs leading-5 text-muted-foreground">
                Phân công Manager bao gồm vận hành cơ bản. Các quyền tài chính,
                phê duyệt và xuất dữ liệu bên dưới cần cấp riêng.
              </p>
            )}
            {row.role_code === "ACCOUNTANT" && (
              <p className="text-xs leading-5 text-muted-foreground">
                Các quyền kế toán dùng cấu hình hồ sơ hiện có và áp dụng cho
                toàn bộ cơ sở được giao. Không thể thay đổi hồ sơ dùng chung với
                chủ sở hữu khác. Hoàn cọc không được cấp mặc định.
              </p>
            )}
            {row.role_code === "TECHNICIAN" && (
              <p className="text-xs leading-5 text-muted-foreground">
                Chỉ xem công việc được giao riêng trong cơ sở. Phân công cơ sở
                không tự động giao toàn bộ yêu cầu sửa chữa.
              </p>
            )}
            {Object.entries(labels).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={caps.includes(key)}
                  onChange={(e) =>
                    setCaps(
                      e.target.checked
                        ? [...caps, key]
                        : caps.filter((c) => c !== key),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          {row.role_code === "MANAGER" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={primaryManager}
                onChange={(e) => setPrimary(e.target.checked)}
              />
              Chỉ định phụ trách chính tại các cơ sở đã chọn
            </label>
          )}
          <AccountField title="Lý do phân công / thay đổi quyền">
            <textarea
              className={input}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
            />
          </AccountField>
          <div className="rounded-xl bg-accent p-4 text-sm text-link">
            <Building2 className="mb-2 size-5" />
            Xem trước:{" "}
            {properties
              .map((id) => options.properties.find((p) => p.id === id)?.name)
              .join(", ") || "Chưa chọn nhà trọ riêng"}
            {area
              ? ` · Toàn bộ cơ sở hiện có trong ${options.areas.find((a) => a.id === area)?.name}`
              : ""}
            . {caps.length} quyền bổ sung.
          </div>
          <button className={primary}>
            {busy ? "Đang lưu..." : "Xác nhận phân công"}
          </button>
        </fieldset>
      </form>
    </AccountModal>
  );
}

function InvitationDialog({
  row,
  onClose,
  onCreated,
}: {
  row: ManagedAccount | null;
  onClose: () => void;
  onCreated: (link: InvitationLink) => Promise<void>;
}) {
  const [role, setRole] = useState<AccountRole>(row ? "TENANT" : "MANAGER"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await service.invite({
        email: String(data.get("email")).trim(),
        fullName: String(data.get("name")).trim(),
        role,
        tenantProfileId: row?.profile_id ?? null,
        reason: String(data.get("reason")).trim(),
      });
      await onCreated(result);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountModal
      title={row ? "Mời kích hoạt tài khoản người thuê" : "Mời nhân sự"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-5">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <AccountField title="Họ tên">
            <input
              className={input}
              name="name"
              defaultValue={row?.full_name}
              required
              maxLength={150}
            />
          </AccountField>
          <AccountField title="Email nhận lời mời">
            <input
              className={input}
              name="email"
              type="email"
              defaultValue={row?.email ?? ""}
              required
              maxLength={255}
            />
          </AccountField>
          <AccountField title="Vai trò">
            <select
              className={input}
              value={role}
              disabled={!!row}
              onChange={(e) => setRole(e.target.value as AccountRole)}
            >
              {Object.entries(roleLabels)
                .filter(([key]) => (row ? key === "TENANT" : key !== "TENANT"))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </AccountField>
          <AccountField title="Lý do mời">
            <textarea
              className={input}
              name="reason"
              required
              maxLength={500}
            />
          </AccountField>
          <p className="text-sm leading-6 text-muted-foreground">
            Người nhận tự đặt mật khẩu qua liên kết một lần. Tài khoản đã tồn
            tại cần đăng nhập để chấp nhận; không tạo tài khoản trùng. Sau kích
            hoạt, bạn chọn cơ sở và quyền trong mục Phân công.
          </p>
          <button className={primary}>
            {busy ? "Đang tạo lời mời..." : "Tạo liên kết kích hoạt"}
          </button>
        </fieldset>
      </form>
    </AccountModal>
  );
}
