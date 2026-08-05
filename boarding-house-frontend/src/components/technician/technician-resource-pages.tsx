"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  CalendarDays,
  KeyRound,
  PackageCheck,
  ShieldAlert,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  useEmergencyTasks,
  useMaterialRequests,
  usePreventivePlans,
  useTechnicianAccount,
  useTechnicianAsset,
  useTechnicianAssets,
  useTechnicianCalendar,
  useTechnicianMaterials,
  useTechnicianNotifications,
  useTechnicianPerformance,
  useAccountMutations,
} from "@/hooks/use-technician";
import { technicianService } from "@/services/technician.service";
import { apiErrorMessage } from "@/lib/api-error";
import {
  Empty,
  ErrorState,
  formatDate,
  formatMoney,
  Loading,
  Page,
  StatusBadge,
  TaskCard,
} from "@/components/technician/technician-ui";

export function CalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const [year, m] = month.split("-").map(Number),
    from = `${month}-01`,
    to = new Date(year, m, 0).toISOString().slice(0, 10);
  const q = useTechnicianCalendar(from, to);
  return (
    <Page
      title="Lịch làm việc"
      description="Lịch tháng của các công việc được giao."
      actions={
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3"
        />
      }
    >
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="grid gap-3">
          {q.data.map((x) => (
            <Link
              key={x.id}
              href={`/technician/tasks/${x.id}`}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[160px_1fr_auto]"
            >
              <p className="text-sm font-semibold text-blue-700">
                {formatDate(x.start)}
              </p>
              <div>
                <p className="font-bold">{x.title}</p>
                <p className="text-sm text-slate-500">
                  {x.propertyName}
                  {x.roomCode ? ` · ${x.roomCode}` : ""}
                </p>
              </div>
              <StatusBadge status={x.status} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Tháng này chưa có lịch" />
      )}
    </Page>
  );
}

export function EmergencyPage() {
  const q = useEmergencyTasks();
  return (
    <Page
      title="Điều phối khẩn cấp"
      description="Ưu tiên an toàn, đánh giá rủi ro và liên hệ quản lý theo quy trình."
    >
      <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        <p className="flex items-center gap-2 font-bold">
          <ShieldAlert className="size-5" />
          Quy trình an toàn
        </p>
        <p className="mt-1">
          Với điện, cháy nổ hoặc rò rỉ nguy hiểm: ngắt nguồn nếu an toàn, cảnh
          báo người xung quanh và liên hệ quản lý. Không thao tác vượt phạm vi
          chuyên môn.
        </p>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {q.data.map((x) => (
            <TaskCard key={x.id} task={x} />
          ))}
        </div>
      ) : (
        <Empty title="Không có công việc khẩn cấp" />
      )}
    </Page>
  );
}

export function PreventivePage() {
  const q = usePreventivePlans();
  return (
    <Page
      title="Bảo trì định kỳ"
      description="Kế hoạch được phân công; kỹ thuật viên không tự thay đổi chu kỳ."
    >
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data.map((x) => (
            <article
              key={x.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex justify-between">
                <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                  <CalendarDays />
                </span>
                <StatusBadge status={x.status} />
              </div>
              <h2 className="mt-4 font-bold">{x.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {x.propertyName} · {x.assetCategory}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p>
                  <span className="block text-xs text-slate-400">
                    Lần tiếp theo
                  </span>
                  {new Date(x.nextRunDate).toLocaleDateString("vi-VN")}
                </p>
                <p>
                  <span className="block text-xs text-slate-400">Chu kỳ</span>
                  {x.frequencyInterval} {x.frequencyType}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Chưa có kế hoạch được giao" />
      )}
    </Page>
  );
}

export function AssetsPage() {
  const q = useTechnicianAssets();
  return (
    <Page
      title="Thiết bị phụ trách"
      description="Chỉ hiển thị thiết bị gắn với phạm vi công việc đã được giao."
    >
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((x) => (
            <Link
              href={`/technician/assets/${x.id}`}
              key={x.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300"
            >
              <Wrench className="size-6 text-blue-600" />
              <h2 className="mt-4 font-bold">{x.name}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {x.assetCode ?? `TB-${x.id}`} · {x.brand ?? "Chưa rõ hãng"}{" "}
                {x.model ?? ""}
              </p>
              <p className="mt-3 text-sm">
                {x.propertyName} · {x.roomCode}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {x.maintenanceCount} lần bảo trì · {x.condition}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Chưa có thiết bị trong phạm vi" />
      )}
    </Page>
  );
}
export function AssetDetailPage({ id }: { id: number }) {
  const q = useTechnicianAsset(id);
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data)
    return (
      <Page title="Thiết bị">
        <ErrorState retry={() => void q.refetch()} />
      </Page>
    );
  const x = q.data;
  return (
    <Page
      title={x.name}
      description={x.assetCode ?? `TB-${x.id}`}
      actions={
        <Link
          href="/technician/assets"
          className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
        >
          Danh sách thiết bị
        </Link>
      }
    >
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Hãng", x.brand],
          ["Model", x.model],
          ["Số sê-ri", x.serialNumber],
          ["Tình trạng", x.condition],
          ["Vị trí", `${x.propertyName} · ${x.roomCode}`],
          [
            "Hết bảo hành",
            x.warrantyExpiry
              ? new Date(x.warrantyExpiry).toLocaleDateString("vi-VN")
              : null,
          ],
          [
            "Bảo trì gần nhất",
            x.lastMaintainedAt
              ? new Date(x.lastMaintainedAt).toLocaleDateString("vi-VN")
              : null,
          ],
          ["Số lần bảo trì", String(x.maintenanceCount)],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-slate-400">{k}</p>
            <p className="mt-1 font-semibold">{v || "Chưa cập nhật"}</p>
          </div>
        ))}
      </section>
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
        Tra cứu QR chỉ khả dụng khi hệ thống có mã QR được phát hành và xác
        thực. Portal không sinh mã QR giả.
      </div>
    </Page>
  );
}

export function MaterialsPage() {
  const q = useTechnicianMaterials();
  return (
    <Page
      title="Danh mục vật tư"
      description="Tồn kho chỉ để tham khảo; kỹ thuật viên không tự điều chỉnh tồn tổng."
    >
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Mã",
                  "Vật tư",
                  "Khu trọ",
                  "Đơn vị",
                  "Tồn",
                  "Tối thiểu",
                  "Đơn giá",
                  "Trạng thái",
                ].map((x) => (
                  <th key={x} className="px-4 py-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{x.code}</td>
                  <td className="px-4 py-3 font-semibold">{x.name}</td>
                  <td className="px-4 py-3">{x.propertyName}</td>
                  <td className="px-4 py-3">{x.unit}</td>
                  <td
                    className={`px-4 py-3 font-semibold ${x.stockQuantity <= x.minimumQuantity ? "text-red-600" : ""}`}
                  >
                    {x.stockQuantity}
                  </td>
                  <td className="px-4 py-3">{x.minimumQuantity}</td>
                  <td className="px-4 py-3">{formatMoney(x.unitPrice)}</td>
                  <td className="px-4 py-3">{x.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Chưa có danh mục vật tư" />
      )}
    </Page>
  );
}

export function MaterialRequestsPage() {
  const q = useMaterialRequests();
  const [busy, setBusy] = useState<number>();
  const receive = async (id: number, version: number) => {
    setBusy(id);
    try {
      await technicianService.receiveMaterial(id, version);
      await q.refetch();
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <Page
      title="Yêu cầu vật tư"
      description="Theo dõi phê duyệt, nhận, sử dụng và hoàn trả vật tư."
    >
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="grid gap-4">
          {q.data.map((x) => (
            <article
              key={x.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-700">
                    {x.taskCode} · {x.urgency}
                  </p>
                  <h2 className="mt-1 font-bold">{x.taskTitle}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(x.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {x.status}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {x.items.map((i) => (
                  <p
                    key={i.id}
                    className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"
                  >
                    <span>
                      {i.name} · {i.quantity} {i.unit}
                    </span>
                    <span>Đã dùng {i.usedQuantity}</span>
                  </p>
                ))}
              </div>
              {x.status === "APPROVED" && (
                <button
                  disabled={busy === x.id}
                  onClick={() => void receive(x.id, x.version)}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <PackageCheck className="size-4" />
                  Xác nhận đã nhận
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Chưa có yêu cầu vật tư" />
      )}
    </Page>
  );
}

export function NotificationsPage() {
  const q = useTechnicianNotifications();
  const read = async (id: number) => {
    await technicianService.markRead(id);
    await q.refetch();
  };
  return (
    <Page title="Thông báo" description="Tự động làm mới mỗi 30 giây.">
      {q.isLoading ? (
        <Loading />
      ) : q.isError || !q.data ? (
        <ErrorState retry={() => void q.refetch()} />
      ) : q.data.length ? (
        <div className="space-y-3">
          {q.data.map((x) => (
            <button
              key={x.id}
              onClick={() => !x.read && void read(x.id)}
              className={`flex w-full gap-3 rounded-2xl border p-4 text-left ${x.read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}
            >
              <Bell
                className={`mt-1 size-5 shrink-0 ${x.read ? "text-slate-400" : "text-blue-600"}`}
              />
              <span className="flex-1">
                <span className="block font-semibold">{x.title}</span>
                <span className="mt-1 block text-sm text-slate-600">
                  {x.content}
                </span>
                <span className="mt-2 block text-xs text-slate-400">
                  {formatDate(x.createdAt)}
                </span>
              </span>
              {!x.read && (
                <span className="mt-2 size-2 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <Empty title="Chưa có thông báo" />
      )}
    </Page>
  );
}

export function PerformancePage() {
  const q = useTechnicianPerformance();
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data)
    return (
      <Page title="Hiệu suất cá nhân">
        <ErrorState retry={() => void q.refetch()} />
      </Page>
    );
  const d = q.data,
    metrics = [
      ["Được giao", d.assignedTasks],
      ["Hoàn thành", d.completedTasks],
      ["Đúng hạn", d.onTimeTasks],
      ["Quá hạn", d.overdueTasks],
      ["Nghiệm thu lần đầu", d.firstPassTasks],
      ["Mở lại", d.reopenedTasks],
      ["Giờ xử lý TB", Number(d.averageResolutionHours).toFixed(1)],
      ["Điểm đánh giá", Number(d.averageRating).toFixed(1)],
    ];
  return (
    <Page
      title="Hiệu suất cá nhân"
      description="Đánh giá có xét SLA, chờ vật tư, độ khẩn cấp và kết quả nghiệm thu."
    >
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([k, v]) => (
          <article
            key={k}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-sm text-slate-500">{k}</p>
            <p className="mt-2 text-2xl font-black">{v}</p>
          </article>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Chart title="Công việc theo tháng" data={d.trend} />
        <Chart title="Phân bố loại sự cố" data={d.categories} />
      </div>
      <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Số liệu không dùng riêng số lượng công việc để kết luận hiệu suất; thời
        gian chờ vật tư hiện ghi nhận: {Number(d.waitingPartsHours).toFixed(1)}{" "}
        giờ, số việc khẩn cấp: {d.urgentTasks}.
      </p>
    </Page>
  );
}
function Chart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function AccountPage() {
  const q = useTechnicianAccount(),
    m = useAccountMutations();
  const [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const act = async (fn: () => Promise<unknown>, text: string) => {
    setError("");
    try {
      await fn();
      setNotice(text);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data)
    return (
      <Page title="Tài khoản">
        <ErrorState retry={() => void q.refetch()} />
      </Page>
    );
  const a = q.data,
    t = a.technician;
  const profile = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act(
      () =>
        m.profile.mutateAsync({
          email: f.get("email"),
          phone: f.get("phone"),
          version: t.version,
        }),
      "Đã cập nhật thông tin liên hệ.",
    );
  };
  const password = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act(
      () =>
        m.password.mutateAsync({
          currentPassword: f.get("currentPassword"),
          newPassword: f.get("newPassword"),
        }),
      "Đã đổi mật khẩu.",
    );
    e.currentTarget.reset();
  };
  return (
    <Page
      title="Tài khoản kỹ thuật viên"
      description="Vai trò, nhóm, khu vực và hạn mức do quản lý cấu hình."
    >
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {notice && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-blue-100 text-xl font-black text-blue-700">
              {t.fullName[0]}
            </span>
            <div>
              <h2 className="font-bold">{t.fullName}</h2>
              <p className="text-sm text-slate-500">
                {t.employeeCode} · {t.workingStatus}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <Info k="Chuyên môn" v={t.expertise} />
            <Info k="Khu vực" v={t.workingArea} />
            <Info k="Lịch làm việc" v={t.workSchedule} />
            <Info k="Hạn mức đề xuất" v={formatMoney(a.costLimit)} />
          </div>
        </section>
        <form
          onSubmit={profile}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="flex items-center gap-2 font-bold">
            <UserRound className="size-5 text-blue-600" />
            Thông tin liên hệ
          </h2>
          <label className="block text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              defaultValue={t.email}
              required
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            />
          </label>
          <label className="block text-sm font-medium">
            Số điện thoại
            <input
              name="phone"
              defaultValue={t.phone ?? ""}
              className="mt-1 min-h-11 w-full rounded-xl border px-3"
            />
          </label>
          <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
            Lưu liên hệ
          </button>
        </form>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Cấu hình thông báo</h2>
          {[
            ["notifyAssignment", "Phân công mới", a.notifyAssignment],
            ["notifySchedule", "Thay đổi lịch", a.notifySchedule],
            ["notifyUrgent", "Công việc khẩn cấp", a.notifyUrgent],
            ["notifyMaterial", "Vật tư", a.notifyMaterial],
          ].map(([key, label, value]) => (
            <label
              key={String(key)}
              className="mt-3 flex items-center justify-between text-sm"
            >
              <span>{String(label)}</span>
              <input
                type="checkbox"
                defaultChecked={Boolean(value)}
                onChange={(e) => {
                  const next = {
                    notifyAssignment: a.notifyAssignment,
                    notifySchedule: a.notifySchedule,
                    notifyUrgent: a.notifyUrgent,
                    notifyMaterial: a.notifyMaterial,
                    version: t.version,
                    [String(key)]: e.target.checked,
                  };
                  void act(
                    () => m.preferences.mutateAsync(next),
                    "Đã cập nhật cấu hình thông báo.",
                  );
                }}
              />
            </label>
          ))}
        </section>
        <form
          onSubmit={password}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h2 className="flex items-center gap-2 font-bold">
            <KeyRound className="size-5 text-blue-600" />
            Đổi mật khẩu
          </h2>
          <input
            name="currentPassword"
            type="password"
            required
            placeholder="Mật khẩu hiện tại"
            className="min-h-11 w-full rounded-xl border px-3"
          />
          <input
            name="newPassword"
            type="password"
            minLength={10}
            required
            placeholder="Mật khẩu mới (tối thiểu 10 ký tự)"
            className="min-h-11 w-full rounded-xl border px-3"
          />
          <button className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
            Đổi mật khẩu
          </button>
        </form>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Phiên đăng nhập</h2>
        <div className="mt-3 divide-y">
          {a.sessions.map((x) => (
            <div key={x.id} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <p className="truncate text-sm font-medium">
                  {x.userAgent ?? "Thiết bị không xác định"}
                </p>
                <p className="text-xs text-slate-500">
                  {x.ipAddress ?? "Không có IP"} · {formatDate(x.lastActiveAt)}
                </p>
              </div>
              <span
                className={`text-xs font-semibold ${x.active ? "text-emerald-600" : "text-slate-400"}`}
              >
                {x.active ? "Đang hoạt động" : "Đã hết"}
              </span>
              {x.active && (
                <button
                  onClick={() =>
                    void act(
                      () => m.revoke.mutateAsync(x.id),
                      "Đã thu hồi phiên.",
                    )
                  }
                  className="text-xs font-semibold text-red-600"
                >
                  Thu hồi
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
function Info({ k, v }: { k: string; v?: string | null }) {
  return (
    <p>
      <span className="block text-xs text-slate-400">{k}</span>
      <span className="font-medium">{v || "Chưa cập nhật"}</span>
    </p>
  );
}
