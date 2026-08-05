import { AlertTriangle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { statusLabel } from "@/lib/format";

export function PageLoading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-slate-50"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-slate-600">
        <LoaderCircle className="size-6 animate-spin text-blue-600" />
        Đang tải dữ liệu...
      </div>
    </main>
  );
}
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
    >
      <AlertTriangle className="mx-auto size-8 text-red-600" />
      <p className="mt-3 font-semibold text-red-800">
        Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.
      </p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-semibold text-white"
      >
        <RefreshCw className="size-4" />
        Thử lại
      </button>
    </div>
  );
}
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
      <Inbox className="mx-auto mb-2 size-8 text-slate-400" />
      {text}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const warning = ["OVERDUE", "URGENT", "IMPORTANT"].includes(status);
  const success = ["PAID", "ACTIVE", "COMPLETED", "OCCUPIED"].includes(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        warning
          ? "bg-red-100 text-red-700"
          : success
            ? "bg-emerald-100 text-emerald-700"
            : "bg-blue-100 text-blue-700"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}
