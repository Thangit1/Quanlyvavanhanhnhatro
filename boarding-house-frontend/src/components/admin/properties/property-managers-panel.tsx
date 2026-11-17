"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import {
  ownerAccessService,
  managerCapabilities,
  type ManagerCapability,
} from "@/services/owner-access.service";
import { apiErrorMessage } from "@/lib/api-error";
const input = "w-full rounded-xl border border-slate-300 bg-white p-3 text-sm";
export function PropertyManagersPanel({ propertyId }: { propertyId: number }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [manager, setManager] = useState(0),
    [properties, setProperties] = useState<number[]>([propertyId]),
    [capabilities, setCapabilities] = useState<ManagerCapability[]>([]),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["owner-property-access", user?.id, user?.activeRole, propertyId],
    enabled: user?.activeRole === "OWNER",
    queryFn: ({ signal }) => ownerAccessService.detail(propertyId, signal),
    refetchInterval: 15_000,
  });
  if (user?.activeRole !== "OWNER") return null;
  async function refresh() {
    await client.cancelQueries();
    await client.invalidateQueries();
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!manager || !properties.length) return;
    if (
      !window.confirm(
        `Phân công/cập nhật quyền cho quản lý tại ${properties.length} nhà trọ đã chọn? Quyền của quản lý này tại các nhà trọ đã chọn sẽ được thay bằng lựa chọn bên dưới.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await ownerAccessService.assign({
        propertyIds: properties,
        userId: manager,
        capabilities,
        reason: reason.trim(),
      });
      await refresh();
      setNotice(
        `Đã cập nhật phân công tại ${properties.length} nhà trọ. Các tài khoản quản lý sẽ nhận dữ liệu mới khi làm mới trang.`,
      );
      setReason("");
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: number) {
    if (!reason.trim()) {
      setError("Nhập lý do trước khi thu hồi phân công.");
      return;
    }
    if (
      !window.confirm(
        "Thu hồi quyền truy cập của quản lý tại nhà trọ này? Các nhà trọ khác được giữ nguyên.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await ownerAccessService.revoke(propertyId, id, reason.trim());
      await refresh();
      setNotice(
        "Đã thu hồi phân công. Backend từ chối truy cập nhà trọ này ngay từ yêu cầu tiếp theo.",
      );
      setReason("");
      if (manager === id) {
        setManager(0);
        setCapabilities([]);
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="property-managers"
      className="space-y-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-bold">Phân công quản lý</h2>
        <p className="mt-1 text-sm text-slate-600">
          Quản lý chỉ thấy nhà trọ được chủ nhà phân công. Phân công không tạo
          bản sao dữ liệu và không đổi chủ sở hữu.
        </p>
      </div>
      {query.isPending && <p>Đang tải phân công…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-red-700">
          {apiErrorMessage(query.error)}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void query.refetch()}
          >
            Thử lại
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}
      {query.data && (
        <>
          <div className="space-y-3">
            <h3 className="font-semibold">
              Đã phân công ({query.data.assignments.length})
            </h3>
            {!query.data.assignments.length && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Chưa phân công quản lý cho nhà trọ này. Tài khoản Manager sẽ
                chưa nhìn thấy nhà trọ/phòng tại đây.
              </p>
            )}
            {query.data.assignments.map((a) => (
              <article
                key={a.manager_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div>
                  <strong>
                    {a.full_name} · #{a.manager_id}
                  </strong>
                  <p className="text-xs text-slate-500">
                    {a.status === "ACTIVE" && a.has_manager_role
                      ? "Đang hoạt động"
                      : "Tài khoản đã ngừng/thiếu vai trò Manager; không thể truy cập"}
                  </p>
                  <ul className="mt-1 text-xs text-slate-600">
                    {query
                      .data!.capabilities.filter(
                        (c) => c.manager_id === a.manager_id,
                      )
                      .map((c) => (
                        <li key={c.capability}>
                          {managerCapabilities[c.capability]}
                        </li>
                      ))}
                  </ul>
                  {!query.data!.capabilities.some(
                    (c) => c.manager_id === a.manager_id,
                  ) && (
                    <p className="text-xs">
                      Chỉ quản lý vận hành; chưa được cấp quyền nhạy cảm.
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={
                      busy || a.status !== "ACTIVE" || !a.has_manager_role
                    }
                    className="text-sm text-blue-700 underline disabled:opacity-40"
                    onClick={() => {
                      setManager(a.manager_id);
                      setProperties([propertyId]);
                      setCapabilities(
                        query
                          .data!.capabilities.filter(
                            (c) => c.manager_id === a.manager_id,
                          )
                          .map((c) => c.capability),
                      );
                      setNotice("");
                    }}
                  >
                    Sửa quyền
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm text-red-700 underline"
                    onClick={() => void revoke(a.manager_id)}
                  >
                    Thu hồi tại nhà trọ này
                  </button>
                </div>
              </article>
            ))}
          </div>
          <form
            onSubmit={(e) => void save(e)}
            className="space-y-4 border-t pt-4"
          >
            <label className="block text-sm font-medium">
              Manager đang hoạt động
              <select
                required
                disabled={busy}
                className={`${input} mt-1`}
                value={manager || ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setManager(id);
                  setCapabilities(
                    query
                      .data!.capabilities.filter((c) => c.manager_id === id)
                      .map((c) => c.capability),
                  );
                }}
              >
                <option value="">Chọn quản lý</option>
                {query.data.availableManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} · #{m.id}
                  </option>
                ))}
              </select>
            </label>
            {!query.data.availableManagers.length && (
              <p className="rounded-xl bg-slate-50 p-3 text-sm">
                Chưa có tài khoản MANAGER đang hoạt động. Liên hệ quản trị hệ
                thống để tạo/kích hoạt và cấp vai trò Manager theo quy trình
                quản lý tài khoản, sau đó tải lại danh sách. Đăng ký công khai
                hiện chỉ tạo tài khoản khách thuê.
              </p>
            )}
            <fieldset disabled={busy} className="space-y-2">
              <legend className="mb-2 text-sm font-semibold">
                Nhà trọ cần phân công/cập nhật quyền
              </legend>
              {query.data.properties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={properties.includes(p.id)}
                    onChange={(e) =>
                      setProperties((old) =>
                        e.target.checked
                          ? [...old, p.id]
                          : old.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.name}
                  {p.id === propertyId ? " (nhà trọ đang xem)" : ""}
                </label>
              ))}
            </fieldset>
            <fieldset disabled={busy} className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold">
                Quyền theo nghiệp vụ
              </legend>
              {Object.entries(managerCapabilities).map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={capabilities.includes(key as ManagerCapability)}
                    onChange={(e) =>
                      setCapabilities((old) =>
                        e.target.checked
                          ? [...old, key as ManagerCapability]
                          : old.filter((c) => c !== key),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-slate-500">
              Không chọn quyền nhạy cảm vẫn cho phép vận hành phòng/người thuê
              trong nhà trọ được phân công. Quyền tài chính, phê duyệt và xuất
              dữ liệu chỉ được cấp khi bạn chọn rõ ràng. Cấp ghi tài chính nên
              đi cùng quyền xem tài chính để thực hiện đầy đủ luồng.
            </p>
            <label className="block text-sm font-medium">
              Lý do phân công, sửa quyền hoặc thu hồi
              <textarea
                required
                maxLength={500}
                rows={2}
                className={`${input} mt-1`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button
              disabled={
                busy || !manager || !properties.length || !reason.trim()
              }
              className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Đang cập nhật…" : "Lưu phân công và quyền đã chọn"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
