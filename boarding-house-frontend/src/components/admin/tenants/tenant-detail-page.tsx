"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  LogOut,
  MapPinHouse,
  Pencil,
  Phone,
  RefreshCw,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  EmptyState,
  ErrorState,
  PageLoading,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import {
  useAdminTenant,
  useAdminTenants,
  useTenantMutations,
} from "@/hooks/use-admin-tenants";
import { adminTenantService } from "@/services/admin-tenant.service";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";

const tabs = [
  "Tổng quan",
  "Hợp đồng",
  "Hóa đơn",
  "Thanh toán",
  "Điện & nước",
  "Thành viên",
  "Yêu cầu hỗ trợ",
  "Lịch sử cư trú",
  "Tạm trú",
  "Giấy tờ",
  "Hoạt động",
] as const;
type Action = "transfer" | "moveout" | "temporary" | "account" | null;

export function TenantDetailPage({ tenantId }: { tenantId: number }) {
  const { user } = useAuth();
  const query = useAdminTenant(tenantId);
  const options = useAdminTenants({ size: 10 });
  const mutations = useTenantMutations(tenantId);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Tổng quan");
  const [action, setAction] = useState<Action>(null);
  const canWrite =
    user?.activeRole === "OWNER" || user?.activeRole === "MANAGER";
  if (query.isLoading) return <PageLoading />;
  if (query.isError || !query.data)
    return (
      <AdminShell title="Hồ sơ người thuê" readOnly>
        <ErrorState onRetry={() => void query.refetch()} />
      </AdminShell>
    );
  const d = query.data;
  const current = d.residences.find((r) => r.status === "ACTIVE");
  const currentContract = d.contracts.find((item) =>
    ["ACTIVE", "EXPIRING", "PENDING_CONFIRMATION"].includes(item.status),
  );
  const latestInvoice = d.invoices[0];
  const latestRequest = d.maintenanceRequests[0];
  return (
    <AdminShell
      title={d.fullName}
      subtitle={`${d.tenantCode} · Hồ sơ người thuê`}
      readOnly
    >
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/tenants"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"
          >
            <ArrowLeft className="size-4" />
            Danh sách người thuê
          </Link>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              {d.status === "ACTIVE" && (
                <button
                  onClick={() => setAction("transfer")}
                  className={outlineButton}
                >
                  <RefreshCw className="size-4" /> Chuyển phòng
                </button>
              )}
              <button
                onClick={() => setAction("temporary")}
                className={outlineButton}
              >
                <MapPinHouse className="size-4" />
                Cập nhật tạm trú
              </button>
              {["ACTIVE", "NOTICE"].includes(d.status) && currentContract && (
                <Link
                  href="/admin/rental-lifecycle"
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                >
                  <LogOut className="size-4" /> Thực hiện trả phòng
                </Link>
              )}
              {d.status === "PENDING" && (
                <Link href="/admin/rental-lifecycle" className={outlineButton}>
                  Thực hiện nhận phòng
                </Link>
              )}
              <Link
                href={`/admin/tenants/${tenantId}/edit`}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
              >
                <Pencil className="size-4" />
                Chỉnh sửa
              </Link>
            </div>
          )}
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-20 place-items-center rounded-2xl bg-blue-100 text-blue-700">
              <UserRound className="size-10" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-extrabold text-slate-900">
                  {d.fullName}
                </h1>
                <StatusBadge status={d.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-4" />
                  {d.phone}
                </span>
                <span>{d.email ?? "Chưa có email"}</span>
                <span>
                  {current
                    ? `${current.propertyName} · Phòng ${current.roomCode ?? "—"}`
                    : "Không có lượt cư trú hiện tại"}
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <p className="text-slate-500">Tài khoản</p>
              <div className="mt-1 flex items-center gap-2">
                {d.hasAccount ? (
                  <StatusBadge status={d.accountStatus ?? "ACTIVE"} />
                ) : (
                  <span className="font-semibold text-slate-600">Chưa tạo</span>
                )}
                {canWrite && (
                  <button
                    onClick={() => setAction("account")}
                    className="font-semibold text-blue-700"
                  >
                    {d.hasAccount ? "Quản lý" : "Tạo ngay"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
          <nav className="flex min-w-max gap-1">
            {tabs.map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${tab === item ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {tab === "Tổng quan" && (
            <div className="space-y-6">
              {currentContract && currentContract.daysToExpiry <= 30 && (
                <div
                  className={`rounded-xl border p-4 text-sm font-semibold ${currentContract.daysToExpiry < 0 ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
                >
                  {currentContract.daysToExpiry < 0
                    ? "Hợp đồng đã hết hạn"
                    : `Hợp đồng sẽ hết hạn sau ${currentContract.daysToExpiry} ngày`}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MoneyCard
                  label="Tổng hóa đơn"
                  value={d.financial.totalInvoiced}
                />
                <MoneyCard
                  label="Đã thanh toán"
                  value={d.financial.totalPaid}
                  tone="success"
                />
                <MoneyCard
                  label="Còn phải thu"
                  value={d.financial.outstandingDebt}
                  tone="danger"
                />
                <MoneyCard
                  label="Nợ quá hạn"
                  value={d.financial.overdueDebt}
                  tone="danger"
                />
                <MoneyCard
                  label="Tiền cọc đang giữ"
                  value={d.financial.depositHeld}
                />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Thông tin cá nhân">
                  <Info label="Mã người thuê" value={d.tenantCode} />
                  <Info label="Ngày sinh" value={formatDate(d.dateOfBirth)} />
                  <Info label="Giới tính" value={d.gender} />
                  <Info label="Nghề nghiệp" value={d.occupation} />
                  <Info label="Nơi làm việc" value={d.workplace} />
                  <Info label="Thường trú" value={d.permanentAddress} />
                  <Info label="Quê quán" value={d.hometown} />
                </Panel>
                <Panel title="Định danh & liên hệ">
                  <Info
                    label={d.identityType ?? "Giấy tờ"}
                    value={d.maskedIdentityNumber}
                  />
                  <Info
                    label="Ngày cấp"
                    value={formatDate(d.identityIssuedDate)}
                  />
                  <Info label="Nơi cấp" value={d.identityIssuedPlace} />
                  <Info
                    label="Liên hệ khẩn cấp"
                    value={[d.emergencyContactName, d.emergencyContactPhone]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <Info label="Ghi chú" value={d.note} />
                </Panel>
                <Panel title="Phòng hiện tại">
                  <Info label="Tòa nhà" value={current?.propertyName} />
                  <Info
                    label="Phòng"
                    value={
                      current?.roomCode ? `Phòng ${current.roomCode}` : null
                    }
                  />
                  <Info
                    label="Ngày vào ở"
                    value={formatDate(current?.moveInDate)}
                  />
                  <Info label="Vai trò" value={current?.residenceRole} />
                </Panel>
                <Panel title="Hợp đồng hiện tại">
                  <Info label="Mã hợp đồng" value={currentContract?.code} />
                  <Info
                    label="Thời hạn"
                    value={
                      currentContract
                        ? `${formatDate(currentContract.startDate)} → ${formatDate(currentContract.endDate)}`
                        : null
                    }
                  />
                  <Info
                    label="Giá thuê"
                    value={
                      currentContract
                        ? formatCurrency(currentContract.monthlyRent)
                        : null
                    }
                  />
                  <Info
                    label="Tiền cọc"
                    value={
                      currentContract
                        ? formatCurrency(currentContract.depositAmount)
                        : null
                    }
                  />
                </Panel>
                <Panel title="Hóa đơn gần nhất">
                  <Info
                    label="Kỳ hóa đơn"
                    value={formatDate(latestInvoice?.billingPeriod)}
                  />
                  <Info
                    label="Tổng tiền"
                    value={
                      latestInvoice
                        ? formatCurrency(latestInvoice.totalAmount)
                        : null
                    }
                  />
                  <Info
                    label="Hạn thanh toán"
                    value={formatDate(latestInvoice?.dueDate)}
                  />
                  <Info label="Trạng thái" value={latestInvoice?.status} />
                </Panel>
                <Panel title="Yêu cầu hỗ trợ">
                  <Info
                    label="Ticket đang mở"
                    value={String(
                      d.maintenanceRequests.filter(
                        (item) =>
                          !["RESOLVED", "CLOSED", "CANCELLED"].includes(
                            item.status,
                          ),
                      ).length,
                    )}
                  />
                  <Info
                    label="Ticket gần nhất"
                    value={
                      latestRequest
                        ? `${latestRequest.code} · ${latestRequest.title}`
                        : null
                    }
                  />
                  <Info label="Trạng thái" value={latestRequest?.status} />
                </Panel>
              </div>
            </div>
          )}
          {tab === "Lịch sử cư trú" && (
            <ListOrEmpty items={d.residences} empty="Chưa có lịch sử cư trú">
              {d.residences.map((item) => (
                <Card
                  key={item.id}
                  title={`${item.propertyName} · Phòng ${item.roomCode ?? "—"}`}
                  status={item.status}
                >
                  <p>
                    {item.residenceRole} · {formatDate(item.moveInDate)} →{" "}
                    {item.moveOutDate
                      ? formatDate(item.moveOutDate)
                      : "Hiện tại"}
                  </p>
                  {item.contractCode && <p>Hợp đồng {item.contractCode}</p>}
                </Card>
              ))}
            </ListOrEmpty>
          )}
          {tab === "Hợp đồng" && (
            <ListOrEmpty items={d.contracts} empty="Chưa có hợp đồng">
              {d.contracts.map((item) => (
                <Card key={item.id} title={item.code} status={item.status}>
                  <p>
                    {item.propertyName} · Phòng {item.roomCode}
                  </p>
                  <p>
                    {formatDate(item.startDate)} → {formatDate(item.endDate)}
                  </p>
                  <p>
                    Giá thuê: {formatCurrency(item.monthlyRent)} · Đặt cọc:{" "}
                    {formatCurrency(item.depositAmount)}
                  </p>
                  <p>
                    Chu kỳ {item.paymentCycle} · Công nợ:{" "}
                    <strong
                      className={item.outstandingDebt > 0 ? "text-red-600" : ""}
                    >
                      {formatCurrency(item.outstandingDebt)}
                    </strong>
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Link
                      href={`/admin/contracts/${item.id}`}
                      className="font-semibold text-blue-700"
                    >
                      Xem hợp đồng
                    </Link>
                    {["ACTIVE", "EXPIRING"].includes(item.status) && (
                      <Link
                        href={`/admin/contracts/${item.id}`}
                        className="font-semibold text-amber-700"
                      >
                        Gia hạn
                      </Link>
                    )}
                  </div>
                </Card>
              ))}
            </ListOrEmpty>
          )}
          {tab === "Hóa đơn" && (
            <ListOrEmpty items={d.invoices} empty="Chưa có hóa đơn">
              {d.invoices.map((item) => (
                <Card key={item.id} title={item.code} status={item.status}>
                  <p>
                    Kỳ {formatDate(item.billingPeriod)} · Hạn{" "}
                    {formatDate(item.dueDate)}
                  </p>
                  <p>
                    {formatCurrency(item.paidAmount)} /{" "}
                    {formatCurrency(item.totalAmount)}
                  </p>
                  <p>
                    Tiền phòng {formatCurrency(item.roomAmount)} · Dịch vụ/phát
                    sinh {formatCurrency(item.serviceAmount)}
                  </p>
                  <Link
                    href={`/admin/invoices/${item.id}`}
                    className="inline-block pt-2 font-semibold text-blue-700"
                  >
                    Xem chi tiết
                  </Link>
                </Card>
              ))}
            </ListOrEmpty>
          )}
          {tab === "Thanh toán" && (
            <ListOrEmpty
              items={d.payments}
              empty="Chưa có giao dịch thanh toán"
            >
              {d.payments.map((item) => (
                <Card
                  key={item.id}
                  title={item.receiptCode}
                  status={item.status}
                >
                  <p>Ngày thanh toán: {formatDate(item.paidAt)}</p>
                  <p>
                    Hóa đơn {item.invoiceCode} · {item.paymentMethod}
                  </p>
                  <p className="font-bold text-emerald-700">
                    {formatCurrency(item.amount)}
                  </p>
                  {item.referenceCode && (
                    <p>Mã giao dịch: {item.referenceCode}</p>
                  )}
                </Card>
              ))}
            </ListOrEmpty>
          )}
          {tab === "Điện & nước" && (
            <ListOrEmpty
              items={d.utilityReadings}
              empty="Chưa có dữ liệu điện nước"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Tháng</th>
                      <th>Điện cũ</th>
                      <th>Điện mới</th>
                      <th>Tiêu thụ</th>
                      <th>Nước cũ</th>
                      <th>Nước mới</th>
                      <th>Tiêu thụ</th>
                      <th>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.utilityReadings.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-3 font-semibold">
                          {formatDate(item.billingPeriod)}
                        </td>
                        <td>{item.electricityPrevious ?? "—"}</td>
                        <td>{item.electricityCurrent ?? "—"}</td>
                        <td>{item.electricityConsumption}</td>
                        <td>{item.waterPrevious ?? "—"}</td>
                        <td>{item.waterCurrent ?? "—"}</td>
                        <td>{item.waterConsumption}</td>
                        <td>
                          {formatCurrency(
                            (item.electricityAmount ?? 0) +
                              (item.waterAmount ?? 0),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ListOrEmpty>
          )}
          {tab === "Thành viên" && (
            <div className="space-y-4">
              <ListOrEmpty items={d.coResidents} empty="Chưa có người ở cùng">
                {d.coResidents.map((item) => (
                  <Card
                    key={item.id}
                    title={item.fullName}
                    status={item.status}
                  >
                    <p>
                      {item.phone} ·{" "}
                      {item.relationship ?? "Chưa khai báo quan hệ"}
                    </p>
                    <p>
                      {item.residenceRole} · Vào ở {formatDate(item.moveInDate)}
                    </p>
                    <Link
                      href={`/admin/tenants/${item.id}`}
                      className="font-semibold text-blue-700"
                    >
                      Xem hồ sơ
                    </Link>
                  </Card>
                ))}
              </ListOrEmpty>
              <Link href="/admin/rental-lifecycle" className={outlineButton}>
                Quản lý nhận phòng / thành viên
              </Link>
            </div>
          )}
          {tab === "Yêu cầu hỗ trợ" && (
            <ListOrEmpty
              items={d.maintenanceRequests}
              empty="Chưa có yêu cầu hỗ trợ"
            >
              {d.maintenanceRequests.map((item) => (
                <Card
                  key={item.id}
                  title={`${item.code} · ${item.title}`}
                  status={item.status}
                >
                  <p>
                    {item.issueType} · Mức độ {item.priority}
                  </p>
                  <p>Tạo lúc {formatDate(item.createdAt)}</p>
                  <Link
                    href={`/admin/maintenance/${item.id}`}
                    className="font-semibold text-blue-700"
                  >
                    Xem ticket
                  </Link>
                </Card>
              ))}
            </ListOrEmpty>
          )}
          {tab === "Tạm trú" && (
            <ListOrEmpty
              items={d.temporaryResidences}
              empty="Chưa khai báo tạm trú"
            >
              {d.temporaryResidences.map((item) => (
                <Card
                  key={item.propertyId}
                  title={item.propertyName}
                  status={item.status}
                >
                  <p>
                    Mã: {item.registrationCode ?? "—"} · Đăng ký{" "}
                    {formatDate(item.registeredAt)} · Hết hạn{" "}
                    {formatDate(item.expiresAt)}
                  </p>
                  <p>{item.note}</p>
                </Card>
              ))}
            </ListOrEmpty>
          )}
          {tab === "Giấy tờ" && (
            <Documents
              tenantId={tenantId}
              documents={d.documents}
              canWrite={canWrite}
              upload={mutations.upload.mutateAsync}
            />
          )}
          {tab === "Hoạt động" && (
            <ListOrEmpty items={d.activities} empty="Chưa có hoạt động">
              {d.activities.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 border-b border-slate-100 py-3 last:border-0"
                >
                  <span className="mt-1 size-2 rounded-full bg-blue-600" />
                  <div>
                    <p className="font-semibold text-slate-800">
                      {item.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.actorName ?? "Hệ thống"} ·{" "}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </ListOrEmpty>
          )}
        </section>
      </div>
      {action && (
        <ActionDialog
          action={action}
          tenant={d}
          rooms={options.data?.rooms ?? []}
          properties={options.data?.properties ?? []}
          onClose={() => setAction(null)}
          mutations={mutations}
        />
      )}
    </AdminShell>
  );
}

function ActionDialog({
  action,
  tenant,
  rooms,
  properties,
  onClose,
  mutations,
}: {
  action: Exclude<Action, null>;
  tenant: ReturnType<typeof useAdminTenant>["data"];
  rooms: NonNullable<ReturnType<typeof useAdminTenants>["data"]>["rooms"];
  properties: NonNullable<
    ReturnType<typeof useAdminTenants>["data"]
  >["properties"];
  onClose: () => void;
  mutations: ReturnType<typeof useTenantMutations>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!tenant) return null;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      if (action === "transfer")
        await mutations.transfer.mutateAsync({
          toRoomId: Number(data.get("toRoomId")),
          transferDate: String(data.get("date")),
          reason: String(data.get("reason") ?? ""),
        });
      if (action === "moveout")
        await mutations.moveOut.mutateAsync({
          moveOutDate: String(data.get("date")),
          reason: String(data.get("reason") ?? ""),
          closeContract: data.get("closeContract") === "on",
        });
      if (action === "temporary")
        await mutations.temporary.mutateAsync({
          propertyId: Number(data.get("propertyId")),
          registrationCode: String(data.get("code") ?? ""),
          registeredAt: String(data.get("registeredAt") ?? ""),
          expiresAt: String(data.get("expiresAt") ?? ""),
          status: String(data.get("status")),
          note: String(data.get("reason") ?? ""),
        });
      if (action === "account") {
        if (!tenant.hasAccount)
          await mutations.account.mutateAsync({
            email: String(data.get("email")),
            temporaryPassword: String(data.get("password")),
          });
        else
          await mutations.accountStatus.mutateAsync(
            String(data.get("status")) as "ACTIVE" | "LOCKED" | "INACTIVE",
          );
      }
      onClose();
    } catch {
      setError(
        "Thao tác không thành công. Vui lòng kiểm tra dữ liệu và thử lại.",
      );
    } finally {
      setBusy(false);
    }
  };
  const titles = {
    transfer: "Chuyển phòng",
    moveout: "Xác nhận rời phòng",
    temporary: "Cập nhật tạm trú",
    account: "Quản lý tài khoản",
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex justify-between gap-3">
          <h2 className="text-lg font-bold">{titles[action]}</h2>
          <button onClick={onClose} aria-label="Đóng">
            <X />
          </button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {action === "transfer" && (
            <>
              <Field label="Phòng chuyển đến">
                <select name="toRoomId" required className={inputClass}>
                  <option value="">Chọn phòng</option>
                  {rooms
                    .filter((r) => ["VACANT", "RESERVED"].includes(r.status))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Phòng {r.code} ·{" "}
                        {properties.find((p) => p.id === r.propertyId)?.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Ngày chuyển">
                <input
                  name="date"
                  type="date"
                  defaultValue={today}
                  required
                  className={inputClass}
                />
              </Field>
            </>
          )}
          {action === "moveout" && (
            <>
              <Field label="Ngày rời phòng">
                <input
                  name="date"
                  type="date"
                  defaultValue={today}
                  required
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input name="closeContract" type="checkbox" />
                Đồng thời kết thúc hợp đồng hiện tại
              </label>
            </>
          )}
          {action === "temporary" && (
            <>
              <Field label="Nhà trọ">
                <select name="propertyId" required className={inputClass}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Trạng thái">
                <select name="status" className={inputClass}>
                  <option value="REGISTERED">Đã đăng ký</option>
                  <option value="PENDING">Đang xử lý</option>
                  <option value="NOT_DECLARED">Chưa khai báo</option>
                  <option value="EXPIRED">Hết hạn</option>
                </select>
              </Field>
              <Field label="Mã đăng ký">
                <input name="code" className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày đăng ký">
                  <input
                    name="registeredAt"
                    type="date"
                    className={inputClass}
                  />
                </Field>
                <Field label="Ngày hết hạn">
                  <input name="expiresAt" type="date" className={inputClass} />
                </Field>
              </div>
            </>
          )}
          {action === "account" &&
            (tenant.hasAccount ? (
              <Field label="Trạng thái tài khoản">
                <select
                  name="status"
                  defaultValue={tenant.accountStatus ?? "ACTIVE"}
                  className={inputClass}
                >
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="LOCKED">Khóa</option>
                  <option value="INACTIVE">Ngừng hoạt động</option>
                </select>
              </Field>
            ) : (
              <>
                <Field label="Email đăng nhập">
                  <input
                    name="email"
                    type="email"
                    defaultValue={tenant.email ?? ""}
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Mật khẩu tạm thời">
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    required
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs font-normal text-slate-500">
                    Tối thiểu 8 ký tự, có chữ hoa, chữ thường và số. Mật khẩu
                    được lưu bằng BCrypt.
                  </p>
                </Field>
              </>
            ))}
          {action !== "account" && (
            <Field label="Ghi chú / lý do">
              <textarea name="reason" className={`${inputClass} min-h-20`} />
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={outlineButton}>
              Hủy
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Đang xử lý..." : "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Documents({
  tenantId,
  documents,
  canWrite,
  upload,
}: {
  tenantId: number;
  documents: {
    id: number;
    documentType: string;
    originalName: string;
    fileSize: number;
    uploadedAt: string;
  }[];
  canWrite: boolean;
  upload: (value: { type: string; file: File }) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      {canWrite && (
        <label className="mb-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-5 font-semibold text-blue-700">
          <Upload className="size-5" />
          Tải PDF/JPG/PNG (tối đa 5 MB)
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                await upload({ type: "IDENTITY", file });
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      <ListOrEmpty items={documents} empty="Chưa có giấy tờ">
        {documents.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-slate-100 py-3"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{item.originalName}</p>
              <p className="text-xs text-slate-500">
                {item.documentType} · {(item.fileSize / 1024).toFixed(1)} KB ·{" "}
                {formatDate(item.uploadedAt)}
              </p>
            </div>
            <button
              aria-label="Tải xuống"
              onClick={() =>
                void adminTenantService.downloadDocument(
                  tenantId,
                  item.id,
                  item.originalName,
                )
              }
              className="grid size-9 place-items-center rounded-lg border"
            >
              <Download className="size-4" />
            </button>
          </div>
        ))}
      </ListOrEmpty>
    </div>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-4 font-bold text-slate-900">{title}</h2>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}
function MoneyCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-red-700"
      : tone === "success"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-lg font-extrabold ${color}`}>
        {formatCurrency(value)}
      </p>
    </article>
  );
}
function Info({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="grid gap-1 border-b border-slate-100 pb-3 sm:grid-cols-[150px_1fr]">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800">{value || "—"}</dd>
    </div>
  );
}
function Card({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex justify-between gap-3">
        <h3 className="font-bold">{title}</h3>
        <StatusBadge status={status} />
      </div>
      <div className="mt-2 space-y-1 text-sm text-slate-600">{children}</div>
    </article>
  );
}
function ListOrEmpty<T>({
  items,
  empty,
  children,
}: {
  items: T[];
  empty: string;
  children: React.ReactNode;
}) {
  return items.length ? (
    <div className="grid gap-3">{children}</div>
  ) : (
    <EmptyState text={empty} />
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500";
const outlineButton =
  "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700";
