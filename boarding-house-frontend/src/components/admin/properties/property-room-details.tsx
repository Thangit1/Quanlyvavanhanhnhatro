"use client";
import Link from "next/link";
import { RoomGallery } from "@/components/shared/room-images";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useManagementScope } from "@/providers/management-scope";
import { useAuth } from "@/providers/auth-provider";
import { EmptyState, StatusBadge } from "@/components/shared/dashboard-ui";
import { RoomMeterManagement } from "@/components/shared/room-meter-management";
import { WorkspaceTabs } from "./room-workspace-ui";
import { RoomListPage } from "./room-list-workspace";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import type { RoomDetail } from "@/types/admin-property";

export function RoomDetailSections({ detail }: { detail: RoomDetail }) {
  const search = useSearchParams();
  const scope = useManagementScope();
  const { user } = useAuth();
  const room = detail.room;
  const finance = scope.canReadFinanceFor(room.propertyId);
  const write = user?.activeRole === "OWNER" || user?.activeRole === "MANAGER";
  const tabs = [
    { id: "overview", label: "Tổng quan" },
    { id: "tenants", label: "Người thuê" },
    { id: "contract", label: "Hợp đồng" },
    { id: "utilities", label: "Điện nước" },
    ...(finance
      ? [
          { id: "services", label: "Dịch vụ" },
          { id: "invoices", label: "Hóa đơn và công nợ" },
        ]
      : []),
    { id: "assets", label: "Tài sản và thiết bị" },
    ...(write ? [{ id: "maintenance", label: "Bảo trì" }] : []),
    { id: "history", label: "Lịch sử hoạt động" },
  ];
  const requested = search.get("tab") ?? "overview";
  const [tab, setTab] = useState(requested);
  const active = tabs.some((t) => t.id === tab) ? tab : "overview";
  const context = `propertyId=${room.propertyId}&roomId=${room.id}`;
  return (
    <div className="space-y-4">
      <WorkspaceTabs tabs={tabs} value={active} onChange={setTab} />
      <div hidden={active !== "overview"}>
        <RoomGallery images={detail.images} cover={room.thumbnailUrl} />
        <Panel title="Thông tin phòng">
          <p className="whitespace-pre-wrap text-sm text-secondary-foreground">
            {detail.description || "Chưa có mô tả."}
          </p>
          <p className="mt-3 text-sm">
            {room.area == null ? "Chưa khai báo diện tích" : `${room.area} m²`}{" "}
            · {room.currentOccupants}/{room.maxOccupants} người
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Mã phòng, trạng thái sử dụng, trạng thái hợp đồng và trạng thái
            thanh toán được theo dõi độc lập.
          </p>
          {finance && (room.overdueInvoiceCount ?? 0) > 0 && (
            <p className="mt-3 text-sm text-danger">
              {room.overdueInvoiceCount} hóa đơn quá hạn. Cảnh báo không thay
              đổi trạng thái phòng.
            </p>
          )}
        </Panel>
      </div>
      <div hidden={active !== "tenants"}>
        <Panel title="Người đang ở">
          {!detail.occupants.length ? (
            <EmptyState text="Chưa có người ở." />
          ) : (
            detail.occupants.map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm"
              >
                <span className="font-semibold">
                  {p.fullName}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {p.representative ? "Đại diện" : "Ở cùng"}
                  </span>
                </span>
                <span className="text-muted-foreground">{p.phone}</span>
              </div>
            ))
          )}
          {write && (
            <Go href={`/admin/tenants?${context}`}>Quản lý người đang ở</Go>
          )}
        </Panel>
      </div>
      <div hidden={active !== "contract"}>
        <Panel title="Hợp đồng liên quan">
          {room.currentContract ? (
            <>
              <StatusBadge status={room.currentContract.status} />
              <p className="mt-3 font-semibold">{room.currentContract.code}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDate(room.currentContract.startDate)} —{" "}
                {formatDate(room.currentContract.endDate)}
              </p>
              <Go href={`/admin/contracts/${room.currentContract.id}`}>
                Mở đúng hợp đồng
              </Go>
            </>
          ) : (
            <EmptyState text="Chưa có hợp đồng liên quan." />
          )}
        </Panel>
      </div>
      <div hidden={active !== "utilities"}>
        <RoomMeterManagement detail={detail} />
        <p className="mt-3 text-sm text-muted-foreground">
          Chỉ lắp đồng hồ khi được backend cho phép. Ghi chỉ số định kỳ theo hợp
          đồng đang vận hành.
        </p>
        {finance && (
          <Go href={`/admin/invoices?${context}`}>
            Hóa đơn và chỉ số kỳ dịch vụ
          </Go>
        )}
      </div>
      {finance && (
        <div hidden={active !== "services"}>
          <Panel title="Dịch vụ và đơn giá">
            {room.currentContract ? (
              <Go href={`/admin/contracts/${room.currentContract.id}`}>
                Mở dịch vụ và đơn giá của hợp đồng
              </Go>
            ) : (
              <EmptyState text="Chưa có hợp đồng để áp dụng dịch vụ. Không tự gán đơn giá giả định." />
            )}
          </Panel>
        </div>
      )}
      {finance && (
        <div hidden={active !== "invoices"}>
          <Panel title="Hóa đơn và công nợ">
            <p className="text-sm">
              Còn phải thu:{" "}
              <strong>{formatCurrency(room.outstandingDebt)}</strong>
            </p>
            <Go href={`/admin/invoices?${context}`}>Mở hóa đơn của phòng</Go>
          </Panel>
        </div>
      )}
      <div hidden={active !== "assets"}>
        <Panel title="Tiện ích, tài sản và thiết bị">
          <div className="flex flex-wrap gap-2">
            {detail.amenities.map((a) => (
              <span
                key={a.id}
                className="rounded-full bg-accent px-3 py-1 text-sm text-link"
              >
                {a.name}
              </span>
            ))}
          </div>
          {!detail.assets.length && !detail.amenities.length && (
            <EmptyState text="Chưa khai báo tài sản hoặc tiện ích." />
          )}
          {detail.assets.map((a, i) => (
            <div
              key={a.id ?? i}
              className="mt-3 flex flex-wrap justify-between gap-2 rounded-lg bg-muted p-3 text-sm"
            >
              <span>
                {a.name} × {a.quantity}
              </span>
              <span>{statusLabel(a.conditionStatus)}</span>
            </div>
          ))}
        </Panel>
      </div>
      {write && (
        <div hidden={active !== "maintenance"}>
          <Panel title="Bảo trì">
            <p className="text-sm">
              {room.openMaintenanceCount} công việc chưa hoàn tất. Nghiệm thu
              bảo trì và xác nhận sẵn sàng được thực hiện theo quy trình hiện
              có.
            </p>
            <Go href={`/admin/maintenance?${context}`}>
              Xem công việc, người phụ trách và tiến độ
            </Go>
            <Go href={`/admin/maintenance/new?${context}`}>
              Tạo yêu cầu bảo trì cho phòng
            </Go>
          </Panel>
        </div>
      )}
      <div hidden={active !== "history"} className="space-y-4">
        <Panel title="Lịch sử giá">
          {!detail.priceHistory.length ? (
            <EmptyState text="Chưa có thay đổi giá." />
          ) : (
            detail.priceHistory.map((h) => (
              <div key={h.id} className="border-b py-3 text-sm">
                <strong>
                  {formatCurrency(Number(h.fromValue))} →{" "}
                  {formatCurrency(Number(h.toValue))}
                </strong>
                <p className="mt-1 text-muted-foreground">
                  {formatDate(h.effectiveDate)} ·{" "}
                  {h.reason || "Không có ghi chú"}
                </p>
              </div>
            ))
          )}
        </Panel>
        <Panel title="Lịch sử trạng thái và hoạt động">
          {!detail.statusHistory.length && !detail.activities.length && (
            <EmptyState text="Chưa có lịch sử hoạt động." />
          )}
          {detail.statusHistory.map((h) => (
            <div key={`s-${h.id}`} className="border-b py-3 text-sm">
              <strong>
                {statusLabel(h.fromValue)} → {statusLabel(h.toValue)}
              </strong>
              <p className="mt-1 text-muted-foreground">
                {h.reason} · {h.actorName} · {formatDate(h.createdAt, true)}
              </p>
            </div>
          ))}
          {detail.activities.map((a) => (
            <div key={`a-${a.id}`} className="border-b py-3 text-sm">
              <p>{a.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {a.actorName} · {formatDate(a.createdAt, true)}
              </p>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
export function PropertyRelatedTab({
  tab,
  propertyId,
}: {
  tab: string;
  propertyId: number;
}) {
  if (tab === "map" || tab === "rooms")
    return (
      <RoomListPage
        key={tab}
        embedded
        fixedPropertyId={propertyId}
        initialView={tab === "map" ? "cards" : "table"}
      />
    );
  const context = `propertyIds=${propertyId}`;
  if (tab === "services")
    return (
      <Panel title="Dịch vụ và đơn giá">
        <Go href={`/admin/reports/utilities?${context}`}>
          Theo dõi điện nước và dịch vụ của nhà trọ
        </Go>
        <Go href={`/admin/contracts?propertyId=${propertyId}`}>
          Quản lý đơn giá theo hợp đồng
        </Go>
        <p className="mt-3 text-xs text-muted-foreground">
          Tái sử dụng danh mục và chính sách dịch vụ hiện có; không tự tạo bảng
          giá mới.
        </p>
      </Panel>
    );
  if (tab === "assets")
    return (
      <Panel title="Tài sản và thiết bị">
        <Go href={`/admin/rooms?propertyId=${propertyId}`}>
          Kiểm tra tài sản và thiết bị từng phòng
        </Go>
        <Go href={`/admin/reports/assets?${context}`}>
          Báo cáo tài sản theo nhà trọ
        </Go>
      </Panel>
    );
  if (tab === "reports")
    return (
      <Panel title="Báo cáo nhà trọ">
        <Go href={`/admin/reports/occupancy?${context}`}>Công suất phòng</Go>
        <Go href={`/admin/reports/revenue?${context}`}>Thực thu dịch vụ</Go>
        <Go href={`/admin/reports/debt?${context}`}>Hóa đơn và công nợ</Go>
        <Go href={`/admin/reports/expenses?${context}`}>Chi phí vận hành</Go>
      </Panel>
    );
  if (tab === "settings")
    return (
      <Panel title="Cấu hình nhà trọ">
        <Go href={`/admin/properties/${propertyId}/edit`}>Thông tin cơ sở</Go>
        <Go href={`/admin/settings/properties?propertyId=${propertyId}`}>
          Quy tắc cấu hình theo cơ sở
        </Go>
      </Panel>
    );
  return null;
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="mb-4 font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
function Go({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-3 block rounded-lg border border-accent-border bg-accent px-4 py-3 text-sm font-medium text-link"
    >
      {children} →
    </Link>
  );
}
