"use client";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type ApiEnvelope } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";
import { apiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
type Row = Record<string, string | number | boolean | null>;
type Detail = {
  contract: Row;
  reading: Row | null;
  rates: Row[];
  services: Row[];
  previous: Row;
  rateHistory: Row[];
  meters: Row[];
  revisions: Row[];
  runs: Row[];
  automation: Row[];
};
const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
const button =
  "rounded-xl bg-blue-700 px-4 py-2 text-sm text-white disabled:opacity-40";
const labels: Record<string, string> = {
  ELECTRICITY: "Điện",
  WATER: "Nước",
  RENT: "Tiền thuê",
  FIXED: "Theo tháng",
  PER_PERSON: "Theo người",
  QUANTITY: "Theo số lượng",
  USAGE: "Theo sử dụng",
  ONCE: "Một lần",
};
export function MonthlyBillingPanel({ contractId }: { contractId: number }) {
  const { user } = useAuth(),
    client = useQueryClient();
  const [period, setPeriod] = useState(() =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
    }).format(new Date()),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const staff = ["OWNER", "MANAGER"].includes(user?.activeRole ?? "");
  const base = `/admin/monthly-billing/${contractId}`;
  const query = useQuery({
    queryKey: [
      "monthly-billing",
      user?.id,
      user?.activeRole,
      contractId,
      period,
    ],
    queryFn: async () =>
      (
        await apiClient.get<ApiEnvelope<Detail>>(base, {
          params: { period: `${period}-01` },
        })
      ).data.data,
  });
  async function act(path: string, payload: unknown) {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`${base}/${path}`, payload);
      await client.invalidateQueries();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function form(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return new FormData(e.currentTarget);
  }
  const d = query.data;
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Điện nước và tính tiền hằng tháng</h2>
      <label className="block max-w-xs text-sm">
        Kỳ sử dụng
        <input
          required
          type="month"
          value={period}
          onChange={(e) => {
            if (e.target.value) setPeriod(e.target.value);
          }}
          className={input}
        />
      </label>
      {query.isPending && <p>Đang tải dữ liệu…</p>}
      {query.isError && (
        <p role="alert" className="text-red-700">
          {apiErrorMessage(query.error)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {d && (
        <>
          <p className="text-sm">
            Giá thuê đã chốt:{" "}
            {formatCurrency(
              d.contract.agreed_monthly_rent == null
                ? null
                : Number(d.contract.agreed_monthly_rent),
            )}{" "}
            ·{" "}
            {d.contract.rent_proration === "ACTUAL_DAYS"
              ? "Tính theo ngày thực tế của tháng"
              : "Thu đủ tháng theo hợp đồng"}
          </p>
          <p className="text-xs text-slate-600">
            Đơn giá phải có căn cứ và thỏa thuận phù hợp quy định áp dụng. Phần
            mềm không chứng nhận một đơn giá nhập vào là hợp pháp. Kỳ đã phát
            hành được giữ nguyên; chứng từ ở đây là hóa đơn thu tiền nội bộ.
          </p>
          {d.rates.map((r) => (
            <p key={String(r.id)} className="text-sm">
              {labels[String(r.code)] ?? String(r.name)} ·{" "}
              {r.calculation_method === "METER"
                ? "Theo đồng hồ"
                : "Phí cố định"}{" "}
              · Đơn giá gốc {formatCurrency(Number(r.unit_price))}/
              {String(r.unit)} · Từ {String(r.effective_date)}
            </p>
          ))}
          {d.reading && (
            <p className="rounded-xl bg-slate-50 p-3 text-sm">
              Chỉ số kỳ này: {String(d.reading.reading_status)} · Điện{" "}
              {String(d.reading.electricity_previous ?? "—")} →{" "}
              {String(d.reading.electricity_current ?? "—")} · Tiêu thụ{" "}
              {String(d.reading.electricity_consumption ?? "Cần đối soát")} ·
              Nước {String(d.reading.water_previous ?? "—")} →{" "}
              {String(d.reading.water_current ?? "—")} · Tiêu thụ{" "}
              {String(d.reading.water_consumption ?? "Cần đối soát")}
              {" · Tiền điện: "}
              {formatCurrency(
                d.reading.electricity_amount == null
                  ? null
                  : Number(d.reading.electricity_amount),
              )}
              {" · Tiền nước: "}
              {formatCurrency(
                d.reading.water_amount == null
                  ? null
                  : Number(d.reading.water_amount),
              )}
            </p>
          )}
          {staff && d.rates.some((r) => r.calculation_method === "METER") && (
            <form
              key={`${contractId}-${period}-${d.reading?.version}`}
              className="space-y-3 border-t pt-3"
              onSubmit={(e) => {
                const f = form(e);
                void act("readings", {
                  period: `${period}-01`,
                  version: Number(d.reading?.version ?? 0),
                  electricity: f.has("ELECTRICITY")
                    ? Number(f.get("ELECTRICITY"))
                    : null,
                  water: f.has("WATER") ? Number(f.get("WATER")) : null,
                  reference: f.get("reference"),
                  reason: f.get("reason"),
                  confirmWarnings: f.get("warnings") === "on",
                });
              }}
            >
              <h3 className="font-semibold">Ghi và chốt chỉ số cuối kỳ</h3>
              {d.rates
                .filter((r) => r.calculation_method === "METER")
                .map((r) => (
                  <label key={String(r.code)} className="block text-sm">
                    {labels[String(r.code)]} · Đầu kỳ:{" "}
                    {String(d.previous[String(r.code)] ?? "Thiếu mốc bàn giao")}
                    <input
                      required
                      name={String(r.code)}
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={
                        d.reading?.[
                          r.code === "ELECTRICITY"
                            ? "electricity_current"
                            : "water_current"
                        ] == null
                          ? undefined
                          : Number(
                              d.reading[
                                r.code === "ELECTRICITY"
                                  ? "electricity_current"
                                  : "water_current"
                              ],
                            )
                      }
                      className={input}
                    />
                  </label>
                ))}
              <input
                required
                name="reference"
                maxLength={500}
                placeholder="Mã ảnh/biên bản đối chiếu"
                className={input}
              />
              <input
                required
                name="reason"
                maxLength={1000}
                placeholder="Nội dung kiểm tra hoặc lý do điều chỉnh"
                className={input}
              />
              <label className="flex gap-2 text-sm">
                <input name="warnings" type="checkbox" />
                Đã kiểm tra cảnh báo không sử dụng/tăng bất thường và ghi lý do
              </label>
              <button disabled={busy} className={button}>
                Chốt chỉ số và lưu lịch sử
              </button>
            </form>
          )}
          {staff && (
            <details>
              <summary>Thay đồng hồ trong kỳ</summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  const f = form(e);
                  void act("meter-replacements", {
                    period: `${period}-01`,
                    version: Number(d.reading?.version ?? 0),
                    type: f.get("type"),
                    code: f.get("code"),
                    removedReading: Number(f.get("removed")),
                    installedReading: Number(f.get("installed")),
                    reference: f.get("reference"),
                    reason: f.get("reason"),
                  });
                }}
              >
                <select required name="type" className={input}>
                  {d.rates
                    .filter((r) => r.calculation_method === "METER")
                    .map((r) => (
                      <option key={String(r.code)} value={String(r.code)}>
                        {labels[String(r.code)]}
                      </option>
                    ))}
                </select>
                <input
                  required
                  name="code"
                  maxLength={50}
                  placeholder="Mã đồng hồ mới"
                  className={input}
                />
                <label className="block text-sm">
                  Chỉ số khi tháo
                  <input
                    required
                    name="removed"
                    type="number"
                    min={0}
                    step="0.01"
                    className={input}
                  />
                </label>
                <label className="block text-sm">
                  Chỉ số khi lắp
                  <input
                    required
                    name="installed"
                    type="number"
                    min={0}
                    step="0.01"
                    className={input}
                  />
                </label>
                <input
                  required
                  name="reference"
                  maxLength={500}
                  placeholder="Mã biên bản/ảnh thay đồng hồ"
                  className={input}
                />
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  placeholder="Lý do thay"
                  className={input}
                />
                <button disabled={busy} className={button}>
                  Lưu các mốc thay đồng hồ
                </button>
              </form>
            </details>
          )}
          {staff && (
            <details>
              <summary>
                Giá thỏa thuận mới từ kỳ tiếp theo / kỳ chưa chốt
              </summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  const f = form(e);
                  void act("rates", {
                    code: f.get("code"),
                    effectiveDate: `${f.get("effective")}-01`,
                    unitPrice: Number(f.get("price")),
                    reference: f.get("reference"),
                    reason: f.get("reason"),
                  });
                }}
              >
                <select name="code" className={input}>
                  {["RENT", "ELECTRICITY", "WATER"].map((c) => (
                    <option key={c} value={c}>
                      {labels[c]}
                    </option>
                  ))}
                </select>
                <label className="block text-sm">
                  Kỳ hiệu lực
                  <input
                    required
                    name="effective"
                    type="month"
                    className={input}
                  />
                </label>
                <input
                  required
                  name="price"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Đơn giá theo chứng từ"
                  className={input}
                />
                <input
                  required
                  name="reference"
                  maxLength={500}
                  placeholder="Mã phụ lục/bảng giá áp dụng"
                  className={input}
                />
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  placeholder="Lý do thay đổi và căn cứ"
                  className={input}
                />
                <button disabled={busy} className={button}>
                  Lưu lịch sử giá
                </button>
              </form>
            </details>
          )}
          {d.rateHistory.length > 0 && (
            <details>
              <summary>Lịch sử giá theo ngày hiệu lực</summary>
              {d.rateHistory.map((r) => (
                <p key={String(r.id)} className="text-sm">
                  {labels[String(r.code)]} · {String(r.effective_date)} ·{" "}
                  {formatCurrency(Number(r.unit_price))} · {String(r.reference)}{" "}
                  · {String(r.reason)}
                </p>
              ))}
            </details>
          )}
          {staff && (
            <details>
              <summary>Chính sách tháng đầu và tháng cuối</summary>
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  const f = form(e);
                  void act("proration", {
                    policy: f.get("policy"),
                    reason: f.get("reason"),
                  });
                }}
              >
                <select
                  name="policy"
                  defaultValue={String(d.contract.rent_proration)}
                  className={input}
                >
                  <option value="FULL_MONTH">Thu đủ tháng theo hợp đồng</option>
                  <option value="ACTUAL_DAYS">
                    Ngày thực tế / số ngày trong tháng
                  </option>
                </select>
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  placeholder="Căn cứ thỏa thuận phân bổ"
                  className={input}
                />
                <button disabled={busy} className={button}>
                  Lưu chính sách
                </button>
              </form>
            </details>
          )}
          <details>
            <summary>Dịch vụ và mức sử dụng</summary>
            <div className="mt-3 space-y-3">
              {d.services.map((s) => (
                <div
                  key={String(s.id)}
                  className="rounded-xl bg-slate-50 p-3 text-sm"
                >
                  <p>
                    {String(s.name)} ·{" "}
                    {labels[String(s.calculation_method)] ??
                      String(s.calculation_method)}{" "}
                    · {formatCurrency(Number(s.unit_price))}/{String(s.unit)} ·{" "}
                    {String(s.effective_date)} →{" "}
                    {String(s.end_date ?? "Đang áp dụng")}
                  </p>
                  {staff && (
                    <form
                      className="mt-2 space-y-2"
                      onSubmit={(e) => {
                        const f = form(e);
                        void act(`services/${s.id}/stop`, {
                          endDate: f.get("end"),
                          reason: f.get("reason"),
                        });
                      }}
                    >
                      <label className="block text-sm">
                        Ngừng từ ngày
                        <input
                          required
                          name="end"
                          type="date"
                          defaultValue={
                            s.end_date ? String(s.end_date) : undefined
                          }
                          className={input}
                        />
                      </label>
                      <input
                        required
                        name="reason"
                        maxLength={1000}
                        placeholder="Căn cứ ngừng áp dụng dịch vụ"
                        className={input}
                      />
                      <button disabled={busy} className={button}>
                        Lưu ngày ngừng
                      </button>
                    </form>
                  )}
                  {staff && s.calculation_method === "USAGE" && (
                    <form
                      className="mt-2 flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        const f = form(e);
                        void act(`services/${s.id}/usage`, {
                          period: `${period}-01`,
                          quantity: Number(f.get("quantity")),
                          reference: f.get("reference"),
                        });
                      }}
                    >
                      <input
                        required
                        name="quantity"
                        type="number"
                        min={0}
                        step="0.001"
                        placeholder="Lượng dùng thực tế"
                        className={input}
                      />
                      <input
                        required
                        name="reference"
                        maxLength={500}
                        placeholder="Chứng từ sử dụng"
                        className={input}
                      />
                      <button disabled={busy} className={button}>
                        Ghi nhận lượng dùng
                      </button>
                    </form>
                  )}
                </div>
              ))}
              {staff && (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    const f = form(e);
                    void act("services", {
                      code: f.get("code"),
                      name: f.get("name"),
                      method: f.get("method"),
                      unit: f.get("unit"),
                      unitPrice: Number(f.get("price")),
                      quantity:
                        f.get("quantity") === ""
                          ? null
                          : Number(f.get("quantity")),
                      effectiveDate: f.get("start"),
                      endDate: f.get("end") || null,
                      prorate: f.get("prorate") === "on",
                      reason: f.get("reason"),
                    });
                  }}
                >
                  <h3 className="font-semibold">Thêm dịch vụ có thỏa thuận</h3>
                  <input
                    required
                    name="code"
                    maxLength={30}
                    placeholder="Mã dịch vụ"
                    className={input}
                  />
                  <input
                    required
                    name="name"
                    maxLength={100}
                    placeholder="Tên dịch vụ"
                    className={input}
                  />
                  <select name="method" className={input}>
                    {["FIXED", "PER_PERSON", "QUANTITY", "USAGE", "ONCE"].map(
                      (c) => (
                        <option key={c} value={c}>
                          {labels[c]}
                        </option>
                      ),
                    )}
                  </select>
                  <input
                    required
                    name="unit"
                    maxLength={30}
                    placeholder="Đơn vị tính"
                    className={input}
                  />
                  <input
                    required
                    name="price"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Đơn giá"
                    className={input}
                  />
                  <input
                    name="quantity"
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Số lượng theo thỏa thuận (nếu tính theo số lượng)"
                    className={input}
                  />
                  <label className="block text-sm">
                    Từ ngày
                    <input
                      required
                      name="start"
                      type="date"
                      className={input}
                    />
                  </label>
                  <label className="block text-sm">
                    Ngừng từ ngày (không tính ngày này)
                    <input name="end" type="date" className={input} />
                  </label>
                  <label className="flex gap-2 text-sm">
                    <input name="prorate" type="checkbox" />
                    Phân bổ theo số ngày áp dụng trong tháng
                  </label>
                  <input
                    required
                    name="reason"
                    maxLength={1000}
                    placeholder="Căn cứ thỏa thuận dịch vụ"
                    className={input}
                  />
                  <button disabled={busy} className={button}>
                    Lưu dịch vụ
                  </button>
                </form>
              )}
            </div>
          </details>
          {user?.activeRole === "OWNER" && (
            <details>
              <summary>
                Lịch tự động lập hóa đơn (áp dụng các nhà của chủ trọ)
              </summary>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  const f = form(e);
                  void act("automation", {
                    enabled: f.get("enabled") === "on",
                    autoIssue: f.get("issue") === "on",
                    generationDay: Number(f.get("generation")),
                    issueDay: Number(f.get("issueDay")),
                    cutoffDay: Number(f.get("cutoff")),
                    dueDay: Number(f.get("due")),
                    periodOffset: Number(f.get("offset")),
                    reason: f.get("reason"),
                  });
                }}
              >
                <label className="flex gap-2">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={Boolean(
                      d.automation[0]?.auto_generate_invoices,
                    )}
                  />
                  Bật lập hóa đơn tự động
                </label>
                <label className="flex gap-2">
                  <input
                    name="issue"
                    type="checkbox"
                    defaultChecked={Boolean(
                      d.automation[0]?.auto_issue_invoices,
                    )}
                  />
                  Tự phát hành khi đủ dữ liệu đã chốt
                </label>
                {[
                  [
                    "generation",
                    "Ngày tạo",
                    d.automation[0]?.invoice_generation_day,
                  ],
                  [
                    "issueDay",
                    "Ngày phát hành",
                    d.automation[0]?.auto_issue_day,
                  ],
                  [
                    "cutoff",
                    "Ngày chốt chỉ số",
                    d.automation[0]?.meter_cutoff_day,
                  ],
                  [
                    "due",
                    "Ngày hạn thanh toán",
                    d.automation[0]?.default_due_day,
                  ],
                ].map(([name, label, value]) => (
                  <label key={String(name)} className="block text-sm">
                    {String(label)}
                    <input
                      required
                      name={String(name)}
                      type="number"
                      min={1}
                      max={28}
                      defaultValue={value == null ? undefined : Number(value)}
                      className={input}
                    />
                  </label>
                ))}
                <select
                  name="offset"
                  defaultValue={Number(
                    d.automation[0]?.billing_period_offset ?? -1,
                  )}
                  className={input}
                >
                  <option value={-1}>Thu kỳ sử dụng tháng trước</option>
                  <option value={0}>
                    Thu kỳ sử dụng tháng hiện tại sau ngày chốt
                  </option>
                </select>
                <input
                  required
                  name="reason"
                  maxLength={1000}
                  placeholder="Lý do và chính sách tự động hóa"
                  className={input}
                />
                <button disabled={busy} className={button}>
                  Lưu lịch
                </button>
              </form>
            </details>
          )}
          <details>
            <summary>Lịch sử ghi chỉ số và kết quả tự động</summary>
            {d.revisions.map((r) => (
              <p key={String(r.id)} className="text-xs">
                {String(r.created_at)} · {String(r.reason)}
              </p>
            ))}
            {d.runs.map((r) => (
              <p key={String(r.billing_period)} className="text-sm">
                {String(r.billing_period)} · {String(r.status)} ·{" "}
                {String(r.message)}
              </p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
