"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { directContractService } from "@/services/direct-contract.service";
import { apiErrorMessage } from "@/lib/api-error";

export function ContractCreatedNotice() {
  const params = useSearchParams();
  return params.has("created") ? (
    <p
      role="status"
      className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"
    >
      Đã lưu hợp đồng thành công.{" "}
      {params.get("created") === "draft"
        ? "Bản nháp chưa giữ phòng hoặc kích hoạt cư trú."
        : "Hợp đồng đang chờ xác nhận, chưa hoàn tất ký kết hoặc nhận phòng."}
    </p>
  ) : null;
}

export function DirectContractDraftPanel({
  contractId,
  tenantId,
}: {
  contractId: number;
  tenantId: number;
}) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <h2 className="font-semibold">Tiếp tục bản nháp</h2>
      <p className="text-sm text-slate-600">
        Kiểm tra điều khoản, tạo tài khoản người thuê nếu chưa có, sau đó gửi
        xác nhận. Chỉ giữ cam kết lịch thuê từ khi hợp đồng chuyển sang chờ xác
        nhận.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/contracts/${contractId}/edit`}
          className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-800"
        >
          Chỉnh sửa bản nháp
        </Link>
        <Link
          href={`/admin/tenants/${tenantId}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
        >
          Hồ sơ và tài khoản người thuê
        </Link>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await directContractService.submit(contractId);
              await client.invalidateQueries();
            } catch (e) {
              setError(apiErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Đang gửi..." : "Gửi xác nhận hợp đồng"}
        </Button>
      </div>
    </section>
  );
}
