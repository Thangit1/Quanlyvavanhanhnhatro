"use client";

import Link from "next/link";
import { AccountsWorkspace } from "@/components/admin/accounts/accounts-page";
import { ownerAccountsService } from "@/services/owner-accounts.service";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyState,
  ErrorState,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import {
  organizationService,
  type ManagementArea,
  type OrganizationRelationship,
} from "@/services/organization.service";

const input = "w-full rounded-xl border border-input bg-card p-3 text-sm";
const button =
  "rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const panel = "space-y-4 rounded-2xl border border-border bg-card p-5";
function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm font-medium text-secondary-foreground">
      <span>{title}</span>
      {children}
    </label>
  );
}
function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

export function OrganizationManagementPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [selected, setSelected] = useState(0);
  const [linkProperty, setLinkProperty] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<
    "properties" | "areas" | "assignments" | "history"
  >("areas");
  const [editing, setEditing] = useState<ManagementArea | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const owner = user?.activeRole === "OWNER";
  const scope = ["organizations", user?.id, user?.activeRole];
  const list = useQuery({
    queryKey: scope,
    enabled: owner,
    queryFn: ({ signal }) => organizationService.list(signal),
  });
  const organization = list.data?.some((o) => o.id === selected)
    ? selected
    : (list.data?.[0]?.id ?? 0);
  const detail = useQuery({
    queryKey: [...scope, organization],
    enabled: owner && !!organization,
    queryFn: ({ signal }) => organizationService.detail(organization, signal),
  });
  const history = useQuery({
    queryKey: [...scope, organization, "history", page],
    enabled: owner && !!organization && tab === "history",
    queryFn: ({ signal }) =>
      organizationService.history(organization, page, signal),
  });
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await client.invalidateQueries({ queryKey: scope });
      setNotice(message);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveArea(event: FormEvent<HTMLFormElement>) {
    const data = values(event);
    await run(async () => {
      await organizationService.saveArea(organization, editing?.id ?? null, {
        code: text(data, "code"),
        name: text(data, "name"),
        description: text(data, "description"),
        status: text(data, "status") as "ACTIVE" | "INACTIVE",
        version: editing?.version ?? 0,
        reason: text(data, "reason"),
      });
      setEditing(null);
    }, "Đã lưu khu vực.");
  }
  async function link(event: FormEvent<HTMLFormElement>) {
    const data = values(event);
    const currentRelationship = detail.data?.relationships.find(
      (r) => !r.ended_at && r.property_id === Number(data.get("property")),
    );
    await run(
      () =>
        currentRelationship
          ? organizationService.move(organization, currentRelationship.id, {
              areaId: Number(data.get("area")) || null,
              version: currentRelationship.version,
              reason: text(data, "reason"),
            })
          : organizationService.link(organization, {
              propertyId: Number(data.get("property")),
              areaId: Number(data.get("area")) || null,
              agreementReference: text(data, "reference"),
              effectiveFrom: text(data, "start"),
              reason: text(data, "reason"),
            }),
      "Đã gán nhà trọ. Phân quyền hiện tại được giữ nguyên.",
    );
  }
  async function change(
    event: FormEvent<HTMLFormElement>,
    row: OrganizationRelationship,
  ) {
    const end =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "end";
    const data = values(event);
    if (
      !window.confirm(
        end
          ? `Kết thúc phân nhóm ${row.property_name} trong công ty này?`
          : `Chuyển khu vực cho ${row.property_name}?`,
      )
    )
      return;
    await run(
      () =>
        end
          ? organizationService.end(organization, row.id, {
              version: row.version,
              reason: text(data, "reason"),
            })
          : organizationService.move(organization, row.id, {
              areaId: Number(data.get("area")) || null,
              version: row.version,
              reason: text(data, "reason"),
            }),
      end
        ? "Đã kết thúc phân nhóm; lịch sử được giữ lại."
        : "Đã chuyển khu vực; quyền truy cập hiện tại được giữ nguyên.",
    );
  }
  const staffOptions = useQuery({
    queryKey: ["owner-account-options", user?.id, user?.activeRole],
    enabled: owner,
    queryFn: ({ signal }) => ownerAccountsService.options(signal),
    refetchInterval: 15000,
  });
  const areas = detail.data?.areas.filter((a) => a.status === "ACTIVE") ?? [];
  const linkOptions = [
    ...(detail.data?.availableProperties ?? []),
    ...(detail.data?.relationships
      .filter((r) => !r.ended_at)
      .map((r) => ({ id: r.property_id, name: r.property_name })) ?? []),
  ];
  const linkingExisting =
    detail.data?.relationships.some(
      (r) => !r.ended_at && r.property_id === linkProperty,
    ) ?? false;
  const relationships =
    detail.data?.relationships.filter((r) =>
      r.property_name
        .toLocaleLowerCase("vi")
        .includes(filter.toLocaleLowerCase("vi")),
    ) ?? [];
  const areaOptions = (
    <>
      <option value="">Quản lý trực tiếp, không thuộc khu vực</option>
      {areas.map((a) => (
        <option value={a.id} key={a.id}>
          {a.name}
        </option>
      ))}
    </>
  );
  return (
    <AdminShell
      title="Khu vực & Phân công"
      subtitle="Nhóm cơ sở vận hành và phân công người phụ trách"
    >
      {!owner ? (
        <EmptyState text="Chức năng này dành cho chủ sở hữu quản trị công ty." />
      ) : (
        <div className="space-y-6">
          {error && (
            <p role="alert" className="rounded-xl bg-danger-muted p-4 text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-xl bg-success-muted p-4 text-success"
            >
              {notice}
            </p>
          )}
          <header className={panel}>
            <h1 className="text-2xl font-extrabold text-foreground">
              Khu vực & Phân công
            </h1>
            <p className="text-sm text-muted-foreground">
              Quản lý nhà trọ theo nhóm vận hành và phân công nhân sự. Không bắt
              buộc tạo khu vực.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                className="text-sm font-semibold text-link"
                href="/admin/accounts"
              >
                Trung tâm Tài khoản & Nhân sự
              </Link>
              <Link
                className="text-sm font-semibold text-link"
                href="/admin/settings/organization"
              >
                Thông tin chủ sở hữu / Tổ chức
              </Link>
            </div>
          </header>
          {list.isSuccess && !list.data.length && (
            <section className={panel}>
              <h2 className="font-bold">Thiết lập khu vực lần đầu</h2>
              <p className="text-sm text-muted-foreground">
                Bạn có thể quản lý nhà trọ trực tiếp tại Nhà và phòng. Khi cần
                phân khu vực, thiết lập không gian cá nhân một lần; không cần
                khai báo công ty.
              </p>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setSelected(await organizationService.setup());
                  }, "Đã thiết lập không gian quản lý.")
                }
              >
                Bắt đầu quản lý khu vực
              </button>
            </section>
          )}
          {list.isPending && <p role="status">Đang tải công ty...</p>}
          {list.isError && (
            <ErrorState
              message={apiErrorMessage(list.error)}
              onRetry={() => void list.refetch()}
            />
          )}
          {!!list.data?.length && (
            <Field title="Không gian quản lý">
              <select
                className={input}
                value={organization}
                disabled={busy}
                onChange={(e) => {
                  setSelected(Number(e.target.value));
                  setLinkProperty(0);
                  setEditing(null);
                  setPage(0);
                  setFilter("");
                  setError("");
                  setNotice("");
                }}
              >
                {list.data.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.code})
                  </option>
                ))}
              </select>
            </Field>
          )}
          {!!organization && (
            <>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Nội dung công ty"
              >
                {(
                  [
                    ["areas", "Khu vực"],
                    ["properties", "Nhà trọ"],
                    ["assignments", "Phân công nhân sự"],
                    ["history", "Nhật ký quản trị"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                    className={
                      tab === key
                        ? button
                        : "rounded-xl border border-input px-4 py-2 text-sm"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {detail.isPending && (
                <p role="status">Đang tải dữ liệu công ty...</p>
              )}
              {detail.isError && (
                <ErrorState
                  message={apiErrorMessage(detail.error)}
                  onRetry={() => void detail.refetch()}
                />
              )}
              {detail.data && tab === "properties" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      [
                        "Nhà trọ đang vận hành",
                        detail.data.relationships.filter((r) => !r.ended_at)
                          .length,
                      ],
                      ["Khu vực hoạt động", areas.length],
                      [
                        "Kỳ quản lý đã kết thúc",
                        detail.data.relationships.filter((r) => !!r.ended_at)
                          .length,
                      ],
                    ].map(([label, count]) => (
                      <div key={label} className={panel}>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="text-3xl font-bold">{count}</p>
                      </div>
                    ))}
                  </div>
                  <section className={panel}>
                    <h2 className="font-bold">Gán nhà trọ vào khu vực</h2>
                    <p className="text-sm text-muted-foreground">
                      Chọn nhà trọ thuộc quyền quản trị của bạn. Có thể để trống
                      khu vực để quản lý trực tiếp. Việc phân nhóm không thay
                      đổi quyền nhân sự hay thông tin chủ sở hữu.
                    </p>
                    {linkOptions.length ? (
                      <form
                        onSubmit={link}
                        className="grid gap-4 md:grid-cols-2"
                      >
                        <fieldset disabled={busy} className="contents">
                          <Field title="Nhà trọ">
                            <select
                              className={input}
                              name="property"
                              required
                              value={linkProperty || ""}
                              onChange={(e) =>
                                setLinkProperty(Number(e.target.value))
                              }
                            >
                              <option value="">Chọn nhà trọ</option>
                              {linkOptions.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field title="Khu vực">
                            <select className={input} name="area">
                              {areaOptions}
                            </select>
                          </Field>
                          {!linkingExisting && (
                            <>
                              <Field title="Tham chiếu thỏa thuận quản lý">
                                <input
                                  className={input}
                                  name="reference"
                                  required
                                  maxLength={200}
                                />
                              </Field>
                              <Field title="Ngày bắt đầu vận hành">
                                <input
                                  className={input}
                                  name="start"
                                  type="date"
                                  required
                                />
                              </Field>
                            </>
                          )}
                          <Field title="Lý do gán">
                            <input
                              className={input}
                              name="reason"
                              required
                              maxLength={500}
                            />
                          </Field>
                          <div className="self-end">
                            <button className={button}>
                              Xác nhận gán nhà trọ
                            </button>
                          </div>
                        </fieldset>
                      </form>
                    ) : (
                      <EmptyState text="Không có nhà trọ chưa được gán. Bạn có thể tạo nhà trọ tại mục Nhà và phòng." />
                    )}
                  </section>
                  <section className={panel}>
                    <h2 className="font-bold">Nhà trọ chưa phân khu vực</h2>
                    <p className="text-sm text-secondary-foreground">
                      {[
                        ...detail.data.availableProperties.map((p) => p.name),
                        ...detail.data.relationships
                          .filter((r) => !r.ended_at && !r.area_id)
                          .map((r) => r.property_name),
                      ].join(", ") || "Tất cả nhà trọ đã được phân khu vực."}
                    </p>
                  </section>
                  <Field title="Tìm theo tên nhà trọ">
                    <input
                      className={input}
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </Field>
                  {!relationships.length && (
                    <EmptyState text="Không có nhà trọ phù hợp." />
                  )}
                  {relationships.map((r) => (
                    <section className={panel} key={`${r.id}-${r.version}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link
                          className="font-bold text-link"
                          href={`/admin/properties/${r.property_id}`}
                        >
                          {r.property_name}
                        </Link>
                        <StatusBadge
                          status={r.ended_at ? "INACTIVE" : "ACTIVE"}
                        />
                      </div>
                      <p className="text-sm text-secondary-foreground">
                        {r.area_name ?? "Quản lý trực tiếp"} · Thỏa thuận:{" "}
                        {r.agreement_reference} · Từ {r.effective_from}
                        {r.ended_at ? ` · Kết thúc ${r.ended_at}` : ""}
                      </p>
                      <p className="text-sm text-secondary-foreground">
                        Quản lý:{" "}
                        {staffOptions.data?.managerAssignments
                          .filter((m) => m.property_id === r.property_id)
                          .map(
                            (m) =>
                              m.full_name + (m.is_primary ? " (chính)" : ""),
                          )
                          .join(", ") || "Chưa phân công"}
                        .{" "}
                        <button
                          className="font-semibold text-link"
                          onClick={() => setTab("assignments")}
                        >
                          Phân công / thu hồi
                        </button>
                      </p>
                      {!r.ended_at && (
                        <form
                          onSubmit={(e) => void change(e, r)}
                          className="grid gap-3 md:grid-cols-2"
                        >
                          <fieldset disabled={busy} className="contents">
                            <Field title="Chuyển đến khu vực">
                              <select
                                className={input}
                                name="area"
                                defaultValue={r.area_id ?? ""}
                              >
                                {areaOptions}
                              </select>
                            </Field>
                            <Field title="Lý do thay đổi">
                              <input
                                className={input}
                                name="reason"
                                required
                                maxLength={500}
                              />
                            </Field>
                            <div className="flex flex-wrap gap-3">
                              <button className={button}>Chuyển khu vực</button>
                              <button
                                type="submit"
                                value="end"
                                className="rounded-xl border border-danger-border px-4 py-2 text-sm text-danger"
                              >
                                Kết thúc phân nhóm
                              </button>
                            </div>
                          </fieldset>
                        </form>
                      )}
                    </section>
                  ))}
                </>
              )}
              {detail.data && tab === "areas" && (
                <>
                  <form
                    onSubmit={saveArea}
                    className={panel}
                    key={editing?.id ?? "new"}
                  >
                    <fieldset disabled={busy} className="space-y-4">
                      <h2 className="font-bold">
                        {editing
                          ? `Sửa khu vực ${editing.name}`
                          : "Tạo khu vực vận hành"}
                      </h2>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field title="Mã khu vực">
                          <input
                            className={input}
                            name="code"
                            defaultValue={editing?.code}
                            required
                            maxLength={50}
                          />
                        </Field>
                        <Field title="Tên khu vực">
                          <input
                            className={input}
                            name="name"
                            defaultValue={editing?.name}
                            required
                            maxLength={150}
                          />
                        </Field>
                      </div>
                      <Field title="Mô tả">
                        <textarea
                          className={input}
                          name="description"
                          defaultValue={editing?.description ?? ""}
                          maxLength={1000}
                        />
                      </Field>
                      <Field title="Trạng thái">
                        <select
                          className={input}
                          name="status"
                          defaultValue={editing?.status ?? "ACTIVE"}
                        >
                          <option value="ACTIVE">Hoạt động</option>
                          <option value="INACTIVE">Ngừng sử dụng</option>
                        </select>
                      </Field>
                      <Field title="Lý do">
                        <input
                          className={input}
                          name="reason"
                          required
                          maxLength={500}
                        />
                      </Field>
                      <div className="flex gap-3">
                        <button className={button}>Lưu khu vực</button>
                        {editing && (
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                          >
                            Hủy chỉnh sửa
                          </button>
                        )}
                      </div>
                    </fieldset>
                  </form>
                  {!detail.data.areas.length && (
                    <EmptyState text="Chưa có khu vực. Công ty vẫn có thể quản lý nhà trọ trực tiếp." />
                  )}
                  {detail.data.areas.map((a) => (
                    <div
                      key={a.id}
                      className={`${panel} flex flex-wrap items-center justify-between gap-4`}
                    >
                      <div>
                        <h3 className="font-bold">
                          {a.name} ({a.code})
                        </h3>
                        <p className="mt-2 text-sm text-secondary-foreground">
                          {
                            detail.data.relationships.filter(
                              (r) => !r.ended_at && r.area_id === a.id,
                            ).length
                          }{" "}
                          nhà trọ · Quản lý:{" "}
                          {[
                            ...new Set(
                              staffOptions.data?.managerAssignments
                                .filter((m) => m.area_id === a.id)
                                .map((m) => m.full_name) ?? [],
                            ),
                          ].join(", ") || "Chưa phân công"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.description}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                      <button
                        disabled={busy}
                        className="text-sm font-semibold text-link"
                        onClick={() => setEditing(a)}
                      >
                        Chỉnh sửa
                      </button>
                    </div>
                  ))}
                </>
              )}
              {tab === "assignments" && <AccountsWorkspace embedded />}
              {tab === "history" && (
                <section className={panel}>
                  <h2 className="font-bold">Nhật ký quản trị</h2>
                  {history.isPending && (
                    <p role="status">Đang tải nhật ký...</p>
                  )}
                  {history.isError && (
                    <ErrorState
                      message={apiErrorMessage(history.error)}
                      onRetry={() => void history.refetch()}
                    />
                  )}
                  {history.data?.length === 0 && (
                    <EmptyState text="Chưa có nhật ký ở trang này." />
                  )}
                  {history.data?.map((row) => (
                    <article
                      key={row.id}
                      className="space-y-1 border-b border-border pb-3 text-sm"
                    >
                      <p className="font-semibold">{row.action}</p>
                      <p className="break-words text-secondary-foreground">{row.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.occurred_at} · Người thực hiện #
                        {row.actor_id ?? "Hệ thống"}
                      </p>
                    </article>
                  ))}
                  <div className="flex items-center gap-4">
                    <button
                      disabled={!page || history.isFetching}
                      onClick={() => setPage(page - 1)}
                    >
                      Trang trước
                    </button>
                    <span>Trang {page + 1}</span>
                    <button
                      disabled={
                        history.isFetching || history.data?.length !== 50
                      }
                      onClick={() => setPage(page + 1)}
                    >
                      Trang sau
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </AdminShell>
  );
}
