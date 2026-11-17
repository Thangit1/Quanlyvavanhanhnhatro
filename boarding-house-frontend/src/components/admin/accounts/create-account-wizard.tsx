"use client";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { AccountField, AccountModal } from "./account-ui";
import { ErrorState } from "@/components/shared/dashboard-ui";
import {
  accountProvisioningService as service,
  type ProvisionResult,
  type ProvisionRequest,
} from "@/services/account-provisioning.service";
import {
  roleLabels,
  accountantPermissions,
  technicianPermissions,
  type AccountRole,
} from "@/services/owner-accounts.service";
import { managerCapabilities } from "@/services/owner-access.service";
import { isValidVietnamPhone } from "@/lib/phone-validation";
import { apiErrorMessage } from "@/lib/api-error";
const input =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
const primary =
  "rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50";
const secondary =
  "rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-50";
const steps = [
  "Thông tin tài khoản",
  "Vai trò",
  "Phạm vi & hồ sơ",
  "Xác nhận tạo",
];

export function InitialCredentialDialog({
  result,
  onClose,
}: {
  result: ProvisionResult;
  onClose: () => void;
}) {
  const [notice, setNotice] = useState("");
  return (
    <AccountModal
      title={
        result.linkedExisting
          ? "Đã liên kết tài khoản"
          : "Tài khoản đã sẵn sàng thiết lập đăng nhập"
      }
      onClose={onClose}
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600">
          Tài khoản đã có trong danh sách.{" "}
          {result.roles.map((r) => roleLabels[r]).join(", ")}
        </p>
        <AccountField title="Đăng nhập bằng email hoặc số điện thoại">
          <input
            className={input}
            readOnly
            value={result.loginIdentifier ?? ""}
          />
        </AccountField>
        {result.initialPassword ? (
          <>
            <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Mật khẩu khởi tạo chỉ hiển thị lần này, hiệu lực{" "}
              {result.passwordExpiresInHours} giờ. Chuyển riêng qua kênh an toàn
              cho người nhận. Tài khoản phải đổi mật khẩu trước khi truy cập
              nghiệp vụ.
            </p>
            <AccountField title="Mật khẩu khởi tạo (chỉ một lần)">
              <input
                className={`${input} font-mono`}
                aria-label="Mật khẩu khởi tạo"
                readOnly
                value={result.initialPassword}
                autoComplete="off"
              />
            </AccountField>
            <button
              className={secondary}
              onClick={() =>
                void navigator.clipboard
                  .writeText(result.initialPassword!)
                  .then(() =>
                    setNotice("Đã sao chép. Chuyển riêng cho người nhận."),
                  )
                  .catch(() =>
                    setNotice("Chọn và sao chép mật khẩu trong ô phía trên."),
                  )
              }
            >
              Sao chép mật khẩu khởi tạo
            </button>
          </>
        ) : (
          <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            Giữ nguyên thông tin đăng nhập hiện tại. Người dùng đăng nhập lại để
            nhận vai trò hoặc phạm vi mới.
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-blue-700">
            {notice}
          </p>
        )}
        <button className={primary} onClick={onClose}>
          Đã lưu thông tin an toàn
        </button>
      </div>
    </AccountModal>
  );
}

export function CreateAccountWizard({
  profile,
  onClose,
  onCreated,
}: {
  profile?: {
    profile_id: number | null;
    full_name: string;
    phone: string | null;
    email: string | null;
  } | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const { user } = useAuth();
  const manager = user?.activeRole === "MANAGER";
  const query = useQuery({
    queryKey: ["account-provisioning-options", user?.id, user?.activeRole],
    queryFn: ({ signal }) => service.options(signal),
    enabled: !!user && ["OWNER", "MANAGER"].includes(user.activeRole),
  });
  const [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<ProvisionResult | null>(null),
    [search, setSearch] = useState("");
  const [data, setData] = useState<ProvisionRequest>({
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    roles: [manager || profile ? "TENANT" : "MANAGER"],
    initialStatus: "ACTIVE",
    propertyIds: [],
    areaId: null,
    managementPropertyId: null,
    tenantProfileId: profile?.profile_id ?? null,
    existingUserId: null,
    dateOfBirth: null,
    permissions: {},
    primary: false,
    identityConfirmed: false,
    reason: "",
  });
  function update<K extends keyof ProvisionRequest>(
    key: K,
    value: ProvisionRequest[K],
  ) {
    setData((old) => ({ ...old, [key]: value }));
    setError("");
  }
  function chooseAccount(id: number) {
    const existing = query.data?.existingAccounts.find((a) => a.id === id);
    setData((old) => ({
      ...old,
      existingUserId: id || null,
      fullName: existing?.full_name ?? "",
      phone: existing?.phone ?? "",
      email: existing?.email ?? "",
      tenantProfileId: null,
      identityConfirmed: false,
    }));
  }
  function chooseProfile(id: number) {
    const existing = query.data?.tenantProfiles.find((p) => p.id === id);
    if (!existing) {
      update("tenantProfileId", null);
      return;
    }
    setData((old) => ({
      ...old,
      tenantProfileId: id,
      fullName: existing.full_name,
      phone: existing.phone,
      email: existing.email ?? "",
      dateOfBirth: existing.date_of_birth,
      managementPropertyId: existing.property_id,
      existingUserId: existing.user_id ?? old.existingUserId,
      identityConfirmed: false,
    }));
  }
  function next(form: HTMLFormElement) {
    setError("");
    if (!form.reportValidity()) return;
    if (
      step === 0 &&
      (!data.fullName.trim() ||
        (!data.existingUserId && !isValidVietnamPhone(data.phone)))
    ) {
      setError("Nhập họ tên và số điện thoại Việt Nam hợp lệ.");
      return;
    }
    if (step === 1 && !data.roles.length) {
      setError("Chọn ít nhất một vai trò.");
      return;
    }
    if (step === 2 && data.tenantProfileId && !data.identityConfirmed) {
      setError("Xác nhận đã đối chiếu danh tính trước khi liên kết hồ sơ.");
      return;
    }
    if (
      step === 2 &&
      manager &&
      !data.tenantProfileId &&
      !data.managementPropertyId
    ) {
      setError("Chọn nhà trọ được giao cho hồ sơ người thuê.");
      return;
    }
    setStep(step + 1);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) {
      next(event.currentTarget);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await service.create({
        ...data,
        email: data.email?.trim() || null,
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        permissions: Object.fromEntries(
          Object.entries(data.permissions).filter(([role]) =>
            data.roles.includes(role as AccountRole),
          ),
        ),
      });
      setResult(response);
      await onCreated();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (result)
    return (
      <InitialCredentialDialog
        result={result}
        onClose={() => {
          setResult(null);
          onClose();
        }}
      />
    );
  const selectedProfile = query.data?.tenantProfiles.find(
    (p) => p.id === data.tenantProfileId,
  );
  const staffRoles = data.roles.filter((r) => r !== "TENANT");
  return (
    <AccountModal
      title="Tạo tài khoản trực tiếp"
      drawer
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="mb-6 grid grid-cols-4 gap-2">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`rounded-lg p-2 text-xs ${index === step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}
            aria-current={index === step ? "step" : undefined}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>
      {query.isPending ? (
        <p role="status">Đang tải phạm vi quản lý...</p>
      ) : query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            {step === 0 && (
              <>
                <AccountField title="Phương thức">
                  <select
                    className={input}
                    value={data.existingUserId ? "existing" : "new"}
                    onChange={(e) => {
                      if (e.target.value === "new") chooseAccount(0);
                      else {
                        const first = query.data?.existingAccounts[0];
                        if (first) chooseAccount(first.id);
                        else
                          setError(
                            "Chưa có tài khoản trong phạm vi để liên kết.",
                          );
                      }
                    }}
                  >
                    <option value="new">Tạo tài khoản mới</option>
                    <option value="existing">
                      Liên kết tài khoản đang quản lý
                    </option>
                  </select>
                </AccountField>
                {!!data.existingUserId && (
                  <>
                    <AccountField title="Tìm tài khoản trong phạm vi">
                      <input
                        className={input}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tên, email, số điện thoại..."
                      />
                    </AccountField>
                    <AccountField title="Tài khoản hiện có">
                      <select
                        className={input}
                        value={data.existingUserId}
                        onChange={(e) => chooseAccount(Number(e.target.value))}
                      >
                        {query.data?.existingAccounts
                          .filter((a) =>
                            `${a.full_name} ${a.email} ${a.phone}`
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                          )
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.full_name} · {a.phone ?? a.email}
                            </option>
                          ))}
                      </select>
                    </AccountField>
                    <p className="text-sm text-slate-500">
                      Liên kết không đặt lại mật khẩu hoặc đổi trạng thái hiện
                      tại. Tài khoản ngoài phạm vi quản trị cần quy trình xác
                      nhận phù hợp.
                    </p>
                  </>
                )}
                <AccountField title="Họ và tên">
                  <input
                    className={input}
                    name="fullName"
                    value={data.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    required
                    maxLength={150}
                    readOnly={!!data.existingUserId}
                  />
                </AccountField>
                <AccountField title="Số điện thoại đăng nhập">
                  <input
                    className={input}
                    name="phone"
                    type="tel"
                    value={data.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    required={!data.existingUserId}
                    maxLength={20}
                    readOnly={!!data.existingUserId}
                  />
                </AccountField>
                <AccountField title="Email (không bắt buộc)">
                  <input
                    className={input}
                    name="email"
                    type="email"
                    value={data.email ?? ""}
                    onChange={(e) => update("email", e.target.value)}
                    maxLength={255}
                    readOnly={!!data.existingUserId}
                  />
                </AccountField>
                {!data.existingUserId && (
                  <AccountField title="Trạng thái ban đầu">
                    <select
                      className={input}
                      value={data.initialStatus}
                      onChange={(e) =>
                        update(
                          "initialStatus",
                          e.target.value as "ACTIVE" | "INACTIVE",
                        )
                      }
                    >
                      <option value="ACTIVE">
                        Cho phép thiết lập đăng nhập
                      </option>
                      <option value="INACTIVE">Chưa kích hoạt</option>
                    </select>
                  </AccountField>
                )}
              </>
            )}
            {step === 1 && (
              <>
                <h3 className="font-bold">Một hoặc nhiều vai trò</h3>
                {query.data?.roles.map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={data.roles.includes(role)}
                      onChange={(e) =>
                        update(
                          "roles",
                          e.target.checked
                            ? [...data.roles, role]
                            : data.roles.filter((r) => r !== role),
                        )
                      }
                    />
                    {roleLabels[role]}
                  </label>
                ))}
                <p className="text-sm text-slate-500">
                  Vai trò quyết định cổng nghiệp vụ. Phạm vi và quyền thao tác
                  được chọn ở bước tiếp theo.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                {!!staffRoles.length && (
                  <>
                    <AccountField title="Khu vực (các cơ sở hiện tại)">
                      <select
                        className={input}
                        value={data.areaId ?? 0}
                        onChange={(e) =>
                          update("areaId", Number(e.target.value) || null)
                        }
                      >
                        <option value="0">
                          Chọn từng nhà trọ / phân công sau
                        </option>
                        {query.data?.areas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </AccountField>
                    <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
                      <legend className="px-1 text-sm font-bold">
                        Một hoặc nhiều nhà trọ
                      </legend>
                      {query.data?.properties.map((p) => (
                        <label
                          className="flex items-center gap-2 text-sm"
                          key={p.id}
                        >
                          <input
                            type="checkbox"
                            checked={data.propertyIds.includes(p.id)}
                            onChange={(e) =>
                              update(
                                "propertyIds",
                                e.target.checked
                                  ? [...data.propertyIds, p.id]
                                  : data.propertyIds.filter(
                                      (id) => id !== p.id,
                                    ),
                              )
                            }
                          />
                          {p.name}
                        </label>
                      ))}
                    </fieldset>
                    {staffRoles.map((role) => {
                      const labels: Record<string, string> =
                        role === "MANAGER"
                          ? managerCapabilities
                          : role === "ACCOUNTANT"
                            ? accountantPermissions
                            : technicianPermissions;
                      const enabled = data.permissions[role] ?? [];
                      return (
                        <fieldset
                          className="space-y-3 rounded-xl border border-slate-200 p-4"
                          key={role}
                        >
                          <legend className="px-1 text-sm font-bold">
                            {roleLabels[role]} · Quyền
                          </legend>
                          {role === "MANAGER" && (
                            <p className="text-xs text-slate-500">
                              Phân công gồm vận hành cơ bản; các quyền nhạy cảm
                              bên dưới cần cấp riêng.
                            </p>
                          )}
                          {role === "ACCOUNTANT" && (
                            <p className="text-xs text-slate-500">
                              Quyền hồ sơ kế toán áp dụng cho các cơ sở được
                              giao. Hoàn cọc mặc định tắt.
                            </p>
                          )}
                          {Object.entries(labels).map(([key, label]) => (
                            <label
                              className="flex items-start gap-2 text-sm"
                              key={key}
                            >
                              <input
                                className="mt-1"
                                type="checkbox"
                                checked={enabled.includes(key)}
                                onChange={(e) =>
                                  update("permissions", {
                                    ...data.permissions,
                                    [role]: e.target.checked
                                      ? [...enabled, key]
                                      : enabled.filter((c) => c !== key),
                                  })
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </fieldset>
                      );
                    })}
                    {data.roles.includes("MANAGER") && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={data.primary}
                          onChange={(e) => update("primary", e.target.checked)}
                        />
                        Phụ trách chính tại các cơ sở chọn
                      </label>
                    )}
                  </>
                )}
                {data.roles.includes("TENANT") && (
                  <>
                    <AccountField title="Hồ sơ người thuê">
                      <select
                        className={input}
                        value={data.tenantProfileId ?? 0}
                        onChange={(e) => chooseProfile(Number(e.target.value))}
                      >
                        <option value="0">Tạo hồ sơ mới, chưa cư trú</option>
                        {query.data?.tenantProfiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name} · {p.phone} ·{" "}
                            {p.property_name ?? "Chưa gán nhà trọ"}
                            {p.user_id ? " · Đã có tài khoản" : ""}
                          </option>
                        ))}
                      </select>
                    </AccountField>
                    {selectedProfile ? (
                      <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                        <p className="font-bold">{selectedProfile.full_name}</p>
                        <p>
                          {selectedProfile.phone} ·{" "}
                          {selectedProfile.email ?? "Chưa có email"}
                        </p>
                        <p>
                          {selectedProfile.property_name ?? "Chưa gán nhà trọ"}{" "}
                          · {selectedProfile.room_code ?? "Chưa có phòng"} ·{" "}
                          {selectedProfile.contract_code ?? "Chưa có hợp đồng"}
                        </p>
                        <label className="flex items-start gap-2">
                          <input
                            className="mt-1"
                            type="checkbox"
                            checked={data.identityConfirmed}
                            onChange={(e) =>
                              update("identityConfirmed", e.target.checked)
                            }
                          />
                          Tôi đã đối chiếu danh tính và thông tin liên hệ với hồ
                          sơ này.
                        </label>
                      </div>
                    ) : (
                      <>
                        <AccountField title="Nhà trọ quản lý hồ sơ (chưa tính cư trú)">
                          <select
                            className={input}
                            value={data.managementPropertyId ?? 0}
                            required={manager}
                            onChange={(e) =>
                              update(
                                "managementPropertyId",
                                Number(e.target.value) || null,
                              )
                            }
                          >
                            <option value={manager ? "" : 0}>
                              Chưa gán nhà trọ
                            </option>
                            {query.data?.properties.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </AccountField>
                        <AccountField title="Ngày sinh (nếu có)">
                          <input
                            className={input}
                            type="date"
                            value={data.dateOfBirth ?? ""}
                            onChange={(e) =>
                              update("dateOfBirth", e.target.value || null)
                            }
                          />
                        </AccountField>
                      </>
                    )}
                    <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                      Tạo login và hồ sơ không tạo hợp đồng, đặt phòng hoặc ghi
                      nhận đang cư trú.
                    </p>
                  </>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <h3 className="font-bold">Xem trước tài khoản</h3>
                <dl className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Họ tên / Đăng nhập</dt>
                    <dd className="font-semibold">
                      {data.fullName} · {data.email || data.phone}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Vai trò</dt>
                    <dd>{data.roles.map((r) => roleLabels[r]).join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Phạm vi</dt>
                    <dd>
                      {data.propertyIds
                        .map(
                          (id) =>
                            query.data?.properties.find((p) => p.id === id)
                              ?.name,
                        )
                        .join(", ") || "Chưa phân công cơ sở riêng"}
                      {data.areaId
                        ? ` · ${query.data?.areas.find((a) => a.id === data.areaId)?.name}`
                        : ""}
                    </dd>
                  </div>
                  {data.roles.includes("TENANT") && (
                    <div>
                      <dt className="text-slate-500">Hồ sơ</dt>
                      <dd>
                        {selectedProfile?.full_name ?? "Hồ sơ mới, chưa cư trú"}
                      </dd>
                    </div>
                  )}
                </dl>
                <AccountField title="Lý do tạo / liên kết tài khoản">
                  <textarea
                    className={input}
                    name="reason"
                    value={data.reason}
                    onChange={(e) => update("reason", e.target.value)}
                    required
                    maxLength={500}
                  />
                </AccountField>
                <p className="text-sm leading-6 text-slate-600">
                  {data.existingUserId
                    ? "Giữ nguyên mật khẩu và lịch sử của tài khoản hiện tại."
                    : "Hệ thống sinh mật khẩu khởi tạo riêng, hiển thị một lần sau khi tạo và bắt buộc đổi ở lần đăng nhập đầu tiên."}
                </p>
              </>
            )}
            <div className="flex items-center justify-between gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  className={secondary}
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  Quay lại
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className={primary}>
                {busy
                  ? "Đang xử lý..."
                  : step === 3
                    ? data.existingUserId
                      ? "Liên kết và phân công"
                      : "Tạo tài khoản"
                    : "Tiếp tục"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </AccountModal>
  );
}

export function EditAccountDialog({
  account,
  onClose,
  onSaved,
}: {
  account: {
    id: number;
    full_name: string;
    phone: string | null;
    email: string | null;
  };
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await service.edit(account.id, {
        fullName: String(data.get("fullName")).trim(),
        phone: String(data.get("phone")).trim(),
        email: String(data.get("email")).trim() || null,
        reason: String(data.get("reason")).trim(),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AccountModal
      title="Chỉnh sửa thông tin tài khoản"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-5">
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <AccountField title="Họ tên">
            <input
              className={input}
              name="fullName"
              defaultValue={account.full_name}
              required
              maxLength={150}
            />
          </AccountField>
          <AccountField title="Điện thoại">
            <input
              className={input}
              name="phone"
              type="tel"
              defaultValue={account.phone ?? ""}
              maxLength={20}
            />
          </AccountField>
          <AccountField title="Email">
            <input
              className={input}
              name="email"
              type="email"
              defaultValue={account.email ?? ""}
              maxLength={255}
            />
          </AccountField>
          <AccountField title="Lý do chỉnh sửa">
            <textarea
              className={input}
              name="reason"
              required
              maxLength={500}
            />
          </AccountField>
          <button className={primary}>
            {busy ? "Đang lưu..." : "Lưu thông tin"}
          </button>
        </fieldset>
      </form>
    </AccountModal>
  );
}
