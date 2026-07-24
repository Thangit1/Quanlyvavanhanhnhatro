"use client";

import Link from "next/link";
import { useState } from "react";
import axios from "axios";
import { AlertTriangle, ArrowLeft, Download, LoaderCircle, Printer, RotateCcw } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTenantContract } from "@/hooks/use-tenant-contracts";
import { tenantContractService } from "@/services/tenant-contract.service";
import { formatDate } from "@/lib/format";
import type { ContractDetail } from "@/types/tenant-contract";
import { EmptyState, ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { ContractStatusBadge } from "./contract-status-badge";
import {
  ContractFinancialSections, ContractGeneralSections, ContractPeopleAssets,
  ContractTermsDocuments,
} from "./contract-detail-sections";
import { ExtensionRequestDialog, TerminationRequestDialog } from "./request-dialogs";

type Dialog = "extension" | "termination" | null;

export function ContractDetailPage({ contractId, initialAction = null }: {
  contractId: number; initialAction?: Dialog;
}) {
  const { user } = useAuth();
  const query = useTenantContract(user?.activeRole === "TENANT", contractId);
  const [dialog, setDialog] = useState<Dialog>(initialAction);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  if (!Number.isSafeInteger(contractId) || contractId < 1) return <EmptyState text="Không tìm thấy hợp đồng." />;
  if (query.isLoading) return <PageLoading />;
  if (query.isError) {
    const status = axios.isAxiosError(query.error) ? query.error.response?.status : undefined;
    if (status === 403) return <main className="mx-auto max-w-4xl p-6"><EmptyState text="Bạn không có quyền xem hợp đồng này." /></main>;
    if (status === 404) return <main className="mx-auto max-w-4xl p-6"><EmptyState text="Không tìm thấy hợp đồng." /></main>;
    return <main className="mx-auto max-w-4xl p-6"><ErrorState onRetry={() => void query.refetch()} /></main>;
  }
  const data = query.data;
  if (!data) return null;
  const currentContract = data;

  async function getDocument(preview: boolean) {
    setActionError(null); setDownloading(true);
    const popup = preview ? window.open("", "_blank", "noopener,noreferrer") : null;
    try {
      const response = await tenantContractService.downloadContract(currentContract.id);
      const url = URL.createObjectURL(response.data);
      if (preview && popup) {
        popup.location.href = url;
        window.setTimeout(() => { popup.focus(); popup.print(); }, 1000);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const disposition = response.headers["content-disposition"] as string | undefined;
        const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        const fallback = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
        const anchor = document.createElement("a"); anchor.href = url;
        anchor.download = encoded ? decodeURIComponent(encoded) : fallback ?? `${currentContract.contractCode}.pdf`; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      popup?.close(); setActionError("Không tìm thấy tệp hợp đồng hoặc bạn không có quyền tải tệp.");
    } finally { setDownloading(false); }
  }
  const alert = contractAlert(data);

  return <main className="contract-print-area mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500 print:hidden"><Link href="/tenant/home" className="hover:text-blue-700">Trang chủ</Link>
      <span aria-hidden="true"> / </span><Link href="/tenant/contracts" className="hover:text-blue-700">Hợp đồng</Link><span aria-hidden="true"> / </span><span>{data.contractCode}</span></nav>
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <Link href="/tenant/contracts" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 print:hidden"><ArrowLeft className="size-4" />Quay lại danh sách</Link>
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{data.contractCode}</h1>
          <ContractStatusBadge status={data.status} /></div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500"><span>Ngày tạo: {formatDate(data.createdAt)}</span>
            <span>Ngày ký: {formatDate(data.signedAt)}</span><span>Còn lại: <strong className="text-slate-800">{data.daysRemaining} ngày</strong></span></div></div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {data.permissions.canDownload && <button onClick={() => void getDocument(false)} disabled={downloading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
            {downloading ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}Tải PDF</button>}
          {data.permissions.canPrint && <button onClick={() => void getDocument(true)} disabled={downloading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"><Printer className="size-4" />In hợp đồng</button>}
          {data.permissions.canRequestExtension && <button onClick={() => setDialog("extension")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${data.status === "EXPIRING" ? "bg-amber-500 text-white" : "bg-blue-600 text-white"}`}>
            <RotateCcw className="size-4" />Yêu cầu gia hạn</button>}
          {data.permissions.canRequestTermination && <button onClick={() => setDialog("termination")}
            className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">Yêu cầu trả phòng</button>}
        </div>
      </div>
    </header>
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{notice}</div>}
    {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}
    {alert && <div role="status" className={`flex gap-3 rounded-xl border p-4 ${alert.urgent ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      <AlertTriangle className="mt-0.5 size-5 shrink-0" /><p className="text-sm font-semibold">{alert.message}</p></div>}
    <div className="grid gap-6 xl:grid-cols-2"><ContractGeneralSections data={data} /><ContractFinancialSections data={data} />
      <ContractPeopleAssets data={data} /><ContractTermsDocuments data={data} downloading={downloading} onDownload={() => void getDocument(false)} /></div>
    {dialog === "extension" && data.permissions.canRequestExtension && <ExtensionRequestDialog contract={data} onClose={() => setDialog(null)} onSuccess={setNotice} />}
    {dialog === "termination" && data.permissions.canRequestTermination && <TerminationRequestDialog contract={data} onClose={() => setDialog(null)} onSuccess={setNotice} />}
  </main>;
}

function contractAlert(data: ContractDetail) {
  if (data.terminationRequest) return { urgent: true, message: "Yêu cầu trả phòng đã được gửi và đang chờ quản lý xác nhận." };
  if (data.extensionRequest) return { urgent: false, message: "Yêu cầu gia hạn của bạn đang được quản lý xem xét." };
  if (["EXPIRED", "TERMINATED", "CANCELLED"].includes(data.status)) return { urgent: true, message: "Hợp đồng này đã hết hiệu lực." };
  if (data.daysRemaining <= 7) return { urgent: true, message: "Hợp đồng sắp hết hạn. Vui lòng gửi yêu cầu gia hạn hoặc liên hệ quản lý." };
  if (data.daysRemaining <= 30) return { urgent: false, message: `Sau ${data.daysRemaining} ngày, hợp đồng của bạn sẽ hết hạn.` };
  return null;
}
