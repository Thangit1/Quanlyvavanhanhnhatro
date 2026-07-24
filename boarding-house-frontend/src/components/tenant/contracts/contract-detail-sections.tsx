import Link from "next/link";
import {
  Bot, Building2, ChevronDown, Download, ExternalLink, FileText, Home,
  Info, PackageOpen, Users, WalletCards, Zap,
} from "lucide-react";
import { formatCurrency, formatDate, statusLabel } from "@/lib/format";
import type { ContractDetail } from "@/types/tenant-contract";
import { EmptyState, StatusBadge } from "@/components/shared/dashboard-ui";

export function DetailPanel({ title, icon: Icon, children, className = "" }: {
  title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string;
}) {
  return <section className={`break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon className="size-5 text-blue-600" />{title}</h2>
    <div className="mt-5">{children}</div>
  </section>;
}
function Description({ items }: { items: Array<[string, React.ReactNode]> }) {
  return <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{items.map(([label, value]) =>
    <div key={label} className="border-b border-slate-100 pb-3"><dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-800">{value ?? "—"}</dd></div>)}</dl>;
}

export function ContractGeneralSections({ data }: { data: ContractDetail }) {
  return <>
    <DetailPanel title="Thông tin hợp đồng" icon={Info}>
      <Description items={[
        ["Mã hợp đồng", data.contractCode], ["Loại hợp đồng", data.contractType === "FIXED_TERM" ? "Có thời hạn" : statusLabel(data.contractType)],
        ["Ngày bắt đầu", formatDate(data.startDate)], ["Ngày kết thúc", formatDate(data.endDate)],
        ["Chu kỳ thanh toán", data.paymentCycle === "MONTHLY" ? "Hàng tháng" : statusLabel(data.paymentCycle)],
        ["Ngày thanh toán", `Ngày ${data.paymentDueDay} hàng tháng`], ["Ngày ký", formatDate(data.signedAt)],
        ["Thời gian báo trước", `${data.noticePeriodDays} ngày`],
      ]} />
    </DetailPanel>
    <DetailPanel title="Khu trọ và phòng" icon={Home}>
      <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
        <div className="grid h-28 place-items-center overflow-hidden rounded-2xl bg-blue-50 text-blue-600">
          {data.room.imageUrl ? <span role="img" aria-label={`Phòng ${data.room.roomCode}`} className="size-full bg-cover bg-center"
            style={{ backgroundImage: `url("${data.room.imageUrl.replaceAll('"', "%22")}")` }} /> : <Building2 className="size-10" />}
        </div>
        <Description items={[
          ["Khu trọ", data.property.name], ["Mã phòng", data.room.roomCode], ["Địa chỉ", data.property.address],
          ["Dãy / tầng", `${data.property.buildingName ?? "—"} / ${data.property.floorName ?? "—"}`],
          ["Loại phòng", data.room.roomType ?? "Chưa cập nhật"], ["Diện tích", data.room.area == null ? "—" : `${data.room.area} m²`],
          ["Số người", `${data.room.currentOccupants}/${data.room.maximumOccupants}`], ["Trạng thái", <StatusBadge key="room-status" status={data.room.status} />],
        ]} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 print:hidden"><Link href="/tenant/room" className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700">Xem thông tin phòng</Link>
        <Link href="/tenant/rules" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Nội quy khu trọ</Link></div>
    </DetailPanel>
    <DetailPanel title="Thông tin các bên" icon={Users} className="xl:col-span-2">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4"><h3 className="font-bold text-slate-800">Bên cho thuê</h3>
          <Description items={[["Họ tên", data.landlord.fullName], ["Điện thoại", data.landlord.phone], ["Email", data.landlord.email], ["Địa chỉ liên hệ", data.landlord.address]]} /></div>
        <div className="rounded-xl bg-blue-50 p-4"><h3 className="font-bold text-blue-900">Bên thuê</h3>
          <Description items={[["Họ tên", data.tenant.fullName], ["Điện thoại", data.tenant.phone], ["Email", data.tenant.email],
            ["Vai trò", data.tenant.role === "REPRESENTATIVE" ? "Người đại diện thuê" : "Người ở cùng"],
            ["Giấy tờ", data.tenant.maskedIdentityNumber ?? "Không hiển thị"]]} /></div>
      </div>
    </DetailPanel>
  </>;
}

export function ContractFinancialSections({ data }: { data: ContractDetail }) {
  const rates = [...data.utilityRates, ...data.services.map((item) => ({ ...item, unit: item.billingCycle }))];
  return <>
    <DetailPanel title="Chi phí theo hợp đồng" icon={WalletCards}>
      <Description items={[
        ["Tiền thuê hàng tháng", formatCurrency(data.financial.monthlyRent)], ["Tiền đặt cọc", formatCurrency(data.financial.depositAmount)],
        ["Tiền giữ chỗ", formatCurrency(data.financial.reservationAmount)], ["Phí quản lý", formatCurrency(data.financial.managementFee)],
        ["Phí dịch vụ cố định", formatCurrency(data.financial.fixedServiceFee)], ["Giảm giá", formatCurrency(data.financial.discountAmount)],
      ]} />
      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Các mức phí trên là giá trị đã được backend xác nhận trong hợp đồng.</p>
    </DetailPanel>
    <DetailPanel title="Điện, nước và dịch vụ" icon={Zap}>
      {!rates.length ? <EmptyState text="Hợp đồng chưa đăng ký dịch vụ bổ sung." /> :
      <div className="space-y-3">{rates.map((item) => <div key={`${item.code}-${item.id}`} className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
        <div><p className="font-semibold text-slate-800">{item.name}</p><p className="text-xs text-slate-500">
          {statusLabel(item.calculationMethod)} · Áp dụng {formatDate(item.effectiveDate)}</p></div>
        <div className="text-left sm:text-right"><p className="font-bold text-blue-700">{formatCurrency(item.unitPrice)}</p><p className="text-xs text-slate-500">/{item.unit}</p></div>
      </div>)}</div>}
    </DetailPanel>
  </>;
}

export function ContractPeopleAssets({ data }: { data: ContractDetail }) {
  return <>
    <DetailPanel title="Người ở cùng" icon={Users}>
      {!data.occupants.length ? <EmptyState text="Hiện chưa có người ở cùng được đăng ký." /> :
      <div className="space-y-3">{data.occupants.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{item.fullName}</p><StatusBadge status={item.residenceStatus} /></div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Quan hệ</dt><dd>{item.relationship ?? "—"}</dd></div>
          <div><dt className="text-slate-500">Ngày chuyển vào</dt><dd>{formatDate(item.moveInDate)}</dd></div>
          <div><dt className="text-slate-500">Tạm trú</dt><dd>{statusLabel(item.temporaryResidenceStatus)}</dd></div>
          <div><dt className="text-slate-500">Giấy tờ</dt><dd>{item.maskedIdentityNumber ?? "Không hiển thị"}</dd></div></dl>
      </article>)}</div>}
      <Link href="/tenant/occupants/request" className="mt-4 inline-flex rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 print:hidden">
        Đăng ký người ở cùng</Link>
      <p className="mt-2 text-xs text-slate-500">Yêu cầu cần được quản lý phê duyệt trước khi thêm vào hợp đồng.</p>
    </DetailPanel>
    <DetailPanel title="Tài sản bàn giao" icon={PackageOpen}>
      {!data.assets.length ? <EmptyState text="Chưa có thông tin tài sản bàn giao." /> :
      <div className="space-y-3">{data.assets.map((asset) => <article key={asset.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex justify-between gap-3"><p className="font-semibold">{asset.name}</p><span className="text-sm font-bold text-blue-700">× {asset.quantity}</span></div>
        <p className="mt-2 text-sm"><span className="text-slate-500">Tình trạng:</span> {asset.handoverCondition}</p>
        {asset.note && <p className="mt-1 text-sm text-slate-600">{asset.note}</p>}</article>)}</div>}
    </DetailPanel>
  </>;
}

export function ContractTermsDocuments({ data, downloading, onDownload }: {
  data: ContractDetail; downloading: boolean; onDownload: () => void;
}) {
  return <>
    <DetailPanel title="Điều khoản và quy định" icon={FileText} className="xl:col-span-2">
      {!data.terms.length ? <EmptyState text="Chưa có điều khoản chi tiết được công bố." /> :
      <div className="space-y-3">{data.terms.map((term, index) => <details key={term.id} open={index === 0} className="group rounded-xl border border-slate-200">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-100">
          {term.title}<ChevronDown className="size-5 transition group-open:rotate-180" /></summary>
        <div className="border-t border-slate-100 p-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{term.content}</div>
      </details>)}</div>}
    </DetailPanel>
    <DetailPanel title="Tệp và tài liệu" icon={FileText}>
      {!data.documents.length ? <EmptyState text="Không tìm thấy tệp hợp đồng." /> :
      <div className="space-y-3">{data.documents.map((document) => <article key={document.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><FileText className="size-5" /></span>
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{document.originalName}</p>
            <p className="text-xs text-slate-500">{document.contentType} · {formatBytes(document.fileSize)} · {formatDate(document.uploadedAt)}</p></div>
          {document.downloadable && <button aria-label={`Tải ${document.originalName}`} onClick={onDownload} disabled={downloading}
            className="rounded-lg p-2 text-blue-700 hover:bg-blue-50 disabled:opacity-50 print:hidden"><Download className="size-5" /></button>}</div>
      </article>)}</div>}
    </DetailPanel>
    <DetailPanel title="Lịch sử hợp đồng" icon={ExternalLink}>
      {!data.history.length ? <EmptyState text="Chưa có lịch sử hợp đồng dành cho khách thuê." /> :
      <ol className="relative ml-2 border-l border-blue-200 pl-5">{data.history.map((event) => <li key={event.id} className="relative pb-5 last:pb-0">
        <span className="absolute -left-[1.7rem] top-1 size-3 rounded-full border-2 border-white bg-blue-600" />
        <time className="text-xs text-slate-500">{formatDate(event.occurredAt, true)}</time><p className="mt-1 text-sm font-semibold">{event.description}</p>
        <p className="text-xs text-slate-500">{event.actorName ?? "Hệ thống"}{event.note ? ` · ${event.note}` : ""}</p></li>)}</ol>}
    </DetailPanel>
    <DetailPanel title="SmartHome AI hỗ trợ hợp đồng" icon={Bot} className="xl:col-span-2 print:hidden">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5"><p className="font-semibold text-blue-900">Trợ lý AI chưa được cấu hình</p>
        <p className="mt-2 text-sm text-slate-700">Khi backend AI sẵn sàng, trợ lý sẽ chỉ giải thích nội dung hợp đồng này và không tự sửa hoặc gửi yêu cầu thay bạn.</p>
        <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-amber-800"><Info className="mt-0.5 size-4 shrink-0" />
          Nội dung AI chỉ nhằm hỗ trợ giải thích. Hợp đồng chính thức là căn cứ được ưu tiên và không phải tư vấn pháp lý.</p></div>
    </DetailPanel>
  </>;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
