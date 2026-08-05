"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageLoading } from "@/components/shared/dashboard-ui";
import {
  useInvoiceData,
  useInvoiceMutations,
} from "@/hooks/use-admin-invoices";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import type {
  AdditionalItem,
  BulkInvoicePayload,
  InvoicePayload,
} from "@/types/admin-invoice";
const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500";
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dates(period: string) {
  if (!period) return { start: "", end: "" };
  const [y, m] = period.split("-").map(Number);
  return {
    start: `${period}-01`,
    end: `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`,
  };
}
export function InvoiceFormPage() {
  const router = useRouter();
  const { options } = useInvoiceData({ page: 0, size: 10 });
  const m = useInvoiceMutations();
  const now = today();
  const current = now.slice(0, 7);
  const ds = dates(current);
  const [step, setStep] = useState(1);
  const [property, setProperty] = useState(0);
  const [building, setBuilding] = useState(0);
  const [floor, setFloor] = useState(0);
  const [form, setForm] = useState<InvoicePayload>({
    roomId: 0,
    contractId: 0,
    billingPeriod: current,
    periodStartDate: ds.start,
    periodEndDate: ds.end,
    issueDate: now,
    dueDate: now,
    additionalItems: [],
    discountAmount: 0,
    includePreviousDebt: true,
    action: "SAVE_DRAFT",
  });
  const [extra, setExtra] = useState<AdditionalItem>({
    name: "",
    quantity: 1,
    unit: "lần",
    unitPrice: 0,
    reason: "",
  });
  const [error, setError] = useState("");
  if (options.isLoading) return <PageLoading />;
  const o = options.data!;
  const buildings = o.buildings.filter((x) => x.parentId === property),
    floors = o.floors.filter((x) => x.parentId === building),
    rooms = o.rooms.filter((x) => x.parentId === floor),
    contracts = o.contracts.filter((x) => x.parentId === form.roomId);
  const submit = async (action: "SAVE_DRAFT" | "ISSUE") => {
    setError("");
    try {
      const result = await m.create.mutateAsync({ ...form, action });
      router.push(`/admin/invoices/${result.id}`);
    } catch (e) {
      setError(apiErrorMessage(e, "Không thể tạo hóa đơn."));
    }
  };
  const add = () => {
    if (
      !extra.name ||
      !extra.reason ||
      extra.quantity <= 0 ||
      extra.unitPrice < 0
    )
      return;
    setForm({ ...form, additionalItems: [...form.additionalItems, extra] });
    setExtra({ name: "", quantity: 1, unit: "lần", unitPrice: 0, reason: "" });
  };
  return (
    <AdminShell
      title="Tạo hóa đơn"
      subtitle={`Bước ${step}/4 · Backend tự tính lại toàn bộ số tiền`}
      readOnly
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex gap-2 overflow-x-auto">
          {[
            "Phòng & kỳ",
            "Điện nước & dịch vụ",
            "Phát sinh & giảm giá",
            "Xem trước",
          ].map((x, i) => (
            <button
              key={x}
              onClick={() => setStep(i + 1)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${step === i + 1 ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
            >
              {i + 1}. {x}
            </button>
          ))}
        </div>
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          {step === 1 && (
            <div>
              <Title title="Chọn phòng và kỳ hóa đơn" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Khu trọ">
                  <Select
                    value={property}
                    items={o.properties}
                    placeholder="Chọn khu trọ"
                    onChange={(v) => {
                      setProperty(v);
                      setBuilding(0);
                      setFloor(0);
                      setForm({ ...form, roomId: 0, contractId: 0 });
                    }}
                  />
                </Field>
                <Field label="Tòa">
                  <Select
                    value={building}
                    items={buildings}
                    placeholder="Chọn tòa"
                    onChange={(v) => {
                      setBuilding(v);
                      setFloor(0);
                      setForm({ ...form, roomId: 0, contractId: 0 });
                    }}
                  />
                </Field>
                <Field label="Tầng">
                  <Select
                    value={floor}
                    items={floors}
                    placeholder="Chọn tầng"
                    onChange={(v) => {
                      setFloor(v);
                      setForm({ ...form, roomId: 0, contractId: 0 });
                    }}
                  />
                </Field>
                <Field label="Phòng">
                  <Select
                    value={form.roomId}
                    items={rooms}
                    placeholder="Chọn phòng"
                    onChange={(v) =>
                      setForm({ ...form, roomId: v, contractId: 0 })
                    }
                  />
                </Field>
                <Field label="Hợp đồng hiệu lực">
                  <Select
                    value={form.contractId}
                    items={contracts}
                    placeholder="Chọn hợp đồng"
                    onChange={(v) => setForm({ ...form, contractId: v })}
                  />
                </Field>
                <Field label="Kỳ hóa đơn">
                  <input
                    type="month"
                    className={input}
                    value={form.billingPeriod}
                    onChange={(e) => {
                      const d = dates(e.target.value);
                      setForm({
                        ...form,
                        billingPeriod: e.target.value,
                        periodStartDate: d.start,
                        periodEndDate: d.end,
                      });
                    }}
                  />
                </Field>
                <Field label="Từ ngày">
                  <input
                    type="date"
                    className={input}
                    value={form.periodStartDate}
                    onChange={(e) =>
                      setForm({ ...form, periodStartDate: e.target.value })
                    }
                  />
                </Field>
                <Field label="Đến ngày">
                  <input
                    type="date"
                    className={input}
                    value={form.periodEndDate}
                    onChange={(e) =>
                      setForm({ ...form, periodEndDate: e.target.value })
                    }
                  />
                </Field>
                <Field label="Hạn thanh toán">
                  <input
                    type="date"
                    className={input}
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <Title title="Điện nước và dịch vụ" />
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
                <strong>Dữ liệu được lấy tự động từ backend</strong>
                <p className="mt-2">
                  Hệ thống dùng chỉ số điện nước đúng kỳ, đơn giá đã lưu và các
                  dịch vụ đang hiệu lực trong hợp đồng. Nếu chưa có chỉ số, hóa
                  đơn vẫn có thể lưu nháp để bổ sung sau.
                </p>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <Title title="Khoản phát sinh, giảm giá và công nợ" />
              <div className="grid gap-3 sm:grid-cols-5">
                <input
                  className={`${input} sm:col-span-2`}
                  value={extra.name}
                  onChange={(e) => setExtra({ ...extra, name: e.target.value })}
                  placeholder="Tên khoản thu"
                />
                <input
                  type="number"
                  min="0.001"
                  className={input}
                  value={extra.quantity}
                  onChange={(e) =>
                    setExtra({ ...extra, quantity: Number(e.target.value) })
                  }
                />
                <input
                  type="number"
                  min="0"
                  className={input}
                  value={extra.unitPrice}
                  onChange={(e) =>
                    setExtra({ ...extra, unitPrice: Number(e.target.value) })
                  }
                />
                <button
                  onClick={add}
                  className="rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white"
                >
                  Thêm
                </button>
                <input
                  className={`${input} sm:col-span-5`}
                  value={extra.reason}
                  onChange={(e) =>
                    setExtra({ ...extra, reason: e.target.value })
                  }
                  placeholder="Lý do khoản phát sinh (bắt buộc)"
                />
              </div>
              <div className="mt-4 space-y-2">
                {form.additionalItems.map((x, i) => (
                  <div
                    key={`${x.name}-${i}`}
                    className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"
                  >
                    <span>
                      {x.name} · {x.quantity} {x.unit}
                    </span>
                    <strong>{formatCurrency(x.quantity * x.unitPrice)}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Giảm giá">
                  <input
                    type="number"
                    min="0"
                    className={input}
                    value={form.discountAmount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        discountAmount: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.includePreviousDebt}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        includePreviousDebt: e.target.checked,
                      })
                    }
                  />
                  Chuyển công nợ kỳ trước
                </label>
                <Field label="Ghi chú">
                  <textarea
                    className={`${input} min-h-20`}
                    value={form.note || ""}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <Title title="Xem trước dữ liệu lập hóa đơn" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Review
                  label="Phòng"
                  value={
                    o.rooms.find((x) => x.id === form.roomId)?.label ||
                    "Chưa chọn"
                  }
                />
                <Review
                  label="Hợp đồng"
                  value={
                    o.contracts.find((x) => x.id === form.contractId)?.label ||
                    "Chưa chọn"
                  }
                />
                <Review label="Kỳ" value={form.billingPeriod} />
                <Review label="Hạn thanh toán" value={form.dueDate} />
                <Review
                  label="Khoản phát sinh"
                  value={String(form.additionalItems.length)}
                />
                <Review
                  label="Giảm giá"
                  value={formatCurrency(form.discountAmount)}
                />
              </div>
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Số tiền xem trước chỉ là phần nhập tay. Backend sẽ lấy tiền
                phòng, điện, nước, dịch vụ và tính lại tổng chính thức khi lưu.
              </p>
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>
        <div className="flex justify-between">
          <button
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
          >
            Quay lại
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!form.roomId || !form.contractId)}
              className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-40"
            >
              Tiếp tục
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => void submit("SAVE_DRAFT")}
                disabled={m.create.isPending}
                className="rounded-xl border bg-white px-4 py-2 font-semibold"
              >
                Lưu nháp
              </button>
              <button
                onClick={() => void submit("ISSUE")}
                disabled={m.create.isPending}
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white"
              >
                Phát hành
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
export function BulkInvoicePage() {
  const { options } = useInvoiceData({ page: 0, size: 10 });
  const m = useInvoiceMutations();
  const now = today();
  const [form, setForm] = useState<BulkInvoicePayload>({
    propertyId: 0,
    billingPeriod: now.slice(0, 7),
    issueDate: now,
    dueDate: now,
    action: "SAVE_DRAFT",
  });
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof m.preview.mutateAsync>>
  >([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  if (options.isLoading) return <PageLoading />;
  const preview = async () => {
    setMessage("");
    try {
      const x = await m.preview.mutateAsync(form);
      setRows(x);
      setSelected(x.filter((r) => r.status === "READY").map((r) => r.roomId));
    } catch (e) {
      setMessage(apiErrorMessage(e));
    }
  };
  const generate = async () => {
    try {
      const x = await m.bulk.mutateAsync({ ...form, roomIds: selected });
      setMessage(
        `Đã tạo ${x.created.length} hóa đơn, bỏ qua ${x.skipped.length}.`,
      );
    } catch (e) {
      setMessage(apiErrorMessage(e));
    }
  };
  return (
    <AdminShell
      title="Lập hóa đơn hàng loạt"
      subtitle="Xem trước và kiểm tra trùng trước khi tạo"
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Khu trọ">
              <Select
                value={form.propertyId}
                items={options.data?.properties || []}
                placeholder="Chọn khu trọ"
                onChange={(v) => setForm({ ...form, propertyId: v })}
              />
            </Field>
            <Field label="Kỳ">
              <input
                type="month"
                className={input}
                value={form.billingPeriod}
                onChange={(e) =>
                  setForm({ ...form, billingPeriod: e.target.value })
                }
              />
            </Field>
            <Field label="Ngày lập">
              <input
                type="date"
                className={input}
                value={form.issueDate}
                onChange={(e) =>
                  setForm({ ...form, issueDate: e.target.value })
                }
              />
            </Field>
            <Field label="Hạn thanh toán">
              <input
                type="date"
                className={input}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
          </div>
          <button
            onClick={() => void preview()}
            disabled={!form.propertyId || m.preview.isPending}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            Kiểm tra và xem trước
          </button>
        </section>
        {rows.length > 0 && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="font-bold">Danh sách phòng</h2>
            <div className="mt-3 space-y-2">
              {rows.map((r) => (
                <label
                  key={r.roomId}
                  className="flex items-center gap-3 rounded-xl border p-3"
                >
                  <input
                    type="checkbox"
                    disabled={r.status !== "READY"}
                    checked={selected.includes(r.roomId)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, r.roomId]
                          : selected.filter((x) => x !== r.roomId),
                      )
                    }
                  />
                  <span className="flex-1">
                    <strong>{r.roomCode}</strong> · {r.tenantName}
                    <small className="block text-red-600">{r.warning}</small>
                  </span>
                  <strong>{formatCurrency(r.estimatedAmount)}</strong>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setForm({ ...form, action: "SAVE_DRAFT" })}
                className="rounded-xl border px-4 py-2"
              >
                Chế độ: {form.action === "ISSUE" ? "Phát hành" : "Lưu nháp"}
              </button>
              <button
                onClick={() => void generate()}
                disabled={!selected.length || m.bulk.isPending}
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Tạo {selected.length} hóa đơn
              </button>
            </div>
          </section>
        )}
        {message && (
          <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
            {message}
          </p>
        )}
        <Link
          href="/admin/invoices"
          className="text-sm font-semibold text-blue-600"
        >
          ← Quay lại danh sách
        </Link>
      </div>
    </AdminShell>
  );
}
function Title({ title }: { title: string }) {
  return <h2 className="mb-5 text-lg font-bold">{title}</h2>;
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
function Select({
  value,
  items,
  placeholder,
  onChange,
}: {
  value: number;
  items: { id: number; label: string }[];
  placeholder: string;
  onChange: (x: number) => void;
}) {
  return (
    <select
      className={input}
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="">{placeholder}</option>
      {items.map((x) => (
        <option key={x.id} value={x.id}>
          {x.label}
        </option>
      ))}
    </select>
  );
}
function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
