"use client";
import { maintenanceStyles } from "./maintenance-styles";
import { FormInput } from "@/components/ui/number-input";
import { parseNumericFields } from "@/lib/numeric-input";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Package,
  Plus,
  Repeat2,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { adminMaintenanceService as api } from "@/services/admin-maintenance.service";
import { useMaintenanceData } from "@/hooks/use-admin-maintenance";
import { formatCurrency, formatDate } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "./maintenance-shared";
export function MaintenanceCalendarPage() {
  const from = new Date();
  from.setDate(1);
  const to = new Date(from);
  to.setMonth(to.getMonth() + 1);
  to.setDate(0);
  const query = useQuery({
    queryKey: ["maintenance-calendar", from.toISOString().slice(0, 10)],
    queryFn: () =>
      api.calendar({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      }),
  });
  return (
    <Page
      title="Lịch bảo trì"
      subtitle="Theo dõi lịch kiểm tra và sửa chữa trong tháng."
      icon={CalendarDays}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {query.data?.map((x) => (
          <Link
            key={`${x.id}-${x.start}`}
            href={`/admin/maintenance/${x.id}`}
            className="rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <div className="flex justify-between">
              <b className="text-link">{x.requestCode}</b>
              <PriorityBadge priority={x.priority} />
            </div>
            <h3 className="mt-3 font-bold">{x.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDate(x.start)} · {x.roomCode || "Khu vực chung"}
            </p>
            <div className="mt-3">
              <StatusBadge status={x.status} />
            </div>
          </Link>
        ))}
        {!query.isLoading && !query.data?.length && (
          <Empty text="Chưa có lịch bảo trì trong tháng này." />
        )}
      </div>
    </Page>
  );
}
export function PreventivePage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["maintenance-plans"],
    queryFn: api.plans,
  });
  const { options } = useMaintenanceData({ page: 0, size: 10 });
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({
    propertyId: 0,
    name: "",
    assetCategory: "AIR_CONDITIONER",
    frequencyType: "MONTHLY",
    frequencyInterval: 6,
    startDate: new Date().toISOString().slice(0, 10),
    reminderDaysBefore: 7,
    estimatedCost: 0,
    active: true,
  });
  const create = useMutation({
    mutationFn: (data: Parameters<typeof api.createPlan>[0]) =>
      api.createPlan(parseNumericFields(data, ["frequencyInterval"])),
    onSuccess: async () => {
      setShow(false);
      await qc.invalidateQueries({ queryKey: ["maintenance-plans"] });
    },
  });
  return (
    <Page
      title="Bảo trì định kỳ"
      subtitle="Lập kế hoạch kiểm tra thiết bị theo chu kỳ."
      icon={Repeat2}
      action={
        <button
          className={maintenanceStyles.primary}
          onClick={() => setShow(!show)}
        >
          <Plus className="size-4" />
          Tạo kế hoạch
        </button>
      }
    >
      {show && (
        <ResourceForm onSubmit={() => create.mutate(form)}>
          <Select
            label="Khu trọ"
            value={form.propertyId}
            onChange={(v) => setForm({ ...form, propertyId: Number(v) })}
            options={[
              ["0", "Chọn khu trọ"],
              ...(options.data?.properties.map((x) => [String(x.id), x.name]) ??
                []),
            ]}
          />
          <Input
            label="Tên kế hoạch"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Select
            label="Chu kỳ"
            value={form.frequencyType}
            onChange={(v) => setForm({ ...form, frequencyType: v })}
            options={[
              ["MONTHLY", "Theo tháng"],
              ["QUARTERLY", "Theo quý"],
              ["YEARLY", "Theo năm"],
            ]}
          />
          <Input
            label="Khoảng lặp"
            type="number"
            value={form.frequencyInterval}
            onChange={(v) => setForm({ ...form, frequencyInterval: v })}
          />
        </ResourceForm>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {query.data?.map((x) => (
          <div
            key={x.id}
            className="surface-card p-5 sm:p-6 "
          >
            <div className="flex justify-between">
              <Repeat2 className="size-5 text-link" />
              <span className="rounded-full bg-success-muted px-2 py-1 text-xs font-bold text-success">
                {x.status}
              </span>
            </div>
            <h3 className="mt-4 font-black">{x.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{x.propertyName}</p>
            <p className="mt-4 text-sm">
              Lần tiếp theo: <b>{formatDate(x.nextRunDate)}</b>
            </p>
            <p className="mt-1 text-sm">
              Chi phí dự kiến: <b>{formatCurrency(x.estimatedCost)}</b>
            </p>
          </div>
        ))}
      </div>
    </Page>
  );
}
export function MaterialsPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["maintenance-materials"],
    queryFn: api.materials,
  });
  const { options } = useMaintenanceData({ page: 0, size: 10 });
  const [form, setForm] = useState<any>({
    propertyId: 0,
    code: "",
    name: "",
    unit: "cái",
    stockQuantity: 0,
    minimumQuantity: 0,
    unitPrice: 0,
  });
  const create = useMutation({
    mutationFn: (data: Parameters<typeof api.createMaterial>[0]) =>
      api.createMaterial(
        parseNumericFields(data, ["stockQuantity", "unitPrice"]),
      ),
    onSuccess: async () =>
      qc.invalidateQueries({ queryKey: ["maintenance-materials"] }),
  });
  return (
    <Page
      title="Danh mục vật tư"
      subtitle="Quản lý tồn kho và đơn giá vật tư sửa chữa."
      icon={Package}
    >
      <ResourceForm onSubmit={() => create.mutate(form)}>
        <Select
          label="Khu trọ"
          value={form.propertyId}
          onChange={(v) => setForm({ ...form, propertyId: Number(v) })}
          options={[
            ["0", "Chọn khu trọ"],
            ...(options.data?.properties.map((x) => [String(x.id), x.name]) ??
              []),
          ]}
        />
        <Input
          label="Mã vật tư"
          value={form.code}
          onChange={(v) => setForm({ ...form, code: v })}
        />
        <Input
          label="Tên vật tư"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
        />
        <Input
          label="Tồn kho"
          type="number"
          value={form.stockQuantity}
          onChange={(v) => setForm({ ...form, stockQuantity: v })}
        />
        <Input
          label="Đơn giá"
          type="number"
          value={form.unitPrice}
          onChange={(v) => setForm({ ...form, unitPrice: v })}
        />
      </ResourceForm>
      <div className="overflow-x-auto surface-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-4">Mã</th>
              <th className="p-4">Vật tư</th>
              <th className="p-4">Khu trọ</th>
              <th className="p-4 text-right">Tồn kho</th>
              <th className="p-4 text-right">Đơn giá</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="p-4 font-bold text-link">{x.code}</td>
                <td className="p-4">{x.name}</td>
                <td className="p-4">{x.propertyName}</td>
                <td
                  className={`p-4 text-right font-bold ${x.stockQuantity <= x.minimumQuantity ? "text-danger" : ""}`}
                >
                  {x.stockQuantity} {x.unit}
                </td>
                <td className="p-4 text-right">
                  {formatCurrency(x.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
export function AssetsPage() {
  const { options } = useMaintenanceData({ page: 0, size: 10 });
  return (
    <Page
      title="Thiết bị cần bảo trì"
      subtitle="Danh sách tài sản theo phòng đang được quản lý."
      icon={Wrench}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {options.data?.assets.map((x) => (
          <div
            key={x.id}
            className="surface-card p-5 sm:p-6 "
          >
            <Wrench className="size-6 text-link" />
            <h3 className="mt-3 font-black">{x.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tình trạng: {x.detail || "Chưa cập nhật"}
            </p>
          </div>
        ))}
      </div>
    </Page>
  );
}
export function ReportsPage() {
  const query = useQuery({
    queryKey: ["maintenance-report"],
    queryFn: api.report,
  });
  return (
    <Page
      title="Báo cáo bảo trì"
      subtitle="Tổng hợp chi phí và hiệu suất xử lý."
      icon={TrendingUp}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {query.data &&
          [
            ["Tổng chi phí", formatCurrency(query.data.totalCost)],
            ["Chủ nhà chịu", formatCurrency(query.data.ownerCost)],
            ["Người thuê chịu", formatCurrency(query.data.tenantCost)],
            ["Đã nghiệm thu", query.data.resolvedRequests],
            [
              "Xử lý trung bình",
              `${Number(query.data.averageHours).toFixed(1)} giờ`,
            ],
          ].map((x) => (
            <div
              key={String(x[0])}
              className="surface-card p-5 sm:p-6 "
            >
              <p className="text-sm text-muted-foreground">{x[0]}</p>
              <p className="mt-2 text-2xl font-black">{x[1]}</p>
            </div>
          ))}
      </div>
    </Page>
  );
}
function Page({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  icon: any;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AdminShell title={title} subtitle={subtitle} readOnly>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/maintenance"
              className="rounded-xl border bg-card p-2"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <p className="text-sm text-muted-foreground">Bảo trì</p>
              <h1 className="flex items-center gap-2 text-2xl font-black">
                <Icon className="size-6 text-link" />
                {title}
              </h1>
            </div>
          </div>
          {action}
        </div>
        {children}
      </div>
    </AdminShell>
  );
}
function ResourceForm({
  onSubmit,
  children,
}: {
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="rounded-2xl border border-accent-border bg-accent p-5"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{children}</div>
      <button type="submit" className={`${maintenanceStyles.primary} mt-4`}>
        <Plus className="size-4" />
        Lưu dữ liệu
      </button>
    </form>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <FormInput
        className={maintenanceStyles.input}
        type={type}
        numericKind={
          /giá|phí|tiền/iu.test(label)
            ? "currency"
            : /tần suất/iu.test(label)
              ? "integer"
              : "decimal"
        }
        required={type === "number"}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <select
        className={maintenanceStyles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((x) => (
          <option key={x[0]} value={x[0]}>
            {x[1]}
          </option>
        ))}
      </select>
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
      {text}
    </div>
  );
}
