"use client";
import { CurrencyInput, NumberInput } from "@/components/ui/number-input";
import {
  parseNumericValue,
  numericPreview,
  type NumericDraftFields,
} from "@/lib/numeric-input";

import Link from "next/link";
import { adminTenantService } from "@/services/admin-tenant.service";
import { ContractMeterReadiness } from "@/components/shared/contract-meter-readiness";
import { ContractServicesEditor } from "./contract-services-editor";
import { serviceTotals, serviceMethods } from "@/lib/contract-services";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Plus, Save } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { apiErrorMessage, contractCreationLoadError } from "@/lib/api-error";
import { formatCurrency } from "@/lib/format";
import {
  directContractService,
  type DirectDraft,
  type DirectContractRequest,
  type NewTenant,
  type Rate,
  type Service,
  type TenantChoice,
} from "@/services/direct-contract.service";

const input =
  "mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const steps = [
  "Phòng và người thuê",
  "Điều khoản hợp đồng",
  "Xem trước hợp đồng",
  "Tạo và gửi hợp đồng",
];
function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-secondary-foreground">
      {title}
      {children}
    </label>
  );
}

export function AdminContractCreatePage({ draftId }: { draftId?: number }) {
  const params = useSearchParams();
  const agreement = params.get("mode") === "agreement";
  const draft = useQuery({
    queryKey: ["direct-contract-draft", draftId, agreement],
    queryFn: ({ signal }) =>
      agreement
        ? directContractService.agreement(draftId!, signal)
        : directContractService.draft(draftId!, signal),
    enabled: !!draftId,
  });
  if (draftId && draft.isLoading) return <PageLoading />;
  if (draftId && draft.isError)
    return <ErrorState onRetry={() => void draft.refetch()} />;
  return (
    <ContractForm
      key={`${draftId ?? "new"}-${draft.data?.version ?? 0}`}
      draftId={draftId}
      initial={draft.data}
    />
  );
}

function ContractForm({
  draftId,
  initial,
}: {
  draftId?: number;
  initial?: DirectDraft;
}) {
  const router = useRouter();
  const routeParams = useSearchParams();
  const client = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const requestKey = useRef("");
  const lastPayload = useRef("");
  const leaving = useRef(false);
  const saving = useRef(false);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [propertyId, setPropertyId] = useState<number | undefined>(
    initial?.propertyId ?? (Number(routeParams.get("propertyId")) || undefined),
  );
  const [roomId, setRoomId] = useState(
    initial?.request.roomId ?? (Number(routeParams.get("roomId")) || 0),
  );
  const [person, setPerson] = useState<TenantChoice | undefined>(
    initial?.tenant,
  );
  const selectedProfileId = Number(routeParams.get("tenantProfileId"));
  const selectedProfile = useQuery({
    queryKey: ["admin-tenant", selectedProfileId],
    queryFn: ({ signal }) =>
      adminTenantService.detail(selectedProfileId, signal),
    enabled: !!selectedProfileId && !draftId,
  });
  const profileHydrated = useRef(false);
  useEffect(() => {
    if (!profileHydrated.current && selectedProfile.data) {
      const p = selectedProfile.data;
      setPerson({
        id: p.id,
        full_name: p.fullName,
        tenant_code: p.tenantCode,
        phone: p.phone,
        email: p.email ?? undefined,
        has_account: p.hasAccount,
      });
      profileHydrated.current = true;
    }
  }, [selectedProfile.data]);
  const [newPerson, setNewPerson] = useState(false);
  const [personForm, setPersonForm] = useState<NewTenant>({
    fullName: "",
    phone: "",
  });
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [start, setStart] = useState(initial?.request.terms.startDate ?? "");
  const [end, setEnd] = useState(initial?.request.terms.endDate ?? "");
  const [checkin, setCheckin] = useState(
    initial?.request.expectedCheckinDate ?? "",
  );
  const [rent, setRent] = useState<number | string>(
    initial?.request.terms.monthlyRent ?? 0,
  );
  const [deposit, setDeposit] = useState<number | string>(
    initial?.request.terms.depositAmount ?? 0,
  );
  const [due, setDue] = useState<number | string>(
    initial?.request.terms.paymentDueDay ?? 5,
  );
  const [notice, setNotice] = useState<number | string>(
    initial?.request.terms.noticePeriodDays ?? 30,
  );
  const [initialRequired, setInitialRequired] = useState(
    initial?.request.terms.initialPaymentRequired ?? false,
  );
  const [note, setNote] = useState(
    initial?.status === "PENDING_CONFIRMATION"
      ? ""
      : (initial?.request.note ?? ""),
  );
  const [clauses, setClauses] = useState(
    initial?.request.terms.terms
      .filter((t) => t.title !== "Phương thức thanh toán")
      .map((t) => t.content)
      .join("\n\n") ?? "",
  );
  const [payment, setPayment] = useState(
    initial?.request.terms.terms.find(
      (t) => t.title === "Phương thức thanh toán",
    )?.content ?? "Chuyển khoản",
  );
  const [rates, setRates] = useState<NumericDraftFields<Rate, "unitPrice">[]>(
    initial?.request.terms.utilityRates ?? [
      {
        code: "ELECTRICITY",
        name: "Điện",
        calculationMethod: "METER",
        unitPrice: 0,
        unit: "kWh",
      },
      {
        code: "WATER",
        name: "Nước",
        calculationMethod: "METER",
        unitPrice: 0,
        unit: "m³",
      },
    ],
  );
  const [services, setServices] = useState<Service[]>(
    initial?.request.terms.services ?? [],
  );
  const [serviceEditing, setServiceEditing] = useState(false);
  const [servicesScope, setServicesScope] = useState(
    `${initial?.propertyId ?? ""}:${initial?.request.roomId ?? 0}`,
  );
  const currentServicesScope = `${propertyId ?? ""}:${roomId}`;

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (!leaving.current) event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]");
      if (
        link &&
        link.getAttribute("target") !== "_blank" &&
        !leaving.current &&
        !window.confirm("Bạn có dữ liệu chưa lưu. Rời trang?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const options = useQuery({
    queryKey: ["direct-contract-options", propertyId, keyword],
    queryFn: ({ signal }) =>
      directContractService.options(propertyId, keyword, signal),
  });
  const property = options.data?.properties.find((p) => p.id === propertyId);
  const room = options.data?.rooms.find((r) => r.id === roomId);
  const selectedTenant = newPerson ? personForm.fullName : person?.full_name;
  const serviceSummary = serviceTotals(services, start);
  const recurring =
    serviceSummary.recurring +
    rates
      .filter((r) => r.calculationMethod === "FIXED")
      .reduce((sum, r) => sum + Number(r.unitPrice), 0);
  const total =
    Number(deposit) + Number(rent) + recurring + serviceSummary.once;
  const updatePerson = (key: keyof NewTenant, value: string) =>
    setPersonForm((previous) => ({ ...previous, [key]: value || undefined }));
  function valid(through: number) {
    if (
      !propertyId ||
      !roomId ||
      (!newPerson && !person) ||
      (newPerson &&
        (!personForm.fullName?.trim() ||
          !/^(0[35789]\d{8}|\+84[35789]\d{8})$/.test(personForm.phone ?? "")))
    ) {
      setError(
        "Chọn nhà, phòng và người thuê; khách mới cần họ tên và số điện thoại Việt Nam hợp lệ.",
      );
      setStep(0);
      return false;
    }
    if (
      through >= 1 &&
      (!start ||
        !end ||
        start >= end ||
        !checkin ||
        checkin < start ||
        checkin >= end ||
        rent === "" ||
        numericPreview(rent) < 0 ||
        deposit === "" ||
        numericPreview(deposit) < 0 ||
        due === "" ||
        numericPreview(due) < 1 ||
        numericPreview(due) > 28 ||
        notice === "" ||
        numericPreview(notice) < 0)
    ) {
      setError(
        "Kiểm tra thời hạn thuê, ngày nhận phòng, giá thuê, tiền cọc và hạn thanh toán.",
      );
      setStep(1);
      return false;
    }
    setError("");
    return true;
  }
  function next() {
    if (serviceEditing) {
      setError(
        "Lưu hoặc hủy phần dịch vụ đang chỉnh sửa trước khi chuyển bước.",
      );
      return;
    }
    if (form.current?.reportValidity() && valid(step))
      setStep((s) => Math.min(3, s + 1));
  }
  async function save(submit: boolean) {
    if (serviceEditing) {
      setError(
        "Lưu hoặc hủy phần dịch vụ đang chỉnh sửa trước khi lưu hợp đồng.",
      );
      return;
    }
    if (services.length && servicesScope !== currentServicesScope) {
      setError("Kiểm tra và xác nhận lại dịch vụ cho nhà trọ/phòng đã chọn.");
      setStep(1);
      return;
    }
    if (busy || !valid(2) || !form.current?.reportValidity()) return;
    if (saving.current) return;
    if (
      submit &&
      (newPerson || !person?.has_account) &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        newPerson ? personForm.email || "" : person?.email || "",
      )
    ) {
      setError(
        "Email người thuê: cần địa chỉ hợp lệ để cấp tài khoản và gửi liên kết đặt mật khẩu. Bạn vẫn có thể lưu nháp.",
      );
      setStep(0);
      return;
    }
    const request: DirectContractRequest = {
      roomId,
      tenantProfileId: newPerson ? undefined : person?.id,
      newTenant: newPerson ? personForm : undefined,
      terms: {
        startDate: start,
        endDate: end,
        depositAmount: Number(deposit),
        monthlyRent: Number(rent),
        paymentDueDay: Number(due),
        noticePeriodDays: Number(notice),
        reservationTransferAmount: 0,
        utilityRates: rates.map((r) => ({
          ...r,
          unitPrice: parseNumericValue(r.unitPrice)!,
        })),
        services,
        initialPaymentRequired: initialRequired,
        terms: [
          ...(clauses.trim()
            ? [{ title: "Điều khoản bổ sung", content: clauses.trim() }]
            : []),
          { title: "Phương thức thanh toán", content: payment },
        ],
      },
      expectedCheckinDate: checkin,
      note: note || undefined,
      submit,
    };
    const serialized = JSON.stringify(request);
    if (lastPayload.current !== serialized) {
      requestKey.current = crypto.randomUUID();
      lastPayload.current = serialized;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await directContractService.save(
        request,
        requestKey.current,
        draftId,
        initial?.version,
        initial?.contentHash,
        initial?.status === "PENDING_CONFIRMATION",
      );
      leaving.current = true;
      setDirty(false);
      await client.invalidateQueries();
      router.push(
        `/admin/contracts/${result.id}?created=${result.status === "DRAFT" ? "draft" : "pending"}`,
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <AdminShell
      title="Tạo hợp đồng thuê phòng"
      subtitle="Lập trực tiếp, không cần giữ phòng trước"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap gap-2 text-sm text-muted-foreground"
        >
          <Link href="/admin/contracts">Hợp đồng</Link>
          <span>/</span>
          <span>
            {draftId ? "Chỉnh sửa bản nháp" : "Tạo hợp đồng thuê phòng"}
          </span>
        </nav>
        <div>
          <Link
            href="/admin/contracts"
            className="inline-flex items-center gap-2 text-sm text-link"
          >
            <ArrowLeft className="size-4" />
            Quay lại danh sách
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-foreground">
            Tạo hợp đồng thuê phòng
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Mã hợp đồng được sinh khi lưu. Tạo hợp đồng chưa phải ký kết hoặc
            nhận phòng.
          </p>
        </div>
        <ol
          aria-label="Các bước tạo hợp đồng"
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
        >
          {steps.map((title, index) => (
            <li
              key={title}
              aria-current={step === index ? "step" : undefined}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${step === index ? "border-ring bg-accent text-link" : "border-border bg-card text-muted-foreground"}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                {index < step ? <Check className="size-4" /> : index + 1}
              </span>
              {title}
            </li>
          ))}
        </ol>
        {options.isError && (
          <ErrorState
            onRetry={() => void options.refetch()}
            message={contractCreationLoadError(options.error)}
          />
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-muted p-4 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <ContractMeterReadiness
          roomId={roomId}
          requiredTypes={rates
            .filter((r) => r.calculationMethod === "METER")
            .map((r) => r.code)}
        />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form
            ref={form}
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 3) next();
              else void save(true);
            }}
            onChange={() => setDirty(true)}
            className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7 [&_button]:min-h-11"
          >
            <h2 className="mb-6 text-lg font-semibold">{steps[step]}</h2>
            <fieldset disabled={busy} className="space-y-5">
              {step === 0 && (
                <>
                  {options.isLoading && (
                    <div
                      aria-label="Đang tải dữ liệu"
                      className="h-12 animate-pulse rounded-xl bg-muted"
                    />
                  )}
                  <Field title="Nhà trọ *">
                    <select
                      required
                      disabled={!!draftId}
                      className={input}
                      value={propertyId ?? ""}
                      onChange={(e) => {
                        setPropertyId(Number(e.target.value) || undefined);
                        setRoomId(0);
                        setPerson(undefined);
                        setSearch("");
                      }}
                    >
                      <option value="">Chọn nhà trọ</option>
                      {options.data?.properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field title="Phòng thuê *">
                    <select
                      required
                      disabled={!propertyId || !!draftId || options.isFetching}
                      className={input}
                      value={roomId || ""}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setRoomId(id);
                        setRent(
                          Number(
                            options.data?.rooms.find((r) => r.id === id)
                              ?.monthly_rent ?? 0,
                          ),
                        );
                      }}
                    >
                      <option value="">Chọn phòng</option>
                      {options.data?.rooms.map((r) => (
                        <option
                          key={r.id}
                          value={r.id}
                          disabled={
                            !["VACANT", "READY", "OCCUPIED"].includes(r.status)
                          }
                        >
                          {r.code} · {r.floor_name || "Chưa ghi tầng"} ·{" "}
                          {r.area ?? "—"} m² · {formatCurrency(r.monthly_rent)}{" "}
                          · {r.capacity} người · {r.status}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Hệ thống kiểm tra lại lịch thuê, giữ phòng, bảo trì và tình
                    trạng phòng khi lưu hoặc gửi xác nhận.
                  </p>
                  {room?.status === "OCCUPIED" && (
                    <p className="rounded-xl bg-warning-muted p-3 text-sm text-amber-900">
                      Số hóa hợp đồng cho người đang ở: chọn đúng hồ sơ đang cư
                      trú tại phòng. Chỉ chấp nhận phòng có một cư trú chưa gắn
                      hợp đồng; dữ liệu nhiều người ở hoặc đã có hợp đồng cần
                      đối soát riêng. Vẫn phải xác nhận nội dung và bàn giao.
                    </p>
                  )}
                  {!draftId && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={!newPerson ? "default" : "outline"}
                        onClick={() => {
                          setNewPerson(false);
                          setDirty(true);
                        }}
                      >
                        Người thuê đã có hồ sơ
                      </Button>
                      <Button
                        type="button"
                        variant={newPerson ? "default" : "outline"}
                        onClick={() => {
                          setNewPerson(true);
                          setDirty(true);
                        }}
                      >
                        <Plus />
                        Thêm người thuê mới
                      </Button>
                    </div>
                  )}
                  {newPerson ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field title="Họ và tên *">
                        <input
                          required
                          maxLength={150}
                          className={input}
                          value={personForm.fullName ?? ""}
                          onChange={(e) =>
                            updatePerson("fullName", e.target.value)
                          }
                        />
                      </Field>
                      <Field title="Số điện thoại *">
                        <input
                          required
                          type="tel"
                          className={input}
                          value={personForm.phone ?? ""}
                          onChange={(e) =>
                            updatePerson("phone", e.target.value)
                          }
                        />
                      </Field>
                      <Field title="Email">
                        <input
                          type="email"
                          maxLength={255}
                          className={input}
                          value={personForm.email ?? ""}
                          onChange={(e) =>
                            updatePerson("email", e.target.value)
                          }
                        />
                      </Field>
                      <Field title="Ngày sinh">
                        <input
                          type="date"
                          className={input}
                          value={personForm.dateOfBirth ?? ""}
                          onChange={(e) =>
                            updatePerson("dateOfBirth", e.target.value)
                          }
                        />
                      </Field>
                      <Field title="Số CCCD/CMND">
                        <input
                          pattern="[0-9]{9}|[0-9]{12}"
                          className={input}
                          value={personForm.identityNumber ?? ""}
                          onChange={(e) =>
                            updatePerson("identityNumber", e.target.value)
                          }
                        />
                      </Field>
                      <Field title="Địa chỉ thường trú">
                        <input
                          maxLength={500}
                          className={input}
                          value={personForm.permanentAddress ?? ""}
                          onChange={(e) =>
                            updatePerson("permanentAddress", e.target.value)
                          }
                        />
                      </Field>
                      <Field title="Người liên hệ khẩn cấp">
                        <input
                          maxLength={150}
                          className={input}
                          value={personForm.emergencyContactName ?? ""}
                          onChange={(e) =>
                            updatePerson("emergencyContactName", e.target.value)
                          }
                        />
                      </Field>
                      <Field title="Điện thoại khẩn cấp">
                        <input
                          type="tel"
                          className={input}
                          value={personForm.emergencyContactPhone ?? ""}
                          onChange={(e) =>
                            updatePerson(
                              "emergencyContactPhone",
                              e.target.value,
                            )
                          }
                        />
                      </Field>
                    </div>
                  ) : (
                    <>
                      {!draftId && (
                        <Field title="Tìm người thuê">
                          <input
                            type="search"
                            disabled={!propertyId}
                            className={input}
                            placeholder="Họ tên, điện thoại, email hoặc mã khách"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </Field>
                      )}
                      <Field title="Người thuê đại diện *">
                        <select
                          required
                          disabled={!!draftId || !propertyId}
                          className={input}
                          value={person?.id ?? ""}
                          onChange={(e) =>
                            setPerson(
                              options.data?.tenants.find(
                                (t) => t.id === Number(e.target.value),
                              ),
                            )
                          }
                        >
                          <option value="">Chọn hồ sơ người thuê</option>
                          {person &&
                            !options.data?.tenants.some(
                              (t) => t.id === person.id,
                            ) && (
                              <option value={person.id}>
                                {person.full_name} · {person.phone}
                              </option>
                            )}
                          {options.data?.tenants.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.tenant_code} · {t.full_name} · {t.phone}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {person && !person.has_account && (
                        <p className="text-sm text-warning">
                          Hệ thống sẽ cấp tài khoản TENANT và gửi liên kết đặt
                          mật khẩu khi gửi hợp đồng. Email hợp lệ là bắt buộc
                          cho tài khoản mới.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field title="Ngày bắt đầu thuê *">
                    <input
                      required
                      type="date"
                      className={input}
                      value={start}
                      onChange={(e) => {
                        setStart(e.target.value);
                        if (!checkin) setCheckin(e.target.value);
                      }}
                    />
                  </Field>
                  <Field title="Ngày kết thúc thuê *">
                    <input
                      required
                      type="date"
                      className={input}
                      value={end}
                      min={start}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </Field>
                  <Field title="Ngày dự kiến nhận phòng *">
                    <input
                      required
                      type="date"
                      className={input}
                      min={start}
                      max={end}
                      value={checkin}
                      disabled={initial?.status === "PENDING_CONFIRMATION"}
                      onChange={(e) => setCheckin(e.target.value)}
                    />
                  </Field>
                  <Field title="Giá thuê / tháng (đ) *">
                    <CurrencyInput
                      required
                      type="number"
                      min={0}
                      max={9999999999999}
                      step="0.01"
                      className={input}
                      value={rent}
                      onChange={(e) => setRent(e.target.value)}
                    />
                  </Field>
                  <Field title="Tiền cọc phải thu (đ) *">
                    <CurrencyInput
                      required
                      type="number"
                      min={0}
                      max={9999999999999}
                      step="0.01"
                      className={input}
                      value={deposit}
                      disabled={initial?.status === "PENDING_CONFIRMATION"}
                      onChange={(e) => setDeposit(e.target.value)}
                    />
                  </Field>
                  <Field title="Ngày đến hạn thanh toán (1–28) *">
                    <NumberInput
                      required
                      type="number"
                      min={1}
                      max={28}
                      className={input}
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </Field>
                  <Field title="Số ngày báo trước khi chấm dứt">
                    <NumberInput
                      required
                      type="number"
                      min={0}
                      max={3650}
                      className={input}
                      value={notice}
                      onChange={(e) => setNotice(e.target.value)}
                    />
                  </Field>
                  <p className="self-center text-sm text-muted-foreground">
                    Hợp đồng có thời hạn, thanh toán hàng tháng; giá thuê được
                    lưu riêng trong hợp đồng.
                  </p>
                  <div className="sm:col-span-2">
                    <Field
                      title={
                        initial?.status === "PENDING_CONFIRMATION"
                          ? "Lý do cập nhật phiên bản *"
                          : "Ghi chú"
                      }
                    >
                      <textarea
                        maxLength={
                          initial?.status === "PENDING_CONFIRMATION"
                            ? 1000
                            : 2000
                        }
                        required={initial?.status === "PENDING_CONFIRMATION"}
                        className={input}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field title="Quyền, nghĩa vụ và điều khoản bổ sung">
                      <textarea
                        rows={5}
                        maxLength={5000}
                        className={input}
                        value={clauses}
                        onChange={(e) => setClauses(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              )}
              {step === 1 && (
                <>
                  {rates.map((rate, index) => (
                    <div
                      key={rate.code}
                      className="grid gap-3 rounded-xl bg-muted p-4 sm:grid-cols-2"
                    >
                      <Field title={`${rate.name}: phương pháp tính`}>
                        <select
                          className={input}
                          value={rate.calculationMethod}
                          onChange={(e) =>
                            setRates((old) =>
                              old.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      calculationMethod: e.target
                                        .value as Rate["calculationMethod"],
                                      unit:
                                        e.target.value === "FIXED"
                                          ? "tháng"
                                          : r.code === "ELECTRICITY"
                                            ? "kWh"
                                            : "m³",
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="METER">Theo công tơ</option>
                          <option value="FIXED">Định mức / tháng</option>
                        </select>
                      </Field>
                      <Field title={`Đơn giá (đ/${rate.unit})`}>
                        <CurrencyInput
                          required
                          type="number"
                          min={0}
                          step="0.01"
                          className={input}
                          value={rate.unitPrice}
                          onChange={(e) =>
                            setRates((old) =>
                              old.map((r, i) =>
                                i === index
                                  ? { ...r, unitPrice: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Chỉ số đầu kỳ và chứng cứ bàn giao được ghi tại phiếu nhận
                    phòng, không xác nhận bàn giao ở bước tạo hợp đồng.
                  </p>
                  <ContractServicesEditor
                    propertyId={propertyId}
                    start={start}
                    end={end}
                    value={services}
                    onChange={(rows) => {
                      setServices(rows);
                      setDirty(true);
                      if (!services.length)
                        setServicesScope(currentServicesScope);
                    }}
                    scopeAccepted={
                      !services.length || servicesScope === currentServicesScope
                    }
                    onAcceptScope={() => {
                      setServicesScope(currentServicesScope);
                      setDirty(true);
                    }}
                    onEditingChange={(editing) => {
                      setServiceEditing(editing);
                      if (editing) setDirty(true);
                    }}
                  />
                  <Field title="Phương thức thanh toán thỏa thuận">
                    <select
                      className={input}
                      value={payment}
                      onChange={(e) => setPayment(e.target.value)}
                    >
                      <option>Chuyển khoản</option>
                      <option>Tiền mặt</option>
                      <option>Tiền mặt hoặc chuyển khoản</option>
                    </select>
                  </Field>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={initialRequired}
                      onChange={(e) => setInitialRequired(e.target.checked)}
                    />
                    Yêu cầu thanh toán hóa đơn kỳ đầu trước khi hoàn tất nhận
                    phòng
                  </label>
                  <p className="rounded-xl bg-accent p-4 text-sm text-link">
                    Đã thanh toán: 0 đ. Hợp đồng trực tiếp không có tiền giữ chỗ
                    chuyển sang. Mọi khoản thực thu cần chứng từ riêng; biểu mẫu
                    không tạo giao dịch hoặc hóa đơn.
                  </p>
                </>
              )}
              {(step === 2 || step === 3) && (
                <div className="space-y-5 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {steps.slice(0, 2).map((s, i) => (
                      <Button
                        key={s}
                        type="button"
                        variant="outline"
                        onClick={() => setStep(i)}
                      >
                        Sửa {s.toLowerCase()}
                      </Button>
                    ))}
                  </div>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[
                      ["Chủ nhà", property?.owner_name],
                      ["Nhà trọ", property?.name],
                      ["Địa chỉ", property?.address],
                      ["Phòng", room?.code],
                      ["Người thuê", selectedTenant],
                      [
                        "Điện thoại",
                        newPerson ? personForm.phone : person?.phone,
                      ],
                      ["Thời hạn", `${start} → ${end}`],
                      ["Dự kiến nhận phòng", checkin],
                      [
                        "Giá thuê / tháng",
                        formatCurrency(numericPreview(rent)),
                      ],
                      ["Tiền cọc", formatCurrency(numericPreview(deposit))],
                      [
                        "Thanh toán",
                        `${payment}, hàng tháng, đến hạn ngày ${due}`,
                      ],
                      ["Báo trước chấm dứt", `${notice} ngày`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="mt-1 font-medium">
                          {value || "Chưa cung cấp"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div>
                    {rates.map((r) => (
                      <p key={r.code}>
                        {r.name}: {formatCurrency(numericPreview(r.unitPrice))}/
                        {r.unit} ·{" "}
                        {r.calculationMethod === "METER"
                          ? "Theo công tơ"
                          : "Định mức"}
                      </p>
                    ))}
                    {services.map((s) => (
                      <p key={s.code}>
                        {s.name}: {formatCurrency(s.unitPrice)} ·{" "}
                        {serviceMethods[s.calculationMethod]} ·{" "}
                        {s.quantity ?? 1} {s.unit ?? "tháng"}
                        {s.status === "INACTIVE" && " · Không áp dụng"}
                      </p>
                    ))}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      Quyền, nghĩa vụ và điều khoản bổ sung
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap">
                      {clauses ||
                        "Chưa bổ sung điều khoản. Có thể quay lại bước 2 để nhập trước khi gửi xác nhận."}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                      {note}
                    </p>
                  </div>
                  <p className="rounded-xl border border-warning-border bg-warning-muted p-4">
                    Sau khi tạo: hai bên xác nhận nội dung, xác minh danh tính,
                    thu cọc theo chứng từ và hoàn tất biên bản nhận phòng. Chỉ
                    sau đó hợp đồng và cư trú được kích hoạt.
                  </p>
                </div>
              )}
            </fieldset>
            <div className="mt-8 flex flex-wrap justify-between gap-3 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={busy || serviceEditing || step === 0}
                onClick={() => setStep((s) => s - 1)}
              >
                Quay lại
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void save(false)}
                >
                  <Save />
                  {busy
                    ? "Đang lưu..."
                    : initial?.status === "PENDING_CONFIRMATION"
                      ? "Lưu phiên bản mới"
                      : "Lưu nháp"}
                </Button>
                <Button
                  type="submit"
                  disabled={busy}
                  className="bg-blue-700 text-white hover:bg-blue-800"
                >
                  {step < 3
                    ? "Tiếp tục"
                    : initial?.status === "PENDING_CONFIRMATION"
                      ? "Lưu & yêu cầu xác nhận lại"
                      : "Tạo & gửi hợp đồng"}
                </Button>
              </div>
            </div>
          </form>
          <aside className="rounded-2xl border border-accent-border bg-accent p-5 lg:sticky lg:top-6">
            <h2 className="font-semibold text-blue-950">Tóm tắt hợp đồng</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Nhà trọ", property?.name || "Chưa chọn"],
                ["Phòng", room?.code || "Chưa chọn"],
                ["Người thuê", selectedTenant || "Chưa chọn"],
                [
                  "Thời gian",
                  start && end ? `${start} → ${end}` : "Chưa thiết lập",
                ],
                ["Giá thuê / tháng", formatCurrency(numericPreview(rent))],
                ["Tiền cọc", formatCurrency(numericPreview(deposit))],
                [
                  "Dịch vụ định kỳ dự kiến kỳ đầu / định mức",
                  formatCurrency(recurring),
                ],
                [
                  "Phí một lần dự kiến kỳ đầu",
                  formatCurrency(serviceSummary.once),
                ],
                [
                  "Dịch vụ theo sử dụng",
                  serviceSummary.usage
                    ? `${serviceSummary.usage} dịch vụ · chưa tính phí`
                    : "Chưa chọn",
                ],
                ["Tạm tính cần thu ban đầu", formatCurrency(total)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-secondary-foreground">{label}</dt>
                  <dd className="text-right font-medium text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs leading-relaxed text-secondary-foreground">
              Tạm tính kỳ đầu theo số lượng đã khai, chưa phân bổ ngày lẻ, chưa
              gồm tiêu thụ công tơ và lượt sử dụng. Phí theo người dùng lịch sử
              cư trú thực tế khi lập hóa đơn. Số phải thu chính thức theo hóa
              đơn và sổ cọc. Không ghi nhận thực thu khi lưu.
            </p>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
