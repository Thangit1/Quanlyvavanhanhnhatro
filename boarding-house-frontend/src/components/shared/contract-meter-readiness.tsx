"use client";
import Link from "next/link";
import { useAdminRoom } from "@/hooks/use-admin-properties";

export function ContractMeterReadiness({
  roomId,
  requiredTypes,
}: {
  roomId: number;
  requiredTypes: string[];
}) {
  const room = useAdminRoom(requiredTypes.length ? roomId : 0);
  if (!roomId || !requiredTypes.length) return null;
  const link = (
    <Link
      className="font-semibold text-link underline"
      href={`/admin/rooms/${roomId}/edit#room-meters`}
      target="_blank"
      rel="noopener noreferrer"
    >
      Quản lý công tơ của phòng (mở tab mới)
    </Link>
  );
  if (room.isError)
    return (
      <aside
        role="alert"
        className="rounded-xl border border-amber-300 bg-warning-muted p-4 text-sm"
      >
        Chưa kiểm tra được công tơ. {link}
      </aside>
    );
  if (!room.data)
    return <p className="text-sm">Đang kiểm tra công tơ của phòng…</p>;
  const missing = requiredTypes.filter(
    (type) =>
      !room.data.meters.some(
        (m) => m.meterType === type && m.status === "ACTIVE",
      ),
  );
  if (!missing.length)
    return (
      <aside className="rounded-xl bg-accent p-3 text-sm">
        Đã có công tơ hoạt động cho các loại tính theo số đo. Khi bàn giao vẫn
        phải đối chiếu mã công tơ và chỉ số thực tế. {link}
      </aside>
    );
  return (
    <aside
      role="alert"
      className="space-y-2 rounded-xl border border-amber-300 bg-warning-muted p-4 text-sm text-amber-950"
    >
      <p className="font-semibold">
        Thiếu công tơ hoạt động:{" "}
        {missing.map((t) => (t === "ELECTRICITY" ? "Điện" : "Nước")).join(", ")}
        .
      </p>
      <p>
        Chính sách hợp đồng tính theo công tơ. Cần đăng ký công tơ thực tế trước
        khi chốt bàn giao; có thể lưu hợp đồng để chuẩn bị thủ tục.
      </p>
      {link}
      <p>Lắp công tơ không tự thay chỉ số hoặc xác nhận biên bản bàn giao.</p>
    </aside>
  );
}
