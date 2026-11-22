"use client";
import Link from "next/link";
import { useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader, SearchInput } from "@/components/shared/management-ui";
import { ErrorState } from "@/components/shared/dashboard-ui";
import { useAdminTenants } from "@/hooks/use-admin-tenants";
import { useManagementProperty } from "@/providers/management-scope";
import type { TenantRow } from "@/types/admin-tenant";

export function TenantIntakePage() {
  const [step, setStep] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [profile, setProfile] = useState<TenantRow>();
  const [propertyId, setPropertyId] = useManagementProperty();
  const [roomId, setRoom] = useState<number>();
  const query = useAdminTenants({
    keyword: keyword.trim() || undefined,
    size: 10,
  });
  return (
    <AdminShell
      title="Tiếp nhận khách thuê"
      subtitle="Hồ sơ → phòng → hợp đồng → xác nhận → bàn giao"
      readOnly
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHeader
          title="Tiếp nhận khách thuê"
          description="Chọn hồ sơ có sẵn để tiếp tục quá trình thuê."
        />
        <ol className="grid grid-cols-3 gap-2">
          {["1. Hồ sơ khách", "2. Chọn phòng", "3. Xem lại"].map((s, i) => (
            <li
              key={s}
              className={`rounded-xl border p-3 text-sm font-semibold ${i === step ? "border-blue-600 bg-accent text-link" : "border-border bg-card text-muted-foreground"}`}
            >
              {s}
            </li>
          ))}
        </ol>
        <section className="space-y-4 surface-card p-5 sm:p-6">
          {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
          {step === 0 && (
            <>
              <SearchInput
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm tên, mã hoặc điện thoại"
              />
              {query.isFetching && (
                <p className="text-sm text-muted-foreground">Đang tải hồ sơ…</p>
              )}
              <div className="space-y-2">
                {query.data?.page.items.map((p) => (
                  <button
                    key={p.id}
                    className={`block w-full rounded-xl border p-3 text-left text-sm ${profile?.id === p.id ? "border-blue-600 bg-accent" : "border-border"}`}
                    onClick={() => setProfile(p)}
                  >
                    <strong>{p.fullName}</strong>
                    <span className="ml-3 text-muted-foreground">
                      {p.tenantCode} · {p.phone}
                    </span>
                  </button>
                ))}
              </div>
              <Link
                className="inline-block text-sm font-semibold text-link"
                href="/admin/tenants/new"
              >
                Chưa có hồ sơ? Tạo hồ sơ độc lập
              </Link>
            </>
          )}
          {step === 1 && (
            <>
              <label className="block text-sm">
                Nhà trọ
                <select
                  className={input}
                  value={propertyId ?? ""}
                  onChange={(e) => {
                    setPropertyId(Number(e.target.value) || undefined);
                    setRoom(undefined);
                  }}
                >
                  <option value="">Chọn nhà trọ được phân quyền</option>
                  {query.data?.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Phòng
                <select
                  className={input}
                  value={roomId ?? ""}
                  onChange={(e) => setRoom(Number(e.target.value) || undefined)}
                >
                  <option value="">Chọn phòng</option>
                  {query.data?.rooms
                    .filter((r) => r.propertyId === propertyId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} · {r.status} · {r.capacity} người
                      </option>
                    ))}
                </select>
              </label>
              <p className="text-sm text-muted-foreground">
                Khả năng tiếp nhận theo ngày thuê được kiểm tra lại trên backend
                khi lập hợp đồng.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <p className="font-bold">
                {profile?.fullName} · {profile?.tenantCode}
              </p>
              <p className="text-sm">
                {query.data?.properties.find((p) => p.id === propertyId)?.name}{" "}
                · Phòng {query.data?.rooms.find((r) => r.id === roomId)?.code}
              </p>
              <p className="text-sm text-muted-foreground">
                Bước tiếp theo: điều khoản, giá và dịch vụ; sau đó hai bên xác
                nhận và bàn giao. Tiền cọc được ghi nhận bằng giao dịch riêng
                trong sổ cọc.
              </p>
              <Link
                className={primary}
                href={`/admin/contracts/new?tenantProfileId=${profile?.id}&propertyId=${propertyId}&roomId=${roomId}`}
              >
                Tiếp tục lập hợp đồng
              </Link>
              <Link
                className="ml-4 text-sm text-link"
                href={`/admin/rental-lifecycle?propertyId=${propertyId}&roomId=${roomId}`}
              >
                Xem giữ phòng / đặt phòng
              </Link>
            </>
          )}
          <div className="flex justify-between border-t pt-4">
            <button
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
            >
              Quay lại
            </button>
            {step < 2 && (
              <button
                disabled={step === 0 ? !profile : !roomId || !propertyId}
                onClick={() => setStep(step + 1)}
                className={primary}
              >
                Tiếp theo
              </button>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
const input =
  "mt-2 block min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm";
const primary =
  "inline-flex rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";
