"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  accountProvisioningService as service,
  type ProvisionResult,
} from "@/services/account-provisioning.service";
import {
  CreateAccountWizard,
  InitialCredentialDialog,
} from "./create-account-wizard";
import {
  EmptyState,
  ErrorState,
  StatusBadge,
} from "@/components/shared/dashboard-ui";
import { apiErrorMessage } from "@/lib/api-error";
export function ManagerTenantAccounts() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [create, setCreate] = useState(false),
    [keyword, setKeyword] = useState(""),
    [page, setPage] = useState(0),
    [property, setProperty] = useState(0),
    [credential, setCredential] = useState<ProvisionResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const data = useQuery({
    queryKey: ["account-provisioning-options", user?.id, user?.activeRole],
    enabled: user?.activeRole === "MANAGER",
    queryFn: ({ signal }) => service.options(signal),
    refetchInterval: 15000,
  });
  async function refresh() {
    await client.invalidateQueries();
  }
  async function reset(id: number) {
    const reason = window.prompt("Lý do đặt lại mật khẩu người thuê:");
    if (!reason?.trim()) return;
    setBusy(true);
    setError("");
    try {
      setCredential(await service.reset(id, reason));
      await refresh();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function status(id: number, current: string) {
    const reason = window.prompt("Lý do đổi trạng thái tài khoản:");
    if (!reason?.trim()) return;
    setBusy(true);
    setError("");
    try {
      await service.status(
        id,
        current === "ACTIVE" ? "LOCKED" : "ACTIVE",
        reason,
      );
      await refresh();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (user?.activeRole !== "MANAGER")
    return (
      <EmptyState text="Chức năng dành cho người quản trị tài khoản trong phạm vi hợp lệ." />
    );
  const rows = (data.data?.tenantProfiles ?? []).filter(
    (p) =>
      (!property || p.property_id === property) &&
      `${p.full_name} ${p.phone} ${p.email}`
        .toLowerCase()
        .includes(keyword.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-2xl font-extrabold">Tài khoản người thuê</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tạo và hỗ trợ tài khoản trong các cơ sở được phân công.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            className="rounded-xl border border-slate-200 p-3 text-sm font-semibold"
            href="/admin/tenants"
          >
            Hồ sơ & lịch sử thuê
          </Link>
          <button
            className="rounded-xl bg-blue-600 p-3 text-sm font-bold text-white"
            onClick={() => setCreate(true)}
          >
            + Tạo tài khoản
          </button>
        </div>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold">
          Tìm người thuê
          <input
            className="w-full rounded-xl border border-slate-200 bg-white p-3"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Nhà trọ
          <select
            className="w-full rounded-xl border border-slate-200 bg-white p-3"
            value={property}
            onChange={(e) => {
              setProperty(Number(e.target.value));
              setPage(0);
            }}
          >
            <option value={0}>Các cơ sở được giao</option>
            {data.data?.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {data.isPending && <p role="status">Đang tải tài khoản người thuê...</p>}
      {data.isError && (
        <ErrorState
          message={apiErrorMessage(data.error)}
          onRetry={() => void data.refetch()}
        />
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Người thuê", "Cơ sở / Phòng", "Tài khoản", "Thao tác"].map(
                  (label) => (
                    <th key={label} className="p-4">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.slice(page * 20, (page + 1) * 20).map((p) => (
                <tr className="border-t border-slate-100" key={p.id}>
                  <td className="p-4">
                    <p className="font-semibold">{p.full_name}</p>
                    <p className="text-xs text-slate-500">
                      {p.phone} · {p.email}
                    </p>
                  </td>
                  <td className="p-4">
                    {p.property_name ?? "Chưa gán"} ·{" "}
                    {p.room_code ?? "Chưa nhận phòng"}
                  </td>
                  <td className="p-4">
                    {p.user_id ? (
                      <>
                        <StatusBadge status={p.account_status ?? "ACTIVE"} />
                        {p.must_change_password && (
                          <p className="mt-1 text-xs text-amber-700">
                            Chờ đổi mật khẩu lần đầu
                          </p>
                        )}
                      </>
                    ) : (
                      "Chưa có tài khoản"
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-3">
                      <Link
                        className="font-bold text-blue-600"
                        href={`/admin/tenants/${p.id}`}
                      >
                        Hồ sơ
                      </Link>
                      {p.user_id && (
                        <>
                          <button
                            disabled={busy}
                            className="font-semibold text-blue-600"
                            onClick={() => void reset(p.user_id!)}
                          >
                            Đặt lại mật khẩu
                          </button>
                          <button
                            disabled={busy}
                            className="font-semibold text-red-600"
                            onClick={() =>
                              void status(
                                p.user_id!,
                                p.account_status ?? "ACTIVE",
                              )
                            }
                          >
                            {p.account_status === "ACTIVE"
                              ? "Khóa"
                              : "Kích hoạt / Mở khóa"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && data.isSuccess && (
          <EmptyState text="Chưa có hồ sơ trong phạm vi." />
        )}
        <div className="flex justify-end gap-4 border-t border-slate-100 p-4 text-sm">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Trước
          </button>
          <span>Trang {page + 1}</span>
          <button
            disabled={(page + 1) * 20 >= rows.length}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </button>
        </div>
      </section>
      {create && (
        <CreateAccountWizard
          onClose={() => setCreate(false)}
          onCreated={refresh}
        />
      )}{" "}
      {credential && (
        <InitialCredentialDialog
          result={credential}
          onClose={() => setCredential(null)}
        />
      )}
    </div>
  );
}
