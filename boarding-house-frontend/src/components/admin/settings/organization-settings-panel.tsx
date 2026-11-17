"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { organizationService } from "@/services/organization.service";
import { apiErrorMessage } from "@/lib/api-error";
import { ErrorState } from "@/components/shared/dashboard-ui";
import { AccountField } from "@/components/admin/accounts/accounts-page";
export function OrganizationSettingsPanel() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const key = ["organizations", user?.id, user?.activeRole];
  const list = useQuery({
    queryKey: key,
    enabled: user?.activeRole === "OWNER",
    queryFn: ({ signal }) => organizationService.list(signal),
  });
  const current =
    selected === 0
      ? null
      : (list.data?.find((o) => o.id === selected) ?? list.data?.[0]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      code: String(data.get("code")).trim(),
      name: String(data.get("name")).trim(),
      description: String(data.get("description")).trim(),
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (current) await organizationService.update(current.id, payload);
      else setSelected(await organizationService.create(payload));
      await client.invalidateQueries({ queryKey: key });
      setNotice("Đã lưu thông tin tổ chức.");
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const input =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm";
  if (user?.activeRole !== "OWNER") return null;
  return (
    <section className="mb-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">Thông tin chủ sở hữu / Tổ chức</h2>
      <p className="text-sm leading-6 text-slate-500">
        Bạn có thể vận hành với tư cách cá nhân hoặc doanh nghiệp. Không cần tạo
        công ty để quản lý nhà trọ. Tổ chức đã thiết lập được giữ lại và dùng
        cho phân nhóm vận hành.
      </p>
      {list.isPending && <p role="status">Đang tải thông tin...</p>}
      {list.isError && (
        <ErrorState
          onRetry={() => void list.refetch()}
          message={apiErrorMessage(list.error)}
        />
      )}{" "}
      {list.isSuccess && (
        <>
          <AccountField title="Tổ chức vận hành">
            <select
              className={input}
              value={current?.id ?? 0}
              disabled={busy}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              <option value="0">Thêm tổ chức khi cần</option>
              {list.data.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </AccountField>
          <form key={current?.id ?? "new"} onSubmit={save}>
            <fieldset disabled={busy} className="space-y-4">
              <AccountField title="Mã tổ chức">
                <input
                  className={input}
                  name="code"
                  defaultValue={current?.code ?? ""}
                  required
                  maxLength={50}
                />
              </AccountField>
              <AccountField title="Tên chủ sở hữu / Tổ chức vận hành">
                <input
                  className={input}
                  name="name"
                  defaultValue={current?.name ?? ""}
                  required
                  maxLength={150}
                />
              </AccountField>
              <AccountField title="Mô tả">
                <textarea
                  className={input}
                  name="description"
                  defaultValue={current?.description ?? ""}
                  maxLength={1000}
                />
              </AccountField>
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="text-sm text-emerald-700">
                  {notice}
                </p>
              )}
              <button className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {busy
                  ? "Đang lưu..."
                  : current
                    ? "Lưu thông tin tổ chức"
                    : "Thêm tổ chức"}
              </button>
            </fieldset>
          </form>
        </>
      )}
      <Link
        className="inline-block text-sm font-bold text-blue-600"
        href="/admin/areas"
      >
        Đến Khu vực & Phân công
      </Link>
    </section>
  );
}
