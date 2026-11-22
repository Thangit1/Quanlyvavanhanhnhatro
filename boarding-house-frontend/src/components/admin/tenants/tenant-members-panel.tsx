"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminTenants } from "@/hooks/use-admin-tenants";
import { adminTenantService } from "@/services/admin-tenant.service";
import { apiErrorMessage } from "@/lib/api-error";

export function TenantMembersPanel({
  propertyId,
  roomId,
  contractId,
  canWrite,
}: {
  propertyId: number;
  roomId: number;
  contractId?: number;
  canWrite: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState(0);
  const [role, setRole] = useState<"OCCUPANT" | "DEPENDENT">("OCCUPANT");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const client = useQueryClient();
  const profiles = useAdminTenants(
    { keyword: keyword.trim(), size: 10 },
    canWrite && keyword.trim().length >= 3,
  );
  if (!canWrite) return null;
  return (
    <form
      className="mb-5 space-y-3 rounded-xl border border-border bg-muted p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError("");
        try {
          await adminTenantService.attachResidence(selected, {
            propertyId,
            roomId,
            contractId,
            moveInDate: date,
            residenceRole: role,
          });
          setSelected(0);
          setKeyword("");
          await client.invalidateQueries();
        } catch (e) {
          setError(
            apiErrorMessage(
              e,
              "Không thể thêm thành viên. Kiểm tra hợp đồng và sức chứa phòng.",
            ),
          );
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <h2 className="font-bold">Thêm người ở cùng từ hồ sơ có sẵn</h2>
      <p className="text-sm text-muted-foreground">
        Hệ thống kiểm tra hợp đồng đang ở, sức chứa và lượt cư trú hiện tại.
        Thành viên dùng hồ sơ riêng; tài khoản đăng nhập được cấp riêng khi cần.
      </p>
      <input
        aria-label="Tìm hồ sơ thành viên"
        value={keyword}
        onChange={(e) => {
          setKeyword(e.target.value);
          setSelected(0);
        }}
        placeholder="Nhập ít nhất 3 ký tự: tên, mã hoặc số điện thoại"
        className={input}
      />
      {profiles.isError && (
        <p role="alert">Không tải được hồ sơ. Vui lòng thử lại.</p>
      )}
      <select
        required
        aria-label="Hồ sơ thành viên"
        value={selected || ""}
        onChange={(e) => setSelected(Number(e.target.value))}
        className={input}
      >
        <option value="">Chọn hồ sơ trong kết quả tìm kiếm</option>
        {profiles.data?.page.items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.tenantCode} · {p.fullName} · {p.phone}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Ngày vào ở
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={input}
          />
        </label>
        <label className="text-sm">
          Vai trò
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className={input}
          >
            <option value="OCCUPANT">Người ở cùng</option>
            <option value="DEPENDENT">Người phụ thuộc</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          disabled={busy || !selected}
          className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Đang lưu…" : "Xác nhận thêm thành viên"}
        </button>
        <Link
          href="/admin/tenants/new"
          className="text-sm font-semibold text-link"
        >
          Tạo hồ sơ mới
        </Link>
      </div>
    </form>
  );
}
const input =
  "mt-1 block min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm";
