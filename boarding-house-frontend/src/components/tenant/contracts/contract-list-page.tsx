"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileCheck2, FileClock, Files, History, Search } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTenantContracts } from "@/hooks/use-tenant-contracts";
import { tenantContractService } from "@/services/tenant-contract.service";
import type { ContractSummary } from "@/types/tenant-contract";
import { EmptyState, ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
import { ContractCard } from "./contract-card";

type Tab = "CURRENT" | "EXPIRING" | "HISTORY";
const tabs: Array<[Tab, string]> = [["CURRENT", "Hợp đồng hiện tại"], ["EXPIRING", "Sắp hết hạn"], ["HISTORY", "Lịch sử hợp đồng"]];

export function ContractListPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("CURRENT");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("endDate,desc");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useTenantContracts(user?.activeRole === "TENANT", { page: 0, size: 50, sort });
  const contracts = useMemo(() => query.data?.content ?? [], [query.data?.content]);
  const groups = useMemo(() => ({
    current: contracts.filter((item) => ["ACTIVE", "PENDING_CONFIRMATION", "TERMINATION_REQUESTED"].includes(item.status)),
    expiring: contracts.filter((item) => item.status === "EXPIRING"),
    history: contracts.filter((item) => ["EXPIRED", "TERMINATED", "CANCELLED"].includes(item.status)),
  }), [contracts]);
  const visible = useMemo(() => {
    const source = tab === "CURRENT" ? groups.current : tab === "EXPIRING" ? groups.expiring : groups.history;
    const term = search.trim().toLocaleLowerCase("vi");
    return !term ? source : source.filter((item) =>
      `${item.contractCode} ${item.roomCode} ${item.propertyName}`.toLocaleLowerCase("vi").includes(term));
  }, [groups, search, tab]);

  async function download(contract: ContractSummary) {
    setActionError(null); setDownloading(contract.id);
    try {
      const response = await tenantContractService.downloadContract(contract.id);
      const disposition = response.headers["content-disposition"] as string | undefined;
      const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const fallback = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
      const fileName = encoded ? decodeURIComponent(encoded) : fallback ?? `${contract.contractCode}.pdf`;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setActionError("Không thể tải tệp hợp đồng. Vui lòng thử lại."); }
    finally { setDownloading(null); }
  }
  if (query.isLoading) return <PageLoading />;

  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500"><Link href="/tenant/home" className="hover:text-blue-700">Trang chủ</Link><span aria-hidden="true"> / </span><span>Hợp đồng</span></nav>
    <header><h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Hợp đồng thuê phòng</h1>
      <p className="mt-2 text-slate-500">Theo dõi hợp đồng hiện tại và lịch sử thuê phòng của bạn.</p></header>
    {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
    {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}
    {query.data && <>
      <section aria-label="Tóm tắt hợp đồng" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ value: query.data.totalElements, label: "Tổng hợp đồng", Icon: Files, colors: "bg-blue-50 text-blue-700" },
          { value: groups.current.length, label: "Đang hiệu lực", Icon: FileCheck2, colors: "bg-emerald-50 text-emerald-700" },
          { value: groups.expiring.length, label: "Sắp hết hạn", Icon: FileClock, colors: "bg-amber-50 text-amber-700" },
          { value: groups.history.length, label: "Đã kết thúc", Icon: History, colors: "bg-slate-100 text-slate-700" }].map(({ value, label, Icon, colors }) =>
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span>
              <span className={`grid size-9 place-items-center rounded-xl ${colors}`}><Icon className="size-5" /></span></div>
            <p className="mt-3 text-3xl font-extrabold text-slate-900">{value}</p></article>)}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Loại hợp đồng" className="flex overflow-x-auto rounded-xl bg-slate-100 p-1">
            {tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>{label}</button>)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><span className="sr-only">Tìm hợp đồng</span>
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Mã hợp đồng hoặc phòng" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-64" /></label>
            <label><span className="sr-only">Sắp xếp</span><select value={sort} onChange={(event) => setSort(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:w-auto">
              <option value="endDate,desc">Ngày kết thúc mới nhất</option><option value="endDate,asc">Sắp hết hạn trước</option>
              <option value="startDate,desc">Ngày bắt đầu mới nhất</option></select></label></div>
        </div>
      </section>
      <section aria-live="polite" className="space-y-4">{visible.length ? visible.map((contract) =>
        <ContractCard key={contract.id} contract={contract} downloading={downloading === contract.id} onDownload={download} />) :
        <EmptyState text={contracts.length ? "Không có hợp đồng phù hợp với bộ lọc." : "Bạn chưa có hợp đồng thuê phòng."} />}</section>
    </>}
  </main>;
}
