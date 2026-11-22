"use client";
import type { RoomDetail } from "@/types/admin-property";
import { formatDate } from "@/lib/format";
import { InitialRoomMeterForm } from "./initial-room-meter-form";

export function RoomMeterManagement({ detail: d }: { detail: RoomDetail }) {
  return (
    <section
      id="room-meters"
      className="scroll-mt-6 space-y-4 surface-card p-6 "
    >
      <h2 className="text-lg font-bold">Quản lý công tơ điện &amp; nước</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {["ELECTRICITY", "WATER"].map((type) => {
          const meter = d.meters.find((m) => m.meterType === type);
          return (
            <div key={type} className="space-y-1 rounded-xl border p-4 text-sm">
              <h3 className="font-semibold">
                {type === "ELECTRICITY"
                  ? "Công tơ điện hiện tại"
                  : "Công tơ nước hiện tại"}
              </h3>
              {meter ? (
                <dl className="space-y-1">
                  <div>
                    <dt>Mã công tơ</dt>
                    <dd>{meter.meterCode}</dd>
                  </div>
                  <div>
                    <dt>Chỉ số gần nhất</dt>
                    <dd>
                      {meter.currentReading}{" "}
                      {type === "ELECTRICITY" ? "kWh" : "m³"}
                    </dd>
                  </div>
                  <div>
                    <dt>Ngày ghi nhận</dt>
                    <dd>
                      {meter.readingDate
                        ? formatDate(meter.readingDate)
                        : "Chưa ghi nhận"}
                    </dd>
                  </div>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd>
                      {meter.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Ngừng hoạt động"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p>Chưa đăng ký công tơ.</p>
              )}
            </div>
          );
        })}
      </div>
      {d.meterManagement?.canInstall ? (
        <InitialRoomMeterForm
          roomId={d.room.id}
          installableTypes={d.meterManagement.installableTypes}
        />
      ) : (
        <p className="text-sm text-secondary-foreground">
          {d.meterManagement?.reason ??
            "Chưa có thông tin điều kiện lắp đặt. Hãy tải lại hoặc kiểm tra quyền quản lý."}
        </p>
      )}
      <p className="text-xs text-secondary-foreground">
        Phòng đang sử dụng phải thay công tơ qua quy trình điện nước theo kỳ,
        ghi chỉ số tháo/lắp và chứng từ; không dùng lắp ban đầu để sửa số đo.
      </p>
      <details>
        <summary className="cursor-pointer font-semibold">
          Lịch sử lắp đặt và thay thế
        </summary>
        {!d.meterManagement?.events.length ? (
          <p className="mt-2 text-sm">
            Chưa có lịch sử được ghi nhận trong phạm vi được phép.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {d.meterManagement.events.map((e) => (
              <li
                key={String(e.id)}
                className="rounded-xl bg-muted p-3 text-sm"
              >
                <p className="font-semibold">
                  {e.meter_type === "ELECTRICITY" ? "Điện" : "Nước"} ·{" "}
                  {e.old_code === "INITIAL" ? "Lắp ban đầu" : `${e.old_code} →`}{" "}
                  {String(e.new_code)}
                </p>
                <p>
                  Chỉ số trước: {String(e.removed_reading ?? e.old_reading)} ·
                  Chỉ số lắp: {String(e.new_reading)}
                </p>
                <p>
                  {String(e.reason)} · Chứng từ: {String(e.evidence_reference)}
                </p>
                <p>
                  {formatDate(String(e.occurred_at), true)} ·{" "}
                  {String(e.actor_name)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
